const { mongoUri, jwtSecret } = require('../config/env')
const { supabase } = require('../config/supabase')

function requireConfiguration(req, res, next) {
  if (!supabase) {
    return res.status(500).json({
      error:
        'Supabase storage is not configured. Set SUPABASE_URL and SUPABASE_SECRET_KEY.',
    })
  }

  if (!mongoUri) {
    return res.status(500).json({
      error: 'MongoDB is not configured. Set MONGODB_URI.',
    })
  }

  if (!jwtSecret) {
    return res.status(500).json({
      error: 'JWT auth is not configured. Set JWT_SECRET.',
    })
  }

  return next()
}

module.exports = requireConfiguration
