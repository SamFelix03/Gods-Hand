import os
import json
import hashlib
import uuid
from datetime import datetime, timezone
from dotenv import load_dotenv
from openai import OpenAI
import boto3
import re
import requests
from web3 import Web3
from eth_account import Account
import time

# Load environment variables
load_dotenv()

# CoinMarketCap API Key
CMC_API_KEY = os.getenv("X_CMC_PRO_API_KEY")

# Flow EVM/Contract config from .env
FLOW_RPC_URL = os.getenv("FLOW_RPC_URL")
FLOW_CHAIN_ID = int(os.getenv("FLOW_CHAIN_ID", "545"))
FLOW_CONTRACT_ADDRESS = os.getenv("FLOW_CONTRACT_ADDRESS")
FLOW_ACCOUNT_ADDRESS = os.getenv("FLOW_ACCOUNT_ADDRESS")
FLOW_PRIVATE_KEY = os.getenv("FLOW_PRIVATE_KEY")

# Contract ABI (from call.py, only needed functions)
CONTRACT_ABI = [
    {
        "inputs": [
            {"internalType": "string", "name": "_title", "type": "string"},
            {"internalType": "string", "name": "_metadata", "type": "string"},
            {"internalType": "uint256", "name": "_targetAmount", "type": "uint256"}
        ],
        "name": "createDisaster",
        "outputs": [
            {"internalType": "bytes32", "name": "", "type": "bytes32"}
        ],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "anonymous": False,
        "inputs": [
            {"indexed": True, "internalType": "bytes32", "name": "disasterHash", "type": "bytes32"},
            {"indexed": False, "internalType": "string", "name": "title", "type": "string"},
            {"indexed": True, "internalType": "address", "name": "creator", "type": "address"},
            {"indexed": False, "internalType": "uint256", "name": "targetAmount", "type": "uint256"}
        ],
        "name": "DisasterCreated",
        "type": "event"
    }
]

