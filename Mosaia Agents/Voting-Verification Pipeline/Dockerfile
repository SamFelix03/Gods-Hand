# syntax=docker/dockerfile:1
FROM python:3.11-slim

# Set workdir
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install python-dotenv to read .env variables
RUN pip install --no-cache-dir python-dotenv

# Copy requirements first for caching
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy project files (including .env)
COPY . .

# Export environment variables from .env using a wrapper shell script
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh
RUN pip install --no-cache-dir pyngrok

# Entrypoint
CMD ["sh", "-c", "python -m pyngrok ngrok authtoken $ngrok && python -m pyngrok ngrok http 8000 --log stdout & uvicorn main:app --host 0.0.0.0 --port 8000"]
