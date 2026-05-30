const jwt = require('jsonwebtoken')
const User = require('../models/User')
const { jwtSecret } = require('../config/env')

async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!token) {
    return res.status(401).json({ error: 'Authentication required.' })
  }

  try {
    const payload = jwt.verify(token, jwtSecret)
    const user = await User.findById(payload.sub)

    if (!user) {
      return res.status(401).json({ error: 'Invalid token.' })
    }

    req.user = user
    return next()
  } catch (_error) {
    return res.status(401).json({ error: 'Invalid token.' })
  }
}

module.exports = authenticate
