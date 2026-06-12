import logging
from pathlib import Path
from uuid import UUID

import psycopg
from pgvector.psycopg import register_vector
from psycopg.types.json import Jsonb

from core.config import settings

logger = logging.getLogger(__name__)


def get_connection():
    if not settings.supabase_db_url:
        raise RuntimeError("SUPABASE_DB_URL is not configured.")

    conn = psycopg.connect(settings.supabase_db_url)
    register_vector(conn)
    return conn


def ensure_schema() -> None:
    schema_path = Path(__file__).resolve().parents[1] / "sql" / "raptor_nodes.sql"
    if not settings.supabase_db_url or not schema_path.exists():
        return

    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(schema_path.read_text(encoding="utf-8"))
            conn.commit()
    except Exception as error:  # noqa: BLE001
        logger.warning("pgvector_schema_init_skipped error=%s", error)


def delete_document_nodes(document_id: str) -> None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("delete from public.raptor_nodes where document_id = %s", (document_id,))
        conn.commit()


def insert_nodes(nodes: list[dict]) -> None:
    if not nodes:
        return

    prepared_nodes = []
    for node in nodes:
        prepared_node = dict(node)
        prepared_node["metadata"] = Jsonb(prepared_node.get("metadata", {}))
        prepared_nodes.append(prepared_node)

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.executemany(
                """
                insert into public.raptor_nodes
                  (id, document_id, owner_id, node_type, level, parent_id, content, embedding,
                   page_start, page_end, chunk_index, cluster_id, metadata)
                values
                  (%(id)s, %(document_id)s, %(owner_id)s, %(node_type)s, %(level)s, %(parent_id)s,
                   %(content)s, %(embedding)s, %(page_start)s, %(page_end)s, %(chunk_index)s,
                   %(cluster_id)s, %(metadata)s)
                """,
                prepared_nodes,
            )
        conn.commit()


def match_nodes(
    *,
    owner_id: str,
    document_id: str | None,
    node_type: str | None,
    query_embedding: list[float],
    limit: int,
) -> list[dict]:
    with get_connection() as conn:
        with conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
            cur.execute(
                """
                select * from public.match_raptor_nodes(%s, %s, %s, %s, %s)
                """,
                (query_embedding, owner_id, document_id, node_type, limit),
            )
            rows = cur.fetchall()

    for row in rows:
        if isinstance(row["id"], UUID):
            row["id"] = str(row["id"])
        if isinstance(row.get("parent_id"), UUID):
            row["parent_id"] = str(row["parent_id"])
    return rows


def fetch_document_nodes(*, owner_id: str, document_id: str) -> list[dict]:
    with get_connection() as conn:
        with conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
            cur.execute(
                """
                select
                  id,
                  document_id,
                  owner_id,
                  node_type,
                  level,
                  parent_id,
                  content,
                  page_start,
                  page_end,
                  chunk_index,
                  cluster_id,
                  metadata,
                  created_at
                from public.raptor_nodes
                where owner_id = %s and document_id = %s
                order by level desc, chunk_index asc nulls last, created_at asc
                """,
                (owner_id, document_id),
            )
            rows = cur.fetchall()

    for row in rows:
        if isinstance(row["id"], UUID):
            row["id"] = str(row["id"])
        if isinstance(row.get("parent_id"), UUID):
            row["parent_id"] = str(row["parent_id"])
    return rows


def fetch_document_leaf_nodes_with_embeddings(*, owner_id: str, document_id: str) -> list[dict]:
    with get_connection() as conn:
        with conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
            cur.execute(
                """
                select
                  id,
                  document_id,
                  owner_id,
                  node_type,
                  level,
                  parent_id,
                  content,
                  embedding,
                  page_start,
                  page_end,
                  chunk_index,
                  cluster_id,
                  metadata,
                  created_at
                from public.raptor_nodes
                where owner_id = %s
                  and document_id = %s
                  and node_type = 'leaf'
                order by chunk_index asc nulls last, created_at asc
                """,
                (owner_id, document_id),
            )
            rows = cur.fetchall()

    for row in rows:
        if isinstance(row["id"], UUID):
            row["id"] = str(row["id"])
        if isinstance(row.get("parent_id"), UUID):
            row["parent_id"] = str(row["parent_id"])
        if row.get("embedding") is not None:
            row["embedding"] = list(row["embedding"])
    return rows
