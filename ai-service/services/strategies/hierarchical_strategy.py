from services.strategies.transactional_strategy import TransactionalStrategy
from services.chunkers.hierarchical_chunker import HierarchicalChunker
from services.raptor_builders.hierarchical_raptor_builder import HierarchicalRaptorBuilder


class HierarchicalStrategy(TransactionalStrategy):
    name = "HIERARCHICAL"

    def __init__(self) -> None:
        super().__init__()
        self.chunker = HierarchicalChunker()
        self.raptor_builder = HierarchicalRaptorBuilder()
