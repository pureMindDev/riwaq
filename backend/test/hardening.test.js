// Server-level reliability checks that need no database: proxy handling, error shapes, public endpoints.
import test from 'node:test'
import assert from 'node:assert/strict'
import { startStack } from './helpers.js'
import { loadConfig } from '../config/index.js'

test('TRUST_PROXY accepts only a small whole number of hops; anything else means "no proxy"', () => {
  assert.equal(loadConfig({}).trustProxy, 0)
  assert.equal(loadConfig({ TRUST_PROXY: '1' }).trustProxy, 1)
  assert.equal(loadConfig({ TRUST_PROXY: ' 2 ' }).trustProxy, 2)
  for (const v of ['true', '*', '-1', 'abc', '100', '']) assert.equal(loadConfig({ TRUST_PROXY: v }).trustProxy, 0, v)
})

// No body is sent, so sign-in answers 400 before touching the database; the limiter still counts the request.
const hit = (s, ip) => s.call('POST', '/api/auth/login', { headers: ip ? { 'X-Forwarded-For': ip } : {} })

test('without TRUST_PROXY a client cannot choose its own IP to dodge the sign-in rate limit', async () => {
  const s = await startStack({ db: false, env: { AUTH_RATE_LIMIT_MAX: '2' } })
  try {
    const codes = []
    for (const ip of ['1.1.1.1', '2.2.2.2', '3.3.3.3']) codes.push((await hit(s, ip)).status)
    assert.deepEqual(codes, [400, 400, 429])
  } finally { await s.close() }
})

test('behind one trusted proxy, visitors are limited separately by their real IP', async () => {
  const s = await startStack({ db: false, env: { AUTH_RATE_LIMIT_MAX: '2', TRUST_PROXY: '1' } })
  try {
    const codes = []
    for (const ip of ['1.1.1.1', '2.2.2.2', '3.3.3.3', '1.1.1.1', '1.1.1.1']) codes.push((await hit(s, ip)).status)
    assert.deepEqual(codes, [400, 400, 400, 400, 429])
  } finally { await s.close() }
})

test('health and status answer without credentials and expose no secrets', async () => {
  const s = await startStack({ db: false })
  try {
    const health = await s.call('GET', '/api/health')
    assert.deepEqual([health.status, health.body], [200, { ok: true }])
    const status = await s.call('GET', '/api/status')
    assert.equal(status.status, 200)
    assert.deepEqual(Object.keys(status.body).sort(), ['database', 'muallim', 'quran', 'recitation'])
    assert.equal(status.body.database.connected, false) // this stack opened no database
    const text = JSON.stringify(status.body)
    for (const secret of [s.config.qf.clientSecret, s.config.qf.clientId, s.config.mongoUri]) {
      if (secret) assert.ok(!text.includes(secret))
    }
  } finally { await s.close() }
})

test('unknown API routes and bad JSON return clean JSON errors, never a stack trace', async () => {
  const s = await startStack({ db: false })
  try {
    const nf = await s.call('GET', '/api/does-not-exist')
    assert.deepEqual([nf.status, nf.body.error.code], [404, 'NOT_FOUND'])
    const bad = await s.call('POST', '/api/auth/login', { body: '{oops' })
    assert.deepEqual([bad.status, bad.body.error.code], [400, 'INVALID_JSON'])
    assert.ok(!JSON.stringify(bad.body).includes('node_modules'))
  } finally { await s.close() }
})

test('CORS allows only the configured origins', async () => {
  const s = await startStack({ db: false, env: { CORS_ORIGINS: 'https://app.example.com' } })
  try {
    const ok = await fetch(s.url + '/api/health', { headers: { Origin: 'https://app.example.com' } })
    assert.equal(ok.headers.get('access-control-allow-origin'), 'https://app.example.com')
    const evil = await fetch(s.url + '/api/health', { headers: { Origin: 'https://evil.example' } })
    assert.equal(evil.headers.get('access-control-allow-origin'), null)
  } finally { await s.close() }
})

test('database down: requests get a quick 503 with Retry-After, not a generic 500 or a long hang', async () => {
  const { default: mongoose } = await import('mongoose')
  const s = await startStack({ db: false, env: { DB_FAIL_FAST: 'true' } })
  mongoose.set('bufferCommands', false) // what config/db.js sets in production
  try {
    const started = Date.now()
    const r = await s.call('POST', '/api/auth/login', { body: { email: 'a@b.co', password: 'correct-horse-9' } })
    assert.deepEqual([r.status, r.body.error.code], [503, 'DATABASE_UNAVAILABLE'])
    assert.ok(Date.now() - started < 1000, 'must fail fast, not wait for a timeout')
    const raw = await fetch(s.url + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"email":"a@b.co","password":"correct-horse-9"}' })
    assert.equal(raw.headers.get('retry-after'), '5')
    // Pages that need no database keep working.
    assert.equal((await s.call('GET', '/api/chapters')).status, 200)
  } finally { mongoose.set('bufferCommands', true); await s.close() }
})

test('isDatabaseDown recognises connection failures only', async () => {
  const { isDatabaseDown } = await import('../middleware/errorHandler.js')
  for (const e of [{ name: 'MongooseServerSelectionError' }, { name: 'MongoNetworkError' }, { name: 'MongooseError', message: 'Operation `users.findOne()` buffering timed out after 10000ms' }]) assert.ok(isDatabaseDown(e), e.name)
  for (const e of [{ name: 'ValidationError' }, { name: 'TypeError', message: 'x is undefined' }, null, undefined]) assert.ok(!isDatabaseDown(e))
})
