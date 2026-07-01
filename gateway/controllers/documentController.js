const crypto = require('crypto')
const Document = require('../models/Document')
const { supabase } = require('../config/supabase')
const { storageBucket, internalServiceKey } = require('../config/env')
const { serializeDocument } = require('../services/documentService')
const {
  fetchProcessingPublicKey: fetchAiProcessingPublicKey,
  queryRag,
  fetchSummaryTree,
  fetchClusterDebug,
  startProtectedIngestion,
} = require('../services/aiService')

const PROCESSING_GRANT_TTL_SECONDS = 5 * 60

function base64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll(/=+$/g, '')
}

function createProcessingGrant(document, ownerId) {
  const payload = {
    documentId: document._id.toString(),
    ownerId: ownerId.toString(),
    purpose: 'processing',
    exp: Math.floor(Date.now() / 1000) + PROCESSING_GRANT_TTL_SECONDS,
  }
  const encodedPayload = base64url(JSON.stringify(payload))
  const signature = crypto
    .createHmac('sha256', internalServiceKey || 'ross-internal')
    .update(encodedPayload)
    .digest()

  return `${encodedPayload}.${base64url(signature)}`
}

async function listDocuments(req, res) {
  try {
    const documents = await Document.find({ ownerId: req.user._id }).sort({
      createdAt: -1,
    })

    return res.json({
      documents: await Promise.all(documents.map(serializeDocument)),
    })
  } catch (error) {
    return res.status(500).json({
      error: error.message || 'Failed to fetch documents.',
    })
  }
}

async function uploadDocuments(req, res) {
  const files = req.files || []
  const layoutStrategy = String(req.body?.layoutStrategy || 'TRANSACTIONAL').toUpperCase()
  const cryptoMetadata = parseCryptoMetadata(req.body?.cryptoMetadata)
  const validLayoutStrategies = ['ADVERSARIAL', 'HIERARCHICAL', 'TRANSACTIONAL']

  if (!files.length) {
    return res.status(400).json({
      error: 'No files were uploaded.',
    })
  }

  if (!validLayoutStrategies.includes(layoutStrategy)) {
    return res.status(400).json({
      error: 'layoutStrategy must be ADVERSARIAL, HIERARCHICAL, or TRANSACTIONAL.',
    })
  }

  if (!cryptoMetadata || cryptoMetadata.length !== files.length) {
    return res.status(400).json({
      error: 'Encrypted uploads require crypto metadata for every file.',
    })
  }

  try {
    const uploadedDocuments = await Promise.all(
      files.map(async (file, index) => {
        const metadata = cryptoMetadata[index] || {}
        const originalName = String(metadata.originalName || file.originalname || `document-${index + 1}.pdf`)
        const originalMimeType = String(metadata.mimeType || 'application/pdf')
        if (!metadata.wrappedDek || !metadata.fileIv || !metadata.wrapIv || !metadata.cryptoVersion) {
          throw new Error(`Missing encryption metadata for ${originalName}.`)
        }

        const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')
        const storagePath = `${req.user._id.toString()}/${Date.now()}-${crypto.randomUUID()}-${safeName}.enc`

        const { error: uploadError } = await supabase.storage
          .from(storageBucket)
          .upload(storagePath, file.buffer, {
            contentType: file.mimetype || 'application/pdf',
            upsert: false,
          })

        if (uploadError) {
          throw uploadError
        }

        const document = await Document.create({
          ownerId: req.user._id,
          name: originalName,
          size: Number(metadata.contentLength || file.size),
          mimeType: 'application/octet-stream',
          path: storagePath,
          layoutStrategy,
          ingestionStatus: 'pending',
          ingestionRequestedAt: new Date(),
          storageEncryption: {
            status: 'encrypted',
            cryptoVersion: metadata.cryptoVersion,
            wrappedDek: metadata.wrappedDek,
            fileIv: metadata.fileIv,
            wrapIv: metadata.wrapIv,
            keyVersion: Number(metadata.keyVersion || 1),
            contentSha256: metadata.contentSha256 || null,
            contentLength: Number(metadata.contentLength || file.size),
            originalMimeType,
          },
        })

        return serializeDocument(document)
      }),
    )

    return res.status(202).json({
      documents: await Promise.all(uploadedDocuments),
    })
  } catch (error) {
    return res.status(500).json({
      error: error.message || 'Upload failed.',
    })
  }
}

async function getProcessingPublicKey(_req, res) {
  try {
    return res.json(await fetchAiProcessingPublicKey())
  } catch (error) {
    return res.status(500).json({
      error: error.message || 'Failed to load processing public key.',
    })
  }
}

async function requestProcessingGrant(req, res) {
  try {
    const document = await Document.findOne({
      _id: req.params.documentId,
      ownerId: req.user._id,
    })

    if (!document) {
      return res.status(404).json({
        error: 'Document not found.',
      })
    }

    return res.json({
      processingGrant: createProcessingGrant(document, req.user._id),
      expiresInSeconds: PROCESSING_GRANT_TTL_SECONDS,
    })
  } catch (error) {
    return res.status(500).json({
      error: error.message || 'Failed to create processing grant.',
    })
  }
}

