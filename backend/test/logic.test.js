// Pure business rules (no database needed).
import test from 'node:test'
import assert from 'node:assert/strict'
import { rangeCovered, juzCoverage, gaps } from '../utils/juz.js'
import { recommend } from '../services/assessmentService.js'
import { quizDefinition, gradeQuiz } from '../services/foundationService.js'
import { LESSONS, LETTERS, QUIZ_PASS_RATIO } from '../config/foundationCurriculum.js'
import { issueProof, verifyProof, PROOF_TTL_MS } from '../utils/voiceProof.js'
import { ANSWERS } from './helpers.js'

test('rangeCovered: needs every verse, across touching passages', () => {
  assert.equal(rangeCovered([[1, 5], [6, 10]], 1, 10), true)
  assert.equal(rangeCovered([[1, 5], [7, 10]], 1, 10), false)
  assert.equal(rangeCovered([[3, 10]], 1, 10), false)
  assert.equal(rangeCovered([], 1, 3), false)
})

test('gaps returns only the uncovered parts', () => {
  assert.deepEqual(gaps([[3, 4], [8, 9]], 1, 10), [[1, 2], [5, 7], [10, 10]])
  assert.deepEqual(gaps([[1, 10]], 1, 10), [])
  assert.deepEqual(gaps([], 5, 8), [[5, 8]])
})

test('juzCoverage: complete only when every range is covered; "contributed" ignores declared-only juz', () => {
  const map = [{ juz: 1, ranges: [{ surah: 1, from: 1, to: 3 }, { surah: 2, from: 1, to: 10 }] }]
  const half = [{ _id: 'a', surah: 1, from: 1, to: 3, source: 'self' }]
  assert.equal(juzCoverage(map, half)[0].complete, false)
  const full = [...half, { _id: 'b', surah: 2, from: 1, to: 10, source: 'self' }]
  const c = juzCoverage(map, full)[0]
  assert.deepEqual([c.complete, c.contributed, c.passageIds.length], [true, true, 2])
  const declared = full.map((p) => ({ ...p, source: 'declared' }))
  assert.deepEqual([juzCoverage(map, declared)[0].complete, juzCoverage(map, declared)[0].contributed], [true, false])
})

test('assessment: beginners -> foundation; ready readers -> tahfidh; hafiz -> muraja\'ah only', () => {
  assert.equal(recommend(ANSWERS.beginner).programme, 'foundation')
  assert.equal(recommend({ ...ANSWERS.ready, joining: 0, quranReading: 1 }).programme, 'foundation') // reading score too low
  const ready = recommend(ANSWERS.ready)
  assert.equal(ready.programme, 'tahfidh')
  assert.equal(ready.suggestedNewVerses, 3)
  assert.equal(recommend({ ...ANSWERS.ready, quranReading: 1, minutes: 15 }).suggestedNewVerses, 1) // achievable: never zero
  assert.equal(recommend(ANSWERS.hafiz).programme, 'murajaah_only')
  assert.ok(recommend(ANSWERS.ready).reasons.some((r) => /not a certified/.test(r)))
})

test('foundation quizzes: every lesson with a quiz has questions with a real answer among 2+ choices', () => {
  for (const l of LESSONS.filter((x) => x.quiz)) {
    const def = quizDefinition(l.id)
    assert.ok(def.length >= 5, l.id)
    for (const q of def) {
      assert.ok(q.pool.includes(q.answer), `${l.id}/${q.id}`)
      assert.ok(new Set(q.pool).size >= 2, `${l.id}/${q.id}`)
    }
  }
})

test('quiz grading counts every question, so skipping cannot pass', () => {
  const def = quizDefinition('letters-1')
  const all = Object.fromEntries(def.map((q) => [q.id, q.answer]))
  assert.equal(gradeQuiz('letters-1', all).passed, true)
  assert.equal(gradeQuiz('letters-1', {}).passed, false)
  const oneRight = { [def[0].id]: def[0].answer }
  const g = gradeQuiz('letters-1', oneRight)
  assert.deepEqual([g.score, g.total, g.passed], [1, def.length, false])
  // 80% pass mark: the most misses that still pass is floor(20%), one more fails.
  const canMiss = Math.floor(def.length * (1 - QUIZ_PASS_RATIO) + 1e-9)
  const miss = (n) => ({ ...all, ...Object.fromEntries(def.slice(0, n).map((q) => [q.id, 'wrong'])) })
  assert.equal(gradeQuiz('letters-1', miss(canMiss)).passed, true)
  assert.equal(gradeQuiz('letters-1', miss(canMiss + 1)).passed, false)
})

