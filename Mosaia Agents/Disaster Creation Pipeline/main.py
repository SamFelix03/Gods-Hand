import os
import re
import requests
import boto3
from dotenv import load_dotenv
from openai import OpenAI
from web3 import Web3
from eth_account import Account

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

# AWS Configuration
AWS_ACCESS_KEY = os.getenv("AWS_ACCESS_KEY_ID")
AWS_SECRET_KEY = os.getenv("AWS_SECRET_ACCESS_KEY")
AWS_REGION = os.getenv("AWS_REGION")

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

def get_disaster_info():
    client = OpenAI(
        base_url="https://api.mosaia.ai/v1/agent",
        api_key=os.getenv("websearchagent")
    )

    response = client.chat.completions.create(
        model="68660a4aeef377abf1f7443f",
        messages=[{"role": "user", "content": "Find the recent natural disaster in Bangalore in May 2025"}],
    )

    return response.choices[0].message.content.strip()

def parse_disaster_info(disaster_output):
    lines = disaster_output.split('\n')
    return {
        "title": lines[0].replace("Title: ", "").strip(),
        "description": lines[1].replace("Description: ", "").strip(),
        "read_more": lines[2].replace("Read More: ", "").strip(),
        "location": lines[3].replace("Disaster Location: ", "").strip()
    }

def get_bounding_box(disaster_data):
    client = OpenAI(
        base_url="https://api.mosaia.ai/v1/agent",
        api_key=os.getenv("bboxagent")
    )

    response = client.chat.completions.create(
        model="6864d6cbca5744854d34c998",
        messages=[{"role": "user", "content": f"🚨 **{disaster_data['title']}** 🚨 {disaster_data['description']} 🔗 [Read more]({disaster_data['read_more']})"}],
    )

    return response.choices[0].message.content.strip()

def get_weather_data(bbox_output):
    client = OpenAI(
        base_url="https://api.mosaia.ai/v1/agent",
        api_key=os.getenv("weatheragent")
    )

    response = client.chat.completions.create(
        model="6864dd95ade4d61675d45e4d",
        messages=[{"role": "user", "content": f"```json\n{bbox_output}\n```"}],
    )

    return response.choices[0].message.content.strip()

def get_financial_analysis(disaster_data, weather_data):
    client = OpenAI(
        base_url="https://api.mosaia.ai/v1/agent",
        api_key=os.getenv("analysisagent")
    )

    analysis_input = f"🌧️ **{disaster_data['title']}**\n{disaster_data['description']}\n\n[Read more]({disaster_data['read_more']})\n\n{weather_data}"
    response = client.chat.completions.create(
        model="6866162ee2d11c774d448a27",
        messages=[{"role": "user", "content": analysis_input}],
    )

    return response.choices[0].message.content.strip()

def extract_amount(analysis_output):
    amount_match = re.search(r"AMOUNT:\s*[\$]?(?P<amount>[\d,]+)", analysis_output)
    return amount_match.group("amount").replace(",", "") if amount_match else "Unknown"

def get_flow_price():
    try:
        cmc_url = "https://pro-api.coinmarketcap.com/v2/cryptocurrency/quotes/latest?symbol=FLOW&convert=USD"
        headers = {"X-CMC_PRO_API_KEY": CMC_API_KEY}
        resp = requests.get(cmc_url, headers=headers)
        resp.raise_for_status()
        data = resp.json()
        flow_tokens = data["data"]["FLOW"]
        flow_token = next((t for t in flow_tokens if t["quote"]["USD"]["price"]), None)
        return float(flow_token["quote"]["USD"]["price"])
    except Exception as e:
        print(f"[ERROR] Could not fetch FLOW price: {e}")
        return None

def convert_to_flow(usd_amount, flow_price):
    if usd_amount == "Unknown" or flow_price is None:
        return None
    return float(usd_amount) / flow_price

def create_disaster_contract(title, description, flow_amount):
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
                return decoded['args']['disasterHash'].hex()
            except Exception:
                continue
        
        print("[Blockchain] Could not extract disaster hash from event logs.")
        return None
        
    except Exception as e:
        print(f"[ERROR] Blockchain interaction failed: {e}")
        return None

def generate_tweet(disaster_data, amount_required):
    return (
        f"🚨 {disaster_data['title']} 🚨\n\n"
        f"📝 {disaster_data['description']}\n\n"
        f"💸 Amount required: ${amount_required}\n\n"
        f"🔗 Read more: {disaster_data['read_more']}"
    )

def post_to_twitter(tweet_text):
    client = OpenAI(
        base_url="https://api.mosaia.ai/v1/agent",
        api_key=os.getenv("tweetagent")
    )

    response = client.chat.completions.create(
        model="6864e70f77520411d032518a",
        messages=[{"role": "user", "content": f'post this content on twitter "{tweet_text}"'}],
    )

    return response.choices[0].message.content

