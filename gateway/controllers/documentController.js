const { randomUUID } = require('crypto')
const Document = require('../models/Document')
const { supabase } = require('../config/supabase')
const { storageBucket } = require('../config/env')
const { serializeDocument } = require('../services/documentService')
const {
  enqueueIngestion,
  queryRag,
  fetchSummaryTree,
  fetchClusterDebug,
} = require('../services/aiService')

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

  const invalidFile = files.find(
    (file) =>
      file.mimetype !== 'application/pdf' &&
      !file.originalname.toLowerCase().endsWith('.pdf'),
  )

  if (invalidFile) {
    return res.status(400).json({
      error: `Only PDF files are supported. Rejected: ${invalidFile.originalname}`,
    })
  }

  try {
    const uploadedDocuments = await Promise.all(
      files.map(async (file) => {
        const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')
        const storagePath = `${req.user._id.toString()}/${Date.now()}-${randomUUID()}-${safeName}`

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
          name: file.originalname,
          size: file.size,
          mimeType: file.mimetype || 'application/pdf',
          path: storagePath,
          layoutStrategy,
          ingestionStatus: 'pending',
          ingestionRequestedAt: new Date(),
        })

        enqueueIngestion(document, req.user._id).catch(async (error) => {
          await Document.findByIdAndUpdate(document._id, {
            ingestionStatus: 'failed',
            ingestionError: error.message || 'Failed to enqueue ingestion.',
            ingestionCompletedAt: new Date(),
          })
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
  const { documentId, question } = req.body

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
  deleteDocument,
  updateIngestionStatus,
  getDocumentStatus,
  ragQuery,
  getSummaryTree,
  getClusterDebug,
}
