# BBOX Identifier Tool
This tool translates a human-readable location (e.g., "Mumbai, India") into geographic coordinates and a bounding box, which defines the region's spatial extent.

## How it works:
1. You send a location in human-readable format
2. The tool makes a request to the Geoapify API
3. The Boundary Box values of that specific location is returned, like this:
   
  min_latitude: minLat,
  max_latitude: maxLat,
  min_longitude: minLon,
  max_longitude: maxLon

## Required Environment Variables
1. Geoapify API Key
