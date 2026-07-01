create extension if not exists vector;

create table if not exists public.raptor_nodes (
  id uuid primary key,
  document_id text not null,
  owner_id text not null,
  node_type text not null check (node_type in ('leaf', 'summary')),
  level integer not null default 0,
  parent_id uuid null,
  content text null,
  encrypted_content text null,
  content_iv text null,
  crypto_version text null,
  embedding vector(1536) not null,
  page_start integer null,
  page_end integer null,
  chunk_index integer null,
  cluster_id text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.raptor_nodes add column if not exists encrypted_content text null;
alter table public.raptor_nodes add column if not exists content_iv text null;
alter table public.raptor_nodes add column if not exists crypto_version text null;
alter table public.raptor_nodes alter column content drop not null;

create index if not exists idx_raptor_nodes_owner_id on public.raptor_nodes(owner_id);
create index if not exists idx_raptor_nodes_document_id on public.raptor_nodes(document_id);
create index if not exists idx_raptor_nodes_node_type on public.raptor_nodes(node_type);
create index if not exists idx_raptor_nodes_level on public.raptor_nodes(level);

create index if not exists idx_raptor_nodes_embedding
on public.raptor_nodes
using ivfflat (embedding vector_cosine_ops)
with (lists = 100);

create or replace function public.match_raptor_nodes (
  query_embedding vector(1536),
  match_owner_id text,
  match_document_id text default null,
  match_node_type text default null,
  match_count integer default 10
)
returns table (
  id uuid,
  document_id text,
  owner_id text,
  node_type text,
  level integer,
  parent_id uuid,
  content text,
  encrypted_content text,
  content_iv text,
  crypto_version text,
  page_start integer,
  page_end integer,
  chunk_index integer,
  cluster_id text,
  metadata jsonb,
  created_at timestamptz,
  similarity float
)
language sql
as $$
  select
    node.id,
    node.document_id,
    node.owner_id,
    node.node_type,
    node.level,
    node.parent_id,
    node.content,
    node.encrypted_content,
    node.content_iv,
    node.crypto_version,
    node.page_start,
    node.page_end,
    node.chunk_index,
    node.cluster_id,
    node.metadata,
    node.created_at,
    1 - (node.embedding <=> query_embedding) as similarity
  from public.raptor_nodes node
  where node.owner_id = match_owner_id
    and (match_document_id is null or node.document_id = match_document_id)
    and (match_node_type is null or node.node_type = match_node_type)
  order by node.embedding <=> query_embedding
  limit match_count;
$$;
