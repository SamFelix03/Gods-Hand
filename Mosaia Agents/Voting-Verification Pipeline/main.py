import os
import requests
import traceback
import re
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from web3 import Web3
from openai import OpenAI
from decimal import Decimal
from botocore.exceptions import ClientError
import json
import yaml
import boto3
from pyngrok import ngrok

# Load env
load_dotenv()
CMC_API_KEY = os.getenv("X_CMC_PRO_API_KEY")
AGENT_API_KEY = os.getenv("verifyagent")
NGROK_AUTHTOKEN = os.getenv("ngrok")

# Config
RPC_URL = os.getenv("FLOW_RPC_URL")
CONTRACT_ADDRESS = os.getenv("FLOW_CONTRACT_ADDRESS")
CMC_URL = 'https://pro-api.coinmarketcap.com/v2/cryptocurrency/quotes/latest?symbol=FLOW&convert=USD'

# Init
app = FastAPI()
client = OpenAI(base_url="https://api.mosaia.ai/v1/agent", api_key=AGENT_API_KEY)

# Start ngrok tunnel on port 8000 when app starts
def start_ngrok():
    if NGROK_AUTHTOKEN:
        ngrok.set_auth_token(NGROK_AUTHTOKEN)
    public_url = ngrok.connect(8000, "http")
    print(f"[NGROK] Tunnel started: {public_url.public_url}")
    return public_url.public_url

ngrok_url = None
try:
    ngrok_url = start_ngrok()
except Exception as e:
    print(f"[NGROK] Failed to start ngrok tunnel: {e}")

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

        # Clean up amount: remove $ and USD and keep only the number
        if isinstance(amount, str):
            cleaned = amount.replace("$", "").replace(",", "").replace("USD", "").strip()
            try:
                amount = float(re.findall(r"[\d.]+", cleaned)[0])
            except Exception:
                amount = None

        # === Final Response ===
        return {
            "amount": amount,
            "comment": comment,
            "sources": sources,
            "flow_balance": balance_data["flow_balance"],
            "usd_value": balance_data["usd_value"],
            "raw_agent_response": response_text  # Include raw response for debugging
        }

    except Exception as e:
        print(f"[ERROR] Main exception: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

# === Health check endpoint ===
@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "disaster-relief-fact-checker"}

# === Test endpoint ===
@app.get("/test-parser")
def test_parser():
    """Test endpoint to verify the parser works with different formats"""
    test_responses = [
        '{"amount": 1000, "comment": "Test JSON", "sources": ["http://example.com"]}',
        'amount: 2000\ncomment: Test YAML\nsources: http://example.com',
        'amount: 3000\nreasoning: The New Life Foundation has provided essential services\nsources: https://newlifefoundation.in/'
    ]
    
    results = []
    for i, response in enumerate(test_responses):
        try:
            parsed = parse_agent_response(response)
            results.append({
                "test_case": i + 1,
                "input": response,
                "parsed": parsed,
                "status": "success"
            })
        except Exception as e:
            results.append({
                "test_case": i + 1,
                "input": response,
                "error": str(e),
                "status": "failed"
            })
    
    return {"test_results": results}

# === Voting Agent Logic (from votingagent.py) ===

# Add UNLOCK_AMOUNT_USD if not present
UNLOCK_AMOUNT_USD = Decimal('0.4')  # $0.4 worth of FLOW

# Voting ABI (add if not present)
VOTING_ABI = [
    {
        "inputs": [
            { "internalType": "bytes32", "name": "_disasterHash", "type": "bytes32" },
            { "internalType": "uint256", "name": "_amount", "type": "uint256" },
            { "internalType": "address payable", "name": "_recipient", "type": "address" }
        ],
        "name": "unlockFunds",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }
]

# Voting DynamoDB Table
voting_dynamodb = boto3.resource(
    "dynamodb",
    region_name=os.getenv("AWS_REGION"),
    aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
    aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY")
)
voting_table = voting_dynamodb.Table("gods-hand-claims")

# Voting Web3 Setup
voting_w3 = Web3(Web3.HTTPProvider(os.getenv("FLOW_RPC_URL")))
voting_account = voting_w3.eth.account.from_key(os.getenv("FLOW_PRIVATE_KEY"))
voting_contract = voting_w3.eth.contract(address=Web3.to_checksum_address(os.getenv("FLOW_CONTRACT_ADDRESS")), abi=VOTING_ABI)

# Voting Input model
class VoteInput(BaseModel):
    voteResult: str
    uuid: str
    disasterHash: str

# Helper: Get FLOW price in USD

def get_flow_price_usd():
    url = "https://pro-api.coinmarketcap.com/v2/cryptocurrency/quotes/latest"
    headers = {
        'Accepts': 'application/json',
        'X-CMC_PRO_API_KEY': os.getenv("X_CMC_PRO_API_KEY")
    }
    params = {
        'symbol': 'FLOW',
        'convert': 'USD'
    }
    response = requests.get(url, headers=headers, params=params)
    data = response.json()

    if response.status_code == 200 and 'data' in data and 'FLOW' in data['data']:
        price = data['data']['FLOW'][0]['quote']['USD']['price']
        return Decimal(str(price))
    else:
        raise Exception(f"CMC API Error: {data.get('status', {}).get('error_message', 'Unknown')}")

# Helper: Unlock funds on contract

