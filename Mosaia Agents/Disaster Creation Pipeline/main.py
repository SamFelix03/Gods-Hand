import os
import re
import requests
from dotenv import load_dotenv
from openai import OpenAI
from web3 import Web3

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

if __name__ == "__main__":
    main()