def init_dynamodb():
    return boto3.resource(
        'dynamodb',
        aws_access_key_id=AWS_ACCESS_KEY,
        aws_secret_access_key=AWS_SECRET_KEY,
        region_name=AWS_REGION
    )

def main():
    disaster_output = get_disaster_info()
    disaster_data = parse_disaster_info(disaster_output)
    
    bbox_output = get_bounding_box(disaster_data)
    weather_data = get_weather_data(bbox_output)
    
    analysis_output = get_financial_analysis(disaster_data, weather_data)
    amount_required = extract_amount(analysis_output)
    
    flow_price = get_flow_price()
    flow_amount = convert_to_flow(amount_required, flow_price)
    
    print("\nFinancial Analysis:\n", analysis_output)
    print("\nAmount required in USD:", f"${amount_required}" if amount_required != "Unknown" else "Unknown")
    
    if flow_price and flow_amount:
        print(f"Current FLOW price (USD): ${flow_price}")
        print(f"Amount required in FLOW: {flow_amount:.6f}")
        
        disaster_hash = create_disaster_contract(
            disaster_data["title"],
            disaster_data["description"],
            flow_amount
        )
        
        if disaster_hash:
            print(f"[Blockchain] Disaster created with hash: {disaster_hash}")
    
    tweet_text = generate_tweet(disaster_data, amount_required)
    print("\nTweet:\n", tweet_text)
    
    twitter_response = post_to_twitter(tweet_text)
    print("\nTwitter Response:\n", twitter_response)
    
    # Initialize DynamoDB
    dynamodb = init_dynamodb()
    print("\nDynamoDB initialized successfully")

def store_in_dynamodb(disaster_data, amount_required, flow_amount, disaster_hash=None):
    dynamodb = init_dynamodb()
    table = dynamodb.Table("gods-hand-events")
    
    # Generate hash if not from contract
    if not disaster_hash:
        disaster_hash = hashlib.sha256(
            (disaster_data['title'] + disaster_data['location']).encode()
        ).hexdigest()
    
    item = {
        "id": str(uuid.uuid4()),
        "title": disaster_data['title'],
        "description": disaster_data['description'],
        "source": disaster_data['read_more'],
        "disaster_location": disaster_data['location'],
        "estimated_amount_required": amount_required,
        "estimated_amount_required_flow": f"{flow_amount:.6f}" if flow_amount else "N/A",
        "disaster_hash": disaster_hash,
        "created_at": datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z')
    }
    
    table.put_item(Item=item)
    return item

def main():
    disaster_output = get_disaster_info()
    disaster_data = parse_disaster_info(disaster_output)
    
    bbox_output = get_bounding_box(disaster_data)
    weather_data = get_weather_data(bbox_output)
    
    analysis_output = get_financial_analysis(disaster_data, weather_data)
    amount_required = extract_amount(analysis_output)
    
    flow_price = get_flow_price()
    flow_amount = convert_to_flow(amount_required, flow_price)
    
    print("\nFinancial Analysis:\n", analysis_output)
    print("\nAmount required in USD:", f"${amount_required}" if amount_required != "Unknown" else "Unknown")
    
    disaster_hash = None
    if flow_price and flow_amount:
        print(f"Current FLOW price (USD): ${flow_price}")
        print(f"Amount required in FLOW: {flow_amount:.6f}")
        
        disaster_hash = create_disaster_contract(
            disaster_data["title"],
            disaster_data["description"],
            flow_amount
        )
        
        if disaster_hash:
            print(f"[Blockchain] Disaster created with hash: {disaster_hash}")
    
    tweet_text = generate_tweet(disaster_data, amount_required)
    print("\nTweet:\n", tweet_text)
    
    twitter_response = post_to_twitter(tweet_text)
    print("\nTwitter Response:\n", twitter_response)
    
    # Store in DynamoDB
    db_item = store_in_dynamodb(
        disaster_data,
        amount_required,
        flow_amount,
        disaster_hash
    )
    print("\n✅ Stored in DynamoDB with ID:", db_item["id"])
    while True:
        try:
            disaster_output = get_disaster_info()
            disaster_data = parse_disaster_info(disaster_output)
            
            bbox_output = get_bounding_box(disaster_data)
            weather_data = get_weather_data(bbox_output)
            
            analysis_output = get_financial_analysis(disaster_data, weather_data)
            amount_required = extract_amount(analysis_output)
            
            flow_price = get_flow_price()
            flow_amount = convert_to_flow(amount_required, flow_price)
            
            print("\nFinancial Analysis:\n", analysis_output)
            print("\nAmount required in USD:", f"${amount_required}" if amount_required != "Unknown" else "Unknown")
            
            disaster_hash = None
            if flow_price and flow_amount:
                print(f"Current FLOW price (USD): ${flow_price}")
                print(f"Amount required in FLOW: {flow_amount:.6f}")
                
                disaster_hash = create_disaster_contract(
                    disaster_data["title"],
                    disaster_data["description"],
                    flow_amount
                )
                
                if disaster_hash:
                    print(f"[Blockchain] Disaster created with hash: {disaster_hash}")
            
            tweet_text = generate_tweet(disaster_data, amount_required)
            print("\nTweet:\n", tweet_text)
            
            twitter_response = post_to_twitter(tweet_text)
            print("\nTwitter Response:\n", twitter_response)
            
            # Store in DynamoDB
            db_item = store_in_dynamodb(
                disaster_data,
                amount_required,
                flow_amount,
                disaster_hash
            )
            print("\n✅ Stored in DynamoDB with ID:", db_item["id"])
            
        except Exception as e:
            print(f"[ERROR] Exception in main loop: {e}")
        
        print("\n[INFO] Sleeping for 1 hour before next run...\n")
        time.sleep(3600)

