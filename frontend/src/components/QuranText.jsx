// Qur'anic text: right-to-left, never auto-translated by the browser.
export default function QuranText({ children, className = '' }) {
  return (
    <p className={`quran-text ${className}`} lang="ar" dir="rtl" translate="no">
      {children}
    </p>
  )
}
