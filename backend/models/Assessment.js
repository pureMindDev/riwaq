import mongoose from 'mongoose'

const schema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    answers: { type: mongoose.Schema.Types.Mixed, required: true },
    result: {
      programme: String,
      reasons: [String],
      readingScore: Number,
      suggestedNewVerses: Number,
    },
  },
  { timestamps: true },
)
export const Assessment = mongoose.model('Assessment', schema)
