# Deploying the backend

The frontend is on **Vercel**. The backend (FastAPI orchestrator API) runs as a
container. **Cloud Run** is the target, but any container host works (Railway, Render,
Fly). The `Dockerfile` lives at the repo root, so `gcloud run deploy --source .` builds
it for you (no local Docker needed).

## What it needs (env vars — the gitignored `backend/.env` values; set on the host, never commit)

| Var | Value | Notes |
|-----|-------|-------|
| `GEMINI_API_KEY_ORCHESTRATOR` (+ the 5 other per-agent keys) | `AQ...` | one per agent |
| `GEMINI_MODEL_ORCHESTRATOR` | `gemini-2.5-flash` | free-tier dev; `pro` has ~no quota |
| `DATABASE_URL` | `postgresql://...neon.../neondb?sslmode=require` | Neon; approvals + audit |
| `CORS_ORIGINS` | `https://<your-vercel-domain>` | optional; only if it differs from the default |
| `CLERK_SECRET_KEY`, `CLERK_ISSUER` | — | optional; only to switch on backend Clerk verification |

The container binds `$PORT` (Cloud Run injects `8080`).

## Cloud Run (source deploy)

```bash
gcloud run deploy quorum-api \
  --source . \
  --region <your-region> \
  --allow-unauthenticated \
  --env-vars-file env.yaml        # keep the real secret values out of shell history
```

`env.yaml` (do NOT commit) is a simple `KEY: value` map of the vars above.

## Point the frontend at it

1. Copy the service URL Cloud Run prints (e.g. `https://quorum-api-xxxx.run.app`).
2. On Vercel, set **`NEXT_PUBLIC_API_BASE`** = that URL, then **redeploy** the frontend.
3. The console now calls the live backend — chat, approvals, audit, invites. Live chat
   needs Gemini quota (else it shows "Your daily usage limit has been reached").

## Local container smoke test

```bash
docker build -t quorum-api .
docker run --rm -p 8080:8080 --env-file backend/.env -e PORT=8080 quorum-api
curl localhost:8080/health   # -> {"status":"ok",...}
```

## Notes

- `backend/.env` is **not** baked into the image (`.dockerignore`); pass env at runtime.
- Data persists to **Neon Postgres** (already cloud-hosted). Without `DATABASE_URL` the app
  falls back to SQLite inside the container, which is **ephemeral** on Cloud Run.
- Building the image behind a corporate TLS proxy can fail `pip` on certs — build in a clean
  network (Cloud Build is fine) or add the proxy root CA to the image.
