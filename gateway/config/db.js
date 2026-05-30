const mongoose = require('mongoose')
const { mongoUri } = require('./env')

async function connectDatabase() {
  if (!mongoUri) {
    console.warn('MONGODB_URI is not set. Auth and document APIs will not work.')
    return
  }

  await mongoose.connect(mongoUri)
}

function isDatabaseConnected() {
  return mongoose.connection.readyState === 1
}

module.exports = {
  connectDatabase,
  isDatabaseConnected,
}
