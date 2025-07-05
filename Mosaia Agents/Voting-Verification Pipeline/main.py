import os
import requests
import traceback
import re
import asyncio
import threading
import time
from datetime import datetime, timedelta
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, BackgroundTasks
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

# Contract ABIs
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

LOTTERY_ABI = [
    {
        "inputs": [
            { "internalType": "bytes32", "name": "_disasterHash", "type": "bytes32" }
        ],
        "name": "lottery",
        "outputs": [
            { "internalType": "address", "name": "", "type": "address" }
        ],
        "stateMutability": "nonpayable",
        "type": "function"
    }
]

# DynamoDB Tables
dynamodb = boto3.resource(
    "dynamodb",
    region_name=os.getenv("AWS_REGION"),
    aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
    aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY")
)
voting_table = dynamodb.Table("gods-hand-claims")
events_table = dynamodb.Table("gods-hand-events")

# Web3 Setup
w3 = Web3(Web3.HTTPProvider(os.getenv("FLOW_RPC_URL")))
account = w3.eth.account.from_key(os.getenv("FLOW_PRIVATE_KEY"))
contract = w3.eth.contract(address=Web3.to_checksum_address(os.getenv("FLOW_CONTRACT_ADDRESS")), abi=VOTING_ABI)
lottery_contract = w3.eth.contract(address=Web3.to_checksum_address(os.getenv("FLOW_CONTRACT_ADDRESS")), abi=LOTTERY_ABI)

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
            nonce = w3.eth.get_transaction_count(account.address)
            tx = contract.functions.unlockFunds(disaster_hash_bytes32, unlock_amount_wei, recipient).build_transaction({
                'from': account.address,
                'chainId': int(os.getenv("FLOW_CHAIN_ID", "545")),
                'nonce': nonce,
                'gas': 300000,
                'gasPrice': w3.to_wei('1', 'gwei')
            })
            signed_tx = w3.eth.account.sign_transaction(tx, os.getenv("FLOW_PRIVATE_KEY"))
            tx_hash = w3.eth.send_raw_transaction(signed_tx.raw_transaction)
            receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
            
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

# === Raffle Monitoring System ===

# Global variable to track processed disasters
processed_disasters = set()

def trigger_lottery(disaster_hash: str):
    """Trigger lottery for a specific disaster"""
    try:
        print(f"[LOTTERY] Triggering lottery for disaster: {disaster_hash}")
        
        # Get disaster information from DynamoDB first
        try:
            response = events_table.get_item(Key={"disaster_hash": disaster_hash})
            disaster = response.get('Item')
            if not disaster:
                print(f"[LOTTERY] ❌ Disaster not found in database: {disaster_hash}")
                return False
        except Exception as e:
            print(f"[LOTTERY] ❌ Failed to fetch disaster from database: {e}")
            return False
        
        # Convert disaster hash to bytes32
        if disaster_hash.startswith("0x"):
            disaster_hash = disaster_hash[2:]
        disaster_bytes = bytes.fromhex(disaster_hash)
        
        # Build transaction
        nonce = w3.eth.get_transaction_count(account.address)
        tx = lottery_contract.functions.lottery(disaster_bytes).build_transaction({
            'from': account.address,
            'chainId': int(os.getenv("FLOW_CHAIN_ID", "545")),
            'nonce': nonce,
            'gas': 500000,  # Higher gas limit for lottery function
            'gasPrice': w3.to_wei('1', 'gwei')
        })
        
        # Sign and send transaction
        signed_tx = w3.eth.account.sign_transaction(tx, os.getenv("FLOW_PRIVATE_KEY"))
        tx_hash = w3.eth.send_raw_transaction(signed_tx.raw_transaction)
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
        
        print(f"[LOTTERY] ✅ Lottery triggered successfully!")
        print(f"[LOTTERY] Transaction Hash: {tx_hash.hex()}")
        print(f"[LOTTERY] Block Number: {receipt.blockNumber}")
        print(f"[LOTTERY] Disaster Title: {disaster.get('title', 'Unknown')}")
        
        # Update DynamoDB with comprehensive lottery information
        try:
            current_time = datetime.utcnow().isoformat() + 'Z'
            
            # Calculate lottery end time based on duration (default 24 hours if not specified)
            lottery_duration = disaster.get('lottery_duration_hours', 24)
            lottery_end_time = (datetime.utcnow() + timedelta(hours=lottery_duration)).isoformat() + 'Z'
            
            events_table.update_item(
                Key={"disaster_hash": disaster_hash},
                UpdateExpression="SET lottery_status = :ls, lottery_transaction_hash = :tx, lottery_end_time = :let, lottery_prize_amount = :lpa",
                ExpressionAttributeValues={
                    ":ls": "triggered",
                    ":tx": tx_hash.hex(),
                    ":let": lottery_end_time,
                    ":lpa": "5% of disaster funds"  # 5% as per contract
                }
            )
            print(f"[LOTTERY] ✅ Updated DynamoDB with comprehensive lottery status")
            print(f"[LOTTERY] Lottery end time: {lottery_end_time}")
            print(f"[LOTTERY] Duration: {lottery_duration} hours")
        except Exception as e:
            print(f"[LOTTERY] ⚠️ Failed to update DynamoDB: {e}")
        
        return True
        
    except Exception as e:
        print(f"[LOTTERY] ❌ Failed to trigger lottery: {e}")
        traceback.print_exc()
        return False

