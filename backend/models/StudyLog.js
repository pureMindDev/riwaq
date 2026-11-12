import mongoose from 'mongoose'

const schema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['memorise', 'revise', 'foundation', 'milestone'], required: true },
    passage: { type: mongoose.Schema.Types.ObjectId, ref: 'Passage' },
    lessonId: String,
    rating: { type: String, enum: ['easy', 'moderate', 'difficult'] },
    date: { type: String, required: true }, // learner-local YYYY-MM-DD
    snapshot: { surah: Number, surahName: String, from: Number, to: Number },
  },
  { timestamps: true },
)
schema.index({ user: 1, date: -1 })
schema.index({ user: 1, passage: 1, createdAt: -1 })
export const StudyLog = mongoose.model('StudyLog', schema)
