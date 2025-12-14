# Quick LLM Frontend

This is the Vite + React frontend for Quick LLM.

It is a static site that calls the backend for:

- `GET /health`
- `GET /api/models`

Inference runs locally in the browser via `@huggingface/transformers` in a Web Worker.

## Local dev

```bash
npm ci
cp .env.example .env
npm run dev
```

## Required env vars

Create `frontend/.env`:

```bash
VITE_API_BASE_URL=http://localhost:4000
```

For production, set `VITE_API_BASE_URL` to your deployed backend API endpoint (API Gateway URL), for example:

```bash
VITE_API_BASE_URL=https://xxxx.execute-api.us-east-1.amazonaws.com
```

This value is baked into the build output.

## Build

```bash
npm run build
```

Output goes to `dist/`.

## Deploy

Deploy `dist/` to any static host, such as:

- AWS Amplify Hosting
- S3 + CloudFront
- Netlify
- Vercel

### Important deployment notes

- The backend must allow your frontend origin via CORS.

  - Backend reads `ALLOWED_ORIGINS` as a comma-separated list.

- WebGPU requires HTTPS (or `localhost`) in most browsers.

  - Prefer HTTPS for production hosting.

### Verification checklist

After deployment:

1. Open the deployed site in a fresh tab
2. Confirm the “Backend connectivity” section reports OK
3. Confirm the model dropdown loads options

If the model list is empty or errors:

- Confirm `VITE_API_BASE_URL` is correct for that deployed build
- Confirm backend CORS includes your deployed frontend origin
- Confirm the backend endpoint is reachable:

  - `curl -sS "$API/health"`
  - `curl -sS "$API/api/models"`
