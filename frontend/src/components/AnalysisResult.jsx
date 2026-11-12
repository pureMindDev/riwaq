const WORD_LABEL = {
  correct: '',
  uncertain: ' (unsure)',
  omitted: ' (possibly skipped)',
  substituted: ' (possibly a different word)',
  not_reached: ' (not reached)',
}

// Shows a real recognition result. Words are marked only as strongly as the evidence allows.
export default function AnalysisResult({ result, engineLabel, notValidated }) {
  const s = result.summary
  const diffs = result.items.filter((it) => ['uncertain', 'omitted', 'substituted'].includes(it.status))
  return (
    <section className="card stack" aria-live="polite" aria-labelledby="result-h">
      <h2 id="result-h">Result (checked after recording)</h2>
      <p className="muted">Engine: {engineLabel}</p>
      {notValidated && (
        <p className="status-note" role="note">
          This engine has not yet been checked against qualified Qur’an teachers, so differences are shown only as &ldquo;unsure&rdquo;, never as likely mistakes.
        </p>
      )}
      {!result.reliable && (
        <p className="status-note" role="alert">
          {result.reason === 'no_speech'
            ? 'No speech was recognised. Check your microphone and try again.'
            : 'We could not recognise enough of your recitation to judge it, so nothing is marked as a mistake. Try again in a quieter place, closer to the microphone.'}
        </p>
      )}
      <p className="quran-text analysis" lang="ar" dir="rtl" translate="no">
        {result.items.map((it) => (
          <span key={it.index}>
            <span className={`word word-${it.status}`}>{it.reference}</span>
            {WORD_LABEL[it.status] && <span className="sr-only">{WORD_LABEL[it.status]}</span>}{' '}
          </span>
        ))}
      </p>
      <ul className="legend">
        <li><span className="word word-correct">Matched</span> {s.correct}</li>
        <li><span className="word word-uncertain">Unsure</span> {s.uncertain}</li>
        {s.omitted > 0 && <li><span className="word word-omitted">Possibly skipped</span> {s.omitted}</li>}
        {s.substituted > 0 && <li><span className="word word-substituted">Possibly different word</span> {s.substituted}</li>}
        <li><span className="word word-not_reached">Not reached</span> {s.notReached}</li>
      </ul>
      {(diffs.length > 0 || result.extras.length > 0) && (
        <div>
          <h3>Where the recording differs from the text</h3>
          <ul className="plain-list small">
            {diffs.map((it) => (
              <li key={it.index}>
                Text: <span lang="ar" dir="rtl" translate="no" className="inline-ar">{it.reference}</span> &mdash;{' '}
                {it.heard ? <>heard: <span lang="ar" dir="rtl" translate="no" className="inline-ar">{it.heard}</span></> : 'nothing heard here'}
                {' '}({it.status === 'uncertain' ? 'unsure' : it.status === 'omitted' ? 'possibly skipped' : 'possibly different'})
              </li>
            ))}
            {result.extras.map((ex, i) => (
              <li key={`x${i}`}>
                Extra word heard: <span lang="ar" dir="rtl" translate="no" className="inline-ar">{ex.heard}</span>{' '}
                ({ex.status === 'repeated' ? 'possibly repeated' : ex.status === 'extra' ? 'possibly extra' : 'unsure'})
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="muted">
        This compares recognised <strong>words</strong> with the text. It does not check Tajweed, pronunciation or vowels, and speech recognition can be wrong.
        If something is unsure, listen to the reference recitation again, record once more, or ask a qualified teacher.
      </p>
    </section>
  )
}
