import { splitWords } from '../lib/recitation/normalize.js'

// The verses being recited. `liveItems` (optional) highlights words the engine has followed so far.
export default function ReferenceText({ verses, liveItems }) {
  let n = 0
  return (
    <div className="reference" aria-label="Text to recite">
      {verses.map((v) => (
        <p key={v.verseKey} className="quran-text" lang="ar" dir="rtl" translate="no">
          {splitWords(v.textUthmani).map((w) => {
            const position = n++ // position among all words; always advances, even without live data
            const item = liveItems?.[position]
            return <span key={`${v.verseKey}-${position}`} className={item?.status === 'correct' ? 'word word-followed' : 'word'}>{w}{' '}</span>
          })}
          <span className="verse-number inline-number">{v.verseNumber}</span>
        </p>
      ))}
    </div>
  )
}
