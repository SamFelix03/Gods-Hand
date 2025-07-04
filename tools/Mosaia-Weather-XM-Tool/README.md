# WeatherXM tool
This tool integrates WeatherXM to provide real-time, hyperlocal weather data for disaster assessment and relief planning. The data collected from WeatherXM's decentralized network of weather stations is sent to the agent.

## How it works:
1. Enter the bbox values of a specific location
2. Using the bounding box, the system queries the WeatherXM endpoint which returns a list of all weather stations located within the defined geographical bounds.
3. The response is filtered to include only active stations, i.e., those that have reported recent weather data.
4. Up to 5 randomly selected active stations are queried for their latest observations.
5. Each response includes:
- Observation data: temperature, precipitation, wind speed/gust, humidity, UV index, solar irradiance, etc.
- Location metadata: latitude, longitude, elevation
- Health scores: data quality, location accuracy
6. These details provide granular, real-time insights into the current weather conditions around a specific location.

## Required Environment Variables
1. WeatherXM API key