def run_disaster_flow():
    # Step 1: Get recent disaster
    disaster_client = OpenAI(
        base_url="https://api.mosaia.ai/v1/agent",
        api_key=os.getenv("websearchagent")
    )

    disaster_response = disaster_client.chat.completions.create(
        model="68660a4aeef377abf1f7443f",
        messages=[{"role": "user", "content": "Find the recent natural disaster in the world"}],
    )

    disaster_output = disaster_response.choices[0].message.content.strip()
    print("\nDisaster Info:\n", disaster_output)

    # Parse disaster output
    lines = disaster_output.split('\n')
    title = lines[0].replace("Title: ", "").strip()
    description = lines[1].replace("Description: ", "").strip()
    read_more = lines[2].replace("Read More: ", "").strip()
    location = lines[3].replace("Disaster Location: ", "").strip()

    # Step 2: Get bounding box using disaster description
    bbox_client = OpenAI(
        base_url="https://api.mosaia.ai/v1/agent",
        api_key=os.getenv("bboxagent")
    )

    bbox_response = bbox_client.chat.completions.create(
        model="6864d6cbca5744854d34c998",
        messages=[{"role": "user", "content": f"🚨 **{title}** 🚨 {description} 🔗 [Read more]({read_more})"}],
    )

    bbox_output = bbox_response.choices[0].message.content.strip()
    print("\nBBox:\n", bbox_output)

    # Step 3: Get weather data
    weather_client = OpenAI(
        base_url="https://api.mosaia.ai/v1/agent",
        api_key=os.getenv("weatheragent")
    )

    weather_response = weather_client.chat.completions.create(
        model="6864dd95ade4d61675d45e4d",
        messages=[{"role": "user", "content": f"```json\n{bbox_output}\n```"}],
    )

    weather_data = weather_response.choices[0].message.content.strip()
    print("\nWeather:\n", weather_data)

    # Step 4: Financial analysis
    analysis_client = OpenAI(
        base_url="https://api.mosaia.ai/v1/agent",
        api_key=os.getenv("analysisagent")
    )

    analysis_input = f"🌧️ **{title}**\n{description}\n\n[Read more]({read_more})\n\n{weather_data}"
    analysis_response = analysis_client.chat.completions.create(
        model="6866162ee2d11c774d448a27",
        messages=[{"role": "user", "content": analysis_input}],
    )

    analysis_output = analysis_response.choices[0].message.content.strip()
    print("\nAnalysis:\n", analysis_output)

    # Step 5: Parse amount
    amount_match = re.search(r"AMOUNT:\s*[\$]?(?P<amount>[\d,]+)", analysis_output)
    amount_required = amount_match.group("amount").replace(",", "") if amount_match else "Unknown"

    # Step 5.1: Convert USD to FLOW
    flow_price = None
    flow_amount = None
    if amount_required != "Unknown":
        try:
            cmc_url = "https://pro-api.coinmarketcap.com/v2/cryptocurrency/quotes/latest?symbol=FLOW&convert=USD"
            headers = {"X-CMC_PRO_API_KEY": CMC_API_KEY}
            resp = requests.get(cmc_url, headers=headers)
            resp.raise_for_status()
            data = resp.json()
            # Find the FLOW token with a valid price (not FLOW on Solana, etc.)
            flow_tokens = data["data"]["FLOW"]
            flow_token = next((t for t in flow_tokens if t["quote"]["USD"]["price"]), None)
            flow_price = float(flow_token["quote"]["USD"]["price"])
            flow_amount = float(amount_required) / flow_price
            print(f"\nAmount required in USD: ${amount_required}")
            print(f"Current FLOW price (USD): ${flow_price}")
            print(f"Amount required in FLOW: {flow_amount:.6f}")
        except Exception as e:
            print(f"[ERROR] Could not fetch FLOW price or convert: {e}")
            flow_amount = None
    else:
        print("[WARN] Amount required is unknown, skipping FLOW conversion.")

    # Step 5.2: Write to Smart Contract and get disaster hash
    contract_disaster_hash = None
    if flow_amount is not None:
        try:
            web3 = Web3(Web3.HTTPProvider(FLOW_RPC_URL))
            if not web3.is_connected():
                raise Exception("Web3 connection failed")
            account = Account.from_key(FLOW_PRIVATE_KEY)
            if account.address.lower() != FLOW_ACCOUNT_ADDRESS.lower():
                raise Exception("Private key does not match account address")
            contract = web3.eth.contract(address=Web3.to_checksum_address(FLOW_CONTRACT_ADDRESS), abi=CONTRACT_ABI)
            nonce = web3.eth.get_transaction_count(account.address)
            # Convert FLOW to wei (1 FLOW = 1e18)
            target_amount_wei = int(flow_amount * 1e18)
            tx = contract.functions.createDisaster(
                title,
                description,
                target_amount_wei
            ).build_transaction({
                'from': account.address,
                'nonce': nonce,
                'gas': 500000,
                'gasPrice': web3.to_wei('1', 'gwei'),
                'chainId': FLOW_CHAIN_ID
            })
            signed_tx = web3.eth.account.sign_transaction(tx, FLOW_PRIVATE_KEY)
            tx_hash = web3.eth.send_raw_transaction(signed_tx.raw_transaction)
            print(f"\n[Blockchain] Sent createDisaster tx: {tx_hash.hex()}")
            receipt = web3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
            if receipt.status != 1:
                raise Exception("Transaction failed")
            # Extract disaster hash from logs
            for log in receipt.logs:
                try:
                    decoded = contract.events.DisasterCreated().process_log(log)
                    contract_disaster_hash = decoded['args']['disasterHash'].hex()
                    print(f"[Blockchain] Disaster hash from contract: {contract_disaster_hash}")
                    break
                except Exception:
                    continue
            if not contract_disaster_hash:
                print("[Blockchain] Could not extract disaster hash from event logs.")
        except Exception as e:
            print(f"[ERROR] Blockchain interaction failed: {e}")

    # Step 6: Construct tweet
    tweet_text = (
        f"🚨 {title} 🚨\n\n"
        f"📝 {description}\n\n"
        f"💸 Amount required: ${amount_required}\n\n"
        f"🔗 Read more: {read_more}"
    )

    print("\nTweet:\n", tweet_text)

    # Step 7: Post to Twitter
    tweet_client = OpenAI(
        base_url="https://api.mosaia.ai/v1/agent",
        api_key=os.getenv("tweetagent")
    )

    tweet_response = tweet_client.chat.completions.create(
        model="6864e70f77520411d032518a",
        messages=[{"role": "user", "content": f'post this content on twitter "{tweet_text}"'}],
    )

    print("\nTwitter Response:\n", tweet_response.choices[0].message.content)

    # Step 8: Store in DynamoDB
    aws_access_key = os.getenv("AWS_ACCESS_KEY_ID")
    aws_secret_key = os.getenv("AWS_SECRET_ACCESS_KEY")
    aws_region = os.getenv("AWS_REGION")

    dynamodb = boto3.resource(
        'dynamodb',
        aws_access_key_id=aws_access_key,
        aws_secret_access_key=aws_secret_key,
        region_name=aws_region
    )

    table = dynamodb.Table("gods-hand-events")

    # Use contract_disaster_hash if available
    final_disaster_hash = contract_disaster_hash if contract_disaster_hash else hashlib.sha256((title + location).encode()).hexdigest()

    # Create a unique hash and timestamp
    unique_id = str(uuid.uuid4())
    created_at = datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z')

    # Log values before insertion
    print("\nLogging values before DB insert:")
    print("Title:", title)
    print("Description:", description)
    print("Read More:", read_more)
    print("Location:", location)
    print("Amount Required:", amount_required)
    print("Amount Required (FLOW):", f"{flow_amount:.6f}" if flow_amount else "N/A")
    print("Hash:", final_disaster_hash)
    print("ID:", unique_id)
    print("Created At:", created_at)

    # Include all required fields
    dynamodb_item = {
        "id": unique_id,
        "title": title,
        "description": description,
        "source": read_more,
        "disaster_location": location,
        "estimated_amount_required": amount_required,
        "estimated_amount_required_flow": f"{flow_amount:.6f}" if flow_amount else "N/A",
        "disaster_hash": final_disaster_hash,
        "created_at": created_at
    }

    # Insert into DynamoDB
    table.put_item(Item=dynamodb_item)
    print("\n✅ DynamoDB entry added successfully.")

if __name__ == "__main__":
    while True:
        try:
            run_disaster_flow()
        except Exception as e:
            print(f"[ERROR] Exception in disaster flow: {e}")
        print("\n[INFO] Sleeping for 1 hour before next run...\n")
        time.sleep(3600)
