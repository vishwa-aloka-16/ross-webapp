const AI_SERVICE_URL = import.meta.env.VITE_AI_SERVICE_URL || ''
let aiServiceWakeRequested = false

function buildAiServiceUrl(path) {
  return `${AI_SERVICE_URL}${path}`
}

export function wakeAiService() {
  if (aiServiceWakeRequested) {
    return Promise.resolve()
  }

  aiServiceWakeRequested = true
  const url = buildAiServiceUrl('/health')

  return fetch(url, {
    method: 'GET',
    mode: 'no-cors',
    cache: 'no-store',
    keepalive: true,
  }).catch(() => {
    // This is a best-effort warmup; the landing page should never fail because of it.
  })
}
