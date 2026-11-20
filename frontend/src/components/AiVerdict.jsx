import { Icon } from './Icons.jsx'

// The red/green answer of the AI letter checker. `ai` is { phase: 'idle'|'recording'|'checking'|'done'|'error', result?, message? }.
export default function AiVerdict({ ai, recError }) {
  return (
    <div className="check-result" role="status" aria-live="polite">
      {ai.phase === 'done' && ai.result.result === 'match' && <p className="verdict verdict-ok"><Icon name="check" size={18} /> Correct</p>}
      {ai.phase === 'done' && ai.result.result === 'fix' && (
        <div className="verdict verdict-bad verdict-col"><span><Icon name="alert" size={18} /> Right letter, but not yet right. Fix this and try again:</span>
          <ul>{ai.result.hints.map((h) => <li key={h.message}>{h.message}</li>)}</ul></div>
      )}
      {ai.phase === 'done' && ai.result.result === 'miss' && <p className="verdict verdict-bad"><Icon name="alert" size={18} /> Not yet: I heard <span dir="rtl" lang="ar">{ai.result.heard}</span> but this letter is <span dir="rtl" lang="ar">{ai.result.expected}</span>. Listen to the recording and try again.</p>}
      {ai.phase === 'done' && ai.result.result === 'none' && <p className="verdict verdict-bad"><Icon name="alert" size={18} /> I did not hear a letter. Try again, a little louder and closer to the microphone.</p>}
      {ai.phase === 'error' && <p className="verdict verdict-bad"><Icon name="alert" size={18} /> {ai.message}</p>}
      {recError && ai.phase !== 'recording' && <p className="verdict verdict-bad"><Icon name="alert" size={18} /> {recError}</p>}
    </div>
  )
}
