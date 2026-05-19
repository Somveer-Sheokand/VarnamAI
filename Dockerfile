# Use Python 3.9 slim image (smaller than full Python)
FROM python:3.9-slim

# Set working directory
WORKDIR /app

# Install system dependencies needed for ai4bharat
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first (for better Docker caching)
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy all application files
COPY . .

# Expose the port your app runs on
EXPOSE 5000

# Run the application with Gunicorn (production server)
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "app:app"]