FROM python:3.11-slim

WORKDIR /app
ENV DEBIAN_FRONTEND=noninteractive
ARG INSTALL_OCR=true

# Install system dependencies
RUN set -eux; \
  packages="build-essential pkg-config netcat-traditional curl"; \
  if [ "$INSTALL_OCR" = "true" ]; then \
    packages="$packages tesseract-ocr tesseract-ocr-eng tesseract-ocr-rus tesseract-ocr-kaz"; \
  fi; \
  echo "Updating apt metadata..."; \
  apt-get update -o Acquire::Retries=5; \
  echo "Installing system packages: $packages"; \
  apt-get install -y --no-install-recommends -o Dpkg::Use-Pty=0 $packages; \
  rm -rf /var/lib/apt/lists/*

# Copy requirements file
COPY requirements.txt .

# Install Python packages
RUN pip install --no-cache-dir -r requirements.txt

# Copy entrypoint script first
COPY entrypoint.sh .
RUN chmod +x entrypoint.sh

# Copy application files
COPY alembic.ini .
COPY alembic ./alembic
COPY app ./app
COPY clean_db.py .

# Create uploads directory
RUN mkdir -p uploads

# Set Python path and environment
ENV PYTHONPATH=/app
ENV ENVIRONMENT=production

# Run the application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
