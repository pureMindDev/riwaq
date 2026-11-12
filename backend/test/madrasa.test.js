// End-to-end tests of the madrasa journey against a real MongoDB and the MOCK provider.
// The recognition engine is a STUB that "hears" exactly the text sent as audio, so each test decides
// precisely what the learner "recited". Real recognition accuracy is not tested here.
import test, { before, after } from 'node:test'
import mongoose from 'mongoose'
import assert from 'node:assert/strict'
import { startStack, dbSkip, ANSWERS } from './helpers.js'
import { quizDefinition } from '../services/foundationService.js'
import { LESSONS } from '../config/foundationCurriculum.js'
import { todayIn, addDays } from '../utils/dates.js'
import { Passage } from '../models/Passage.js'
import { DailyPlan } from '../models/DailyPlan.js'
import { StudyLog } from '../models/StudyLog.js'
import { RecitationSubmission } from '../models/RecitationSubmission.js'

let s
const today = () => todayIn('UTC')
before(async () => { if (!dbSkip) s = await startStack({ engine: true }) }) // strict mode: no self-declaration
after(async () => { if (s) await s.close() })
const opts = { skip: dbSkip }

const answersFor = (id) => Object.fromEntries(quizDefinition(id).map((q) => [q.id, q.answer]))
const call = (u, m, p, body) => s.call(m, p, { token: u.token, body })
const plan = async (u) => (await s.call('GET', '/api/plan/today', { token: u.token })).body.plan
const nextDay = (u) => DailyPlan.deleteMany({ user: u.user.id })
async function newLearner(answers, settings) {
  const u = await s.register()
  if (answers) await call(u, 'POST', '/api/assessment', { answers })
  if (settings) await call(u, 'PATCH', '/api/student/settings', settings)
  return u
}
const tahfidhLearner = (extra = {}) => newLearner(ANSWERS.ready, { start: { surah: 1, verse: 1 }, direction: 'ascending', newVerses: 2, ...extra })

// --- reciting to the Muallim: the "audio" is the text the engine will hear
const verseText = async (surah, from, to) => (await s.call('GET', `/api/chapters/${surah}/verses?from=${from}&to=${to}`)).body.verses.map((v) => v.textUthmani).join(' ')
const speak = (u, path, text) => s.call('POST', path, { token: u.token, raw: Buffer.from(text, 'utf8'), headers: { 'Content-Type': 'audio/webm' } })
async function recite(u, passageId, mutate = (t) => t) {
  const p = (await call(u, 'GET', `/api/tahfidh/passages/${passageId}`)).body.passage
  return speak(u, `/api/tahfidh/passages/${passageId}/recitations`, mutate(await verseText(p.surah, p.from, p.to)))
}
const swap = (...indexes) => (t) => t.split(' ').map((w, i) => (indexes.includes(i) ? 'مختلف' : w)).join(' ')
const memorise = async (u, id) => {
  assert.equal((await recite(u, id)).body.passed, true)
  const r = await call(u, 'POST', `/api/tahfidh/passages/${id}/memorised`, {})
  assert.equal(r.status, 200, JSON.stringify(r.body))
  return r.body.passage
}
const revise = async (u, id, mutate) => {
  const r = await recite(u, id, mutate)
  return call(u, 'POST', `/api/murajaah/passages/${id}/complete`, { submissionId: r.body.id })
}

test('no plan before the initial assessment', opts, async () => {
  const u = await s.register()
  const r = await s.call('GET', '/api/plan/today', { token: u.token })
  assert.deepEqual([r.status, r.body.error.code], [409, 'ASSESSMENT_REQUIRED'])
})

