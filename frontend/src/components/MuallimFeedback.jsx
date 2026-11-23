// What the Muallim says after hearing a recitation: direct, specific, and in order.
const WORD_LABEL = { ok: 'right', wrong: 'needs correction', omitted: 'skipped', not_reached: 'not reached' }

// `words` (optional): the AI Muallim's verdict for every word of the passage, shown in the Qur'an text itself.
export default function MuallimFeedback({ feedback, words }) {
  const f = feedback
  return (
    <section className={`muallim muallim-${f.verdict}`} aria-live="polite" aria-labelledby="muallim-h">
      <h3 id="muallim-h">{f.verdict === 'passed' ? 'Correct' : f.verdict === 'unclear' ? 'I could not hear you' : 'The Muallim says'}</h3>
      <p role="status"><strong>{f.headline}</strong></p>
      {f.verdict !== 'unclear' && words?.length > 0 && (
        <>
          <p className="muallim-words" dir="rtl" lang="ar" data-testid="muallim-words">
            {words.map((w, i) => <span key={i} className={`mw mw-${w.status}`} title={WORD_LABEL[w.status]}>{w.text} </span>)}
          </p>
          <p className="muted small-print">Green: right. Red: needs correction (underlined if skipped). Grey: not reached.</p>
        </>
      )}
      {f.corrections.length > 0 && (
        <ol className="corrections">
          {f.corrections.map((c, i) => (
            <li key={`${c.word}-${c.type}-${i}`} dir="auto"><span className="correction-word">Word {c.word}</span> {c.message}</li>
          ))}
        </ol>
      )}
      {f.advice?.length > 0 && (
        <>
          <h4>Tajweed notes (these do not stop you passing)</h4>
          <ul className="corrections" data-testid="tajweed-advice">
            {f.advice.map((a, i) => <li key={`${a.word}-${i}`} dir="auto">{a.message}</li>)}
          </ul>
        </>
      )}
      {f.verdict === 'try_again' && <p className="muted">Listen to the reference recitation for the words above, then recite the whole passage again.</p>}
    </section>
  )
}
