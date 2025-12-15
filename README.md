<p align="center">
  <a href="https://quickllm.samalbayati.com">
    <img src="frontend/src/assets/qlm-high-resolution-logo.png" alt="Quick LLM" width="280" />
  </a>
</p>

<p align="center">
  <a href="https://quickllm.samalbayati.com">Try the app right now!</a>
</p>

# Quick LLM

Quick LLM is a small portfolio friendly playground that runs open source models directly in the browser.

- Frontend: Vite + React
- Backend: Express on AWS Lambda + API Gateway (HTTP API)
- Runtime: `@huggingface/transformers` in a Web Worker
- Acceleration: WebGPU when available, otherwise WASM CPU fallback

## What it does

- Shows a model picker powered by `GET /api/models`
- Initializes a selected model in a worker
- Streams tokens back to the UI during generation
- Provides basic storage tooling to clear app caches and local settings

## Architecture overview

### Backend

- Public endpoints:
  - `GET /health` returns `{ status, message }`
  - `GET /api/models` returns `{ models: [...] }`
- CORS is controlled by `ALLOWED_ORIGINS` (comma-separated)
- No prompts or model outputs are sent to the backend

### Frontend

- Reads API base URL from `VITE_API_BASE_URL`
- Fetches model manifest from the backend
- Runs inference in a Web Worker
- Loads model assets directly from the model host (for example Hugging Face)

## Privacy

Prompts and generated text stay in your browser.
The backend only serves a health response and a model manifest.
Model weights and tokenizer files are fetched by your browser from the model host and may be cached locally by your browser.

## Browser support and WebGPU notes

- WebGPU generally requires a secure context (HTTPS or `http://localhost`)
- If WebGPU is unavailable or fails, the app falls back to CPU (WASM)
- First run is slower due to model downloads, later runs often reuse cached assets

## Repo layout

- `frontend/` Vite + React app
- `backend/` Express app packaged for Lambda
- `backend/infra/` OpenTofu infrastructure for Lambda + API Gateway + logs

## Run locally

### 1) Backend

```bash
cd backend
npm ci
npm run dev
```

Backend defaults to `http://localhost:4000`.

Optional local env (create `backend/.env`):

```bash
NODE_ENV=development
PORT=4000
ALLOWED_ORIGINS=http://localhost:5173
```

### 2) Frontend

```bash
cd frontend
npm ci
cp .env.example .env
npm run dev
```

Open `http://localhost:5173`.

## Configure API base URL

The frontend reads `VITE_API_BASE_URL` at build time.

Local:

- `frontend/.env`

  - `VITE_API_BASE_URL=http://localhost:4000`

Deployed:

- Set `VITE_API_BASE_URL` to your deployed API Gateway endpoint
- See `frontend/README.md` for deployment notes

## Deploy

- Backend deployment (OpenTofu + GitHub Actions): see `backend/README.md`
- Frontend deployment (static hosting): see `frontend/README.md`

