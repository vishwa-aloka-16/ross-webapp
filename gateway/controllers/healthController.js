const { storageBucket, mongoUri, jwtSecret } = require('../config/env')
const { supabase } = require('../config/supabase')
const { isDatabaseConnected } = require('../config/db')

function getHealth(_req, res) {
  return res.json({
    ok: true,
    storageConfigured: Boolean(supabase),
    mongoConfigured: Boolean(mongoUri),
    mongoConnected: isDatabaseConnected(),
    jwtConfigured: Boolean(jwtSecret),
    bucket: storageBucket,
  })
}

module.exports = {
  getHealth,
}
