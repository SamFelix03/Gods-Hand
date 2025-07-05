import os
import requests
import traceback
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from web3 import Web3
from openai import OpenAI

# Load env
load_dotenv()
CMC_API_KEY = os.getenv("X_CMC_PRO_API_KEY")
AGENT_API_KEY = os.getenv("verifyagent")

# Config
RPC_URL = os.getenv("FLOW_RPC_URL")
CONTRACT_ADDRESS = os.getenv("FLOW_CONTRACT_ADDRESS")
CMC_URL = 'https://pro-api.coinmarketcap.com/v2/cryptocurrency/quotes/latest?symbol=FLOW&convert=USD'

# Init
app = FastAPI()
client = OpenAI(base_url="https://api.mosaia.ai/v1/agent", api_key=AGENT_API_KEY)

# ABI
CONTRACT_ABI = [
    {
        "inputs": [{"internalType": "bytes32", "name": "_disasterHash", "type": "bytes32"}],
        "name": "getDisasterFunds",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{"internalType": "bytes32", "name": "_disasterHash", "type": "bytes32"}],
        "name": "getDisasterDetails",
        "outputs": [
            {"internalType": "string", "name": "", "type": "string"},
            {"internalType": "string", "name": "", "type": "string"},
            {"internalType": "uint256", "name": "", "type": "uint256"},
            {"internalType": "uint256", "name": "", "type": "uint256"},
            {"internalType": "address", "name": "", "type": "address"},
            {"internalType": "uint256", "name": "", "type": "uint256"},
            {"internalType": "bool", "name": "", "type": "bool"}
        ],
        "stateMutability": "view",
        "type": "function"
    }
]

# Request Schema
class FactCheckInput(BaseModel):
    statement: str
    disaster_hash: str

# === Utility: Get USD price of FLOW ===
def get_usd_price_of_flow():
    try:
        headers = {"X-CMC_PRO_API_KEY": CMC_API_KEY}
        print("[INFO] Fetching FLOW price from CoinMarketCap...")
        res = requests.get(CMC_URL, headers=headers)
        res.raise_for_status()
        data = res.json()
        for entry in data["data"]["FLOW"]:
            if entry["name"] == "Flow":
                price = entry["quote"]["USD"]["price"]
                print(f"[INFO] FLOW price: ${price:.4f}")
                return price
    except Exception as e:
        print(f"[ERROR] CMC price fetch failed: {e}")
    return None

# === Utility: Get balance of disaster pool ===
def get_disaster_balance(disaster_hash: str):
    try:
        print("[INFO] Connecting to Flow EVM...")
        web3 = Web3(Web3.HTTPProvider(RPC_URL))
        if not web3.is_connected():
            raise Exception("Cannot connect to Flow EVM Testnet")

        contract = web3.eth.contract(
            address=Web3.to_checksum_address(CONTRACT_ADDRESS),
            abi=CONTRACT_ABI
        )

        if disaster_hash.startswith("0x"):
            disaster_hash = disaster_hash[2:]
        if len(disaster_hash) != 64:
            raise Exception("Invalid disaster_hash length")

        disaster_bytes = bytes.fromhex(disaster_hash)

        print("[INFO] Fetching disaster details...")
        details = contract.functions.getDisasterDetails(disaster_bytes).call()
        if not details[0]:
            raise Exception("Disaster not found")

        print("[INFO] Fetching disaster balance...")
        balance = contract.functions.getDisasterFunds(disaster_bytes).call()
        balance_eth = web3.from_wei(balance, 'ether')

        print(f"[INFO] Balance: {balance_eth} FLOW")

        usd_price = get_usd_price_of_flow()
        usd_value = float(balance_eth) * usd_price if usd_price else None

        return {
            "flow_balance": float(balance_eth),
            "usd_value": round(usd_value, 2) if usd_value is not None else None
        }
    except Exception as e:
        print(f"[ERROR] get_disaster_balance: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=str(e))

# === Endpoint: /fact-check ===
@app.post("/fact-check")
def fact_check(data: FactCheckInput):
    try:
        print(f"[INFO] Statement: {data.statement}")
        print(f"[INFO] Disaster Hash: {data.disaster_hash}")

        # === Get Disaster Pool Balance ===
        balance_data = get_disaster_balance(data.disaster_hash)
        usd_value = balance_data["usd_value"]

        # === Call Mosaia Agent with statement and USD value ===
        ai_message = (
            f"Petition: {data.statement}\n"
            f"Current available funds in pool: ${usd_value if usd_value is not None else 'Unknown'} USD.\n"
            "Based on the petition and the available funds, decide how much should be allocated from the pool. "
            "Respond with the amount to allocate, a brief reasoning, and a single source which shows that the NGO performed the work."
        )
        print("[INFO] Sending to AI:")
        print(ai_message)
        completion = client.chat.completions.create(
            model="686656aaf14ab5c885e431ce",
            messages=[{"role": "user", "content": ai_message}],
        )
        response_text = completion.choices[0].message.content.strip()
        print("[INFO] AI Response:")
        print(response_text)

        # === Basic Response ===
        return {
            "statement": data.statement,
            "disaster_hash": data.disaster_hash,
            "flow_balance": balance_data["flow_balance"],
            "usd_value": balance_data["usd_value"],
            "ai_response": response_text
        }

    except Exception as e:
        print(f"[ERROR] Main exception: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "disaster-relief-fact-checker"}

@app.get("/flow-price")
def get_flow_price():
    price = get_usd_price_of_flow()
    if price:
        return {"flow_price_usd": price}
    else:
        raise HTTPException(status_code=500, detail="Failed to fetch FLOW price")

@app.get("/blockchain-status")
def blockchain_status():
    try:
        web3 = Web3(Web3.HTTPProvider(RPC_URL))
        is_connected = web3.is_connected()
        latest_block = web3.eth.block_number if is_connected else None
        return {"connected": is_connected, "rpc_url": RPC_URL, "latest_block": latest_block}
    except Exception as e:
        return {"connected": False, "error": str(e)}

@app.get("/disaster-balance/{disaster_hash}")
def disaster_balance(disaster_hash: str):
    return get_disaster_balance(disaster_hash)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)