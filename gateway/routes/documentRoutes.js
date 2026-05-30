const express = require('express')
const {
  listDocuments,
  uploadDocuments,
  deleteDocument,
  updateIngestionStatus,
  getDocumentStatus,
} = require('../controllers/documentController')
const authenticate = require('../middleware/authenticate')
const authenticateInternalService = require('../middleware/authenticateInternalService')
const requireConfiguration = require('../middleware/requireConfiguration')
const upload = require('../middleware/upload')

const router = express.Router()

router.get('/', requireConfiguration, authenticate, listDocuments)
router.get('/:documentId/status', requireConfiguration, authenticate, getDocumentStatus)
router.post(
  '/upload',
  requireConfiguration,
  authenticate,
  upload.array('documents', 10),
  uploadDocuments,
)
router.post(
  '/internal/:documentId/ingestion-status',
  requireConfiguration,
  authenticateInternalService,
  updateIngestionStatus,
)
router.delete('/:documentId', requireConfiguration, authenticate, deleteDocument)

module.exports = router
