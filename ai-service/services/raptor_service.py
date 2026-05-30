import logging
import math
from collections import defaultdict
from uuid import uuid4

from services.summary_queue import summary_queue

logger = logging.getLogger(__name__)


LEGAL_SUMMARIZATION_PROMPT = """
You are an expert legal counsel, senior analytical attorney, and legal text engineer. Your task is to review a provided section, cluster of clauses, or textual excerpt extracted from a legal instrument, document, or record, and generate a dense, abstractive, and authoritative legal summary.

### STRUCTURAL FOCUS BY DOCUMENT TYPE:
Adapt your analytical focus based on the nature of the source text provided:
- **Transactional / Contracts**: Synthesize overarching legal positions, core rights granted, mutual or asymmetric covenants, and operational mechanics.
- **Litigation / Briefs / Court Records**: Extract the procedural posture, legal arguments, standard of review, material facts, judicial holdings, and rationale.
- **Regulatory / Statutory / Compliance**: Identify statutory authorities, explicit compliance thresholds, mandatory reportable metrics, and enforcement or non-compliance penalties.
- **Corporate Governance / Internal Instruments**: Synthesize delegation of authority, fiduciary obligations, voting thresholds, and organizational protocols.

### INSTRUCTIONS:
1. **Thematic Synthesis**: Consolidate the text into a coherent, high-level structural framework. Do not merely list facts or copy sentences sequentially; synthesize the content into definitive legal positions, rights, or obligations.
2. **Preserve Core Parameters & Quantitative Thresholds**: Retain explicit legal conditions, financial or liability thresholds, caps, timelines, statutory cure periods (e.g., "within 10 business days"), governing laws, and jurisdictional parameters.
3. **Highlight Legal & Operational Exposure**: Explicitly emphasize any latent liability, asymmetric risk, strict compliance overhead, waiver of rights, or restrictive conditions imposed on any party.
4. **No Jargon Dilution (Maintain Terms of Art)**: Do not replace precise legal terms of art (e.g., "Indemnification", "Estoppel", "Res Judicata", "Conditions Precedent", "Material Breach", "Fiduciary Duty") with simplified, casual phrasing. Keep the tone human-led, highly professional, logically dense, and authoritative.
5. **Strict Contextual Grounding**: Base your summary *exclusively* on the provided text. Do not introduce outside legal principles, external facts, or standardized boilerplate provisions that are not explicitly grounded in this text.

### LEGAL TEXT EXCERPT TO SUMMARIZE:
{cluster_text}

### EXECUTIVE LEGAL SUMMARY:
"""


def plan_optimal_raptor_tree(
    n: int,
    target_compression: int = 4,
    min_nodes: int = 4,
) -> list[int]:
    if n <= 0:
        return []

    levels = [n]
    current = n

    while current >= min_nodes:
        next_level_nodes = math.ceil(current / target_compression)
        if next_level_nodes >= current:
            break

        levels.append(next_level_nodes)
        current = next_level_nodes

    if len(levels) > 1 and levels[-1] > 1:
        levels.append(1)

    return levels


async def summarize_group(*, document_id: str, owner_id: str, member_nodes: list[dict], level: int, cluster_id: str, metadata: dict) -> dict:
    cluster_content = "\n\n".join(node["content"] for node in member_nodes)
    prompt = LEGAL_SUMMARIZATION_PROMPT.format(cluster_text=cluster_content)
    summary = await summary_queue.enqueue(prompt)
    node_id = str(uuid4())
    summary_node = {
        "id": node_id,
        "document_id": document_id,
        "owner_id": owner_id,
        "node_type": "summary",
        "level": level,
        "parent_id": None,
        "content": summary,
        "page_start": min(node.get("page_start") or 0 for node in member_nodes) or None,
        "page_end": max(node.get("page_end") or 0 for node in member_nodes) or None,
        "chunk_index": None,
        "cluster_id": cluster_id,
        "metadata": {
            "child_ids": [node["id"] for node in member_nodes],
            **metadata,
        },
    }

    for member_node in member_nodes:
        member_node["parent_id"] = node_id

    return summary_node


