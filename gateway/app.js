const express = require('express')
const corsMiddleware = require('./middleware/cors')
const healthRoutes = require('./routes/healthRoutes')
const authRoutes = require('./routes/authRoutes')
const documentRoutes = require('./routes/documentRoutes')
const ragRoutes = require('./routes/ragRoutes')

const app = express()

app.use(express.json())
app.use(corsMiddleware)

app.use(healthRoutes)
app.use('/api/auth', authRoutes)
app.use('/api/documents', documentRoutes)
app.use('/api/rag', ragRoutes)

module.exports = app
