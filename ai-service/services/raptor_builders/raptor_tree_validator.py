from models.tree_node_record import TreeNodeRecord
from models.validation_result import ValidationResult


class RaptorTreeValidator:
    def validate(self, nodes: list[TreeNodeRecord], *, layout_strategy: str) -> ValidationResult:
        errors: list[str] = []
        if not nodes:
            errors.append("No tree nodes were produced.")
        ids = {node.id for node in nodes}
        if len(ids) != len(nodes):
            errors.append("Duplicate node IDs detected.")
        leaf_count = sum(1 for node in nodes if node.node_type == "leaf")
        if leaf_count == 0:
            errors.append("No leaf nodes were produced.")
        for node in nodes:
            if node.parent_id and node.parent_id not in ids:
                errors.append(f"Node {node.id} references missing parent {node.parent_id}.")
            if node.page_start and node.page_end and node.page_start > node.page_end:
                errors.append(f"Node {node.id} has invalid page range.")
            if node.layout_strategy != layout_strategy:
                errors.append(f"Node {node.id} has mismatched layout strategy.")
        return ValidationResult(
            passed=not errors,
            errors=errors,
            warnings=[],
            stats={"node_count": len(nodes), "leaf_count": leaf_count},
        )