while True:
        try:
            print("\n=== Starting disaster processing ===")
            
            print("\n[1/7] Fetching disaster info...")
            disaster_output = get_disaster_info()
            disaster_data = parse_disaster_info(disaster_output)
            print("✔ Disaster data retrieved:", disaster_data['title'])
            
            print("\n[2/7] Getting bounding box...")
            bbox_output = get_bounding_box(disaster_data)
            print("✔ Bounding box data:", bbox_output[:50] + "...")
            
            print("\n[3/7] Fetching weather data...")
            weather_data = get_weather_data(bbox_output)
            print("✔ Weather data retrieved")
            
            print("\n[4/7] Performing financial analysis...")
            analysis_output = get_financial_analysis(disaster_data, weather_data)
            amount_required = extract_amount(analysis_output)
            print("✔ Analysis complete. Amount required:", amount_required)
            
            print("\n[5/7] Checking FLOW price...")
            flow_price = get_flow_price()
            flow_amount = convert_to_flow(amount_required, flow_price)
            
            disaster_hash = None
            if flow_price and flow_amount:
                print(f"✔ FLOW price: ${flow_price}, Amount in FLOW: {flow_amount:.6f}")
                
                print("\n[6/7] Creating disaster contract...")
                disaster_hash = create_disaster_contract(
                    disaster_data["title"],
                    disaster_data["description"],
                    flow_amount
                )
                
                if disaster_hash:
                    print(f"✔ Disaster created with hash: {disaster_hash}")
            
            print("\n[7/7] Posting to Twitter...")
            tweet_text = generate_tweet(disaster_data, amount_required)
            twitter_response = post_to_twitter(tweet_text)
            print("✔ Tweet posted successfully")
            
            # Store in DynamoDB
            print("\n[+] Storing in DynamoDB...")
            db_item = store_in_dynamodb(
                disaster_data,
                amount_required,
                flow_amount,
                disaster_hash
            )
            print("✔ Stored in DynamoDB with ID:", db_item["id"])
            
            print("\n=== Processing complete ===")
            
        except Exception as e:
            print(f"[ERROR] Exception in main loop: {e}")
        
        print("\n[INFO] Sleeping for 1 hour before next run...\n")
            def validate_disaster_data(disaster_data):
                required_fields = ['title', 'description', 'read_more', 'location']
                for field in required_fields:
                    if not disaster_data.get(field):
                        raise ValueError(f"Missing required field: {field}")
                    
                if len(disaster_data['title']) < 5:
                    raise ValueError("Title is too short")
                
                if len(disaster_data['description']) < 20:
                    raise ValueError("Description is too short")
                
                if not disaster_data['read_more'].startswith(('http://', 'https://')):
                    raise ValueError("Invalid read_more URL")

            def main():
                while True:
                    try:
                        print("\n=== Starting disaster processing ===")
                        
                        print("\n[1/7] Fetching disaster info...")
                        disaster_output = get_disaster_info()
                        disaster_data = parse_disaster_info(disaster_output)
                        validate_disaster_data(disaster_data)
                        print("✔ Disaster data validated:", disaster_data['title'])
                            while True:
        try:
            print("\n=== Starting disaster processing ===")
            
            print("\n[1/7] Fetching disaster info...")
            disaster_output = get_with_retry(get_disaster_info)
            disaster_data = parse_disaster_info(disaster_output)
            validate_disaster_data(disaster_data)
            print("✔ Disaster data validated:", disaster_data['title'])
            
            print("\n[2/7] Getting bounding box...")
            bbox_output = get_with_retry(lambda: get_bounding_box(disaster_data))
            print("✔ Bounding box data:", bbox_output[:50] + "...")
            
            print("\n[3/7] Fetching weather data...")
            weather_data = get_with_retry(lambda: get_weather_data(bbox_output))
            print("✔ Weather data retrieved")
                    time.sleep(3600)
                    if __name__ == "__main__":
                        main()