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
AGENT_API_KEY = os.getenv("verifyagent")
NGROK_AUTHTOKEN = os.getenv("ngrok")

# Config
RPC_URL = os.getenv("SEPOLIA_RPC_URL")
if not RPC_URL:
    raise Exception("SEPOLIA_RPC_URL environment variable is required")
CONTRACT_ADDRESS = os.getenv("ETH_CONTRACT_ADDRESS")  # You'll need to set this environment variable

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

# ABI for the new godslite contract
CONTRACT_ABI = [
    {
        "inputs": [{"internalType": "bytes32", "name": "_disasterHash", "type": "bytes32"}],
        "name": "getDisasterDetails",
        "outputs": [
            {"internalType": "string", "name": "title", "type": "string"},
            {"internalType": "string", "name": "metadata", "type": "string"},
            {"internalType": "uint256", "name": "targetAmount", "type": "uint256"},
            {"internalType": "uint256", "name": "totalDonated", "type": "uint256"},
            {"internalType": "address", "name": "creator", "type": "address"},
            {"internalType": "uint256", "name": "timestamp", "type": "uint256"},
            {"internalType": "bool", "name": "isActive", "type": "bool"}
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{"internalType": "bytes32", "name": "_disasterHash", "type": "bytes32"}],
        "name": "getFundingProgress",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
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

# === Utility: Get disaster information from Ethereum contract ===
def get_disaster_info(disaster_hash: str):
    try:
        print("[INFO] Connecting to Ethereum Sepolia...")
        web3 = Web3(Web3.HTTPProvider(RPC_URL))
        if not web3.is_connected():
            raise Exception("Cannot connect to Ethereum Sepolia")

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
        
        # Check if disaster exists and is active
        if not details[0]:  # title is empty
            raise Exception("Disaster not found")
        
        if not details[6]:  # isActive is False
            raise Exception("Disaster is not active")

        title = details[0]
        target_amount_usdc = details[2]  # targetAmount in USDC (6 decimals)
        total_donated_usdc = details[3]  # totalDonated in USDC (6 decimals)
        
        # Convert from USDC decimals (6) to actual USDC amount
        target_amount = float(target_amount_usdc) / 1_000_000
        total_donated = float(total_donated_usdc) / 1_000_000
        
        print(f"[INFO] Disaster: {title}")
        print(f"[INFO] Target Amount: ${target_amount:.2f} USDC")
        print(f"[INFO] Total Donated: ${total_donated:.2f} USDC")

        return {
            "title": title,
            "target_amount_usdc": target_amount,
            "total_donated_usdc": total_donated,
            "funding_progress": (total_donated / target_amount * 100) if target_amount > 0 else 0
        }
    except Exception as e:
        print(f"[ERROR] get_disaster_info: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=str(e))



# === Endpoint: /fact-check ===
@app.post("/fact-check")
def fact_check(data: FactCheckInput):
    try:
        print(f"[INFO] Statement: {data.statement}")
        print(f"[INFO] Disaster Hash: {data.disaster_hash}")

        # === Get Disaster Information from Ethereum Contract ===
        disaster_info = get_disaster_info(data.disaster_hash)
        total_donated = disaster_info["total_donated_usdc"]
        target_amount = disaster_info["target_amount_usdc"]
        funding_progress = disaster_info["funding_progress"]

        # === Call Mosaia Agent with statement and USDC amounts ===
        ai_message = (
            f"Petition: {data.statement}\n"
            f"Disaster: {disaster_info['title']}\n"
            f"Target Amount: ${target_amount:.2f} USDC\n"
            f"Total Donated: ${total_donated:.2f} USDC\n"
            f"Funding Progress: {funding_progress:.1f}%\n"
            "Based on the petition and the current funding status, decide how much should be allocated from the donated funds. "
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
            "disaster_title": disaster_info["title"],
            "target_amount_usdc": target_amount,
            "total_donated_usdc": total_donated,
            "funding_progress": funding_progress,
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

# Contract ABIs - Updated for new godslite contract
GODSLITE_ABI = [
    {
        "inputs": [
            { "internalType": "bytes32", "name": "_disasterHash", "type": "bytes32" }
        ],
        "name": "getDisasterDetails",
        "outputs": [
            { "internalType": "string", "name": "title", "type": "string" },
            { "internalType": "string", "name": "metadata", "type": "string" },
            { "internalType": "uint256", "name": "targetAmount", "type": "uint256" },
            { "internalType": "uint256", "name": "totalDonated", "type": "uint256" },
            { "internalType": "address", "name": "creator", "type": "address" },
            { "internalType": "uint256", "name": "timestamp", "type": "uint256" },
            { "internalType": "bool", "name": "isActive", "type": "bool" }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            { "internalType": "bytes32", "name": "_disasterHash", "type": "bytes32" }
        ],
        "name": "getFundingProgress",
        "outputs": [
            { "internalType": "uint256", "name": "", "type": "uint256" }
        ],
        "stateMutability": "view",
        "type": "function"
    }
]

# USDC Token ABI for transfers
USDC_ABI = [
    {
        "inputs": [
            { "internalType": "address", "name": "to", "type": "address" },
            { "internalType": "uint256", "name": "amount", "type": "uint256" }
        ],
        "name": "transfer",
        "outputs": [
            { "internalType": "bool", "name": "", "type": "bool" }
        ],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            { "internalType": "address", "name": "account", "type": "address" }
        ],
        "name": "balanceOf",
        "outputs": [
            { "internalType": "uint256", "name": "", "type": "uint256" }
        ],
        "stateMutability": "view",
        "type": "function"
    }
]

# DynamoDB Tables - Only initialize if required environment variables are present
dynamodb = None
voting_table = None

# Initialize DynamoDB components only if required environment variables exist
if os.getenv("AWS_REGION") and os.getenv("AWS_ACCESS_KEY_ID") and os.getenv("AWS_SECRET_ACCESS_KEY"):
    try:
        dynamodb = boto3.resource(
            "dynamodb",
            region_name=os.getenv("AWS_REGION"),
            aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
            aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY")
        )
        voting_table = dynamodb.Table("gods-hand-claims")
        print("[INFO] DynamoDB components initialized successfully")
    except Exception as e:
        print(f"[WARN] Failed to initialize DynamoDB components: {e}")
        print("[WARN] Voting features will be disabled")
else:
    print("[WARN] Missing required AWS environment variables. Voting features will be disabled.")

# Web3 Setup for Ethereum Sepolia
w3 = None
account = None
godslite_contract = None
usdc_contract = None

# Initialize Web3 components for Ethereum Sepolia
try:
    w3 = Web3(Web3.HTTPProvider(RPC_URL))
    
    # Get private key from environment variable
    private_key = os.getenv("private_key")
    if not private_key:
        raise Exception("private_key environment variable is required")
    
    # Clean private key - remove any non-hex characters and ensure it's 64 characters
    private_key = ''.join(c for c in private_key if c in '0123456789abcdefABCDEF')
    if len(private_key) != 64:
        raise Exception(f"Invalid private key length: {len(private_key)}. Expected 64 characters.")
    
    account = w3.eth.account.from_key(private_key)
    
    # Initialize godslite contract
    godslite_contract = w3.eth.contract(
        address=Web3.to_checksum_address("0x07f9BFEb19F1ac572f6D69271261dDA1fD378D9A"), 
        abi=GODSLITE_ABI
    )
    
    # Initialize USDC contract
    usdc_contract = w3.eth.contract(
        address=Web3.to_checksum_address("0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"), 
        abi=USDC_ABI
    )
    
    print("[INFO] Web3 components initialized successfully for Ethereum Sepolia")
    print(f"[INFO] Using account: {account.address}")
    print(f"[INFO] Godslite contract: 0x07f9BFEb19F1ac572f6D69271261dDA1fD378D9A")
    print(f"[INFO] USDC contract: 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238")
    
except Exception as e:
    print(f"[WARN] Failed to initialize Web3 components: {e}")
    print("[WARN] Voting features will be disabled")

# Voting Input model
class VoteInput(BaseModel):
    voteResult: str
    uuid: str

# Helper: Get disaster information from godslite contract
def get_disaster_info_from_contract(disaster_hash: str):
    """Get disaster information from the godslite contract"""
    try:
        if not godslite_contract:
            raise Exception("Godslite contract not initialized")
            
        print(f"[INFO] Fetching disaster info from contract for hash: {disaster_hash}")
        
        # Convert disaster hash to bytes32
        if disaster_hash.startswith("0x"):
            disaster_hash = disaster_hash[2:]
        if len(disaster_hash) != 64:
            raise Exception("Invalid disaster_hash length")
        
        disaster_bytes = bytes.fromhex(disaster_hash)
        
        # Get disaster details from contract
        details = godslite_contract.functions.getDisasterDetails(disaster_bytes).call()
        
        # Check if disaster exists and is active
        if not details[0]:  # title is empty
            raise Exception("Disaster not found in contract")
        
        if not details[6]:  # isActive is False
            raise Exception("Disaster is not active in contract")

        title = details[0]
        target_amount_usdc = details[2]  # targetAmount in USDC (6 decimals)
        total_donated_usdc = details[3]  # totalDonated in USDC (6 decimals)
        
        # Convert from USDC decimals (6) to actual USDC amount
        target_amount = float(target_amount_usdc) / 1_000_000
        total_donated = float(total_donated_usdc) / 1_000_000
        
        print(f"[INFO] Disaster: {title}")
        print(f"[INFO] Target Amount: ${target_amount:.2f} USDC")
        print(f"[INFO] Total Donated: ${total_donated:.2f} USDC")

        return {
            "title": title,
            "target_amount_usdc": target_amount,
            "total_donated_usdc": total_donated,
            "funding_progress": (total_donated / target_amount * 100) if target_amount > 0 else 0
        }
    except Exception as e:
        print(f"[ERROR] get_disaster_info_from_contract: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=str(e))

# Helper: Send USDC from controlled wallet to recipient
def send_usdc_to_recipient(recipient_address: str, amount_usdc: float):
    """Send USDC from the controlled wallet to the recipient"""
    try:
        if not usdc_contract or not account:
            raise Exception("USDC contract or account not initialized")
            
        print(f"[INFO] Sending {amount_usdc} USDC to {recipient_address}")
        
        # Convert USDC amount to wei (USDC has 6 decimals)
        amount_wei = int(amount_usdc * 1_000_000)
        
        # Check wallet balance
        wallet_balance = usdc_contract.functions.balanceOf(account.address).call()
        wallet_balance_usdc = float(wallet_balance) / 1_000_000
        
        print(f"[INFO] Wallet balance: {wallet_balance_usdc:.2f} USDC")
        
        if amount_wei > wallet_balance:
            raise Exception(f"Insufficient USDC balance. Required: {amount_usdc}, Available: {wallet_balance_usdc}")
        
        # Build USDC transfer transaction
        nonce = w3.eth.get_transaction_count(account.address)
        tx = usdc_contract.functions.transfer(
            Web3.to_checksum_address(recipient_address), 
            amount_wei
        ).build_transaction({
            'from': account.address,
            'chainId': 11155111,  # Sepolia chain ID
        'nonce': nonce,
            'gas': 100000,  # Standard gas for ERC20 transfer
            'gasPrice': w3.to_wei('20', 'gwei')  # Higher gas price for Sepolia
        })
        
        # Sign and send transaction
        signed_tx = w3.eth.account.sign_transaction(tx, private_key)
        tx_hash = w3.eth.send_raw_transaction(signed_tx.raw_transaction)
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
        
        print(f"[INFO] ✅ USDC transfer successful!")
        print(f"[INFO] Transaction Hash: {tx_hash.hex()}")
        print(f"[INFO] Block Number: {receipt.blockNumber}")
        
        return tx_hash.hex(), receipt.blockNumber
        
    except Exception as e:
        print(f"[ERROR] send_usdc_to_recipient: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"USDC transfer failed: {str(e)}")

@app.post("/process-vote/")
async def process_vote(vote: VoteInput):
    # Check if DynamoDB is available
    if not voting_table:
        raise HTTPException(status_code=503, detail="Voting system is not available. Please check configuration.")
    
    # Check if Web3 components are available
    if not w3 or not account or not godslite_contract or not usdc_contract:
        raise HTTPException(status_code=503, detail="Blockchain components are not available. Please check configuration.")
    
    # Step 1: Get item from DynamoDB
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
            # Get organization address and claimed amount from DB
            org_address = item.get("organization_aztec_address")
            if not org_address:
                raise HTTPException(status_code=500, detail="Missing organization_aztec_address in DB.")

            claimed_amount_usdc = item.get("claimed_amount")
            if claimed_amount_usdc is None:
                raise HTTPException(status_code=500, detail="Missing claimed_amount in DB.")

            print(f"[INFO] Approving claim for {claimed_amount_usdc} USDC to {org_address}")

            # Send USDC directly to the organization
            tx_hash, block_number = send_usdc_to_recipient(org_address, claimed_amount_usdc)

            # Update DB with approved status and transaction hash
            voting_table.update_item(
                Key={"id": vote.uuid},
                UpdateExpression="SET claim_state = :s, claims_hash = :h",
                ExpressionAttributeValues={
                    ":s": "approved",
                    ":h": tx_hash
                }
            )

            return {
                "status": "✅ Claim approved & USDC sent successfully.",
                "txHash": tx_hash,
                "confirmedInBlock": block_number,
                "claimed_amount_usdc": str(claimed_amount_usdc),
                "recipient": org_address
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
        try:
            reason = item.get("reason", "")
            claimed_amount = item.get("claimed_amount", 0)

            # Use AI to determine the new amount based on context
            prompt = (
                f"The organization has requested {claimed_amount} USDC as relief funds. "
                f"The reason they provided is: '{reason}'. "
                f"Voters believe the amount should be '{vote_result}'. "
                f"Please analyze the request and suggest a revised amount in USDC. "
                f"Consider the reason provided and whether the amount should be increased or decreased. "
                f"Respond with just the new amount as a number."
            )

            completion = client.chat.completions.create(
                model="6866646ff14ab5c885e4386d",
                messages=[{"role": "user", "content": prompt}],
            )
            response_content = completion.choices[0].message.content.strip()
            
            # Extract the number from AI response
            new_amount = int("".join(filter(str.isdigit, response_content)))
            
            # Ensure minimum amount of 1 USDC
            if new_amount < 1:
                new_amount = 1
                print(f"[INFO] AI suggested amount too low, adjusted to minimum: {new_amount} USDC")

            print(f"[INFO] AI suggested new amount: {new_amount} USDC (was: {claimed_amount})")

            # Update DB with new amount and send back for re-voting
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
                "newAmount": new_amount,
                "previousAmount": claimed_amount,
                "aiReasoning": "AI analyzed the request and suggested adjustment based on context"
            }
            
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"AI adjustment failed: {str(e)}")

    else:
        raise HTTPException(status_code=400, detail="Invalid vote result. Must be: approve, reject, higher, or lower.")

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

if __name__ == "__main__":
    import uvicorn
    
    # Start FastAPI server
    uvicorn.run(app, host="0.0.0.0", port=8000)