test('assessment: validated, saved, applied to the student; recommendation is a suggestion', opts, async () => {
  const q = await s.call('GET', '/api/assessment/questions')
  assert.equal(q.body.questions.length, 6)
  const u = await s.register()
  assert.equal((await call(u, 'POST', '/api/assessment', { answers: { ...ANSWERS.ready, letters: 7 } })).status, 400)
  assert.equal((await call(u, 'POST', '/api/assessment', { answers: { letters: 2 } })).status, 400)
  const r = await call(u, 'POST', '/api/assessment', { answers: ANSWERS.beginner })
  assert.equal(r.body.result.programme, 'foundation')
  assert.equal((await call(u, 'GET', '/api/student')).body.student.programme, 'foundation')
  assert.equal((await call(u, 'PATCH', '/api/student/programme', { programme: 'tahfidh' })).body.student.programme, 'tahfidh')
  for (const bad of ['unassigned', 'wizard', undefined]) assert.equal((await call(u, 'PATCH', '/api/student/programme', { programme: bad })).status, 400)
})

test('foundation: every lesson is earned: server-graded quizzes, sequential unlocking, and the Muallim for the last one', opts, async () => {
  const u = await newLearner(ANSWERS.beginner)
  const p = await plan(u)
  assert.deepEqual(p.items.map((i) => [i.kind, i.lessonId]), [['foundation_lesson', 'letters-1']])
  assert.equal((await call(u, 'GET', '/api/foundation/lessons/letters-2')).body.error.code, 'LESSON_LOCKED')
  const lesson = (await call(u, 'GET', '/api/foundation/lessons/letters-1')).body.lesson
  assert.ok(lesson.quiz.questions.every((q) => q.choices.length >= 2 && !('answer' in q)), 'answers must never be sent to the client')
  assert.equal((await call(u, 'POST', '/api/foundation/lessons/letters-1/complete')).body.error.code, 'QUIZ_REQUIRED')
  assert.equal((await call(u, 'POST', '/api/foundation/lessons/letters-1/quiz', { answers: {} })).body.passed, false)
  assert.equal((await call(u, 'POST', '/api/foundation/lessons/letters-1/complete')).status, 409)
  assert.equal((await call(u, 'POST', '/api/foundation/lessons/letters-1/quiz', { answers: answersFor('letters-1') })).body.passed, true)
  assert.equal((await call(u, 'POST', '/api/foundation/lessons/letters-1/complete')).status, 200)
  assert.equal((await plan(u)).items[0].status, 'completed')

  for (const l of LESSONS.slice(1).filter((x) => x.type !== 'readalong')) {
    assert.ok(l.quiz, `${l.id} must have a quiz: nothing can be completed by clicking`)
    assert.equal((await call(u, 'POST', `/api/foundation/lessons/${l.id}/complete`)).body.error.code, 'QUIZ_REQUIRED', l.id)
    await call(u, 'POST', `/api/foundation/lessons/${l.id}/quiz`, { answers: answersFor(l.id) })
    assert.equal((await call(u, 'POST', `/api/foundation/lessons/${l.id}/complete`)).status, 200, l.id)
  }
  assert.equal((await call(u, 'POST', '/api/foundation/lessons/readalong/complete')).body.error.code, 'MUALLIM_PASS_REQUIRED')
  const text = await verseText(1, 1, 3) // the mock Surah has 3 verses; the lesson asks for up to 7 and the server reads what exists
  const bad = await speak(u, '/api/foundation/lessons/readalong/recitation', swap(1)(text))
  assert.deepEqual([bad.status, bad.body.passed, bad.body.verdict], [201, false, 'try_again'])
  assert.equal((await call(u, 'POST', '/api/foundation/lessons/readalong/complete')).status, 409)
  const good = await speak(u, '/api/foundation/lessons/readalong/recitation', text)
  assert.equal(good.body.passed, true)
  assert.equal((await call(u, 'POST', '/api/foundation/lessons/readalong/complete')).body.allDone, true)
  await nextDay(u)
  assert.match((await plan(u)).message, /completed the foundation/)
})

