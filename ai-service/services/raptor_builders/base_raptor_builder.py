from __future__ import annotations

from abc import ABC, abstractmethod


class BaseRaptorBuilder(ABC):
    @abstractmethod
    async def build_tree(self, *, document_id: str, owner_id: str, embedded_chunks, document_profile):
        raise NotImplementedError
