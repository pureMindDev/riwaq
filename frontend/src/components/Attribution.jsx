export default function Attribution({ reciterName }) {
  return (
    <p className="attribution">
      Qur&rsquo;an text and recitation data provided by{' '}
      <a href="https://quran.foundation/" target="_blank" rel="noreferrer">Quran.Foundation</a>
      {' '}and, for Surahs it does not serve, by{' '}
      <a href="https://alquran.cloud/" target="_blank" rel="noreferrer">Islamic Network (AlQuran.cloud)</a>.
      {reciterName ? ` Reciter: ${reciterName}.` : ''}
    </p>
  )
}