test('tahfidh: nothing counts as memorised until the Muallim passes the WHOLE passage', opts, async () => {
  const u = await tahfidhLearner()
  const p1 = await plan(u)
  assert.deepEqual(p1.items.map((i) => [i.kind, i.label]), [['new_memorisation', 'Test Surah A 1–2']])
  assert.equal((await plan(u)).items[0].passageId, p1.items[0].passageId)
  const id = p1.items[0].passageId

  assert.equal((await call(u, 'PATCH', `/api/tahfidh/passages/${id}/position`, { verse: 2 })).body.lastVerse, 2)
  for (const body of [{}, { selfDeclared: true }]) {
    const r = await call(u, 'POST', `/api/tahfidh/passages/${id}/memorised`, body)
    assert.deepEqual([r.status, r.body.error.code], [409, 'MUALLIM_PASS_REQUIRED'])
  }
  const half = await speak(u, `/api/tahfidh/passages/${id}/recitations`, await verseText(1, 1, 1))
  assert.deepEqual([half.body.passed, half.body.corrections[0].type], [false, 'stopped_early'])
  assert.equal((await call(u, 'POST', `/api/tahfidh/passages/${id}/memorised`, {})).status, 409)
  const wrong = await recite(u, id, swap(1))
  assert.equal(wrong.body.verdict, 'try_again')
  assert.match(wrong.body.corrections[0].message, /Word 2 «.*»: you said «مختلف»\. The word is «/)
  assert.equal((await call(u, 'POST', `/api/tahfidh/passages/${id}/memorised`, {})).status, 409)

  const ok = await memorise(u, id)
  assert.deepEqual([ok.status, ok.evidence], ['memorised', 'recitation_checked'])
  assert.equal(ok.schedule.dueDate, addDays(today(), 1))
  assert.equal((await plan(u)).items[0].status, 'completed')

  await nextDay(u)
  assert.deepEqual((await plan(u)).items.map((i) => [i.kind, i.label]), [['new_memorisation', 'Test Surah A 3']])
})

test('the Muallim hears a wrong VOWEL and names the letter (when the engine transcribes vowels)', opts, async () => {
  const u = await tahfidhLearner({ newVerses: 1 })
  const id = (await plan(u)).items[0].passageId
  const r = await recite(u, id, (t) => t.replace('لَيْسَ', 'لَيْسِ'))
  assert.deepEqual([r.body.passed, r.body.corrections.length, r.body.corrections[0].type], [false, 1, 'vowel'])
  assert.match(r.body.corrections[0].message, /Word 3 «لَيْسَ»: on the letter س \(Sīn\) the vowel should be fatḥa, but you said kasra\./)
  assert.equal((await call(u, 'POST', `/api/tahfidh/passages/${id}/memorised`, {})).status, 409)
  const stored = await RecitationSubmission.findById(r.body.id).lean()
  assert.deepEqual([stored.verdict, stored.corrections.length, stored.passed], ['try_again', 1, false])
  assert.ok(!JSON.stringify(stored).includes('audio'), 'only the outcome is stored')
})

test('concurrent plan requests create exactly one assigned passage', opts, async () => {
  const u = await tahfidhLearner()
  const results = await Promise.all(Array.from({ length: 6 }, () => s.call('GET', '/api/plan/today', { token: u.token })))
  assert.ok(results.every((r) => r.status === 200))
  assert.equal(await Passage.countDocuments({ user: u.user.id }), 1)
  assert.equal(await DailyPlan.countDocuments({ user: u.user.id }), 1)
})

