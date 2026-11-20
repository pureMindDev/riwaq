import { LESSONS, LETTERS, SHORT_VOWELS, OTHER_MARKS, LONG_VOWELS, ARTICULATION_AREAS, MAKHRAJ, QUIZ_PASS_RATIO } from '../config/foundationCurriculum.js'
import { AppError } from '../utils/AppError.js'
import { Student } from '../models/Student.js'
import { StudyLog } from '../models/StudyLog.js'
import { DailyPlan } from '../models/DailyPlan.js'
import { todayIn } from '../utils/dates.js'
import { verifyProof } from '../utils/voiceProof.js'

const ZWJ = '\u200D' // asks the browser to draw the joined form of a letter
const byId = new Map(LETTERS.map((l) => [l.id, l]))
const shuffle = (arr) => {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
const forms = (l) => ({ isolated: l.char, initial: l.joins ? l.char + ZWJ : l.char, medial: l.joins ? ZWJ + l.char + ZWJ : ZWJ + l.char, final: ZWJ + l.char })
const consonants = LETTERS.filter((l) => l.sound)
const syllable = (l, v) => ({ text: l.char + v.mark, sound: l.sound + v.vowel })
// The drill grid is deterministic, so its quiz can be graded without storing anything.
const drillCell = (r, c) => ({ letter: consonants[(r * 5 + c * 3) % consonants.length], vowel: SHORT_VOWELS[(r + c) % 3] })
const AREAS = ['Al-Jawf (open space)', 'Al-Ḥalq (throat)', 'Al-Lisān (tongue)', 'Ash-Shafatayn (lips)', 'Al-Khayshūm (nasal passage)']
const AREA_QUESTIONS = [['ب', 3], ['ف', 3], ['ح', 1], ['ع', 1], ['ق', 2], ['ك', 2]]

// Letters lessons test three things: see a letter and give its NAME, hear a letter and pick it, and (only when the AI
// letter checker is running) SAY a letter. The hardest letters to tell apart are the ones that are spoken first.
const SAY_COUNT = 4
const SAY_PRIORITY = ['hha', 'kha', 'ayn', 'ghayn', 'sad', 'dad', 'tta', 'zha', 'qaf', 'tha', 'dhal', 'shin', 'jim', 'ha', 'alif', 'zay', 'sin', 'kaf', 'ta', 'dal', 'ba', 'ra', 'fa', 'lam', 'mim', 'nun', 'waw', 'ya']
const FATHA = 'َ'
const sayDisplay = (l) => (l.id === 'alif' ? 'أ' : l.char) + FATHA // Tajweed/Qaida style; alif is taught as hamza with fatha
const sayLetterIds = (ids) => [...ids].sort((a, b) => SAY_PRIORITY.indexOf(a) - SAY_PRIORITY.indexOf(b)).slice(0, SAY_COUNT)

// The fixed question set for a lesson: [{ id, kind, prompt, display, answer, pool }].
// `kind` is 'choice' (default), 'listen' (play the letter's recording, pick the letter) or 'say' (spoken; only with
// `voice: true`; the "answer" is a signed receipt from the AI checker, see utils/voiceProof.js, so it has no `pool`).
// `pool` is where wrong choices come from. The answer never leaves the server.
export function quizDefinition(lessonId, { voice = false } = {}) {
  const lesson = LESSONS.find((l) => l.id === lessonId)
  if (!lesson?.quiz) return []
  if (lesson.type === 'letters') {
    const names = lesson.letterIds.map((id) => {
      const l = byId.get(id)
      return { id: `name:${id}`, prompt: 'What is the name of this letter?', display: l.char, answer: l.name, pool: LETTERS.map((x) => x.name) }
    })
    const listen = lesson.letterIds.map((id) => {
      const l = byId.get(id)
      return { id: `listen:${id}`, kind: 'listen', letterId: id, prompt: 'Listen. Which letter did you hear?', display: '', answer: l.char, pool: LETTERS.map((x) => x.char) }
    })
    const say = voice ? sayLetterIds(lesson.letterIds).map((id) => ({ id: `say:${id}`, kind: 'say', letterId: id, prompt: 'Say this letter aloud', display: sayDisplay(byId.get(id)), answer: null })) : []
    return [...names, ...listen, ...say]
  }
  if (lesson.type === 'vowels') {
    const picks = ['ba', 'ta', 'jim', 'sin', 'kaf', 'mim']
    return picks.map((id, i) => {
      const l = byId.get(id)
      const v = SHORT_VOWELS[i % 3]
      return { id: `vowel:${id}:${v.id}`, prompt: 'How is this read?', display: syllable(l, v).text, answer: l.sound + v.vowel, pool: SHORT_VOWELS.map((x) => l.sound + x.vowel) }
    })
  }
  if (lesson.type === 'marks') {
    return OTHER_MARKS.map((m) => ({ id: `mark:${m.id}`, prompt: 'What is this mark called?', display: 'ب' + m.mark, answer: m.name, pool: OTHER_MARKS.map((x) => x.name) }))
  }
  if (lesson.type === 'madd') {
    const out = []
    for (const id of ['ba', 'sin']) {
      const l = byId.get(id)
      for (const m of LONG_VOWELS) {
        out.push({ id: `madd:${m.id}:${id}`, prompt: 'How is this read?', display: m.pattern(l.char), answer: l.sound + m.vowel, pool: LONG_VOWELS.map((x) => l.sound + x.vowel) })
      }
    }
    return out
  }
  if (lesson.type === 'info') {
    return [
      ...AREA_QUESTIONS.map(([ch, area]) => ({ id: `area:${ch}`, prompt: 'Which area does this letter come from?', display: ch, answer: AREAS[area], pool: AREAS })),
      { id: 'area:ghunna', prompt: 'The nasal sound (ghunna) of these letters comes from…', display: 'ن م', answer: AREAS[4], pool: AREAS },
    ]
  }
  if (lesson.type === 'drill') {
    return [[0, 0], [1, 2], [2, 4], [3, 1], [4, 3], [5, 0], [5, 4], [2, 2]].map(([r, c]) => {
      const { letter, vowel } = drillCell(r, c)
      return { id: `drill:${r}:${c}`, prompt: 'How is this read?', display: letter.char + vowel.mark, answer: letter.sound + vowel.vowel, pool: SHORT_VOWELS.map((x) => letter.sound + x.vowel) }
    })
  }
  if (lesson.type === 'joining') {
    return ['alif', 'ba', 'dal', 'sin', 'ra', 'mim', 'waw', 'jim'].map((id) => {
      const l = byId.get(id)
      return { id: `join:${id}`, prompt: 'Does this letter connect to the letter AFTER it?', display: l.char, answer: l.joins ? 'Yes' : 'No', pool: ['Yes', 'No'] }
    })
  }
  return []
}

function buildQuiz(lessonId, voice) {
  return quizDefinition(lessonId, { voice }).map((q) => {
    const kind = q.kind || 'choice'
    if (kind === 'say') return { id: q.id, kind, prompt: q.prompt, display: q.display, letterId: q.letterId }
    const wrong = shuffle([...new Set(q.pool)].filter((x) => x !== q.answer)).slice(0, 3)
    return { id: q.id, kind, prompt: q.prompt, display: q.display, ...(q.letterId ? { letterId: q.letterId } : {}), choices: shuffle([q.answer, ...wrong]) }
  })
}

// The score counts ALL questions of the lesson, so skipping questions cannot help.
// A spoken question is right only with a valid, unexpired receipt for this learner and letter.
export function gradeQuiz(lessonId, answers, { voice = false, userId, secret, now } = {}) {
  const def = quizDefinition(lessonId, { voice })
  const isRight = (q) => (q.kind === 'say' ? verifyProof(secret, userId, q.letterId, answers?.[q.id], now) : answers?.[q.id] === q.answer)
  const wrong = def.filter((q) => !answers || !isRight(q)).map((q) => q.id)
  const score = def.length - wrong.length
  return { score, total: def.length, passed: def.length > 0 && score / def.length >= QUIZ_PASS_RATIO, wrong }
}

// A few characters shown on the lesson card so a learner can recognise it. Teaching material only.
function preview(lesson) {
  switch (lesson.type) {
    case 'letters': return lesson.letterIds.slice(0, 4).map((id) => byId.get(id).char).join(' ')
    case 'vowels': return SHORT_VOWELS.map((v) => 'ب' + v.mark).join(' ')
    case 'marks': return OTHER_MARKS.slice(0, 3).map((m) => 'ب' + m.mark).join(' ')
    case 'madd': return LONG_VOWELS.map((m) => m.pattern('ب')).join(' ')
    case 'joining': { const f = forms(byId.get('ba')); return [f.isolated, f.initial, f.medial, f.final].join(' ') }
    case 'drill': return [0, 1, 2].map((c) => { const { letter, vowel } = drillCell(0, c); return syllable(letter, vowel).text }).join(' ')
    default: return ''
  }
}

function content(lesson) {
  switch (lesson.type) {
    case 'letters':
      return { letters: lesson.letterIds.map((id) => { const l = byId.get(id); return { id, char: l.char, name: l.name, joins: l.joins, forms: forms(l), makhraj: MAKHRAJ[id] } }) }
    case 'vowels':
      return {
        marks: SHORT_VOWELS.map((v) => ({ name: v.name, mark: '◌' + v.mark, sound: v.vowel })),
        examples: ['ba', 'ta', 'jim'].map((id) => ({ letter: byId.get(id).char, syllables: SHORT_VOWELS.map((v) => ({ ...syllable(byId.get(id), v) })) })),
      }
    case 'marks':
      return { marks: OTHER_MARKS.map((m) => ({ name: m.name, mark: '◌' + m.mark, example: 'ب' + m.mark, meaning: m.meaning })) }
    case 'madd':
      return { examples: LONG_VOWELS.map((m) => ({ text: m.pattern('ب'), sound: 'b' + m.vowel })), note: 'A long vowel is held for about two counts.' }
    case 'joining':
      return {
        nonJoiners: LETTERS.filter((l) => !l.joins).map((l) => ({ char: l.char, name: l.name })),
        examples: ['ba', 'sin', 'mim', 'ayn'].map((id) => ({ char: byId.get(id).char, name: byId.get(id).name, forms: forms(byId.get(id)) })),
        note: 'Six letters never connect to the letter after them. The others change shape depending on their position.',
      }
    case 'info':
      return {
        areas: ARTICULATION_AREAS,
        note: 'This is a general overview. The exact points of articulation must be learned by listening to and repeating after a qualified teacher. This app cannot check your articulation.',
      }
    case 'drill': {
      const rows = []
      for (let r = 0; r < 6; r++) {
        rows.push(Array.from({ length: 5 }, (_, c) => { const { letter, vowel } = drillCell(r, c); return syllable(letter, vowel) }).map((s) => s.text))
      }
      return { rows, note: 'Read each row slowly, then faster. Aim for steady, smooth reading.' }
    }
    case 'readalong':
      return { passage: lesson.passage, note: 'Follow the text while listening, then read it yourself.' }
    default:
      return {}
  }
}

export function createFoundationService({ config, planItems, letterEngine }) {
  // Spoken quiz questions exist only while the AI letter checker is configured; without it the quiz is as before.
  const voice = () => Boolean(letterEngine?.available)
  const completed = async (userId) => (await Student.findOne({ user: userId }).lean())?.foundation?.completedLessons || []

  async function nextLesson(userId) {
    const done = new Set(await completed(userId))
    return LESSONS.find((l) => !done.has(l.id)) || null
  }

  async function assertAccess(userId, lessonId) {
    const lesson = LESSONS.find((l) => l.id === lessonId)
    if (!lesson) throw new AppError('NOT_FOUND', 'Lesson not found.', 404)
    const done = new Set(await completed(userId))
    const unlocked = LESSONS.filter((l) => l.order < lesson.order).every((l) => done.has(l.id))
    if (!unlocked) throw new AppError('LESSON_LOCKED', 'Finish the earlier lessons first.', 409)
    return { lesson, done }
  }

  return {
    nextLesson,

    // `attempts` and `best` come only from the learner's saved quiz results (null/0 when there are none).
    async list(userId) {
      const f = (await Student.findOne({ user: userId }).lean())?.foundation
      const done = new Set(f?.completedLessons || [])
      const results = f?.quizResults || []
      let open = true
      return LESSONS.map((l) => {
        const isDone = done.has(l.id)
        const unlocked = open
        if (!isDone) open = false
        const mine = results.filter((r) => r.lessonId === l.id && r.total > 0)
        const best = mine.reduce((b, r) => (!b || r.score / r.total > b.score / b.total ? r : b), null)
        return {
          id: l.id, order: l.order, title: l.title, type: l.type, hasQuiz: Boolean(l.quiz), completed: isDone, unlocked,
          preview: preview(l), attempts: mine.length, best: best ? { score: best.score, total: best.total } : null,
          // Additive: the letters a letters-lesson teaches (public curriculum data), so the page can show them as cards.
          ...(l.type === 'letters' ? { letters: l.letterIds.map((id) => { const x = byId.get(id); return { id: x.id, char: x.char, name: x.name, sound: x.sound, joins: x.joins } }) } : {}),
        }
      })
    },

    async get(userId, lessonId) {
      const { lesson, done } = await assertAccess(userId, lessonId)
      const student = (lesson.type === 'readalong' || lesson.quiz) ? await Student.findOne({ user: userId }).lean() : null
      return {
        id: lesson.id, order: lesson.order, title: lesson.title, type: lesson.type, completed: done.has(lesson.id),
        readalongPassed: lesson.type === 'readalong' ? Boolean(student?.foundation.readalongPassed) : undefined,
        // Additive: a saved passing quiz result survives a reload, so "Complete lesson" stays available.
        quizPassed: lesson.quiz ? Boolean(student?.foundation.quizResults?.some((r) => r.lessonId === lesson.id && r.passed)) : undefined,
        content: content(lesson), quiz: lesson.quiz ? { passRatio: QUIZ_PASS_RATIO, questions: buildQuiz(lesson.id, voice()) } : null,
      }
    },

    async submitQuiz(userId, lessonId, answers) {
      const { lesson } = await assertAccess(userId, lessonId)
      if (!lesson.quiz) throw new AppError('NO_QUIZ', 'This lesson has no quiz.', 400)
      const result = gradeQuiz(lessonId, answers, { voice: voice(), userId: String(userId), secret: config?.letterEngine?.proofSecret })
      await Student.updateOne({ user: userId }, { $push: { 'foundation.quizResults': { lessonId, score: result.score, total: result.total, passed: result.passed } } })
      return result
    },

    async complete(userId, timezone, lessonId) {
      const { lesson } = await assertAccess(userId, lessonId)
      const s = await Student.findOne({ user: userId }).lean()
      if (lesson.quiz && !s.foundation.quizResults.some((r) => r.lessonId === lessonId && r.passed)) {
        throw new AppError('QUIZ_REQUIRED', 'Pass the quiz to complete this lesson.', 409)
      }
      if (lesson.type === 'readalong' && !s.foundation.readalongPassed && !config.muallim.allowSelfDeclaration) {
        throw new AppError('MUALLIM_PASS_REQUIRED', 'Read the passage aloud to the Muallim and pass before completing this lesson.', 409)
      }
      const date = todayIn(timezone)
      const res = await Student.updateOne({ user: userId, 'foundation.completedLessons': { $ne: lessonId } }, { $push: { 'foundation.completedLessons': lessonId } })
      if (res.modifiedCount) await StudyLog.create({ user: userId, type: 'foundation', lessonId, date })
      await planItems.complete(userId, date, { kind: 'foundation_lesson', lessonId })
      return { completed: await completed(userId), allDone: (await nextLesson(userId)) === null }
    },
  }
}
