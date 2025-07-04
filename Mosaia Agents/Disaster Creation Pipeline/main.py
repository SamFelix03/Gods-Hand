import os
from dotenv import load_dotenv
from openai import OpenAI

# Load environment variables
load_dotenv()

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

def main():
    disaster_info = get_disaster_info()
    print("Disaster Info:\n", disaster_info)

if __name__ == "__main__":
    main()