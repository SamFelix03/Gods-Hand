import os
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

# Load env
load_dotenv()

app = FastAPI()

@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "disaster-relief-fact-checker"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)