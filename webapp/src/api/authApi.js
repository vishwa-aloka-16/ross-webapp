const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

function buildUrl(path) {
  return `${API_BASE_URL}${path}`
}

async function request(path, options = {}) {
  const response = await fetch(buildUrl(path), {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
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

export function loginInit({ email }) {
  return request('/api/auth/login/init', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
}

export function loginFinish({ email, challengeId, clientNonce, clientProof }) {
  return request('/api/auth/login/finish', {
    method: 'POST',
    body: JSON.stringify({ email, challengeId, clientNonce, clientProof }),
  })
}

export function register({ firstName, lastName, email, firm, authSalt, authVerifier, kdfAlgorithm, kdfParams, keyVersion }) {
  return request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      firstName,
      lastName,
      email,
      firm,
      authSalt,
      authVerifier,
      kdfAlgorithm,
      kdfParams,
      keyVersion,
    }),
  })
}

export function fetchCurrentUser(token) {
  return request('/api/auth/me', { token })
}
