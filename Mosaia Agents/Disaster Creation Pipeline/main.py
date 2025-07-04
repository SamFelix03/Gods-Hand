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

def main():
    disaster_output = get_disaster_info()
    disaster_data = parse_disaster_info(disaster_output)
    
    bbox_output = get_bounding_box(disaster_data)
    print("\nBounding Box:\n", bbox_output)

if __name__ == "__main__":
    main()