const express = require('express')
const { register, login, me } = require('../controllers/authController')
const authenticate = require('../middleware/authenticate')
const requireConfiguration = require('../middleware/requireConfiguration')

const router = express.Router()

router.post('/register', requireConfiguration, register)
router.post('/login', requireConfiguration, login)
router.get('/me', requireConfiguration, authenticate, me)

module.exports = router