async def build_summary_nodes(*, document_id: str, owner_id: str, leaf_nodes: list[dict], leaf_embeddings: list[list[float]], cluster_fn, embed_fn) -> list[dict]:
    all_summary_nodes: list[dict] = []
    current_nodes = leaf_nodes
    current_embeddings = leaf_embeddings
    level = 1
    max_levels = 8
    tree_plan = plan_optimal_raptor_tree(len(leaf_nodes))

    logger.info(
        "raptor_plan document_id=%s levels=%s",
        document_id,
        tree_plan,
    )

    if len(tree_plan) <= 1:
        logger.info(
            "raptor_stop_flat document_id=%s leaf_count=%s",
            document_id,
            len(leaf_nodes),
        )
        return all_summary_nodes

    for target_node_count in tree_plan[1:]:
        if len(current_nodes) <= 1 or level > max_levels:
            break

        if target_node_count >= len(current_nodes):
            logger.info(
                "raptor_stop_no_reduction document_id=%s level=%s node_count=%s target_nodes=%s",
                document_id,
                level,
                len(current_nodes),
                target_node_count,
            )
            break

        clusters = cluster_fn(current_nodes, current_embeddings, target_node_count, level)
        is_full_merge = len(clusters) == 1 and len(clusters[0]) == len(current_nodes)
        should_create_root = target_node_count == 1 and len(current_nodes) > 1

        if not clusters or (is_full_merge and not should_create_root):
            logger.info(
                "raptor_stop_no_reduction document_id=%s level=%s node_count=%s target_nodes=%s",
                document_id,
                level,
                len(current_nodes),
                target_node_count,
            )
            break

        logger.info(
            "raptor_level_start document_id=%s level=%s node_count=%s target_nodes=%s cluster_count=%s",
            document_id,
            level,
            len(current_nodes),
            target_node_count,
            len(clusters),
        )

        next_level_nodes: list[dict] = []
        summary_texts: list[str] = []

        for cluster_index, member_indexes in enumerate(clusters):
            member_nodes = [current_nodes[index] for index in member_indexes]
            summary_node = await summarize_group(
                document_id=document_id,
                owner_id=owner_id,
                member_nodes=member_nodes,
                level=level,
                cluster_id=f"level-{level}-cluster-{cluster_index}",
                metadata={
                    "layout_partition": _shared_metadata_value(member_nodes, "layout_partition"),
                    "layout_strategy": _shared_metadata_value(member_nodes, "layout_strategy"),
                    "section_hierarchy": _shared_metadata_value(member_nodes, "section_hierarchy"),
                },
            )
            next_level_nodes.append(summary_node)
            summary_texts.append(summary_node["content"])
            all_summary_nodes.append(summary_node)

        if len(next_level_nodes) >= len(current_nodes):
            logger.info(
                "raptor_stop_non_shrinking document_id=%s level=%s current_nodes=%s next_nodes=%s",
                document_id,
                level,
                len(current_nodes),
                len(next_level_nodes),
            )
            break

        next_level_embeddings = await embed_fn(summary_texts)
        for summary_node, embedding in zip(next_level_nodes, next_level_embeddings, strict=True):
            summary_node["embedding"] = embedding

        current_nodes = next_level_nodes
        current_embeddings = next_level_embeddings
        level += 1

    if level > max_levels:
        logger.info(
            "raptor_stop_max_levels document_id=%s max_levels=%s",
            document_id,
            max_levels,
        )

    return all_summary_nodes


async def build_structural_summary_nodes(
    *,
    document_id: str,
    owner_id: str,
    leaf_nodes: list[dict],
    embed_fn,
) -> list[dict]:
    all_summary_nodes: list[dict] = []
    current_nodes = leaf_nodes
    current_level = 1
    max_levels = 12

    while len(current_nodes) > 1 and current_level <= max_levels:
        path_counts = defaultdict(int)
        for node in current_nodes:
            path_counts[_node_path(node)] += 1

        grouped_nodes: dict[tuple[str, ...], list[dict]] = defaultdict(list)
        carryover_nodes: list[dict] = []

        for node in current_nodes:
            path = _node_path(node)
            if path_counts[path] > 1:
                grouped_nodes[path].append(node)
                continue

            parent_path = path[:-1]
            if parent_path:
                grouped_nodes[parent_path].append(node)
            else:
                carryover_nodes.append(node)

        if not grouped_nodes:
            if len(current_nodes) > 1:
                grouped_nodes[("document-root",)] = current_nodes
                carryover_nodes = []
            else:
                break

        next_level_nodes: list[dict] = []
        summary_texts: list[str] = []

        for group_index, (path, member_nodes) in enumerate(grouped_nodes.items()):
            hierarchy = _path_to_hierarchy(member_nodes, path)
            summary_node = await summarize_group(
                document_id=document_id,
                owner_id=owner_id,
                member_nodes=member_nodes,
                level=current_level,
                cluster_id=f"structural-level-{current_level}-cluster-{group_index}",
                metadata={
                    "layout_strategy": "HIERARCHICAL",
                    "layout_partition": hierarchy[0]["key"] if hierarchy else "document-root",
                    "section_hierarchy": hierarchy,
                    "section_key": hierarchy[-1]["key"] if hierarchy else "document-root",
                    "section_parent_key": hierarchy[-2]["key"] if len(hierarchy) > 1 else None,
                    "structural_depth": len(hierarchy),
                },
            )
            next_level_nodes.append(summary_node)
            summary_texts.append(summary_node["content"])
            all_summary_nodes.append(summary_node)

        next_level_embeddings = await embed_fn(summary_texts)
        for summary_node, embedding in zip(next_level_nodes, next_level_embeddings, strict=True):
            summary_node["embedding"] = embedding

        if carryover_nodes:
            next_level_nodes.extend(carryover_nodes)

        current_nodes = next_level_nodes
        current_level += 1

    if len(current_nodes) > 1:
        root_node = await summarize_group(
            document_id=document_id,
            owner_id=owner_id,
            member_nodes=current_nodes,
            level=current_level,
            cluster_id=f"structural-level-{current_level}-root",
            metadata={
                "layout_strategy": "HIERARCHICAL",
                "layout_partition": "document-root",
                "section_hierarchy": [],
                "section_key": "document-root",
                "section_parent_key": None,
                "structural_depth": 0,
            },
        )
        root_embedding = await embed_fn([root_node["content"]])
        root_node["embedding"] = root_embedding[0]
        all_summary_nodes.append(root_node)

    return all_summary_nodes


def _shared_metadata_value(member_nodes: list[dict], key: str):
    values = [(node.get("metadata") or {}).get(key) for node in member_nodes]
    first_value = values[0]
    if all(value == first_value for value in values):
        return first_value
    return None


def _node_path(node: dict) -> tuple[str, ...]:
    metadata = node.get("metadata") or {}
    hierarchy = metadata.get("section_hierarchy") or []
    return tuple(item["key"] for item in hierarchy if item.get("key"))


def _path_to_hierarchy(member_nodes: list[dict], path: tuple[str, ...]) -> list[dict]:
    if not path:
        return []

    sample_hierarchy = (member_nodes[0].get("metadata") or {}).get("section_hierarchy") or []
    hierarchy = []
    for item in sample_hierarchy:
        hierarchy.append(dict(item))
        if item.get("key") == path[-1]:
            break
    return hierarchy
