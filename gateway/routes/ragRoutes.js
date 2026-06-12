const express = require('express')
const { ragQuery, getSummaryTree, getClusterDebug } = require('../controllers/documentController')
const authenticate = require('../middleware/authenticate')
const requireConfiguration = require('../middleware/requireConfiguration')

const router = express.Router()

router.post('/query', requireConfiguration, authenticate, ragQuery)
router.get('/summary-tree/:documentId', requireConfiguration, authenticate, getSummaryTree)
router.post('/debug-clusters/:documentId', requireConfiguration, authenticate, getClusterDebug)

module.exports = router
