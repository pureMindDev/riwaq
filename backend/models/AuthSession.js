import mongoose from 'mongoose'

// Only a SHA-256 hash of the session token is stored, so a database leak does not reveal usable tokens.
const schema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
  },
  { timestamps: true },
)
export const AuthSession = mongoose.model('AuthSession', schema)
