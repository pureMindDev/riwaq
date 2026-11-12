import mongoose from 'mongoose'

const item = new mongoose.Schema({
  kind: { type: String, enum: ['foundation_lesson', 'new_memorisation', 'revision', 'milestone'], required: true },
  label: String,
  passage: { type: mongoose.Schema.Types.ObjectId, ref: 'Passage' },
  lessonId: String,
  milestone: { type: mongoose.Schema.Types.ObjectId, ref: 'Milestone' },
  status: { type: String, enum: ['pending', 'completed'], default: 'pending' },
  completedAt: Date,
})

const schema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: String, required: true },
    programme: String,
    message: String,
    items: [item],
  },
  { timestamps: true },
)
schema.index({ user: 1, date: 1 }, { unique: true })
export const DailyPlan = mongoose.model('DailyPlan', schema)