test('letters quizzes: every letter is asked by name AND by ear; the listening answer is the letter itself', () => {
  for (const l of LESSONS.filter((x) => x.type === 'letters')) {
    const def = quizDefinition(l.id)
    assert.equal(def.length, l.letterIds.length * 2, l.id)
    const byLetter = Object.fromEntries(LETTERS.map((x) => [x.id, x]))
    for (const id of l.letterIds) {
      const q = def.find((x) => x.id === `listen:${id}`)
      assert.equal(q.kind, 'listen')
      assert.equal(q.answer, byLetter[id].char)
      assert.equal(q.display, '') // the question is the recording: the letter must not be printed
      assert.ok(q.pool.length === 28 && new Set(q.pool).size === 28)
      assert.ok(def.some((x) => x.id === `name:${id}`))
    }
  }
})

test('spoken quiz questions exist only with voice on, are right only with a valid receipt, and cannot be forged', () => {
  const secret = 's3cret'
  const off = quizDefinition('letters-1')
  const on = quizDefinition('letters-1', { voice: true })
  assert.equal(off.some((q) => q.kind === 'say'), false)
  const say = on.filter((q) => q.kind === 'say')
  assert.equal(say.length, 4)
  assert.deepEqual(say.map((q) => q.letterId), ['hha', 'kha', 'tha', 'jim']) // hardest-to-tell-apart letters first
  assert.ok(say.every((q) => q.display.endsWith('\u064E') && !('pool' in q)))
  const base = Object.fromEntries(on.filter((q) => q.kind !== 'say').map((q) => [q.id, q.answer]))
  const ctx = { voice: true, userId: 'u1', secret }
  const g0 = gradeQuiz('letters-1', base, ctx)
  assert.deepEqual([g0.score, g0.total, g0.passed], [14, 18, false]) // skipping every spoken question fails: 14/18 < 80%
  const proofs = Object.fromEntries(say.map((q) => [q.id, issueProof(secret, 'u1', q.letterId)]))
  assert.equal(gradeQuiz('letters-1', { ...base, ...proofs }, ctx).passed, true)
  // One receipt is enough to pass when everything else is right (15/18), none is not.
  assert.equal(gradeQuiz('letters-1', { ...base, [say[0].id]: proofs[say[0].id] }, ctx).passed, true)
  // Forgery attempts: another learner's receipt, another letter's, a wrong secret, an expired one, junk, the letter itself.
  const bad = [issueProof(secret, 'u2', 'hha'), issueProof(secret, 'u1', 'kha'), issueProof('other', 'u1', 'hha'), issueProof(secret, 'u1', 'hha', Date.now() - 3600_000), 'x.y', '', 123, 'ح']
  for (const b of bad) assert.equal(gradeQuiz('letters-1', { ...base, 'say:hha': b }, ctx).score, 14, String(b))
  // With the checker off at grading time the spoken questions simply are not part of the score.
  assert.deepEqual(((g) => [g.score, g.total])(gradeQuiz('letters-1', base, { voice: false })), [14, 14])
})

test('voice receipts: valid, expired, tampered, wrong user/letter/secret', () => {
  const now = 1_000_000_000_000
  const p = issueProof('k', 'u1', 'ba', now)
  assert.equal(verifyProof('k', 'u1', 'ba', p, now + 1000), true)
  assert.equal(verifyProof('k', 'u1', 'ba', p, now + PROOF_TTL_MS + 1), false)
  assert.equal(verifyProof('k', 'u2', 'ba', p, now), false)
  assert.equal(verifyProof('k', 'u1', 'ta', p, now), false)
  assert.equal(verifyProof('z', 'u1', 'ba', p, now), false)
  const [exp, sig] = p.split('.')
  assert.equal(verifyProof('k', 'u1', 'ba', `${Number(exp) + 99999999}.${sig}`, now), false) // extending the expiry breaks the signature
  assert.equal(verifyProof('k', 'u1', 'ba', `${exp}.${sig.replace(/.$/, sig.endsWith('0') ? '1' : '0')}`, now), false)
  assert.equal(verifyProof('', 'u1', 'ba', p, now), false)
})

test('curriculum data is consistent: 28 letters, unique ids, six non-joining letters', () => {
  assert.equal(LETTERS.length, 28)
  assert.equal(new Set(LETTERS.map((l) => l.id)).size, 28)
  assert.equal(new Set(LETTERS.map((l) => l.name)).size, 28) // quiz choices must be distinguishable
  assert.equal(LETTERS.filter((l) => !l.joins).length, 6)
  const covered = LESSONS.filter((l) => l.type === 'letters').flatMap((l) => l.letterIds)
  assert.equal(new Set(covered).size, 28)
})
