const { supabase } = require('../config/supabase')
const { storageBucket, signedUrlExpiresIn } = require('../config/env')

async function createSignedPdfUrl(path) {
  const { data, error } = await supabase.storage
    .from(storageBucket)
    .createSignedUrl(path, signedUrlExpiresIn)

  if (error) {
    throw error
  }

  return data.signedUrl
}

async function serializeDocument(document) {
  return {
    id: document._id.toString(),
    ownerId: document.ownerId?.toString?.() || document.ownerId,
    name: document.name,
    size: document.size,
    mimeType: document.mimeType,
    path: document.path,
    pdfUrl: await createSignedPdfUrl(document.path),
    layoutStrategy: document.layoutStrategy,
    ingestionStatus: document.ingestionStatus,
    ingestionError: document.ingestionError,
    ingestionRequestedAt: document.ingestionRequestedAt,
    ingestionCompletedAt: document.ingestionCompletedAt,
    createdAt: document.createdAt,
  }
}

module.exports = {
  createSignedPdfUrl,
  serializeDocument,
}
