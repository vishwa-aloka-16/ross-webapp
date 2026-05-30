const { createClient } = require('@supabase/supabase-js')
const { supabaseUrl, supabaseSecretKey } = require('./env')

const supabase =
  supabaseUrl && supabaseSecretKey
    ? createClient(supabaseUrl, supabaseSecretKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      })
    : null

module.exports = {
  supabase,
}