test('muraja\'ah is reciting to the Muallim: the result decides the rating, and a recitation is used once', opts, async () => {
  const u = await tahfidhLearner({ newVerses: 1 })
  const id = (await plan(u)).items[0].passageId
  await memorise(u, id)
  await Passage.updateOne({ _id: id }, { 'schedule.dueDate': today() })
  await nextDay(u)
  const p = await plan(u)
  assert.deepEqual(p.items.map((i) => i.kind), ['new_memorisation', 'revision'])

  for (const body of [{ rating: 'easy' }, {}]) {
    const r = await call(u, 'POST', `/api/murajaah/passages/${id}/complete`, body)
    assert.deepEqual([r.status, r.body.error.code], [409, 'MUALLIM_REQUIRED'])
  }
  const easy = await revise(u, id)
  assert.deepEqual([easy.body.passage.schedule.stage, easy.body.passage.schedule.dueDate], [1, addDays(today(), 3)])
  assert.equal((await plan(u)).items[1].status, 'completed')

  const mid = await revise(u, id, swap(1))
  assert.equal(mid.body.passage.status, 'memorised')
  assert.equal(mid.body.passage.schedule.stage, 1)
  const hard = await revise(u, id, swap(0, 1, 2))
  assert.deepEqual([hard.body.passage.status, hard.body.passage.schedule.dueDate], ['needs_review', addDays(today(), 1)])

  const sub = await recite(u, id)
  assert.equal((await call(u, 'POST', `/api/murajaah/passages/${id}/complete`, { submissionId: sub.body.id })).status, 200)
  const again = await call(u, 'POST', `/api/murajaah/passages/${id}/complete`, { submissionId: sub.body.id })
  assert.deepEqual([again.status, again.body.error.code], [409, 'ALREADY_USED'])

  const unclear = await recite(u, id, () => 'مرحبا بكم في هذا البرنامج الجميل')
  assert.equal(unclear.body.verdict, 'unclear')
  assert.equal((await call(u, 'POST', `/api/murajaah/passages/${id}/complete`, { submissionId: unclear.body.id })).body.error.code, 'UNCLEAR')

  await RecitationSubmission.collection.updateOne({ _id: new mongoose.Types.ObjectId(sub.body.id) }, { $set: { consumed: false, createdAt: new Date(Date.now() - 2 * 3600000) } }) // timestamps are immutable through Mongoose
  assert.equal((await call(u, 'POST', `/api/murajaah/passages/${id}/complete`, { submissionId: sub.body.id })).body.error.code, 'EXPIRED')

  const adj = await call(u, 'PATCH', `/api/murajaah/passages/${id}/schedule`, { dueDate: addDays(today(), 10) })
  assert.equal(adj.body.passage.schedule.dueDate, addDays(today(), 10))
  assert.equal((await call(u, 'PATCH', `/api/murajaah/passages/${id}/schedule`, { dueDate: 'tomorrow' })).status, 400)
  const hist = (await call(u, 'GET', '/api/murajaah/history')).body.history
  assert.deepEqual(hist.map((h) => h.rating), ['easy', 'difficult', 'moderate', 'easy'])
})

test('a recitation for another passage cannot be used to revise this one', opts, async () => {
  const u = await tahfidhLearner({ newVerses: 1 })
  const a = (await plan(u)).items[0].passageId
  await memorise(u, a)
  const b = (await call(u, 'POST', '/api/tahfidh/passages', { surah: 2, from: 1, to: 1, status: 'memorised' })).body.passage.id
  const subA = await recite(u, a)
  assert.equal((await call(u, 'POST', `/api/murajaah/passages/${b}/complete`, { submissionId: subA.body.id })).status, 404)
})

test('a Tahfidh day stays achievable: at most 6 revisions are planned, the rest stay due', opts, async () => {
  const u = await tahfidhLearner()
  for (let v = 1; v <= 8; v++) assert.equal((await call(u, 'POST', '/api/tahfidh/passages', { surah: 2, from: v, to: v, status: 'memorised' })).status, 201)
  const p = await plan(u)
  assert.equal(p.items.filter((i) => i.kind === 'revision').length, 6)
  assert.equal((await call(u, 'GET', '/api/murajaah')).body.due.length, 8)
})

