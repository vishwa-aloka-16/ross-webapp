const DEFAULT_KDF = {
  algorithm: 'PBKDF2-SHA256',
  iterations: 210000,
  hash: 'SHA-256',
  saltBytes: 16,
  keyVersion: 1,
}

function toBase64(bytes) {
  const chunkSize = 0x8000
  let binary = ''
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize))
  }
  return window.btoa(binary)
}

function fromBase64(base64) {
  const binary = window.atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

function utf8Bytes(value) {
  return new TextEncoder().encode(value)
}

function randomBytes(length) {
  return window.crypto.getRandomValues(new Uint8Array(length))
}

async function sha256Base64(data) {
  const digest = await window.crypto.subtle.digest('SHA-256', data)
  return toBase64(new Uint8Array(digest))
}

async function importHmacKey(rawKeyBytes) {
  return window.crypto.subtle.importKey(
    'raw',
    rawKeyBytes,
    {
      name: 'HMAC',
      hash: 'SHA-256',
    },
    false,
    ['sign'],
  )
}

async function signProof(rawKeyBytes, message) {
  const hmacKey = await importHmacKey(rawKeyBytes)
  const signature = await window.crypto.subtle.sign('HMAC', hmacKey, utf8Bytes(message))
  return toBase64(new Uint8Array(signature))
}

async function deriveMasterBits(password, saltBytes, iterations) {
  const passwordKey = await window.crypto.subtle.importKey(
    'raw',
    utf8Bytes(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )

  return window.crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations,
      hash: 'SHA-256',
    },
    passwordKey,
    512,
  )
}

async function deriveSessionMaterial(password, saltBase64, params = {}) {
  const iterations = Number(params.iterations || DEFAULT_KDF.iterations)
  const saltBytes = fromBase64(saltBase64)
  const bits = await deriveMasterBits(password, saltBytes, iterations)
  const masterBytes = new Uint8Array(bits)
  const authSecret = masterBytes.slice(0, 32)
  const wrapSecret = masterBytes.slice(32, 64)
  const wrappingKey = await window.crypto.subtle.importKey(
    'raw',
    wrapSecret,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )

  return {
    authSecret,
    authVerifier: toBase64(authSecret),
    wrappingKey,
    wrappingKeyBytes: wrapSecret,
    kdfAlgorithm: DEFAULT_KDF.algorithm,
    kdfParams: {
      iterations,
      hash: DEFAULT_KDF.hash,
      saltBytes: saltBytes.length,
    },
    keyVersion: Number(params.keyVersion || DEFAULT_KDF.keyVersion),
  }
}

export async function createRegistrationMaterial(password) {
  const saltBytes = randomBytes(DEFAULT_KDF.saltBytes)
  const authSalt = toBase64(saltBytes)
  const session = await deriveSessionMaterial(password, authSalt, {
    iterations: DEFAULT_KDF.iterations,
    keyVersion: DEFAULT_KDF.keyVersion,
  })

  return {
    authSalt,
    authVerifier: session.authVerifier,
    kdfAlgorithm: session.kdfAlgorithm,
    kdfParams: session.kdfParams,
    keyVersion: session.keyVersion,
    wrappingKey: session.wrappingKey,
  }
}

export async function createLoginMaterial({ password, email, challengeId, serverNonce, authSalt, kdfParams, keyVersion }) {
  const session = await deriveSessionMaterial(password, authSalt, {
    ...(kdfParams || {}),
    keyVersion,
  })
  const clientNonce = toBase64(randomBytes(32))
  const clientProof = await signProof(
    session.authSecret,
    `${String(email || '').toLowerCase()}:${challengeId}:${serverNonce}:${clientNonce}`,
  )

  const serverProof = await signProof(
    session.authSecret,
    `${String(email || '').toLowerCase()}:${challengeId}:${serverNonce}:${clientNonce}:server`,
  )

  return {
    clientNonce,
    clientProof,
    expectedServerProof: serverProof,
    wrappingKey: session.wrappingKey,
    keyVersion: session.keyVersion,
  }
}

export async function encryptDocument(file, wrappingKey, keyVersion = DEFAULT_KDF.keyVersion) {
  const dek = await window.crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  )
  const fileIv = randomBytes(12)
  const wrapIv = randomBytes(12)
  const fileBuffer = await file.arrayBuffer()
  const encryptedPayload = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: fileIv },
    dek,
    fileBuffer,
  )
  const exportedDek = new Uint8Array(await window.crypto.subtle.exportKey('raw', dek))
  const wrappedDek = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: wrapIv },
    wrappingKey,
    exportedDek,
  )

  return {
    encryptedFileBlob: new Blob([encryptedPayload], { type: 'application/octet-stream' }),
    wrappedDek: toBase64(new Uint8Array(wrappedDek)),
    fileIv: toBase64(fileIv),
    wrapIv: toBase64(wrapIv),
    contentLength: file.size,
    contentSha256: await sha256Base64(fileBuffer),
    mimeType: file.type || 'application/pdf',
    dekBase64: toBase64(exportedDek),
    dekBytes: exportedDek,
    cryptoVersion: 'ross-aes-gcm-v1',
    keyVersion,
  }
}

export async function unwrapDocumentKey(storageEncryption, wrappingKey) {
  if (!storageEncryption?.wrappedDek || !storageEncryption?.wrapIv) {
    throw new Error('Document key metadata is missing.')
  }

  const decrypted = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(storageEncryption.wrapIv) },
    wrappingKey,
    fromBase64(storageEncryption.wrappedDek),
  )
  return new Uint8Array(decrypted)
}

export async function decryptPdfBuffer(encryptedBuffer, fileIvBase64, dekBytes) {
  const dek = await window.crypto.subtle.importKey(
    'raw',
    dekBytes,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt'],
  )
  return window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(fileIvBase64) },
    dek,
    encryptedBuffer,
  )
}

export async function decryptArtifactText(encryptedContent, contentIv, dekBytes) {
  if (!encryptedContent) {
    return ''
  }
  const dek = await window.crypto.subtle.importKey(
    'raw',
    dekBytes,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt'],
  )
  const decrypted = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(contentIv) },
    dek,
    fromBase64(encryptedContent),
  )
  return new TextDecoder().decode(decrypted)
}

function normalizePem(pem) {
  return pem
    .replace('-----BEGIN PUBLIC KEY-----', '')
    .replace('-----END PUBLIC KEY-----', '')
    .replaceAll(/\s+/g, '')
}

export async function encryptSessionDekForProcessing(dekBase64, publicKeyPem) {
  const publicKey = await window.crypto.subtle.importKey(
    'spki',
    fromBase64(normalizePem(publicKeyPem)),
    {
      name: 'RSA-OAEP',
      hash: 'SHA-256',
    },
    false,
    ['encrypt'],
  )

  const encrypted = await window.crypto.subtle.encrypt(
    { name: 'RSA-OAEP' },
    publicKey,
    fromBase64(dekBase64),
  )
  return toBase64(new Uint8Array(encrypted))
}

export function createObjectUrl(buffer, mimeType = 'application/pdf') {
  return URL.createObjectURL(new Blob([buffer], { type: mimeType }))
}

export function revokeObjectUrl(url) {
  if (url) {
    URL.revokeObjectURL(url)
  }
}
