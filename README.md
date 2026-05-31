<h1 align="left">
  <img src="webapp/public/logo-Ross.png" alt="Ross logo" width="44" style="vertical-align: middle; margin-right: 10px;" />
  Ross
</h1>

Ross is an AI-powered legal document analysis platform for uploading contracts and legal PDFs, generating structured summaries, and asking document-grounded questions through a chat interface.

Live app: https://ross-ai.netlify.app/  
Repository: https://github.com/vishwa-aloka-16/ross-webapp

## Overview

Ross is split into three services:

- `webapp/` - the React frontend used by end users
- `gateway/` - the Node.js API layer for auth, document workflows, and service orchestration
- `ai-service/` - the Python AI pipeline for ingestion, clustering, summary trees, retrieval, and answer generation

## Features

- User registration and login
- PDF upload and document tracking
- Background ingestion pipeline
- Legal document summarization
- Hierarchical summary tree generation
- RAG-based document Q&A with citations
- Support for different legal document layout strategies

## Architecture

1. The frontend uploads documents and sends authenticated requests to the gateway.
2. The gateway stores document metadata, uploads files to Supabase Storage, and queues AI ingestion.
3. The AI service extracts PDF text, chunks the content, creates embeddings, clusters sections, and stores nodes in pgvector.
4. The frontend can then request summary trees and ask questions against indexed documents.

## Tech Stack

### Frontend

- `React 19` for the user interface
- `Vite` for fast development and production builds
- `React Markdown` and `remark-gfm` for rendering rich markdown responses
- `react-syntax-highlighter` for formatted code or structured content blocks
- Plain CSS and custom component styling for the UI

### Gateway

- `Node.js` as the JavaScript runtime
- `Express` for HTTP APIs
- `Mongoose` for MongoDB models and persistence
- `jsonwebtoken` for JWT-based authentication
- `bcryptjs` for password hashing
- `multer` for file upload handling
- `dotenv` for environment variable management
- `@supabase/supabase-js` for storage operations

### AI Service

- `Python` for the document intelligence pipeline
- `Flask` for the AI API server
- `Gunicorn` for production serving
- `Pydantic` and `pydantic-settings` for request validation and configuration
- `httpx` for service-to-service HTTP calls
- `PyPDF` for PDF text extraction
- `NumPy`, `SciPy`, and `scikit-learn` for clustering and analysis
- `google-genai` for Gemini-powered summarization, embeddings, and answer generation
- `psycopg` and `pgvector` for vector storage and retrieval in Postgres
- `supabase` Python client for storage access

## Data and Infrastructure

- `MongoDB Atlas` stores users and document metadata
- `Supabase Storage` stores uploaded PDFs
- `Supabase Postgres + pgvector` stores embeddings and summary tree nodes
- `Gemini` powers summarization, embeddings, and question answering

## Deployment

- `Netlify` hosts the frontend
- `Render` hosts the gateway
- `Render` can also host the AI service
- `GitHub` is used for source control and deployment integration

## Repository Structure

```text
ross-webapp/
├── webapp/        # React frontend
├── gateway/       # Node/Express backend
├── ai-service/    # Python AI service
└── data/          # local test assets and sample files
```

## Environment Files

Example env files are included here:

- `webapp/.env.example`
- `gateway/.env.example`
- `ai-service/.env.example`

Do not commit real secrets. Use your deployment platform's environment variable settings for production credentials.

## Local Development

### Frontend

```bash
cd webapp
npm install
npm run dev
```

### Gateway

```bash
cd gateway
npm install
npm start
```

### AI Service

```bash
cd ai-service
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

## Production Build Settings

### Netlify

- Base directory: `webapp`
- Build command: `npm run build`
- Publish directory: `dist`
- Frontend environment variable: `VITE_API_BASE_URL`

### Render Gateway

- Root directory: `gateway`
- Build command: `npm install`
- Start command: `npm start`

### Render AI Service

- Root directory: `ai-service`
- Build command: `pip install -r requirements.txt`
- Start command: `gunicorn --bind 0.0.0.0:$PORT main:app`

## Key Tools Used

- `Git` and `GitHub` for version control
- `Netlify` for frontend deployment
- `Render` for backend and AI service deployment
- `MongoDB Atlas` for document/user data
- `Supabase` for file storage and vector-backed Postgres data
- `Gemini` for LLM and embedding capabilities
- `ESLint` for frontend linting

## Notes

- The frontend expects a `VITE_API_BASE_URL` pointing to the deployed gateway.
- The gateway must be configured with the correct `CORS_ORIGIN` for the frontend domain.
- The AI service needs a valid `SUPABASE_DB_URL` to read and write pgvector-backed nodes.
- The gateway and AI service should share the same `INTERNAL_SERVICE_KEY`.
