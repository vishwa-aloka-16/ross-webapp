<h1 align="left">
  <img src="webapp/src/assets/logo.png" alt="Ross logo" width="44" style="vertical-align: middle; box-sizing:border-box; margin-right: 10px; padding:5px; background-color:#fff; border-radius:100px;" />
  Ross
</h1>

Ross is an AI-powered legal document analysis platform for uploading contracts and legal PDFs, running a multi-stage ingestion pipeline, generating hierarchical summaries, and answering document-grounded questions with citations.

Live app: https://ross-ai.netlify.app/  
Repository: https://github.com/vishwa-aloka-16/ross-webapp

## System Overview

The repository contains three application services plus local data assets:

- `webapp/` - React frontend for authentication, upload, document review, summary exploration, PDF viewing, and evidence inspection
- `gateway/` - Express API gateway for auth, document metadata, upload orchestration, storage access, and AI-service proxying
- `ai-service/` - Flask-based AI pipeline for PDF extraction, chunking, embeddings, clustering, summary-tree construction, retrieval, and answer generation 

## End-to-End Flow

1. A user signs in through the React frontend.
2. The frontend uploads one or more PDF files to the gateway.
3. The gateway validates the request, stores the PDF in Supabase Storage, creates MongoDB document records, and triggers AI ingestion through an internal service call.
4. The AI service downloads the PDF, extracts and normalizes document blocks, chooses a layout strategy, chunks content, creates embeddings, clusters sections, and stores summary and leaf nodes in Postgres with `pgvector`.
5. The gateway exposes document status, summary-tree, and RAG endpoints back to the frontend.
6. The frontend renders the PDF, summary tree, evidence sources, and question-answering results.

## Repository Structure

```text
LAWAI/
|-- webapp/        # Frontend application
|-- gateway/       # Node/Express API gateway
|-- ai-service/    # Python AI and 
README.md
```

## System Components

### Frontend (`webapp`)

Core app shell and pages:

- `src/App.jsx` - root application state, auth flow, upload flow, ingestion polling, summary loading, and workspace coordination
- `src/RossLandingPage.jsx` - public landing page
- `src/RossAuth.jsx` - sign-in, demo request, and password reset request UI
- `src/components/workspace/WorkspaceShell.jsx` - authenticated workspace layout

Workspace components:

- `src/components/workspace/DocumentSidebar.jsx` - document list, search, and document actions
- `src/components/workspace/PdfViewerPanel.jsx` - PDF rendering and page focus
- `src/components/workspace/RightInsightPanel.jsx` - summary and evidence side panel

Summary and evidence components:

- `src/components/summaries/SummaryExplorer.jsx`
- `src/components/summaries/SummaryTree.jsx`
- `src/components/summaries/SummaryNode.jsx`
- `src/components/summaries/SummaryCard.jsx`
- `src/components/summaries/EvidenceDrawer.jsx`
- `src/components/summaries/summaryHelpers.js`

Upload and workflow components:

- `src/components/upload/UploadModal.jsx`
- `src/components/upload/IngestionProgressModal.jsx`

Shared UI components:

- `src/components/common/Button.jsx`
- `src/components/common/Spinner.jsx`
- `src/components/common/EmptyState.jsx`
- `src/components/common/MarkdownContent.jsx`

Frontend API modules:

- `src/api/authApi.js` - login and current-user requests
- `src/api/documentApi.js` - document list, upload, delete, and ingestion status
- `src/api/summaryApi.js` - summary-tree and evidence retrieval
- `src/api/wakeApi.js` - service wake-up helper

Static and media assets:

- `public/logo-Ross.png`, `public/favicon.svg`, `public/icons.svg`
- `src/assets/logo.png`, `src/assets/hero.png`, `src/assets/landing-img.png`, `src/assets/promo.mp4`

### Gateway (`gateway`)

Application entrypoints:

- `index.js` - process bootstrap
- `app.js` - Express app creation and route registration

Configuration:

- `config/env.js` - environment variable loading
- `config/db.js` - MongoDB connection
- `config/supabase.js` - Supabase client setup

Routes:

- `routes/healthRoutes.js` - health endpoint
- `routes/authRoutes.js` - register, login, and current-user endpoints
- `routes/documentRoutes.js` - document list, upload, status, delete, and internal status callback
- `routes/ragRoutes.js` - RAG query, summary-tree, and cluster-debug endpoints

Controllers:

- `controllers/healthController.js`
- `controllers/authController.js`
- `controllers/documentController.js`

Middleware:

- `middleware/cors.js` - CORS policy
- `middleware/authenticate.js` - JWT auth for end users
- `middleware/authenticateInternalService.js` - internal service authentication for AI callbacks
- `middleware/requireConfiguration.js` - startup/config validation gate
- `middleware/upload.js` - `multer` upload parsing

