const { aiServiceUrl, internalServiceKey } = require('../config/env')

function buildInternalHeaders() {
  const headers = {
    'Content-Type': 'application/json',
  }

  if (internalServiceKey) {
    headers['X-Internal-Service-Key'] = internalServiceKey.trim()
  }

  return headers
}

async function requestAiService(path, options = {}) {
  const response = await fetch(`${aiServiceUrl}${path}`, {
    method: options.method || 'GET',
    headers: {
      ...buildInternalHeaders(),
      ...(options.headers || {}),
    },
    body: options.body,
  })

  const isJson = response.headers.get('content-type')?.includes('application/json')
  const payload = isJson ? await response.json() : null

  if (!response.ok) {
    throw new Error(payload?.error || `AI service request failed with ${response.status}.`)
  }

  return payload
}

async function enqueueIngestion(document, ownerId) {
  return requestAiService('/ingestion/documents', {
    method: 'POST',
    body: JSON.stringify({
      documentId: document._id.toString(),
      ownerId: ownerId.toString(),
      fileName: document.name,
      storagePath: document.path,
      layoutStrategy: document.layoutStrategy || 'TRANSACTIONAL',
    }),
  })
}

async function queryRag({ ownerId, documentId, question }) {
  return requestAiService('/rag/query', {
    method: 'POST',
    body: JSON.stringify({
      ownerId,
      documentId,
      question,
    }),
  })
}

async function fetchSummaryTree({ ownerId, documentId }) {
  return requestAiService('/rag/summary-tree', {
    method: 'POST',
    body: JSON.stringify({
      ownerId,
      documentId,
    }),
  })
}

async function fetchClusterDebug({ ownerId, documentId, layoutStrategy, targetClusters }) {
  return requestAiService('/debug/clusters', {
    method: 'POST',
    body: JSON.stringify({
      ownerId,
      documentId,
      layoutStrategy,
      targetClusters,
    }),
  })
}

module.exports = {
  enqueueIngestion,
  queryRag,
  fetchSummaryTree,
  fetchClusterDebug,
}
