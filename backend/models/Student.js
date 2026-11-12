import mongoose from 'mongoose'

export const PROGRAMMES = ['unassigned', 'foundation', 'tahfidh', 'murajaah_only']

const schema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    timezone: { type: String, default: 'UTC' },
    programme: { type: String, enum: PROGRAMMES, default: 'unassigned' },
    assessment: { type: mongoose.Schema.Types.ObjectId, ref: 'Assessment' },
    dailyTarget: {
      newVerses: { type: Number, min: 1, max: 20, default: 3 }, // new memorisation per day
      revisionVerses: { type: Number, min: 10, max: 600, default: 100 }, // Murajaah-only daily quota
    },
    tahfidhPlan: {
      direction: { type: String, enum: ['ascending', 'descending'], default: 'descending' },
      start: { surah: { type: Number, min: 1, max: 114, default: 114 }, verse: { type: Number, min: 1, default: 1 } },
    },
    foundation: {
      completedLessons: { type: [String], default: [] },
      readalongPassed: { type: Boolean, default: false },
      quizResults: {
        type: [{ lessonId: String, score: Number, total: Number, passed: Boolean, at: { type: Date, default: Date.now } }],
        default: [],
      },
    },
  },
  { timestamps: true },
)
export const Student = mongoose.model('Student', schema)
