const { internalServiceKey } = require('../config/env')

function authenticateInternalService(req, res, next) {
  if (!internalServiceKey) {
    return next()
  }

  if ((req.headers['x-internal-service-key'] || '').trim() !== internalServiceKey.trim()) {
    return res.status(401).json({
      error: 'Invalid internal service key.',
    })
  }

  return next()
}

module.exports = authenticateInternalService