Models:

- `models/User.js` - user records
- `models/Document.js` - uploaded document records and ingestion metadata

Services:

- `services/authService.js` - token creation and user serialization
- `services/documentService.js` - signed PDF URL generation and document serialization
- `services/aiService.js` - internal calls to the AI service

### AI Service (`ai-service`)

Application entrypoints:

- `main.py` - runtime entrypoint
- `app.py` - Flask app, health endpoints, ingestion API, RAG API, summary-tree API, and cluster-debug API

Core configuration and security:

- `core/config.py` - typed settings
- `core/logging.py` - logging bootstrap
- `core/security.py` - internal service key validation

Schemas:

- `schemas/health.py`
- `schemas/ingestion.py`
- `schemas/query.py`

Data models:

- `models/ingestion_job.py`
- `models/pipeline_checkpoint.py`
- `models/document_profile.py`
- `models/document_block.py`
- `models/chunk_record.py`
- `models/embedded_chunk_record.py`
- `models/tree_node_record.py`
- `models/extraction_artifact.py`
- `models/validation_result.py`

Database and persistence:

- `db/supabase_client.py` - Supabase access
- `db/pgvector.py` - schema creation, node storage, vector matching, and node fetch logic
- `sql/raptor_nodes.sql` - node schema

Orchestration and status:

- `services/ingestion_service.py` - background ingestion queue and job status
- `services/orchestrator/ingestion_orchestrator.py` - pipeline coordinator
- `services/orchestrator/stage_runner.py`
- `services/orchestrator/pipeline_stage.py`
- `services/orchestrator/status_reporter.py`
- `services/orchestrator/retry_policy.py`

Extraction pipeline:

- `services/pdf_extraction_service.py`
- `services/extraction/extraction_router.py`
- `services/extraction/extraction_orchestrator.py`
- `services/extraction/pdf_profiler.py`
- `services/extraction/engines/pymupdf_extractor.py`
- `services/extraction/engines/pdfplumber_extractor.py`
- `services/extraction/engines/ocr_extractor.py`

Normalization and extraction quality:

- `services/extraction/normalization/block_normalizer.py`
- `services/extraction/normalization/reading_order_resolver.py`
- `services/extraction/normalization/table_normalizer.py`
- `services/extraction/normalization/header_footer_detector.py`
- `services/extraction/normalization/heading_detector.py`
- `services/extraction/normalization/list_item_detector.py`
- `services/extraction/quality/extraction_quality_checker.py`
- `services/extraction/quality/extraction_report_builder.py`

Chunking and strategy system:

- `services/chunking_service.py`
- `services/chunkers/base_chunker.py`
- `services/chunkers/hierarchical_chunker.py`
- `services/chunkers/transactional_chunker.py`
- `services/chunkers/adversarial_chunker.py`
- `services/chunkers/chunk_quality_validator.py`
- `services/strategies/base_strategy.py`
- `services/strategies/hierarchical_strategy.py`
- `services/strategies/transactional_strategy.py`
- `services/strategies/adversarial_strategy.py`
- `services/strategies/strategy_router.py`

Embeddings, clustering, and RAPTOR-style tree building:

- `services/embedding_service.py`
- `services/embeddings/embedding_service.py`
- `services/embeddings/embedding_batcher.py`
- `services/clustering_service.py`
- `services/cluster_planning_service.py`
- `services/cluster_debug_service.py`
- `services/clusterers/cluster_planner.py`
- `services/clusterers/cluster_validator.py`
- `services/clusterers/global_clusterer.py`
- `services/clusterers/structural_clusterer.py`
- `services/clusterers/adversarial_clusterer.py`
- `services/raptor_service.py`
- `services/raptor_builders/base_raptor_builder.py`
- `services/raptor_builders/hierarchical_raptor_builder.py`
- `services/raptor_builders/transactional_raptor_builder.py`
- `services/raptor_builders/adversarial_raptor_builder.py`
- `services/raptor_builders/raptor_tree_validator.py`
- `services/summary_queue.py`
- `services/summary_tree_service.py`

Retrieval and answering:

- `services/retrieval_service.py`
- `services/answer_service.py`
- `services/gemini_cache_service.py`
- `providers/gemini_provider.py`

Storage, callbacks, and repositories:

- `services/storage_service.py`
- `services/storage/storage_download_service.py`
- `services/storage/temp_file_service.py`
- `services/gateway_callback_service.py`
- `services/repositories/document_status_repository.py`
- `services/repositories/checkpoint_repository.py`
- `services/repositories/artifact_repository.py`
- `services/repositories/chunk_repository.py`
- `services/repositories/node_repository.py`

Utilities and tests:

