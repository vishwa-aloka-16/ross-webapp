const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') })

module.exports = {
  port: process.env.PORT || 3001,
  corsOrigin: process.env.CORS_ORIGIN || '*',
  mongoUri: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  aiServiceUrl: process.env.AI_SERVICE_URL || 'http://localhost:8000',
  internalServiceKey: process.env.INTERNAL_SERVICE_KEY,
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseSecretKey:
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
  storageBucket: process.env.SUPABASE_STORAGE_BUCKET || 'documents',
  signedUrlExpiresIn: Number(process.env.SIGNED_URL_EXPIRES_IN || 3600),
}
