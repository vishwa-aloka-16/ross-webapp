from __future__ import annotations

from models.pipeline_checkpoint import PipelineCheckpoint
from utils.id_generator import generate_id


class StageRunner:
    def __init__(self, checkpoint_repository, artifact_repository) -> None:
        self.checkpoint_repository = checkpoint_repository
        self.artifact_repository = artifact_repository

    def run_stage(self, *, job, run_id: str, stage: str, artifact_type: str, fn):
        result = fn()
        artifact_ref = self.artifact_repository.save(
            document_id=job.document_id,
            run_id=run_id,
            artifact_type=artifact_type,
            payload=result,
        )
        checkpoint = PipelineCheckpoint(
            checkpoint_id=generate_id("chk"),
            document_id=job.document_id,
            owner_id=job.owner_id,
            run_id=run_id,
            stage=stage,
            status="completed",
            artifact_ref=artifact_ref,
        )
        self.checkpoint_repository.save(checkpoint)
        return result
