const { corsOrigin } = require('../config/env')

function corsMiddleware(req, res, next) {
  res.header('Access-Control-Allow-Origin', corsOrigin)
  res.header('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204)
  }

  return next()
}

module.exports = corsMiddleware
