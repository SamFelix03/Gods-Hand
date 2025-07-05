import os
import requests
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

# Load env
load_dotenv()
CMC_API_KEY = os.getenv("X_CMC_PRO_API_KEY")

# Config
CMC_URL = 'https://pro-api.coinmarketcap.com/v2/cryptocurrency/quotes/latest?symbol=FLOW&convert=USD'

app = FastAPI()

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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)