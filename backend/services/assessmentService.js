import { ASSESSMENT_QUESTIONS } from '../config/assessmentQuestions.js'
import { AppError } from '../utils/AppError.js'
import { Assessment } from '../models/Assessment.js'
import { Student } from '../models/Student.js'

const MINUTES_TO_VERSES = { 15: 2, 30: 3, 60: 5 }

// Pure function: turns the answers into a programme SUGGESTION.
export function recommend(answers) {
  const reading = ['letters', 'vowels', 'joining', 'quranReading']
  const readingScore = reading.reduce((n, id) => n + answers[id], 0)
  const reasons = []
  let suggestedNewVerses = MINUTES_TO_VERSES[answers.minutes]
  if (answers.quranReading === 1) suggestedNewVerses = Math.max(1, suggestedNewVerses - 1)

  let programme
  if (answers.memorised === 'hafiz') {
    programme = 'murajaah_only'
    reasons.push('You have memorised the whole Qur’an, so you do not need to memorise again. We suggest a Muraja’ah-only programme to keep it strong.')
  } else if (answers.letters < 2 || answers.vowels < 2) {
    programme = 'foundation'
    reasons.push('Reading the letters and short vowels comfortably comes first. The foundation programme builds this step by step.')
  } else if (readingScore < 6) {
    programme = 'foundation'
    reasons.push('Your reading is nearly ready. A little more practice with joining letters and fluent reading will make memorisation easier.')
  } else {
    programme = 'tahfidh'
    reasons.push('You can read well enough to begin structured Tahfidh.')
    if (answers.memorised === 'juz' || answers.memorised === 'some') {
      reasons.push('Add what you have already memorised in Tahfidh so it is included in your revision.')
    }
  }
  reasons.push('This is a suggestion based on your own answers, not a certified assessment. You can change your programme at any time.')
  return { programme, reasons, readingScore, suggestedNewVerses }
}

export function createAssessmentService() {
  return {
    questions: () => ASSESSMENT_QUESTIONS,

    validate(answers) {
      if (!answers || typeof answers !== 'object') throw new AppError('INVALID_PARAMETER', 'Answers are required.', 400)
      const clean = {}
      for (const q of ASSESSMENT_QUESTIONS) {
        const allowed = q.options.map((o) => o.value)
        if (!allowed.includes(answers[q.id])) throw new AppError('INVALID_PARAMETER', `Please answer: ${q.text}`, 400)
        clean[q.id] = answers[q.id]
      }
      return clean
    },

    async submit(userId, rawAnswers) {
      const answers = this.validate(rawAnswers)
      const result = recommend(answers)
      const assessment = await Assessment.create({ user: userId, answers, result })
      const update = { programme: result.programme, assessment: assessment._id }
      if (result.programme === 'tahfidh') update['dailyTarget.newVerses'] = result.suggestedNewVerses
      await Student.updateOne({ user: userId }, { $set: update })
      return result
    },

    async latest(userId) {
      const a = await Assessment.findOne({ user: userId }).sort({ createdAt: -1 }).lean()
      return a ? { createdAt: a.createdAt, answers: a.answers, result: a.result } : null
    },
  }
}