test('passage records: validation, overlap protection, status changes without duplicates', opts, async () => {
  const u = await tahfidhLearner()
  const add = (body) => call(u, 'POST', '/api/tahfidh/passages', body)
  assert.equal((await add({ surah: 2, from: 1, to: 1, status: 'learning' })).status, 201)
  const clash = await add({ surah: 2, from: 1, to: 1, status: 'learning' })
  assert.deepEqual([clash.status, clash.body.error.code], [409, 'PASSAGE_OVERLAP'])
  assert.equal((await add({ surah: 2, from: 2, to: 2, status: 'learning' })).status, 201)
  for (const bad of [{ surah: 2, from: 9, to: 99 }, { surah: 2, from: 9, to: 8 }, { surah: 0, from: 1, to: 1 }, { surah: 2, from: 'a', to: 3 }, { surah: 2, from: 9, to: 9, status: 'verified' }]) {
    assert.equal((await add({ status: 'learning', ...bad })).status, 400, JSON.stringify(bad))
  }
  const id = (await call(u, 'GET', '/api/tahfidh/passages')).body.passages[0].id
  assert.equal((await call(u, 'PATCH', `/api/tahfidh/passages/${id}/status`, { status: 'needs_review' })).status, 409)
  assert.equal((await call(u, 'PATCH', `/api/tahfidh/passages/${id}/status`, { status: 'memorised' })).status, 409)
  await memorise(u, id)
  assert.equal((await call(u, 'PATCH', `/api/tahfidh/passages/${id}/status`, { status: 'needs_review' })).body.passage.status, 'needs_review')
  assert.equal((await call(u, 'PATCH', `/api/tahfidh/passages/${id}/status`, { status: 'memorised' })).body.passage.status, 'memorised')
  const back = await call(u, 'PATCH', `/api/tahfidh/passages/${id}/status`, { status: 'learning' })
  assert.deepEqual([back.body.passage.status, back.body.passage.schedule, back.body.passage.evidence], ['learning', null, 'none'])
  assert.equal((await call(u, 'GET', '/api/tahfidh/passages')).body.passages.length, 2)
  assert.equal((await call(u, 'PATCH', '/api/student/settings', { newVerses: 0 })).status, 400)
  assert.equal((await call(u, 'PATCH', '/api/student/settings', { start: { surah: 1, verse: 9 } })).status, 400)
})

test('juz milestones: the cumulative check is passed only by a correct recitation', opts, async () => {
  const u = await tahfidhLearner()
  const add = (surah, from, to) => call(u, 'POST', '/api/tahfidh/passages', { surah, from, to, status: 'memorised' })
  await add(1, 1, 3)
  assert.equal((await call(u, 'GET', '/api/milestones')).body.milestones.length, 0)
  await add(2, 1, 10)
  const m = (await call(u, 'GET', '/api/milestones')).body.milestones[0]
  assert.deepEqual([m.juz, m.status, m.targets.length, m.assessmentItems.length], [1, 'pending', 2, 1])
  const day = await plan(u)
  assert.ok(day.items.some((i) => i.kind === 'milestone' && i.milestoneId === m.id))
  await call(u, 'DELETE', `/api/tahfidh/passages/${day.items.find((i) => i.kind === 'new_memorisation').passageId}`)

  for (const t of m.targets) assert.equal((await revise(u, t.passageId)).status, 200)
  let cur = (await call(u, 'GET', `/api/milestones/${m.id}`)).body.milestone
  assert.equal(cur.progress.revised, 2)
  assert.equal(cur.status, 'pending')

  const item = cur.assessmentItems[0]
  const miss = await recite(u, item.passageId, swap(0))
  const tried = await call(u, 'POST', `/api/milestones/${m.id}/assessment/${item.id}`, { submissionId: miss.body.id })
  assert.equal(tried.body.milestone.status, 'pending')
  assert.equal(tried.body.milestone.assessmentItems[0].done, false)
  assert.equal((await call(u, 'POST', `/api/milestones/${m.id}/assessment/${item.id}`, { rating: 'easy' })).body.error.code, 'MUALLIM_REQUIRED')
  const hit = await recite(u, item.passageId)
  cur = (await call(u, 'POST', `/api/milestones/${m.id}/assessment/${item.id}`, { submissionId: hit.body.id })).body.milestone
  assert.equal(cur.status, 'completed')
  assert.equal(await StudyLog.countDocuments({ user: u.user.id, type: 'milestone' }), 1)
})

