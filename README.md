# Ross

Ross is a multi-service legal document analysis workspace with:

- `webapp/`: React + Vite frontend
- `gateway/`: Node.js API gateway for auth, document orchestration, and RAG routing
- `ai-service/`: Python service for ingestion, embeddings, summary trees, and answer generation

## Before publishing

This repository is configured to keep local secrets and generated files out of git:

- `.env` files are ignored
- `node_modules`, `dist`, Python caches, and runtime caches are ignored
- large local test exports and zipped assets are ignored

Use the example environment files below when setting up a new machine:

- `webapp/.env.example`
- `gateway/.env.example`
- `ai-service/.env.example`

## Local setup

### Web app

```bash
cd webapp
npm install
npm run dev
```

### Gateway

```bash
cd gateway
npm install
npm run start
```

### AI service

```bash
cd ai-service
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

## Recommended publish checklist

1. Copy each `.env.example` to a real `.env` locally and fill in your secrets.
2. Verify the frontend `VITE_API_BASE_URL` points to your deployed gateway.
3. Confirm MongoDB, Supabase, and Gemini credentials are not committed.
4. Build the frontend before release with `npm run build` inside `webapp/`.
5. Commit from the repo root after reviewing `git status`.
