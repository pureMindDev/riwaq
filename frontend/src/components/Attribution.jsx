export default function Attribution({ reciterName }) {
  return (
    <p className="attribution">
      Qur&rsquo;an text and recitation data provided by{' '}
      <a href="https://quran.foundation/" target="_blank" rel="noreferrer">Quran.Foundation</a>.
      {reciterName ? ` Reciter: ${reciterName}.` : ''}
    </p>
  )
}