test('hafiz: muraja\'ah-only programme; declared Ajza\' spawn no milestones; revising them needs the Muallim', opts, async () => {
  const u = await newLearner(ANSWERS.hafiz, { revisionVerses: 10 })
  assert.equal((await call(u, 'GET', '/api/student')).body.student.programme, 'murajaah_only')
  assert.match((await plan(u)).message, /memorised/)
  assert.equal((await call(u, 'POST', '/api/tahfidh/declare-juz', { juz: [31] })).status, 400)
  assert.equal((await call(u, 'POST', '/api/tahfidh/declare-juz', { juz: [3] })).status, 404)
  const d = await call(u, 'POST', '/api/tahfidh/declare-juz', { juz: [1, 2] })
  assert.deepEqual([d.status, d.body.created, d.body.verses], [201, 3, 63])
  assert.equal((await call(u, 'POST', '/api/tahfidh/declare-juz', { juz: [1, 2] })).body.created, 0)
  const ps = (await call(u, 'GET', '/api/tahfidh/passages')).body.passages
  assert.ok(ps.every((p) => p.source === 'declared' && p.evidence === 'declared'))
  assert.equal((await call(u, 'GET', '/api/milestones')).body.milestones.length, 0)

  await nextDay(u)
  let p = await plan(u)
  assert.deepEqual(p.items.map((i) => i.label), ['Test Surah A 1–3', 'Test Surah B 1–10'])
  assert.equal((await revise(u, p.items[0].passageId)).status, 200)
  await nextDay(u)
  p = await plan(u)
  assert.deepEqual(p.items.map((i) => i.label), ['Test Surah B 1–10'])
})

test('declaring a Juz is refused while a covered passage is still being learned', opts, async () => {
  const u = await newLearner(ANSWERS.hafiz)
  await call(u, 'POST', '/api/tahfidh/passages', { surah: 1, from: 1, to: 1, status: 'learning' })
  const r = await call(u, 'POST', '/api/tahfidh/declare-juz', { juz: [1] })
  assert.deepEqual([r.status, r.body.error.code], [409, 'PASSAGE_OVERLAP'])
  assert.equal((await call(u, 'GET', '/api/tahfidh/passages')).body.passages.length, 1)
})

test('changing programme re-plans today; time zone decides what "today" is', opts, async () => {
  const u = await newLearner(ANSWERS.beginner)
  assert.equal((await plan(u)).items[0].kind, 'foundation_lesson')
  await call(u, 'PATCH', '/api/student/settings', { start: { surah: 1, verse: 1 }, direction: 'ascending' })
  await call(u, 'PATCH', '/api/student/programme', { programme: 'tahfidh' })
  assert.equal((await plan(u)).items[0].kind, 'new_memorisation')
  const nz = await s.register(undefined, { timezone: 'Pacific/Auckland' })
  await call(nz, 'POST', '/api/assessment', { answers: ANSWERS.beginner })
  assert.equal((await plan(nz)).date, todayIn('Pacific/Auckland'))
  assert.equal((await call(nz, 'PATCH', '/api/student/settings', { timezone: 'Mars/Base' })).status, 400)
})

