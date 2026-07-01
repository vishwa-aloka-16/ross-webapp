const express = require('express')
const { register, loginInit, loginFinish, me } = require('../controllers/authController')
const authenticate = require('../middleware/authenticate')
const requireConfiguration = require('../middleware/requireConfiguration')

const router = express.Router()

router.post('/register', requireConfiguration, register)
router.post('/login/init', requireConfiguration, loginInit)
router.post('/login/finish', requireConfiguration, loginFinish)
router.get('/me', requireConfiguration, authenticate, me)

module.exports = router