def unlock_funds(disaster_hash: str, recipient_address: str):
    flow_price_usd = get_flow_price_usd()
    flow_amount = UNLOCK_AMOUNT_USD / flow_price_usd
    unlock_amount_wei = int(flow_amount * Decimal(1e18))
    disaster_hash_bytes32 = Web3.to_bytes(hexstr=disaster_hash)
    recipient = Web3.to_checksum_address(recipient_address)

    nonce = voting_w3.eth.get_transaction_count(voting_account.address)
    tx = voting_contract.functions.unlockFunds(disaster_hash_bytes32, unlock_amount_wei, recipient).build_transaction({
        'from': voting_account.address,
        'chainId': int(os.getenv("FLOW_CHAIN_ID", "545")),
        'nonce': nonce,
        'gas': 300000,
        'gasPrice': voting_w3.to_wei('1', 'gwei')
    })

    signed_tx = voting_w3.eth.account.sign_transaction(tx, os.getenv("FLOW_PRIVATE_KEY"))
    tx_hash = voting_w3.eth.send_raw_transaction(signed_tx.raw_transaction)
    receipt = voting_w3.eth.wait_for_transaction_receipt(tx_hash)
    return tx_hash.hex(), receipt.blockNumber

@app.post("/process-vote/")
async def process_vote(vote: VoteInput):
    # Step 1: Get item
    try:
        response = voting_table.get_item(Key={"id": vote.uuid})
        item = response.get("Item")
        if not item:
            raise HTTPException(status_code=404, detail="UUID not found in DB.")
    except ClientError as e:
        raise HTTPException(status_code=500, detail=f"DynamoDB error: {e.response['Error']['Message']}")

    vote_result = vote.voteResult.lower()

    if vote_result == "approve":
        try:
            # Update DB first
            voting_table.update_item(
                Key={"id": vote.uuid},
                UpdateExpression="SET claim_state = :s",
                ExpressionAttributeValues={":s": "approved"}
            )

            # Trigger contract call
            org_address = item.get("organization_aztec_address")
            if not org_address:
                raise HTTPException(status_code=500, detail="Missing organization_aztec_address in DB.")

            # Fetch claimed_amount in USD from DB
            claimed_amount_usd = item.get("claimed_amount")
            if claimed_amount_usd is None:
                raise HTTPException(status_code=500, detail="Missing claimed_amount in DB.")

            # Convert USD to FLOW using CMC API
            flow_price_usd = get_flow_price_usd()
            flow_amount = Decimal(str(claimed_amount_usd)) / flow_price_usd
            unlock_amount_wei = int(flow_amount * Decimal(1e18))

            # Prepare detailed logs
            log_details = {
                "claimed_amount_usd": str(claimed_amount_usd),
                "flow_price_usd": str(flow_price_usd),
                "converted_flow_amount": str(flow_amount),
                "unlock_amount_wei": str(unlock_amount_wei)
            }

            disaster_hash_bytes32 = Web3.to_bytes(hexstr=vote.disasterHash)
            recipient = Web3.to_checksum_address(org_address)
            nonce = voting_w3.eth.get_transaction_count(voting_account.address)
            tx = voting_contract.functions.unlockFunds(disaster_hash_bytes32, unlock_amount_wei, recipient).build_transaction({
                'from': voting_account.address,
                'chainId': int(os.getenv("FLOW_CHAIN_ID", "545")),
                'nonce': nonce,
                'gas': 300000,
                'gasPrice': voting_w3.to_wei('1', 'gwei')
            })
            signed_tx = voting_w3.eth.account.sign_transaction(tx, os.getenv("FLOW_PRIVATE_KEY"))
            tx_hash = voting_w3.eth.send_raw_transaction(signed_tx.raw_transaction)
            receipt = voting_w3.eth.wait_for_transaction_receipt(tx_hash)
            
            # Add the tx hash to the claims_hash attribute in the table
            voting_table.update_item(
                Key={"id": vote.uuid},
                UpdateExpression="SET claims_hash = :h",
                ExpressionAttributeValues={":h": tx_hash.hex()}
            )

            return {
                "status": "✅ Claim approved & funds unlocked.",
                "txHash": tx_hash.hex(),
                "confirmedInBlock": receipt.blockNumber,
                "claimed_amount_usd": str(claimed_amount_usd),
                "flow_price_usd": str(flow_price_usd),
                "converted_flow_amount": str(flow_amount),
                "unlock_amount_wei": str(unlock_amount_wei)
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Approval failed: {str(e)}")

    elif vote_result == "reject":
        try:
            voting_table.update_item(
                Key={"id": vote.uuid},
                UpdateExpression="SET claim_state = :s",
                ExpressionAttributeValues={":s": "rejected"}
            )
            return {"status": "❌ Claim rejected."}
        except ClientError as e:
            raise HTTPException(status_code=500, detail=f"Update error: {e.response['Error']['Message']}")

    elif vote_result in ["higher", "lower"]:
        reason = item.get("reason", "")
        claimed_amount = item.get("claimed_amount", 0)

        prompt = (
            f"The organization has requested {claimed_amount} as relief funds. "
            f"The reason they provided is: '{reason}'. "
            f"Voters believe the amount should be '{vote_result}'. "
            f"Please suggest a revised newAmount."
        )

        try:
            completion = client.chat.completions.create(
                model="6866646ff14ab5c885e4386d",
                messages=[{"role": "user", "content": prompt}],
            )
            response_content = completion.choices[0].message.content.strip()
            new_amount = int("".join(filter(str.isdigit, response_content)))
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"AI error: {str(e)}")

        try:
            voting_table.update_item(
                Key={"id": vote.uuid},
                UpdateExpression="SET claim_state = :s, claimed_amount = :a",
                ExpressionAttributeValues={
                    ":s": "voting",
                    ":a": new_amount
                }
            )
            return {
                "status": "🔁 Claim sent back for re-voting with updated amount.",
                "newAmount": new_amount
            }
        except ClientError as e:
            raise HTTPException(status_code=500, detail=f"Update error: {e.response['Error']['Message']}")

    else:
        raise HTTPException(status_code=400, detail="Invalid vote result. Must be: approve, reject, higher, or lower.")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)