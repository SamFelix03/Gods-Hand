const dotenv = require('dotenv');
const express = require('express');
const { handler } = require('../dist/index');

dotenv.config();

const app = express();

const { GEOAPIFY_API_KEY, PORT } = process.env;

if (!GEOAPIFY_API_KEY) {
    console.log('`GEOAPIFY_API_KEY` not set. Please check your .env file.');
    process.exit(1);
}

app.get('/', async (req, res) => {
    const { location } = req.query;

    const event = {
        body: JSON.stringify({
            args: {
                location
            },
            secrets: {
                GEOAPIFY_API_KEY
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