def check_disasters_for_raffle():
    """Check for disasters that are ready for raffle (72 hours old)"""
    try:
        print("[RAFFLE] Checking for disasters ready for raffle...")
        
        # Scan the events table for disasters
        response = events_table.scan()
        disasters = response.get('Items', [])
        
        current_time = datetime.utcnow()
        seventy_two_hours_ago = current_time - timedelta(hours=72)
        
        for disaster in disasters:
            disaster_hash = disaster.get('disaster_hash')
            created_at = disaster.get('created_at')
            lottery_status = disaster.get('lottery_status', 'pending')
            lottery_end_time = disaster.get('lottery_end_time')
            
            # Skip if already processed or lottery already triggered
            if disaster_hash in processed_disasters or lottery_status in ['triggered', 'completed']:
                continue
            
            # Check if disaster is older than 72 hours
            if created_at:
                try:
                    # Parse the created_at timestamp
                    if isinstance(created_at, str):
                        disaster_time = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                    else:
                        disaster_time = created_at
                    
                    if disaster_time < seventy_two_hours_ago:
                        print(f"[RAFFLE] 🎰 Disaster {disaster_hash} is ready for raffle!")
                        print(f"[RAFFLE] Title: {disaster.get('title', 'Unknown')}")
                        print(f"[RAFFLE] Created: {disaster_time}")
                        print(f"[RAFFLE] Current: {current_time}")
                        print(f"[RAFFLE] Age: {(current_time - disaster_time).total_seconds() / 3600:.1f} hours")
                        
                        # Trigger lottery
                        success = trigger_lottery(disaster_hash)
                        if success:
                            processed_disasters.add(disaster_hash)
                        
                except Exception as e:
                    print(f"[RAFFLE] ⚠️ Error processing disaster {disaster_hash}: {e}")
                    continue
        
        print(f"[RAFFLE] Check completed. Processed disasters: {len(processed_disasters)}")
        
    except Exception as e:
        print(f"[RAFFLE] ❌ Error checking disasters: {e}")
        traceback.print_exc()

def check_lottery_winners():
    """Check for completed lotteries and update winner information"""
    try:
        print("[LOTTERY] Checking for completed lotteries...")
        
        # Scan for lotteries that have ended
        response = events_table.scan(
            FilterExpression="lottery_status = :status",
            ExpressionAttributeValues={":status": "triggered"}
        )
        triggered_lotteries = response.get('Items', [])
        
        current_time = datetime.utcnow()
        
        for lottery in triggered_lotteries:
            lottery_end_time = lottery.get('lottery_end_time')
            if not lottery_end_time:
                continue
                
            try:
                # Parse lottery end time
                if isinstance(lottery_end_time, str):
                    end_time = datetime.fromisoformat(lottery_end_time.replace('Z', '+00:00'))
                else:
                    end_time = lottery_end_time
                
                # Check if lottery has ended
                if current_time > end_time:
                    disaster_hash = lottery.get('disaster_hash')
                    print(f"[LOTTERY] 🏆 Lottery ended for disaster: {disaster_hash}")
                    
                    # Update status to completed
                    events_table.update_item(
                        Key={"disaster_hash": disaster_hash},
                        UpdateExpression="SET lottery_status = :ls",
                        ExpressionAttributeValues={":ls": "completed"}
                    )
                    print(f"[LOTTERY] ✅ Updated lottery status to completed")
                    
            except Exception as e:
                print(f"[LOTTERY] ⚠️ Error processing lottery end time: {e}")
                continue
                
    except Exception as e:
        print(f"[LOTTERY] ❌ Error checking lottery winners: {e}")
        traceback.print_exc()

def raffle_monitor_loop():
    """Background loop to monitor disasters for raffle"""
    print("[RAFFLE] 🎰 Starting raffle monitoring system...")
    
    while True:
        try:
            check_disasters_for_raffle()
            check_lottery_winners()  # Also check for completed lotteries
            # Wait for 1 hour before next check
            time.sleep(3600)  # 1 hour
        except Exception as e:
            print(f"[RAFFLE] ❌ Error in raffle monitor loop: {e}")
            time.sleep(300)  # Wait 5 minutes on error before retrying

def start_raffle_monitor():
    """Start the raffle monitoring in a separate thread"""
    raffle_thread = threading.Thread(target=raffle_monitor_loop, daemon=True)
    raffle_thread.start()
    print("[RAFFLE] 🎰 Raffle monitoring thread started")

