// Turns the AI checker's word-by-word passage result into the same feedback shape the Muallim uses
// ({ verdict, headline, corrections, stats }), so saving, "memorised" gating and revision ratings need no change.
//
// Policy: a passage PASSES only if every word is ok. Tajweed-rule remarks are advice and never block.
// HONESTY: the checker is experimental; nothing here claims it is right. See docs/RECITATION.md.
const VERSE = (w) => `verse ${w.aya}`

function describe(n, w, p) {
  const where = `Word ${n} «${w.text}» (${VERSE(w)})`
  if (p.kind === 'vowel') return `${where}: the vowel on «${p.span}» is wrong. Say it exactly as the word is written, with the right vowel.`
  if (p.kind === 'missing') return `${where}: you left out «${p.span}». Say every letter of the word.`
  if (p.kind === 'extra') return `${where}: you added an extra sound at «${p.span || w.text}». Do not add anything that is not written.`
  return `${where}: «${p.span}» was not said correctly. Listen to the reference and say that letter again.`
}

export function passageFeedback(check) {
  const total = check.words.length
  if (!check.reliable) {
    return {
      verdict: 'unclear',
      headline: check.reason === 'no_speech'
        ? 'I could not hear you. Check your microphone and recite again.'
        : 'This does not sound like the passage you chose. Check the verses, then recite again a little slower and closer to the microphone.',
      corrections: [], advice: [], stats: { words: total, correct: 0 },
    }
  }
  const corrections = []
  const advice = []
  let stoppedAt = null
  check.words.forEach((w, i) => {
    const n = i + 1
    if (w.status === 'not_reached') { stoppedAt ??= n; return }
    if (w.status === 'omitted') corrections.push({ word: n, type: 'skipped', reference: w.text, message: `Word ${n} «${w.text}» (${VERSE(w)}): you skipped this word.` })
    else if (w.status === 'wrong') {
      for (const p of w.problems) corrections.push({ word: n, type: p.kind === 'different' ? 'letter' : p.kind, reference: w.text, message: describe(n, w, p) })
      if (!w.problems.length) corrections.push({ word: n, type: 'unclear', reference: w.text, message: `Word ${n} «${w.text}»: not right. Say it again.` })
    }
    for (const a of w.advice) advice.push({ word: n, reference: w.text, rule: a.rule, message: `Word ${n} «${w.text}»: ${a.message}` })
  })
  if (stoppedAt) {
    const w = check.words[stoppedAt - 1]
    corrections.push({ word: stoppedAt, type: 'stopped_early', reference: w.text, message: `You stopped before word ${stoppedAt} «${w.text}». Recite to the end of the passage.` })
  }
  corrections.sort((a, b) => a.word - b.word)
  const passed = corrections.length === 0
  const bad = new Set(corrections.map((c) => c.word))
  return {
    verdict: passed ? 'passed' : 'try_again',
    headline: passed
      ? (advice.length ? `Correct. Every word was right. ${advice.length} Tajweed ${advice.length === 1 ? 'note' : 'notes'} below.` : 'Correct. Every word was right.')
      : `${corrections.length} ${corrections.length === 1 ? 'thing' : 'things'} to correct. Listen to the reference recitation, then recite again.`,
    corrections, advice,
    stats: { words: total, correct: check.words.filter((w, i) => w.status === 'ok' && !bad.has(i + 1)).length },
  }
}