test('when the Qur\'an provider is down the plan says so honestly and is not saved', opts, async () => {
  const dead = await startStack({ db: 'reuse', dead: true })
  const u = await dead.register()
  await dead.call('POST', '/api/assessment', { token: u.token, body: { answers: ANSWERS.ready } })
  const r = await dead.call('GET', '/api/plan/today', { token: u.token })
  assert.ok(r.body.plan.warnings.length > 0)
  assert.equal(await DailyPlan.countDocuments({ user: u.user.id }), 0)
  assert.equal((await dead.call('POST', '/api/tahfidh/passages', { token: u.token, body: { surah: 1, from: 1, to: 1, status: 'learning' } })).status, 502)
  await dead.close()
})

test('without a recognition engine the Muallim is honestly unavailable, and progress cannot be claimed', opts, async () => {
  const none = await startStack({ db: 'reuse' })
  const u = await none.register()
  await none.call('POST', '/api/assessment', { token: u.token, body: { answers: ANSWERS.ready } })
  await none.call('PATCH', '/api/student/settings', { token: u.token, body: { start: { surah: 1, verse: 1 }, direction: 'ascending', newVerses: 1 } })
  const id = (await none.call('GET', '/api/plan/today', { token: u.token })).body.plan.items[0].passageId
  const r = await none.call('POST', `/api/tahfidh/passages/${id}/recitations`, { token: u.token, raw: Buffer.from('x'), headers: { 'Content-Type': 'audio/webm' } })
  assert.deepEqual([r.status, r.body.error.code], [501, 'MUALLIM_UNAVAILABLE'])
  for (const body of [{}, { selfDeclared: true }]) assert.equal((await none.call('POST', `/api/tahfidh/passages/${id}/memorised`, { token: u.token, body })).body.error.code, 'MUALLIM_PASS_REQUIRED')
  assert.equal((await none.call('GET', '/api/status')).body.muallim.strict, true)
  await none.close()
})

test('development switch: ALLOW_SELF_DECLARATION lets a developer test without an engine (off by default)', opts, async () => {
  const dev = await startStack({ db: 'reuse', env: { ALLOW_SELF_DECLARATION: 'true' } })
  const u = await dev.register()
  await dev.call('POST', '/api/assessment', { token: u.token, body: { answers: ANSWERS.ready } })
  const id = (await dev.call('POST', '/api/tahfidh/passages', { token: u.token, body: { surah: 1, from: 1, to: 1, status: 'learning' } })).body.passage.id
  const r = await dev.call('POST', `/api/tahfidh/passages/${id}/memorised`, { token: u.token, body: { selfDeclared: true } })
  assert.deepEqual([r.status, r.body.passage.evidence], [200, 'self_declared'])
  assert.equal((await dev.call('POST', `/api/murajaah/passages/${id}/complete`, { token: u.token, body: { rating: 'easy' } })).status, 200)
  assert.equal((await dev.call('GET', '/api/status')).body.muallim.strict, false)
  await dev.close()
})

test('progress and activity come only from saved records', opts, async () => {
  const u = await tahfidhLearner()
  const empty = (await call(u, 'GET', '/api/student/progress')).body
  assert.deepEqual([empty.memorisedVerses, empty.learningPassages, empty.week.reduce((n, d) => n + d.count, 0)], [0, 0, 0])
  await memorise(u, (await plan(u)).items[0].passageId)
  const p = (await call(u, 'GET', '/api/student/progress')).body
  assert.deepEqual([p.memorisedVerses, p.week[6].count, p.bySurah[0].memorisedVerses], [2, 1, 2])
  const act = (await call(u, 'GET', '/api/student/activity')).body.activity
  assert.deepEqual([act.length, act[0].type], [1, 'memorise'])
})

test('practice recitation (Recite page) returns direct corrections and saves nothing', opts, async () => {
  const text = await verseText(1, 1, 1)
  const u = await s.register()
  const r = await speak(u, '/api/recitation/analyze?surah=1&from=1&to=1', swap(2)(text))
  assert.equal(r.status, 200)
  assert.equal(r.body.feedback.verdict, 'try_again')
  assert.equal(await RecitationSubmission.countDocuments({ user: u.user.id }), 0)
})
