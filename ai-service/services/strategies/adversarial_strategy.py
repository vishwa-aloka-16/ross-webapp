from services.strategies.transactional_strategy import TransactionalStrategy
from services.chunkers.adversarial_chunker import AdversarialChunker
from services.raptor_builders.adversarial_raptor_builder import AdversarialRaptorBuilder


class AdversarialStrategy(TransactionalStrategy):
    name = "ADVERSARIAL"

    def __init__(self) -> None:
        super().__init__()
        self.chunker = AdversarialChunker()
        self.raptor_builder = AdversarialRaptorBuilder()
