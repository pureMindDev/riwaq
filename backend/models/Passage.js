import mongoose from 'mongoose'

export const PASSAGE_STATUSES = ['learning', 'memorised', 'needs_review']

// One record per contiguous range of verses a learner is learning or has memorised.
// Ranges for the same learner and Surah never overlap (enforced in passageService).
const schema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    surah: { type: Number, required: true, min: 1, max: 114 },
    surahName: String,
    from: { type: Number, required: true, min: 1 },
    to: { type: Number, required: true, min: 1 },
    status: { type: String, enum: PASSAGE_STATUSES, required: true },
    source: { type: String, enum: ['assigned', 'self', 'declared'], default: 'self' },
    // How "memorised" was established. None of these is a teacher's verification.
    evidence: { type: String, enum: ['none', 'self_declared', 'recitation_checked', 'declared'], default: 'none' },
    memorisedAt: Date,
    lastVerse: Number,
    schedule: {
      stage: Number,
      dueDate: String,
      lastRevised: String,
    },
  },
  { timestamps: true },
)
schema.index({ user: 1, surah: 1, from: 1 })
// Business rule enforced by the database: a learner has at most ONE assigned passage being learned at a time.
schema.index({ user: 1 }, { unique: true, partialFilterExpression: { source: 'assigned', status: 'learning' }, name: 'one_active_assigned_passage' })
export const Passage = mongoose.model('Passage', schema)
