const dotenv = require('dotenv');
const express = require('express');
const { handler } = require('../dist/index');

dotenv.config();

const app = express();

const { WEATHER_XM_API_KEY, PORT } = process.env;

if (!WEATHER_XM_API_KEY) {
    console.log('`WEATHER_XM_API_KEY` not set. Please check your .env file.');
    process.exit(1);
}

app.get('/', async (req, res) => {
    const { min_lat, min_lon, max_lat, max_lon } = req.query;

    const event = {
        body: JSON.stringify({
            args: {
                min_lat: min_lat ? Number(min_lat) : undefined,
                min_lon: min_lon ? Number(min_lon) : undefined,
                max_lat: max_lat ? Number(max_lat) : undefined,
                max_lon: max_lon ? Number(max_lon) : undefined
            },
            secrets: {
                WEATHER_XM_API_KEY
            }
        })
    }

    const result = await handler(event)

    res.status(result.statusCode).send(result.body);
});

const port = PORT || 3000;
app.listen(port, () => {
    console.log(`Local development server running on port ${port}`);
});
