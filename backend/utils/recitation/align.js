// (options.conservative: never state a mistake as likely; see docs/RECITATION.md)
// Compares what a speech engine heard with the reference text, word by word.
//
// Design rules (see docs/RECITATION.md):
//  - Recognition is uncertain, so close or low-confidence differences are
//    reported as "uncertain", never as mistakes.
//  - If the heard text barely overlaps the reference, we do not accuse
//    anything: the whole result is marked unreliable.
//  - Words after the last heard word are "not_reached", not "omitted".
//  - This checks WORDS only. It says nothing about Tajweed.
import { wordKey, similarity } from './normalize.js'

const NEAR = 0.75 // similarity at/above which a difference is "close"
const MIN_CONFIDENCE = 0.5
const MIN_OVERLAP = 0.5

export function alignRecitation(referenceWords, heardWords, options = {}) {
  const minConf = options.minConfidence ?? MIN_CONFIDENCE
  const ref = referenceWords.map((w) => ({ ...w, key: wordKey(w.text) }))
  const heard = heardWords
    .map((w) => ({ text: w.text, confidence: w.confidence, key: wordKey(w.text) }))
    .filter((w) => w.key.length > 0)

  const empty = {
    reliable: false,
    reason: 'no_speech',
    items: ref.map((r, index) => ({ index, reference: r.text, verseKey: r.verseKey, status: 'not_reached' })),
    extras: [],
    summary: summarise([], []),
  }
  if (heard.length === 0) return empty

  const n = ref.length
  const m = heard.length
  // cost[i][j] = best cost aligning first i reference words with first j heard words
  const cost = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))
  const subCost = (i, j) => {
    const s = similarity(ref[i].key, heard[j].key)
    return s === 1 ? 0 : s >= NEAR ? 0.4 : 1
  }
  for (let i = 1; i <= n; i++) cost[i][0] = i
  for (let j = 1; j <= m; j++) cost[0][j] = j
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      cost[i][j] = Math.min(
        cost[i - 1][j - 1] + subCost(i - 1, j - 1),
        cost[i - 1][j] + 1,
        cost[i][j - 1] + 1,
      )
    }
  }

  // Walk back to recover the alignment.
  const ops = [] // { type: 'pair'|'del'|'ins', i?, j? } in reverse
  let i = n
  let j = m
  // When two alignments cost the same (e.g. repeated verses), prefer leaving reference words
  // unmatched at the END ("not reached") rather than accusing earlier words of being skipped.
  while (i > 0 || j > 0) {
    if (i > 0 && cost[i][j] === cost[i - 1][j] + 1) {
      ops.push({ type: 'del', i: i - 1 })
      i--
    } else if (i > 0 && j > 0 && cost[i][j] === cost[i - 1][j - 1] + subCost(i - 1, j - 1)) {
      ops.push({ type: 'pair', i: i - 1, j: j - 1 })
      i--
      j--
    } else {
      ops.push({ type: 'ins', j: j - 1 })
      j--
    }
  }
  ops.reverse()

  const lowConf = (h) => h && typeof h.confidence === 'number' && h.confidence < minConf
  const items = new Array(n)
  const extras = []
  let lastPaired = -1
  for (const op of ops) if (op.type === 'pair') lastPaired = Math.max(lastPaired, op.i)

  ops.forEach((op, k) => {
    if (op.type === 'pair') {
      const r = ref[op.i]
      const h = heard[op.j]
      const s = similarity(r.key, h.key)
      let status = 'correct'
      let reason
      if (s < 1 && s >= NEAR) {
        status = 'uncertain'
        reason = 'close_match'
      } else if (s < NEAR) {
        if (lowConf(h)) {
          status = 'uncertain'
          reason = 'low_confidence'
        } else {
          status = 'substituted'
        }
      }
      items[op.i] = { index: op.i, reference: r.text, verseKey: r.verseKey, status, heard: h.text, reason }
    } else if (op.type === 'del') {
      const r = ref[op.i]
      let status = op.i > lastPaired ? 'not_reached' : 'omitted'
      let reason
      if (status === 'omitted') {
        const prev = ops.slice(0, k).reverse().find((o) => o.type !== 'del')
        const next = ops.slice(k + 1).find((o) => o.type !== 'del')
        const nearLow = [prev, next].some((o) => o && o.j !== undefined && lowConf(heard[o.j]))
        if (nearLow) {
          status = 'uncertain'
          reason = 'low_confidence'
        }
      }
      items[op.i] = { index: op.i, reference: r.text, verseKey: r.verseKey, status, reason }
    } else {
      const h = heard[op.j]
      const neighbours = [ops[k - 1], ops[k + 1]].filter((o) => o && o.type === 'pair')
      const repeated = neighbours.some((o) => heard[o.j].key === h.key)
      let status = repeated ? 'repeated' : 'extra'
      let reason
      if (lowConf(h)) {
        status = 'uncertain'
        reason = 'low_confidence'
      }
      const before = ops.slice(0, k).filter((o) => o.type === 'pair').pop()
      extras.push({ afterIndex: before ? before.i : -1, heard: h.text, status, reason })
    }
  })

  // Overall reliability: how much of the reached part matched at all?
  const reached = items.filter((it) => it.status !== 'not_reached').length
  const matched = items.filter((it) => it.status === 'correct' || (it.status === 'uncertain' && it.reason === 'close_match')).length
  const overlap = reached === 0 ? 0 : matched / reached
  const reliable = overlap >= MIN_OVERLAP

  // Until a recogniser has been validated against qualified teachers, differences are
  // reported only as "unsure" (conservative). The same happens when overall recognition is poor.
  if (!reliable || options.conservative) {
    const reason = reliable ? 'unvalidated_engine' : 'unreliable_recognition'
    for (const it of items) {
      if (['omitted', 'substituted'].includes(it.status)) {
        it.status = 'uncertain'
        it.reason = reason
      }
    }
    for (const ex of extras) {
      ex.status = 'uncertain'
      ex.reason = reason
    }
  }

  return {
    reliable,
    reason: reliable ? undefined : 'low_overlap',
    items,
    extras,
    summary: summarise(items, extras),
  }
}

function summarise(items, extras) {
  const counts = { correct: 0, uncertain: 0, omitted: 0, substituted: 0, notReached: 0, repeated: 0, extra: 0 }
  for (const it of items) {
    if (it.status === 'not_reached') counts.notReached++
    else counts[it.status]++
  }
  for (const ex of extras) {
    if (ex.status === 'uncertain') counts.uncertain++
    else counts[ex.status]++
  }
  return counts
}
