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

def parse_disaster_info(disaster_output):
    lines = disaster_output.split('\n')
    return {
        "title": lines[0].replace("Title: ", "").strip(),
        "description": lines[1].replace("Description: ", "").strip(),
        "read_more": lines[2].replace("Read More: ", "").strip(),
        "location": lines[3].replace("Disaster Location: ", "").strip()
    }

def main():
    disaster_output = get_disaster_info()
    print("Raw Disaster Info:\n", disaster_output)
    
    disaster_data = parse_disaster_info(disaster_output)
    print("\nParsed Disaster Data:")
    for key, value in disaster_data.items():
        print(f"{key}: {value}")

if __name__ == "__main__":
    main()