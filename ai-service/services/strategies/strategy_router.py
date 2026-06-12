from services.strategies.adversarial_strategy import AdversarialStrategy
from services.strategies.hierarchical_strategy import HierarchicalStrategy
from services.strategies.transactional_strategy import TransactionalStrategy


class StrategyRouter:
    def __init__(self) -> None:
        self._strategies = {
            "TRANSACTIONAL": TransactionalStrategy(),
            "ADVERSARIAL": AdversarialStrategy(),
            "HIERARCHICAL": HierarchicalStrategy(),
        }

    def get_strategy(self, layout_strategy: str):
        return self._strategies.get(layout_strategy, self._strategies["TRANSACTIONAL"])
