import mongoose from 'mongoose'

// Created when a Juz (a thirtieth of the Qur'an) has been fully memorised through the app.
const schema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    juz: { type: Number, required: true, min: 1, max: 30 },
    status: { type: String, enum: ['pending', 'completed'], default: 'pending' },
    revisionTargets: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Passage' }],
    assessmentItems: [
      {
        juz: Number,
        passage: { type: mongoose.Schema.Types.ObjectId, ref: 'Passage' },
        done: { type: Boolean, default: false },
        rating: { type: String, enum: ['easy', 'moderate', 'difficult'] },
        at: Date,
      },
    ],
    completedAt: Date,
  },
  { timestamps: true },
)
schema.index({ user: 1, juz: 1 }, { unique: true })
export const Milestone = mongoose.model('Milestone', schema)
