from db.pgvector import match_nodes
from services.embedding_service import batch_embed_texts


async def retrieve_context(*, owner_id: str, document_id: str, question: str) -> tuple[list[dict], list[dict]]:
    query_embedding = (
        await batch_embed_texts([question], task_type="RETRIEVAL_QUERY")
    )[0]

    summary_nodes = match_nodes(
        owner_id=owner_id,
        document_id=document_id,
        node_type="summary",
        query_embedding=query_embedding,
        limit=6,
    )
    leaf_nodes = match_nodes(
        owner_id=owner_id,
        document_id=document_id,
        node_type="leaf",
        query_embedding=query_embedding,
        limit=10,
    )

    return summary_nodes, leaf_nodes
