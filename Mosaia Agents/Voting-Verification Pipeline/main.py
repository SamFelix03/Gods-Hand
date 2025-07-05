import os
import requests
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from web3 import Web3

# Load env
load_dotenv()
CMC_API_KEY = os.getenv("X_CMC_PRO_API_KEY")

# Config
RPC_URL = os.getenv("FLOW_RPC_URL")
CONTRACT_ADDRESS = os.getenv("FLOW_CONTRACT_ADDRESS")
CMC_URL = 'https://pro-api.coinmarketcap.com/v2/cryptocurrency/quotes/latest?symbol=FLOW&convert=USD'

app = FastAPI()

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

# === Utility: Parse agent response ===
def parse_agent_response(response_text):
    """
    Parse agent response that could be in JSON, YAML, or custom format
    """
    print(f"[INFO] Attempting to parse response: {response_text[:200]}...")
    
    # First try JSON
    try:
        result = json.loads(response_text)
        print("[INFO] Successfully parsed as JSON")
        return result
    except json.JSONDecodeError:
        print("[INFO] Not valid JSON, trying YAML...")
    
    # Try YAML
    try:
        result = yaml.safe_load(response_text)
        if isinstance(result, dict):
            print("[INFO] Successfully parsed as YAML")
            return result
    except yaml.YAMLError:
        print("[INFO] Not valid YAML, trying custom parsing...")
    
    # Try custom parsing for key: value format
    try:
        result = {}
        lines = response_text.strip().split('\n')
        current_key = None
        current_value = []
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
                
            # Check if line contains a colon (key: value format)
            if ':' in line and not line.startswith(' '):
                # Save previous key-value pair
                if current_key:
                    value = '\n'.join(current_value).strip()
                    # Try to convert to appropriate type
                    if value.isdigit():
                        result[current_key] = int(value)
                    elif value.replace('.', '').isdigit():
                        result[current_key] = float(value)
                    elif value.lower() in ['true', 'false']:
                        result[current_key] = value.lower() == 'true'
                    else:
                        result[current_key] = value
                
                # Start new key-value pair
                parts = line.split(':', 1)
                current_key = parts[0].strip()
                current_value = [parts[1].strip()] if len(parts) > 1 and parts[1].strip() else []
            else:
                # Continuation of previous value
                if current_key:
                    current_value.append(line)
        
        # Save last key-value pair
        if current_key:
            value = '\n'.join(current_value).strip()
            if value.isdigit():
                result[current_key] = int(value)
            elif value.replace('.', '').isdigit():
                result[current_key] = float(value)
            elif value.lower() in ['true', 'false']:
                result[current_key] = value.lower() == 'true'
            else:
                result[current_key] = value
        
        if result:
            print(f"[INFO] Successfully parsed with custom parser: {result}")
            return result
            
    except Exception as e:
        print(f"[ERROR] Custom parsing failed: {e}")
    
    # Try regex parsing as fallback
    try:
        result = {}
        
        # Extract amount
        amount_match = re.search(r'amount:\s*(\d+(?:\.\d+)?)', response_text, re.IGNORECASE)
        if amount_match:
            result['amount'] = float(amount_match.group(1))
        
        # Extract reasoning/comment
        reasoning_match = re.search(r'reasoning:\s*(.+?)(?=\n\w+:|$)', response_text, re.IGNORECASE | re.DOTALL)
        if reasoning_match:
            result['reasoning'] = reasoning_match.group(1).strip()
        
        comment_match = re.search(r'comment:\s*(.+?)(?=\n\w+:|$)', response_text, re.IGNORECASE | re.DOTALL)
        if comment_match:
            result['comment'] = comment_match.group(1).strip()
        
        # Extract sources
        sources_match = re.search(r'sources?:\s*(.+?)(?=\n\w+:|$)', response_text, re.IGNORECASE | re.DOTALL)
        if sources_match:
            sources_text = sources_match.group(1).strip()
            # Split by common delimiters
            sources = [s.strip() for s in re.split(r'[,;\n]', sources_text) if s.strip()]
            result['sources'] = sources
        
        if result:
            print(f"[INFO] Successfully parsed with regex: {result}")
            return result
            
    except Exception as e:
        print(f"[ERROR] Regex parsing failed: {e}")
    
    # If all parsing methods fail, return a default structure
    print("[WARN] All parsing methods failed, returning default structure")
    return {
        "amount": None,
        "comment": response_text,
        "sources": [],
        "raw_response": response_text
    }

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
        print("[INFO] Raw Agent Response:")
        print(response_text)

        # Parse the response using the robust parser
        result = parse_agent_response(response_text)

        # Extract values with fallbacks
        amount = result.get("amount")
        comment = (result.get("comment") or 
                  result.get("reasoning") or 
                  result.get("response") or 
                  "No comment available")
        sources = result.get("sources", [])
        
        # Ensure sources is a list
        if isinstance(sources, str):
            sources = [sources]
        elif not isinstance(sources, list):
            sources = []

        # === Final Response ===
        return {
            "amount": amount,
            "comment": comment,
            "sources": sources,
            "flow_balance": balance_data["flow_balance"],
            "usd_value": balance_data["usd_value"],
            "raw_agent_response": response_text
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
    uvicorn.run(app, host="0.0.0.0", port=8000) "name": "_disasterHash", "type": "bytes32"}],
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)