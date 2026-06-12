from __future__ import annotations
import logging

from models.document_profile import DocumentProfile, PageProfile
from models.ingestion_job import IngestionJob
from services.embeddings.embedding_service import EmbeddingService
from services.extraction.extraction_orchestrator import ExtractionOrchestrator
from services.orchestrator.stage_runner import StageRunner
from services.orchestrator.status_reporter import StatusReporter
from services.repositories.artifact_repository import ArtifactRepository
from services.repositories.checkpoint_repository import CheckpointRepository
from services.repositories.document_status_repository import DocumentStatusRepository
from services.repositories.node_repository import NodeRepository
from services.storage.storage_download_service import StorageDownloadService
from services.storage.temp_file_service import TempFileService
from services.strategies.strategy_router import StrategyRouter
from utils.id_generator import generate_id

logger = logging.getLogger(__name__)


class IngestionOrchestrator:
    def __init__(self, *, job_statuses: dict[str, dict] | None = None) -> None:
        self.job_statuses = job_statuses if job_statuses is not None else {}
        self.storage_download_service = StorageDownloadService()
        self.temp_file_service = TempFileService()
        self.extraction_orchestrator = ExtractionOrchestrator()
        self.embedding_service = EmbeddingService()
        self.strategy_router = StrategyRouter()
        self.checkpoint_repository = CheckpointRepository()
        self.artifact_repository = ArtifactRepository()
        self.stage_runner = StageRunner(self.checkpoint_repository, self.artifact_repository)
        self.node_repository = NodeRepository()
        self.document_status_repository = DocumentStatusRepository(self.job_statuses)
        self.status_reporter = StatusReporter(self.document_status_repository)

    async def run(self, job: IngestionJob) -> dict:
        run_id = generate_id("run")
        await self.document_status_repository.update(
            document_id=job.document_id,
            status="processing",
            stage="pending",
            progress=0,
            run_id=run_id,
        )

        await self.status_reporter.report(
            document_id=job.document_id,
            status="processing",
            stage="downloading_pdf",
            progress=10,
            message="Downloading PDF",
            run_id=run_id,
        )
        pdf_path = self.stage_runner.run_stage(
            job=job,
            run_id=run_id,
            stage="download_complete",
            artifact_type="downloaded_pdf_path",
            fn=lambda: self.download_pdf(job),
        )

        await self.status_reporter.report(
            document_id=job.document_id,
            status="processing",
            stage="extracting_pdf_structure",
            progress=25,
            message="Extracting document",
            run_id=run_id,
        )
        extraction_artifact = self.stage_runner.run_stage(
            job=job,
            run_id=run_id,
            stage="extract_complete",
            artifact_type="extraction_artifact",
            fn=lambda: self.extraction_orchestrator.extract_document_v2(pdf_path, job.document_id),
        )

        await self.status_reporter.report(
            document_id=job.document_id,
            status="processing",
            stage="profiling_document",
            progress=35,
            message="Profiling document",
            run_id=run_id,
        )
        document_profile = self.stage_runner.run_stage(
            job=job,
            run_id=run_id,
            stage="profile_complete",
            artifact_type="document_profile",
            fn=lambda: self._profile_from_artifact(extraction_artifact),
        )

        strategy = self.strategy_router.get_strategy(job.layout_strategy)
        await self.status_reporter.report(
            document_id=job.document_id,
            status="processing",
            stage="selecting_strategy",
            progress=40,
            message=f"Selected {strategy.name} strategy",
            run_id=run_id,
        )

        chunks = self.stage_runner.run_stage(
            job=job,
            run_id=run_id,
            stage="chunk_complete",
            artifact_type="chunks",
            fn=lambda: strategy.chunk(extraction_artifact, document_profile, job.owner_id),
        )

        chunk_validation = self.stage_runner.run_stage(
            job=job,
            run_id=run_id,
            stage="chunk_validation_complete",
            artifact_type="chunk_validation",
            fn=lambda: strategy.chunk_validator.validate(chunks, layout_strategy=strategy.name),
        )
        if not chunk_validation.passed:
            raise RuntimeError("; ".join(chunk_validation.errors))

        await self.status_reporter.report(
            document_id=job.document_id,
            status="processing",
            stage="embedding_chunks",
            progress=72,
            message="Embedding chunks",
            run_id=run_id,
        )
        embedded_chunks = await self.embedding_service.embed_chunks(chunks)
        self.artifact_repository.save(
            document_id=job.document_id,
            run_id=run_id,
            artifact_type="embedded_chunks",
            payload=embedded_chunks,
        )

        await self.status_reporter.report(
            document_id=job.document_id,
            status="processing",
            stage="building_tree",
            progress=84,
            message="Building RAPTOR tree",
            run_id=run_id,
        )
        tree_nodes = await strategy.build_tree(embedded_chunks, document_profile, job.document_id, job.owner_id)
        self.artifact_repository.save(
            document_id=job.document_id,
            run_id=run_id,
            artifact_type="tree_nodes",
            payload=tree_nodes,
        )

        await self.status_reporter.report(
            document_id=job.document_id,
            status="processing",
            stage="validating_tree",
            progress=92,
            message="Validating RAPTOR tree",
            run_id=run_id,
        )
        validation = strategy.validate(tree_nodes, chunks, document_profile)
        self.stage_runner.run_stage(
            job=job,
            run_id=run_id,
            stage="validate_complete",
            artifact_type="validation_result",
            fn=lambda: validation,
        )
        if not validation.passed:
            raise RuntimeError("; ".join(validation.errors))

        await self.status_reporter.report(
            document_id=job.document_id,
            status="processing",
            stage="storing_nodes",
            progress=98,
            message="Storing nodes",
            run_id=run_id,
        )
        result = self.stage_runner.run_stage(
            job=job,
            run_id=run_id,
            stage="store_complete",
            artifact_type="store_result",
            fn=lambda: self.store_result(job, run_id, tree_nodes),
        )

        await self.document_status_repository.update(
            document_id=job.document_id,
            status="indexed",
            stage="indexed",
            progress=100,
            run_id=run_id,
        )
        return result

    def download_pdf(self, job: IngestionJob) -> str:
        pdf_bytes = self.storage_download_service.download_pdf(job.storage_path)
        return self.temp_file_service.write_pdf(pdf_bytes)

    def store_result(self, job: IngestionJob, run_id: str, tree_nodes: list[dict]) -> dict:
        for node in tree_nodes:
            node.setdefault("metadata", {})
            node["metadata"].setdefault("layout_strategy", job.layout_strategy)
            node["metadata"]["run_id"] = run_id
        self.node_repository.replace_document_nodes(document_id=job.document_id, nodes=tree_nodes)
        return {
            "documentId": job.document_id,
            "ownerId": job.owner_id,
            "runId": run_id,
            "layoutStrategy": job.layout_strategy,
            "nodeCount": len(tree_nodes),
            "status": "indexed",
        }

    def _profile_from_artifact(self, extraction_artifact):
        pages = [
            PageProfile(**page_payload)
            for page_payload in extraction_artifact.profile.get("pages", [])
        ]
        return DocumentProfile(
            document_id=extraction_artifact.profile["document_id"],
            total_pages=extraction_artifact.profile["total_pages"],
            is_scanned=extraction_artifact.profile["is_scanned"],
            is_mixed=extraction_artifact.profile["is_mixed"],
            has_tables=extraction_artifact.profile["has_tables"],
            has_complex_layout=extraction_artifact.profile["has_complex_layout"],
            ocr_required_pages=extraction_artifact.profile.get("ocr_required_pages", []),
            table_heavy_pages=extraction_artifact.profile.get("table_heavy_pages", []),
            empty_pages=extraction_artifact.profile.get("empty_pages", []),
            average_text_density=extraction_artifact.profile.get("average_text_density", 0.0),
            confidence=extraction_artifact.profile.get("confidence", 0.0),
            pages=pages,
        )
