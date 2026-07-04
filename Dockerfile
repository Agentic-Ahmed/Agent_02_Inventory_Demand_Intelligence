# Backend (FastAPI orchestrator API) container — for Cloud Run or any container host.
# Build context is the repo ROOT; only backend/ is copied in (see .dockerignore).
# The frontend deploys separately to Vercel and is not part of this image.
FROM python:3.12-slim

# ca-certificates: outbound HTTPS to the Gemini API + Neon Postgres (sslmode=require).
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONPATH=/app \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Install deps first so this layer caches until requirements change.
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

# App code (backend/.env is excluded by .dockerignore — pass secrets at runtime).
COPY backend/ ./backend/

# Cloud Run injects $PORT (defaults to 8080 elsewhere). Bind to 0.0.0.0.
ENV PORT=8080
EXPOSE 8080
CMD ["sh", "-c", "uvicorn backend.api.app:app --host 0.0.0.0 --port ${PORT}"]
