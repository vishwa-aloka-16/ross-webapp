const app = require('./app')
const { port } = require('./config/env')
const { connectDatabase } = require('./config/db')

async function start() {
  await connectDatabase()

  app.listen(port, () => {
    console.log(`Gateway listening on port ${port}`)
  })
}

start().catch((error) => {
  console.error('Failed to start gateway', error)
  process.exit(1)
})
