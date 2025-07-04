import fetch from 'node-fetch';

export default async function toolCall(
    min_lat: number,
    min_lon: number,
    max_lat: number,
    max_lon: number,
    apiKey: string
): Promise<any> {
    if (
        min_lat === undefined ||
        min_lon === undefined ||
        max_lat === undefined ||
        max_lon === undefined
    ) throw new Error('Missing bounding box values');
    if (!apiKey) throw new Error('Missing WEATHER_XM_API_KEY');

    // Fetch stations in bbox
    const url = `https://pro.weatherxm.com/api/v1/stations/bounds?min_lat=${min_lat}&max_lat=${max_lat}&min_lon=${min_lon}&max_lon=${max_lon}`;
    const res = await fetch(url, {
        headers: {
            'X-API-KEY': apiKey
        }
    });
    if (!res.ok) {
        throw new Error(`WeatherXM API error: ${res.status} ${res.statusText}`);
    }
    const data = await res.json();
    if (!data.stations) {
        throw new Error("No stations data found in response");
    }
    const activeStations = data.stations.filter((station: any) => station.lastDayQod > 0);
    if (activeStations.length === 0) {
        return { message: "No active stations found in bbox." };
    }
    // Pick up to 5 random stations
    const selectedStations = activeStations
        .sort(() => 0.5 - Math.random())
        .slice(0, 5);

    // Fetch latest data for each station
    const stationDataPromises = selectedStations.map((station: any) =>
        fetch(`https://pro.weatherxm.com/api/v1/stations/${station.id}/latest`, {
            headers: { 'X-API-KEY': apiKey }
        })
        .then(res => {
            if (!res.ok) throw new Error(`Failed to fetch data for station ${station.id}: ${res.status} ${res.statusText}`);
            return res.json().then(data => ({
                stationId: station.id,
                stationName: station.name,
                data
            }));
        })
        .catch(error => ({
            stationId: station.id,
            error: error.message
        }))
    );

    const results = await Promise.all(stationDataPromises);
    const successful = results.filter((r: any) => !r.error);
    const failed = results.filter((r: any) => r.error);

    return {
        bbox: { min_lat, min_lon, max_lat, max_lon },
        successful,
        failed
    };
}
