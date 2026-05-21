FROM python:3.10-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=5000

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Pin pip version first (ensures consistent installs across team)
RUN pip install --no-cache-dir pip==24.0

# Copy requirements
COPY requirements.txt .

# Install PyTorch CPU version (compatible with Python 3.10)
RUN pip install --no-cache-dir torch>=2.0.0 --index-url https://download.pytorch.org/whl/cpu

# Install remaining dependencies
RUN pip install --default-timeout=100 --no-cache-dir \
    flask>=2.0.0 \
    flask-cors>=4.0.0 \
    gunicorn==20.1.0 \
    ai4bharat-transliteration>=1.1.3

# Copy application files
COPY . .

EXPOSE 5000

CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "2", "--threads", "2", "--timeout", "120", "app:app"]
