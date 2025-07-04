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

def main():
    disaster_output = get_disaster_info()
    disaster_data = parse_disaster_info(disaster_output)
    
    bbox_output = get_bounding_box(disaster_data)
    weather_data = get_weather_data(bbox_output)
    
    analysis_output = get_financial_analysis(disaster_data, weather_data)
    print("\nFinancial Analysis:\n", analysis_output)

if __name__ == "__main__":
    main()