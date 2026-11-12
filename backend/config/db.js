import mongoose from 'mongoose'

// Waits until every model's indexes exist. Without this, the first requests after a fresh start could run
// before the unique indexes (one account per email, one active assigned passage) are in place.
export const ensureIndexes = () => Promise.all(mongoose.modelNames().map((name) => mongoose.model(name).init()))

export async function connectDb(uri) {
  mongoose.set('strictQuery', true)
  mongoose.set('bufferCommands', false) // while disconnected, fail at once (-> 503) instead of queueing requests
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 })
  await ensureIndexes()
  return mongoose.connection
}

export const disconnectDb = () => mongoose.disconnect()