# === Endpoint to manually trigger lottery ===
@app.post("/trigger-lottery/{disaster_hash}")
def manual_trigger_lottery(disaster_hash: str):
    """Manually trigger lottery for a specific disaster"""
    try:
        success = trigger_lottery(disaster_hash)
        if success:
            return {"status": "✅ Lottery triggered successfully", "disaster_hash": disaster_hash}
        else:
            raise HTTPException(status_code=500, detail="Failed to trigger lottery")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

# === Endpoint to check raffle status ===
@app.get("/raffle-status")
def get_raffle_status():
    """Get status of raffle monitoring system"""
    try:
        # Get count of disasters in events table
        response = events_table.scan(Select='COUNT')
        total_disasters = response.get('Count', 0)
        
        # Get lottery statistics
        pending_response = events_table.scan(
            FilterExpression="lottery_status = :status",
            ExpressionAttributeValues={":status": "pending"}
        )
        pending_lotteries = len(pending_response.get('Items', []))
        
        triggered_response = events_table.scan(
            FilterExpression="lottery_status = :status",
            ExpressionAttributeValues={":status": "triggered"}
        )
        triggered_lotteries = len(triggered_response.get('Items', []))
        
        completed_response = events_table.scan(
            FilterExpression="lottery_status = :status",
            ExpressionAttributeValues={":status": "completed"}
        )
        completed_lotteries = len(completed_response.get('Items', []))
        
        return {
            "status": "active",
            "processed_disasters": len(processed_disasters),
            "total_disasters": total_disasters,
            "lottery_stats": {
                "pending": pending_lotteries,
                "triggered": triggered_lotteries,
                "completed": completed_lotteries
            },
            "monitor_active": True,
            "next_check_in": "1 hour"
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e)
        }

# === Endpoint to get lottery details for a specific disaster ===
@app.get("/lottery/{disaster_hash}")
def get_lottery_details(disaster_hash: str):
    """Get detailed lottery information for a specific disaster"""
    try:
        response = events_table.get_item(Key={"disaster_hash": disaster_hash})
        disaster = response.get('Item')
        
        if not disaster:
            raise HTTPException(status_code=404, detail="Disaster not found")
        
        # Calculate time until lottery (if pending)
        lottery_info = {
            "disaster_hash": disaster_hash,
            "title": disaster.get('title', 'Unknown'),
            "lottery_status": disaster.get('lottery_status', 'pending'),
            "lottery_duration_hours": disaster.get('lottery_duration_hours', 24),
            "lottery_prize_amount": disaster.get('lottery_prize_amount', '5% of disaster funds'),
            "created_at": disaster.get('created_at'),
            "lottery_end_time": disaster.get('lottery_end_time'),
            "lottery_transaction_hash": disaster.get('lottery_transaction_hash'),
            "lottery_winner": disaster.get('lottery_winner')
        }
        
        # Calculate time until lottery trigger (if pending)
        if disaster.get('lottery_status') == 'pending' and disaster.get('created_at'):
            try:
                created_at = datetime.fromisoformat(disaster.get('created_at').replace('Z', '+00:00'))
                trigger_time = created_at + timedelta(hours=72)
                current_time = datetime.utcnow()
                
                if current_time < trigger_time:
                    time_until_trigger = trigger_time - current_time
                    lottery_info["time_until_trigger"] = {
                        "hours": int(time_until_trigger.total_seconds() // 3600),
                        "minutes": int((time_until_trigger.total_seconds() % 3600) // 60)
                    }
                else:
                    lottery_info["time_until_trigger"] = "Ready for trigger"
            except Exception as e:
                lottery_info["time_until_trigger"] = "Error calculating time"
        
        return lottery_info
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

# === Endpoint to get all lotteries ===
@app.get("/lotteries")
def get_all_lotteries():
    """Get all lotteries with their status"""
    try:
        response = events_table.scan()
        disasters = response.get('Items', [])
        
        lotteries = []
        for disaster in disasters:
            lottery_info = {
                "disaster_hash": disaster.get('disaster_hash'),
                "title": disaster.get('title', 'Unknown'),
                "lottery_status": disaster.get('lottery_status', 'pending'),
                "created_at": disaster.get('created_at'),
                "lottery_end_time": disaster.get('lottery_end_time'),
                "lottery_transaction_hash": disaster.get('lottery_transaction_hash')
            }
            lotteries.append(lottery_info)
        
        # Sort by created_at (newest first)
        lotteries.sort(key=lambda x: x.get('created_at', ''), reverse=True)
        
        return {
            "total": len(lotteries),
            "lotteries": lotteries
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    
    # Start raffle monitoring
    start_raffle_monitor()
    
    # Start FastAPI server
    uvicorn.run(app, host="0.0.0.0", port=8000)