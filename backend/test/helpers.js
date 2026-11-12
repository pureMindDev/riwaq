// Shared test setup: a mock Qur'an provider (placeholder text, NOT Qur'an), an optional stub
// recognition engine, and a real MongoDB database (TEST_MONGODB_URI) that is dropped afterwards.
import http from 'node:http'
import mongoose from 'mongoose'
import { createMockProvider, MOCK } from '../dev/mock-provider.js'
import { loadConfig } from '../config/index.js'
import { createServices } from '../services/index.js'
import { createApp } from '../app.js'
import { ensureIndexes } from '../config/db.js'

export const TEST_URI = process.env.TEST_MONGODB_URI || ''
export const dbSkip = TEST_URI ? false : 'TEST_MONGODB_URI is not set: database tests were SKIPPED (see README)'

const listen = (server) => new Promise((r) => server.listen(0, () => r(server.address().port)))

export async function startStack({ engine = false, dead = false, env = {}, db = true } = {}) {
  const mock = createMockProvider()
  const mockPort = await listen(mock.server)
  let stub
  if (engine) {
    // TEST STUB: the "audio" bytes ARE the transcript, so tests control exactly what the engine "heard".
    stub = http.createServer((req, res) => {
      const chunks = []
      req.on('data', (c) => chunks.push(c))
      req.on('end', () => {
        const words = Buffer.concat(chunks).toString('utf8').split(/\s+/).filter(Boolean).map((text) => ({ text, confidence: 0.9 }))
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ words }))
      })
    })
    await listen(stub)
  }
  const dbName = `dt_test_${process.pid}_${Date.now()}`
  const base = dead ? 'http://localhost:1' : `http://localhost:${mockPort}`
  const config = loadConfig({
    MONGODB_URI: TEST_URI,
    QF_CLIENT_ID: MOCK.clientId, QF_CLIENT_SECRET: MOCK.clientSecret,
    QF_AUTH_URL: base, QF_API_URL: base, QF_AUDIO_BASE_URL: `${base}/audio/`, QF_CACHE_SECONDS: '0',
    ...(db === false ? { DB_FAIL_FAST: 'false' } : {}), // stacks with no database must still reach input validation
    AUTH_RATE_LIMIT_MAX: '1000', UPLOAD_RATE_LIMIT_MAX: '1000',
    ...(engine ? { RECITATION_ENGINE_URL: `http://localhost:${stub.address().port}` } : {}),
    ...env,
  })
  if (db === true) await mongoose.connect(TEST_URI, { dbName }) // db: 'reuse' shares the already-open connection
  const services = createServices({ config })
  if (db === true) await ensureIndexes() // models are loaded by now; wait for the unique indexes
  const server = http.createServer(createApp({ config, services }))
  const url = `http://localhost:${await listen(server)}`

  async function call(method, path, { token, body, raw, headers = {} } = {}) {
    const h = { ...headers }
    if (token) h.Authorization = `Bearer ${token}`
    let payload
    if (raw) payload = raw
    else if (body !== undefined) { h['Content-Type'] = 'application/json'; payload = typeof body === 'string' ? body : JSON.stringify(body) }
    const res = await fetch(url + path, { method, headers: h, body: payload })
    const text = await res.text()
    let json = null
    try { json = JSON.parse(text) } catch { /* not json */ }
    return { status: res.status, body: json }
  }

  return {
    call, url, services, mock, config,
    async register(email = `u${Math.random().toString(36).slice(2)}@example.com`, extra = {}) {
      const r = await call('POST', '/api/auth/register', { body: { name: 'Test Student', email, password: 'correct-horse-9', timezone: 'UTC', ...extra } })
      if (r.status !== 201) throw new Error(`register failed: ${JSON.stringify(r.body)}`)
      return { token: r.body.token, user: r.body.user, email }
    },
    async close() {
      server.close(); mock.server.close(); stub?.close()
      if (db === true) { await mongoose.connection.dropDatabase(); await mongoose.disconnect() }
    },
  }
}

export const ANSWERS = {
  beginner: { letters: 0, vowels: 0, joining: 0, quranReading: 0, memorised: 'none', minutes: 15 },
  ready: { letters: 2, vowels: 2, joining: 2, quranReading: 2, memorised: 'none', minutes: 30 },
  hafiz: { letters: 2, vowels: 2, joining: 2, quranReading: 2, memorised: 'hafiz', minutes: 60 },
}
