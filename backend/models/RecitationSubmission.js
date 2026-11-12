import mongoose from 'mongoose'

// The OUTCOME of a recitation to the Muallim. Audio is never stored.
const schema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    kind: { type: String, enum: ['passage', 'lesson'], default: 'passage' },
    passage: { type: mongoose.Schema.Types.ObjectId, ref: 'Passage' },
    lessonId: String,
    surah: Number,
    from: Number,
    to: Number,
    verdict: { type: String, enum: ['passed', 'try_again', 'unclear'], required: true },
    passed: { type: Boolean, default: false },
    corrections: [{ word: Number, type: { type: String }, message: String }],
    wordCount: Number,
    consumed: { type: Boolean, default: false }, // a revision session uses one recitation, once
  },
  { timestamps: true },
)
schema.index({ user: 1, passage: 1, createdAt: -1 })
export const RecitationSubmission = mongoose.model('RecitationSubmission', schema)
