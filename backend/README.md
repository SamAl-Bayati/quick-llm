<p align="center">
  <a href="https://quickllm.samalbayati.com">
    <img src="../frontend/src/assets/qlm-high-resolution-logo.png" alt="Quick LLM" width="280" />
  </a>
</p>

<p align="center">
  <a href="https://quickllm.samalbayati.com">Try the app right now!</a>
</p>

# Quick LLM Backend

This is the backend for Quick LLM. It serves:

- `GET /health`
- `GET /api/models`

It does not run inference and does not receive prompts.

The backend is deployed to AWS using:

- AWS Lambda (Node.js)
- API Gateway HTTP API
- OpenTofu for IaC
- GitHub Actions for CI/CD

## Local dev

```bash
npm ci
npm run dev
```

By default, local runs on `http://localhost:4000`.

Optional local env (create `backend/.env`):

```bash
NODE_ENV=development
PORT=4000
ALLOWED_ORIGINS=http://localhost:5173
```

## CORS

CORS is controlled by `ALLOWED_ORIGINS` which is a comma-separated list.

Examples:

- Local only:

  - `ALLOWED_ORIGINS=http://localhost:5173`

- Local + prod:

  - `ALLOWED_ORIGINS=http://localhost:5173,https://your-frontend.com`

If `ALLOWED_ORIGINS` is empty, the current CORS middleware allows all origins.

## Deploy via GitHub Actions + OpenTofu

This repo deploys automatically:

- Dev: push to `dev`

  - `.github/workflows/deploy-backend-dev.yml`
  - uses `backend/infra/environments/dev.tfvars`

- Prod: push to `main`

  - `.github/workflows/deploy-backend-prod.yml`
  - uses `backend/infra/environments/prod.tfvars`

### Required GitHub secrets

Your workflows reference these secrets:

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION`
- `TF_STATE_BUCKET`

The OpenTofu backend state key is derived from the repo name and environment.

## Manual deploy from your machine

From `backend/infra`:

```bash
tofu init \
  -backend-config="bucket=<TF_STATE_BUCKET>" \
  -backend-config="key=<repo>/<env>/terraform.tfstate" \
  -backend-config="region=<AWS_REGION>" \
  -backend-config="use_lockfile=true"
```

Then apply:

```bash
tofu apply -auto-approve \
  -var-file="environments/<env>.tfvars" \
  -var="lambda_zip_path=/absolute/path/to/function.zip"
```

The GitHub Actions workflow creates `function.zip` for you. If doing it locally, zip:

- `backend/index.js`
- `backend/src/`
- `backend/node_modules/`
- `backend/package.json`
- `backend/package-lock.json`

## Get the deployed API endpoint

```bash
cd infra
tofu output -raw api_endpoint
```

## Smoke test

```bash
API="$(tofu output -raw api_endpoint)"
curl -sS "$API/health" | cat
curl -sS "$API/api/models" | cat
```

If `/api/models` works here but the frontend fails:

- CORS likely needs your frontend origin in `ALLOWED_ORIGINS`
- Or the frontend build has the wrong `VITE_API_BASE_URL`
