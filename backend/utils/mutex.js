// Runs async functions one at a time per key (in this server process).
// Used so two simultaneous requests from the SAME learner cannot both pass an overlap check.
// With several server instances, the database's unique index (see models/Passage.js) is the backstop.
const tails = new Map()

export async function withLock(key, fn) {
  const prev = tails.get(key) || Promise.resolve()
  let release
  const mine = new Promise((r) => { release = r })
  const tail = prev.then(() => mine)
  tails.set(key, tail)
  await prev
  try {
    return await fn()
  } finally {
    release()
    if (tails.get(key) === tail) tails.delete(key)
  }
}
