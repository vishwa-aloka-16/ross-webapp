const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

function buildUrl(path) {
  return `${API_BASE_URL}${path}`
}

async function request(path, options = {}) {
  const response = await fetch(buildUrl(path), {
    method: options.method || 'GET',
    headers: {
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...(options.headers || {}),
    },
    body: options.body,
  })

  const isJson = response.headers.get('content-type')?.includes('application/json')
  const payload = isJson ? await response.json() : null

  if (!response.ok) {
    throw new Error(
      payload?.error ||
        payload?.detail ||
        payload?.message ||
        `Request failed with status ${response.status}.`,
    )
  }

  return payload
}

export function fetchDocuments(token) {
  return request('/api/documents', { token })
}

export function fetchDocumentStatus(documentId, token) {
  return request(`/api/documents/${documentId}/status`, { token })
}

export function uploadDocuments({ token, formData }) {
  return request('/api/documents/upload', {
    method: 'POST',
    body: formData,
    token,
  })
}

export function deleteDocument(documentId, token) {
  return request(`/api/documents/${documentId}`, {
    method: 'DELETE',
    token,
  })
}
