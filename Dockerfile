# Production Dockerfile for SolCall Layer 3 Math Engine on AWS ECS Fargate
FROM python:3.12-slim

# Prevent Python from writing .pyc files and enable unbuffered logging for CloudWatch
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app/src

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code and data stores
COPY src /app/src
COPY data /app/data
COPY static /app/static
COPY run_layer3.py /app/

# Pre-generate Layer 3 feeds at build time
RUN python /app/run_layer3.py

# Create a non-root application user for AWS security compliance
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

# Expose HTTP port for ECS Application Load Balancer
EXPOSE 8000

# AWS ECS Container Healthcheck (pure Python standard library - zero external dependencies)
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"

# Launch production server via Uvicorn
CMD ["uvicorn", "solcall.api:app", "--host", "0.0.0.0", "--port", "8000"]