async function startProcessing(req, res) {
  const { encryptedSessionDek, processingGrant } = req.body || {}
  if (!encryptedSessionDek || !processingGrant) {
    return res.status(400).json({
      error: 'encryptedSessionDek and processingGrant are required.',
    })
  }

  try {
    const document = await Document.findOne({
      _id: req.params.documentId,
      ownerId: req.user._id,
    })

    if (!document) {
      return res.status(404).json({
        error: 'Document not found.',
      })
    }

    const result = await startProtectedIngestion({
      documentId: document._id.toString(),
      ownerId: req.user._id.toString(),
      fileName: document.name,
      storagePath: document.path,
      layoutStrategy: document.layoutStrategy,
      fileIv: document.storageEncryption?.fileIv,
      encryptedSessionDek,
      processingGrant,
    })

    await Document.findByIdAndUpdate(document._id, {
      ingestionStatus: 'processing',
      ingestionError: null,
      ingestionRequestedAt: new Date(),
      ingestionCompletedAt: null,
    })

    return res.status(202).json(result)
  } catch (error) {
    return res.status(500).json({
      error: error.message || 'Failed to start protected ingestion.',
    })
  }
}

async function deleteDocument(req, res) {
  try {
    const document = await Document.findOne({
      _id: req.params.documentId,
      ownerId: req.user._id,
    })

    if (!document) {
      return res.status(404).json({
        error: 'Document not found.',
      })
    }

    const { error: deleteError } = await supabase.storage
      .from(storageBucket)
      .remove([document.path])

    if (deleteError) {
      throw deleteError
    }

    await document.deleteOne()

    return res.status(204).send()
  } catch (error) {
    return res.status(500).json({
      error: error.message || 'Delete failed.',
    })
  }
}

async function updateIngestionStatus(req, res) {
  const { documentId } = req.params
  const { ingestionStatus, ingestionError = null } = req.body

  if (!['pending', 'processing', 'indexed', 'failed'].includes(ingestionStatus)) {
    return res.status(400).json({
      error: 'Invalid ingestion status.',
    })
  }

  const update = {
    ingestionStatus,
    ingestionError,
  }

  if (ingestionStatus === 'indexed' || ingestionStatus === 'failed') {
    update.ingestionCompletedAt = new Date()
  }

  const document = await Document.findByIdAndUpdate(documentId, update, { new: true })

  if (!document) {
    return res.status(404).json({
      error: 'Document not found.',
    })
  }

  return res.json({
    document: await serializeDocument(document),
  })
}

async function getDocumentStatus(req, res) {
  const document = await Document.findOne({
    _id: req.params.documentId,
    ownerId: req.user._id,
  })

  if (!document) {
    return res.status(404).json({
      error: 'Document not found.',
    })
  }

  return res.json({
    id: document._id.toString(),
    ingestionStatus: document.ingestionStatus,
    ingestionError: document.ingestionError,
    ingestionRequestedAt: document.ingestionRequestedAt,
    ingestionCompletedAt: document.ingestionCompletedAt,
  })
}

async function ragQuery(req, res) {
  const { documentId, question, encryptedSessionDek } = req.body

  if (!documentId || !question) {
    return res.status(400).json({
      error: 'documentId and question are required.',
    })
  }

  const document = await Document.findOne({
    _id: documentId,
    ownerId: req.user._id,
  })

  if (!document) {
    return res.status(404).json({
      error: 'Document not found.',
    })
  }

  if (document.ingestionStatus !== 'indexed') {
    return res.status(409).json({
      error: 'Document is not indexed yet.',
      ingestionStatus: document.ingestionStatus,
    })
  }

  try {
    const result = await queryRag({
      ownerId: req.user._id.toString(),
      documentId: document._id.toString(),
      question,
      encryptedSessionDek,
    })

    return res.json(result)
  } catch (error) {
    return res.status(500).json({
      error: error.message || 'RAG query failed.',
    })
  }
}

async function getSummaryTree(req, res) {
  const { documentId } = req.params

  const document = await Document.findOne({
    _id: documentId,
    ownerId: req.user._id,
  })

  if (!document) {
    return res.status(404).json({
      error: 'Document not found.',
    })
  }

  if (document.ingestionStatus !== 'indexed') {
    return res.status(409).json({
      error: 'Document is not indexed yet.',
      ingestionStatus: document.ingestionStatus,
    })
  }

  try {
    const result = await fetchSummaryTree({
      ownerId: req.user._id.toString(),
      documentId: document._id.toString(),
    })

    return res.json(result)
  } catch (error) {
    return res.status(500).json({
      error: error.message || 'Summary tree fetch failed.',
    })
  }
}

async function getClusterDebug(req, res) {
  const { documentId } = req.params
  const { layoutStrategy, targetClusters = null } = req.body || {}

  const document = await Document.findOne({
    _id: documentId,
    ownerId: req.user._id,
  })

  if (!document) {
    return res.status(404).json({
      error: 'Document not found.',
    })
  }

  if (document.ingestionStatus !== 'indexed') {
    return res.status(409).json({
      error: 'Document is not indexed yet.',
      ingestionStatus: document.ingestionStatus,
    })
  }

  try {
    const result = await fetchClusterDebug({
      ownerId: req.user._id.toString(),
      documentId: document._id.toString(),
      layoutStrategy: layoutStrategy || document.layoutStrategy,
      targetClusters,
    })

    return res.json(result)
  } catch (error) {
    return res.status(500).json({
      error: error.message || 'Cluster debug fetch failed.',
    })
  }
}

module.exports = {
  listDocuments,
  uploadDocuments,
  getProcessingPublicKey,
  requestProcessingGrant,
  startProcessing,
  deleteDocument,
  updateIngestionStatus,
  getDocumentStatus,
  ragQuery,
  getSummaryTree,
  getClusterDebug,
}

function parseCryptoMetadata(rawValue) {
  if (!rawValue) {
    return null
  }
  try {
    const parsed = JSON.parse(rawValue)
    return Array.isArray(parsed) ? parsed : null
  } catch (_error) {
    return null
  }
}
