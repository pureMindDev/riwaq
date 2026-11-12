import { AppError } from '../utils/AppError.js'
import { splitWords } from '../utils/recitation/normalize.js'
import { alignRecitation } from '../utils/recitation/align.js'
import { muallimFeedback } from '../utils/recitation/muallim.js'
import { LESSONS } from '../config/foundationCurriculum.js'
import { Student } from '../models/Student.js'
import { RecitationSubmission } from '../models/RecitationSubmission.js'

// The Muallim: listens (through the configured recognition engine), compares with the exact text,
// and answers with direct corrections. Only the OUTCOME is kept, never the audio.
export function createRecitationAssessmentService({ quran, engine, passages }) {
  async function judge(surah, from, to, audio, contentType) {
    if (!engine.available) throw new AppError('MUALLIM_UNAVAILABLE', 'The Muallim is not available yet: no recognition service is connected to this site.', 501)
    const { verses } = await quran.getVerses(surah, from, to)
    const reference = verses.flatMap((v) => splitWords(v.textUthmani).map((text) => ({ text, verseKey: v.verseKey })))
    const heard = await engine.transcribe(audio, contentType)
    const result = alignRecitation(reference, heard) // strict: the Muallim states what it heard
    return { result, feedback: muallimFeedback(result), words: reference.length }
  }

  const present = (sub, feedback, result) => ({
    id: String(sub._id), passed: sub.passed, verdict: feedback.verdict, headline: feedback.headline,
    corrections: feedback.corrections, stats: feedback.stats, result,
  })

  async function save(base, feedback, words) {
    return RecitationSubmission.create({
      ...base, verdict: feedback.verdict, passed: feedback.verdict === 'passed', wordCount: words,
      corrections: feedback.corrections.map((c) => ({ word: c.word, type: c.type, message: c.message })),
    })
  }

  return {
    judge,

    // Free practice (Recite page): nothing is saved.
    async practise(surah, from, to, audio, contentType) {
      const { result, feedback } = await judge(surah, from, to, audio, contentType)
      return { result, feedback }
    },

    async submitForPassage(userId, passageId, audio, contentType) {
      const p = await passages.owned(userId, passageId)
      const { result, feedback, words } = await judge(p.surah, p.from, p.to, audio, contentType)
      const sub = await save({ user: userId, kind: 'passage', passage: p._id, surah: p.surah, from: p.from, to: p.to }, feedback, words)
      return present(sub, feedback, result)
    },

    // The final foundation lesson: read a short passage aloud to the Muallim.
    async submitForLesson(userId, lessonId, audio, contentType) {
      const lesson = LESSONS.find((l) => l.id === lessonId && l.type === 'readalong')
      if (!lesson) throw new AppError('NOT_FOUND', 'This lesson has no recitation.', 404)
      const { surah, from } = lesson.passage
      // The lesson asks for a short passage; read only the verses the provider says this Surah has.
      const chapter = await quran.getChapter(surah)
      const to = Math.min(lesson.passage.to, chapter.versesCount)
      const { result, feedback, words } = await judge(surah, from, to, audio, contentType)
      const sub = await save({ user: userId, kind: 'lesson', lessonId, surah, from, to }, feedback, words)
      if (sub.passed) await Student.updateOne({ user: userId }, { $set: { 'foundation.readalongPassed': true } })
      return present(sub, feedback, result)
    },
  }
}
