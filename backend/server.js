import mongoose from 'mongoose'
import { loadConfig } from './config/index.js'
import { connectDb, disconnectDb } from './config/db.js'
import { createServices } from './services/index.js'
import { createApp } from './app.js'

const config = loadConfig()
if (!config.mongoUri) {
  console.error('MONGODB_URI is not set. Copy backend/.env.example to backend/.env and set it.')
  process.exit(1)
}

try {
  await connectDb(config.mongoUri)
} catch (err) {
  console.error('Could not connect to MongoDB:', err.message)
  process.exit(1)
}

// Connection trouble after start-up is logged (the driver reconnects by itself); /api/status shows the live state.
mongoose.connection.on('disconnected', () => console.error('MongoDB connection lost; the driver will keep trying to reconnect.'))
mongoose.connection.on('reconnected', () => console.log('MongoDB connection restored.'))

const services = createServices({ config })
const app = createApp({ config, services })

// Express passes listen errors (e.g. the port is already in use) to this callback. Ignoring them would print
// "running" for a server that never started.
const server = app.listen(config.port, (err) => {
  if (err) {
    console.error(`Could not listen on port ${config.port}:`, err.code || err.message)
    process.exit(1)
  }
  console.log(`Riwaq API on http://localhost:${config.port}`)
  console.log(`Database: connected`)
  console.log(`Qur'an provider: ${services.quran.configured ? `configured (${services.quran.environment})` : 'NOT configured (set QF_CLIENT_ID / QF_CLIENT_SECRET)'}`)
  console.log(`Second Qur'an source: ${services.quran.fallbackSource ? 'ON (alquran.cloud)' : 'OFF (set QURAN_FALLBACK=alquran in .env)'}`)
  console.log(`Recitation engine: ${services.recitation.available() ? (services.letterEngine.available ? 'AI checker (phoneme level)' : 'word-level engine') : 'not configured'}`)
})

// Hosts stop a service with SIGTERM: finish in-flight requests, close the database, then exit.
let stopping = false
async function shutdown(signal) {
  if (stopping) return
  stopping = true
  console.log(`${signal} received: shutting down.`)
  const force = setTimeout(() => { console.error('Shutdown timed out; exiting.'); process.exit(1) }, 10000)
  force.unref()
  server.close(async () => {
    try { await disconnectDb() } catch { /* already closing */ }
    process.exit(0)
  })
  server.closeIdleConnections()
}
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

// A forgotten await or unexpected rejection must be visible in the logs (message only: never log request data).
process.on('unhandledRejection', (reason) => console.error('Unhandled rejection:', reason?.name, reason?.message))
