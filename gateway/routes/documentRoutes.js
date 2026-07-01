const express = require('express')
const {
  listDocuments,
  uploadDocuments,
  getProcessingPublicKey,
  requestProcessingGrant,
  startProcessing,
  deleteDocument,
  updateIngestionStatus,
  getDocumentStatus,
} = require('../controllers/documentController')
const authenticate = require('../middleware/authenticate')
const authenticateInternalService = require('../middleware/authenticateInternalService')
const requireConfiguration = require('../middleware/requireConfiguration')
const upload = require('../middleware/upload')

const router = express.Router()

router.get('/processing/public-key', requireConfiguration, authenticate, getProcessingPublicKey)
router.get('/', requireConfiguration, authenticate, listDocuments)
router.post('/:documentId/processing-grant', requireConfiguration, authenticate, requestProcessingGrant)
router.post('/:documentId/processing-start', requireConfiguration, authenticate, startProcessing)
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
