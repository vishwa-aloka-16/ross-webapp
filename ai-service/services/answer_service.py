from providers.gemini_provider import answer_question


async def generate_rag_answer(*, question: str, summary_nodes: list[dict], leaf_nodes: list[dict]) -> str:
    summary_context = "\n\n".join(
        f"[Summary L{node['level']} p.{node.get('page_start')}-{node.get('page_end')}]\n{node['content']}"
        for node in summary_nodes
    )
    leaf_context = "\n\n".join(
        f"[Clause p.{node.get('page_start')}-{node.get('page_end')}]\n{node['content']}"
        for node in leaf_nodes
    )

    prompt = (
        "Answer the legal question using only the provided context. "
        "Prefer specific obligations and clauses, and keep citations grounded in the supplied excerpts.\n\n"
        f"Question:\n{question}\n\n"
        f"Thematic summaries:\n{summary_context}\n\n"
        f"Supporting clauses:\n{leaf_context}"
    )
    return await answer_question(prompt)
