// Pure helpers: which Ajza' (plural of Juz) are fully covered by a learner's memorised passages.
// The verse ranges of each Juz come from the Qur'an provider; they are never hard-coded here.

// Is every verse of [from, to] inside the union of these [from, to] intervals?
export function rangeCovered(intervals, from, to) {
  let need = from
  for (const [a, b] of [...intervals].sort((x, y) => x[0] - y[0])) {
    if (a > need) break
    if (b >= need) need = b + 1
    if (need > to) return true
  }
  return need > to
}

// passages: [{ _id|id, surah, from, to, source }] that count as memorised.
// juzMap: [{ juz, ranges: [{ surah, from, to }] }]
export function juzCoverage(juzMap, passages) {
  const bySurah = new Map()
  for (const p of passages) {
    if (!bySurah.has(p.surah)) bySurah.set(p.surah, [])
    bySurah.get(p.surah).push(p)
  }
  return juzMap.map(({ juz, ranges }) => {
    let complete = true
    let contributed = false
    const ids = new Set()
    for (const r of ranges) {
      const ps = bySurah.get(r.surah) || []
      if (!rangeCovered(ps.map((p) => [p.from, p.to]), r.from, r.to)) complete = false
      for (const p of ps) {
        if (p.from <= r.to && p.to >= r.from) {
          ids.add(String(p._id ?? p.id))
          if (p.source !== 'declared') contributed = true
        }
      }
    }
    return { juz, complete, contributed, passageIds: [...ids] }
  })
}

// Parts of [from, to] NOT covered by the given intervals.
export function gaps(intervals, from, to) {
  const out = []
  let cursor = from
  for (const [a, b] of [...intervals].sort((x, y) => x[0] - y[0])) {
    if (b < cursor) continue
    if (a > to) break
    if (a > cursor) out.push([cursor, Math.min(a - 1, to)])
    cursor = Math.max(cursor, b + 1)
    if (cursor > to) break
  }
  if (cursor <= to) out.push([cursor, to])
  return out
}
