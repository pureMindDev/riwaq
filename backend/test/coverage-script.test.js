import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
import { startStack } from './helpers.js'
import { runCoverage } from '../scripts/check-quran-coverage.js'

let s
before(async () => { s = await startStack({ db: false }) })
after(() => s.close())

test('coverage script reports what the provider serves and what it does not, without crashing', async () => {
  const lines = []
  const out = await runCoverage({ quran: s.services.quran, reciterId: 901, log: (l) => lines.push(l) })
  assert.equal(out.chapters, lines.length)
  assert.equal(out.textOk + out.textMissing.length, out.chapters)
  assert.ok(out.rows.every((r) => r.id && r.text && r.audio))
  const none = await runCoverage({ quran: s.services.quran, log: () => {} })
  assert.ok(none.rows.every((r) => r.audio === 'skipped'))
})
