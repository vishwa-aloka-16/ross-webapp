from __future__ import annotations

from abc import ABC, abstractmethod


class BaseStrategy(ABC):
    name: str

    @abstractmethod
    def chunk(self, extraction_artifact, document_profile, owner_id: str):
        raise NotImplementedError

    @abstractmethod
    async def build_tree(self, embedded_chunks, document_profile, document_id: str, owner_id: str):
        raise NotImplementedError

    @abstractmethod
    def validate(self, tree_nodes, chunks, document_profile):
        raise NotImplementedError