- `utils/token_counter.py`
- `utils/text_cleaner.py`
- `utils/id_generator.py`
- `utils/logging_utils.py`
- `tests/test_pdf_extraction_and_chunking.py`
- `tests/test_cluster_debug_and_planning.py`
- `tests/test_v2_pipeline.py`

## Supported Document Processing Strategies

The ingestion pipeline supports three layout strategies exposed through the upload flow and backend validation:

- `ADVERSARIAL`
- `HIERARCHICAL`
- `TRANSACTIONAL`

## Technology Stack

### Frontend Technologies

- `React 19`
- `React DOM`
- `Vite`
- `ESLint`
- `@vitejs/plugin-react`
- `react-markdown`
- `remark-gfm`
- `react-syntax-highlighter`
- `prismjs`
- `react-pdf`
- `pdfjs-dist`
- `reactflow`
- `@ai-sdk/google`
- `ai`
- Plain CSS

### Gateway Technologies

- `Node.js`
- `Express 5`
- `Mongoose`
- `MongoDB`
- `jsonwebtoken`
- `bcryptjs`
- `multer`
- `dotenv`
- `@supabase/supabase-js`

### AI Service Technologies

- `Python`
- `Flask`
- `Gunicorn`
- `Pydantic`
- `pydantic-settings`
- `httpx`
- `numpy`
- `scipy`
- `scikit-learn`
- `pdfplumber`
- `google-genai`
- `supabase`
- `psycopg`
- `pgvector`

### Data, AI, and Infrastructure

- `MongoDB Atlas` for users and document metadata
- `Supabase Storage` for uploaded PDFs
- `Supabase Postgres` for AI artifacts and indexed nodes
- `pgvector` for vector similarity search
- `Google Gemini` for embeddings, summarization, and answer generation
- `JWT` for session authentication
- Internal service key authentication between `gateway` and `ai-service`
- `Netlify` for frontend deployment
- `Render` for backend and AI-service deployment
- `GitHub` for source control and deployment integration

## API Surface

### Gateway Endpoints

- `GET /health`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/documents`
- `GET /api/documents/:documentId/status`
- `POST /api/documents/upload`
- `DELETE /api/documents/:documentId`
- `POST /api/documents/internal/:documentId/ingestion-status`
- `POST /api/rag/query`
- `GET /api/rag/summary-tree/:documentId`
- `POST /api/rag/debug-clusters/:documentId`

### AI Service Endpoints

- `GET /health`
- `POST /ingestion/documents`
- `GET /ingestion/documents/:document_id/status`
- `POST /rag/query`
- `POST /rag/summary-tree`
- `POST /debug/clusters`

## Environment Variables

### Frontend

- `VITE_API_BASE_URL`
- `VITE_AI_SERVICE_URL`

### Gateway

- `PORT`
- `CORS_ORIGIN`
- `MONGODB_URI`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `AI_SERVICE_URL`
- `INTERNAL_SERVICE_KEY`
- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET`
- `SIGNED_URL_EXPIRES_IN`

### AI Service

- `PORT`
- `AI_SERVICE_HOST`
- `INTERNAL_SERVICE_KEY`
- `GATEWAY_URL`
- `GATEWAY_INTERNAL_STATUS_PATH`
- `GEMINI_API_KEY`
- `EMBEDDING_MODEL_NAME`
- `SUMMARIZATION_MODEL_NAME`
- `ANSWER_MODEL_NAME`
- `EMBEDDING_BATCH_SIZE`
- `EMBEDDING_OUTPUT_DIMENSIONS`
- `SUMMARY_REQUEST_INTERVAL_SECONDS`
- `MAX_SUMMARY_RETRIES`
- `MAX_EMBEDDING_RETRIES`
- `SUPABASE_URL`
- `SUPABASE_KEY`
- `SUPABASE_SECRET_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET`
- `SUPABASE_DB_URL`

Example files:

- `webapp/.env.example`
- `gateway/.env.example`
- `ai-service/.env.example`

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

## Deployment

### Netlify

- Base directory: `webapp`
- Build command: `npm run build`
- Publish directory: `dist`

### Render Gateway

- Root directory: `gateway`
- Build command: `npm install`
- Start command: `npm start`

### Render AI Service

- Root directory: `ai-service`
- Build command: `pip install -r requirements.txt`
- Start command: `gunicorn --bind 0.0.0.0:$PORT main:app`

## Notes

- The frontend expects the gateway base URL in `VITE_API_BASE_URL`.
- The gateway and AI service must share the same `INTERNAL_SERVICE_KEY`.
- The gateway must be connected to MongoDB and Supabase Storage before uploads will work.
- The AI service must be connected to Supabase Storage, Supabase Postgres, and Gemini before ingestion and RAG will work.
 