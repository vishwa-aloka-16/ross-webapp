const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

function buildUrl(path) {
  return `${API_BASE_URL}${path}`
}

async function request(path, token, options = {}) {
  const response = await fetch(buildUrl(path), {
    method: options.method || 'GET',
    headers: {
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
    body: options.body,
  })

  const isJson = response.headers.get('content-type')?.includes('application/json')
  const payload = isJson ? await response.json() : null

  if (!response.ok) {
    const error = new Error(
      payload?.error ||
        payload?.detail ||
        payload?.message ||
        `Request failed with status ${response.status}.`,
    )
    error.status = response.status
    error.payload = payload
    throw error
  }

  return payload
}

function toTitleFromContent(content = '') {
  const firstLine = content.split('\n').map((line) => line.trim()).find(Boolean) || ''
  if (!firstLine) {
    return 'Summary'
  }
  return firstLine.length > 72 ? `${firstLine.slice(0, 69)}...` : firstLine
}

function toMetadata(metadata = {}) {
  return {
    ...metadata,
    layoutStrategy: metadata.layoutStrategy || metadata.layout_strategy || null,
    clusterId: metadata.clusterId || metadata.cluster_id || null,
    clauseNumber: metadata.clauseNumber || metadata.clause_number || null,
    clauseTitle: metadata.clauseTitle || metadata.clause_title || null,
    partyEnclave: metadata.partyEnclave || metadata.party_enclave || null,
    issueKey: metadata.issueKey || metadata.issue_key || null,
    argumentType: metadata.argumentType || metadata.argument_type || null,
    sectionHierarchy: metadata.sectionHierarchy || metadata.section_hierarchy || [],
    sectionKey: metadata.sectionKey || metadata.section_key || null,
    sectionParentKey: metadata.sectionParentKey || metadata.section_parent_key || null,
    structuralDepth: metadata.structuralDepth || metadata.structural_depth || null,
    extractionSource: metadata.extractionSource || metadata.extraction_source || null,
  }
}

function countLeafSources(node) {
  if (!node?.children?.length) {
    return node?.nodeType === 'leaf' ? 1 : 0
  }
  return node.children.reduce((total, child) => total + countLeafSources(child), 0)
}

function normalizeNode(node, fallbackType = 'summary') {
  const metadata = toMetadata(node.metadata || {})
  const children = Array.isArray(node.children) ? node.children.map((child) => normalizeNode(child)) : []
  const nodeType = node.nodeType || node.node_type || fallbackType

  const normalized = {
    id: node.id,
    nodeType,
    level: node.level ?? 0,
    title:
      node.title ||
      metadata.clauseTitle ||
      metadata.sectionKey ||
      metadata.sectionParentKey ||
      toTitleFromContent(node.content || ''),
    content: node.content || '',
    pageStart: node.pageStart ?? node.page_start ?? null,
    pageEnd: node.pageEnd ?? node.page_end ?? null,
    sourceCount: node.sourceCount ?? node.source_count ?? null,
    chunkIndex: node.chunkIndex ?? node.chunk_index ?? null,
    parentId: node.parentId ?? node.parent_id ?? null,
    clusterId: node.clusterId ?? node.cluster_id ?? metadata.clusterId ?? null,
    metadata,
    children,
  }

  normalized.sourceCount = normalized.sourceCount ?? countLeafSources(normalized)

  return normalized
}

function synthesizeRoot(payload) {
  const normalizedRoots = (payload.root_nodes || []).map((node) => normalizeNode(node))

  if (normalizedRoots.length === 1) {
    const onlyRoot = normalizedRoots[0]
    return {
      ...onlyRoot,
      nodeType: onlyRoot.nodeType === 'summary' ? 'root_summary' : onlyRoot.nodeType,
      title: onlyRoot.title || 'Document Summary',
    }
  }

  const maxLevel = payload.max_level || Math.max(0, ...normalizedRoots.map((node) => node.level))
  return {
    id: `root-${payload.document_id || 'document'}`,
    nodeType: 'root_summary',
    level: maxLevel + 1,
    title: 'Document Summary',
    content:
      normalizedRoots.find((node) => node.content)?.content ||
      'Traceable summary tree for this document.',
    pageStart: normalizedRoots.reduce((min, node) => {
      if (!node.pageStart) {
        return min
      }
      return min === null ? node.pageStart : Math.min(min, node.pageStart)
    }, null),
    pageEnd: normalizedRoots.reduce((max, node) => {
      if (!node.pageEnd) {
        return max
      }
      return max === null ? node.pageEnd : Math.max(max, node.pageEnd)
    }, null),
    sourceCount: payload.leaf_count ?? normalizedRoots.reduce((total, node) => total + countLeafSources(node), 0),
    metadata: {},
    children: normalizedRoots,
  }
}

export function normalizeSummaryTreePayload(payload) {
  if (!payload) {
    return null
  }

  if (payload.root) {
    return {
      documentId: payload.documentId || payload.document_id,
      root: normalizeNode(payload.root, payload.root.nodeType || 'root_summary'),
    }
  }

  if (payload.root_nodes) {
    return {
      documentId: payload.documentId || payload.document_id,
      root: synthesizeRoot(payload),
    }
  }

  return {
    documentId: payload.documentId || payload.document_id,
    root: null,
  }
}

function collectLeafSources(node, bucket = []) {
  if (!node) {
    return bucket
  }

  if (node.nodeType === 'leaf') {
    bucket.push({
      chunkId: node.id,
      pageStart: node.pageStart,
      pageEnd: node.pageEnd,
      content: node.content,
      bbox: node.metadata?.bbox || null,
      metadata: node.metadata || {},
    })
    return bucket
  }

  for (const child of node.children || []) {
    collectLeafSources(child, bucket)
  }

  return bucket
}

export async function fetchSummaryTree(documentId, token) {
  const paths = [
    `/api/documents/${documentId}/summary-tree`,
    `/api/rag/summary-tree/${documentId}`,
  ]

  let lastError = null
  for (const path of paths) {
    try {
      const payload = await request(path, token)
      return normalizeSummaryTreePayload(payload)
    } catch (error) {
      lastError = error
      if (![404, 405].includes(error.status)) {
        break
      }
    }
  }

  throw lastError || new Error('Failed to load summary tree')
}

export async function fetchNodeEvidence(documentId, nodeId, token, fallbackNode = null) {
  try {
    return await request(`/api/documents/${documentId}/nodes/${nodeId}/evidence`, token)
  } catch (error) {
    if (fallbackNode) {
      return {
        nodeId,
        sources: collectLeafSources(fallbackNode),
        derivedFromTree: true,
      }
    }
    throw new Error('Failed to load node evidence')
  }
}
