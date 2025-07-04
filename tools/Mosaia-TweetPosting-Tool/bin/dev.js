const dotenv = require('dotenv');
const express = require('express');
const { handler } = require('../dist/index');

dotenv.config();

const app = express();

const {
  TWITTER_APP_KEY,
  TWITTER_APP_SECRET,
  TWITTER_ACCESS_TOKEN,
  TWITTER_ACCESS_SECRET,
  PORT
} = process.env;

if (!TWITTER_APP_KEY || !TWITTER_APP_SECRET || !TWITTER_ACCESS_TOKEN || !TWITTER_ACCESS_SECRET) {
  console.log('Twitter API credentials not set. Please check your .env file.');
  process.exit(1);
}

app.get('/', async (req, res) => {
  const { content } = req.query;

  const event = {
    body: JSON.stringify({
      args: {
        content
      },
      secrets: {
        TWITTER_APP_KEY,
        TWITTER_APP_SECRET,
        TWITTER_ACCESS_TOKEN,
        TWITTER_ACCESS_SECRET
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
