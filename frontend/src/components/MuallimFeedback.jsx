// What the Muallim says after hearing a recitation: direct, specific, and in order.
export default function MuallimFeedback({ feedback }) {
  const f = feedback
  return (
    <section className={`muallim muallim-${f.verdict}`} aria-live="polite" aria-labelledby="muallim-h">
      <h3 id="muallim-h">{f.verdict === 'passed' ? 'Correct' : f.verdict === 'unclear' ? 'I could not hear you' : 'The Muallim says'}</h3>
      <p role="status"><strong>{f.headline}</strong></p>
      {f.corrections.length > 0 && (
        <ol className="corrections">
          {f.corrections.map((c, i) => (
            <li key={`${c.word}-${c.type}-${i}`} dir="auto"><span className="correction-word">Word {c.word}</span> {c.message}</li>
          ))}
        </ol>
      )}
      {f.verdict === 'try_again' && <p className="muted">Listen to the reference recitation for the words above, then recite the whole passage again.</p>}
    </section>
  )
}
