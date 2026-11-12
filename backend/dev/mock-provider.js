// DEVELOPMENT / TEST ONLY. A tiny stand-in for the Quran Foundation API so the
// app can be exercised without credentials. It contains NO Qur'anic text:
// every "verse" is a clearly labelled placeholder sentence. Never use it in
// production and never present its output as Qur'an.
import http from 'node:http'

export const MOCK = { clientId: 'test-id', clientSecret: 'test-secret' }
const TOKEN = 'mock-token'
const CHAPTERS = [
  { id: 1, name_simple: 'Test Surah A', name_arabic: 'اختبار', verses_count: 3, revelation_place: 'makkah', translated_name: { name: 'Placeholder A' } },
  { id: 2, name_simple: 'Test Surah B', name_arabic: 'تجربة', verses_count: 60, revelation_place: 'madinah', translated_name: { name: 'Placeholder B' } },
]
// "Test text, not from the Qur'an, number N"
const verseText = (n) => `نَصٌّ تَجْرِيبِيٌّ لَيْسَ مِنَ الْقُرْآنِ رَقْم ${n}`

function wav() {
  const rate = 8000
  const samples = rate // 1 second tone
  const buf = Buffer.alloc(44 + samples * 2)
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + samples * 2, 4); buf.write('WAVEfmt ', 8)
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22)
  buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34)
  buf.write('data', 36); buf.writeUInt32LE(samples * 2, 40)
  for (let i = 0; i < samples; i++) buf.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 440 * i) / rate) * 3000), 44 + i * 2)
  return buf
}

export function createMockProvider() {
  const calls = { token: 0 }
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x')
    const json = (status, body) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)) }
    if (url.pathname === '/oauth2/token') {
      const expected = 'Basic ' + Buffer.from(`${MOCK.clientId}:${MOCK.clientSecret}`).toString('base64')
      if (req.headers.authorization !== expected) return json(401, { error: 'invalid_client' })
      calls.token++
      return json(200, { access_token: TOKEN, expires_in: 3600 })
    }
    if (url.pathname.startsWith('/audio/')) {
      res.writeHead(200, { 'Content-Type': 'audio/wav', 'Access-Control-Allow-Origin': '*' })
      return res.end(wav())
    }
    if (req.headers['x-auth-token'] !== TOKEN || req.headers['x-client-id'] !== MOCK.clientId) return json(401, { error: 'unauthorized' })
    const p = url.pathname.replace('/content/api/v4', '')
    const page = Number(url.searchParams.get('page') || 1)
    const per = Number(url.searchParams.get('per_page') || 10)
    const paginate = (all, key) => {
      const slice = all.slice((page - 1) * per, page * per)
      return { [key]: slice, pagination: { next_page: page * per < all.length ? page + 1 : null } }
    }
    let m
    if (p === '/chapters') return json(200, { chapters: CHAPTERS })
    if ((m = p.match(/^\/chapters\/(\d+)$/))) {
      const c = CHAPTERS.find((c) => c.id === Number(m[1]))
      return c ? json(200, { chapter: c }) : json(404, { error: 'not found' })
    }
    if ((m = p.match(/^\/verses\/by_chapter\/(\d+)$/))) {
      const c = CHAPTERS.find((c) => c.id === Number(m[1]))
      if (!c) return json(200, { verses: [], pagination: { next_page: null } })
      const all = Array.from({ length: c.verses_count }, (_, i) => ({ verse_number: i + 1, verse_key: `${c.id}:${i + 1}`, text_uthmani: verseText(i + 1) }))
      return json(200, paginate(all, 'verses'))
    }
    // MOCK Juz mapping (not the real one): two tiny "Ajza'" so milestones can be tested.
    if (p === '/juzs') return json(200, { juzs: [
      { id: 1, juz_number: 1, verse_mapping: { 1: '1-3', 2: '1-10' } },
      { id: 2, juz_number: 2, verse_mapping: { 2: '11-60' } },
    ] })
    if (p === '/resources/recitations') return json(200, { recitations: [{ id: 901, reciter_name: 'Mock Reciter (test tone)', style: null }] })
    if ((m = p.match(/^\/recitations\/(\d+)\/by_chapter\/(\d+)$/))) {
      const c = CHAPTERS.find((c) => c.id === Number(m[2]))
      if (!c) return json(200, { audio_files: [], pagination: { next_page: null } })
      const all = Array.from({ length: c.verses_count }, (_, i) => ({ verse_key: `${c.id}:${i + 1}`, url: `mock/${m[1]}/${c.id}_${i + 1}.wav` }))
      return json(200, paginate(all, 'audio_files'))
    }
    json(404, { error: 'not found' })
  })
  return { server, calls }
}

// Run directly: node dev/mock-provider.js
if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.MOCK_PORT) || 4100
  createMockProvider().server.listen(port, () => {
    console.log(`MOCK provider (NOT real Qur'an data) on http://localhost:${port}`)
    console.log(`Start the API with:\n  QF_CLIENT_ID=${MOCK.clientId} QF_CLIENT_SECRET=${MOCK.clientSecret} QF_AUTH_URL=http://localhost:${port} QF_API_URL=http://localhost:${port} QF_AUDIO_BASE_URL=http://localhost:${port}/audio/ npm start`)
  })
}
