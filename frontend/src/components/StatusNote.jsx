// A plain, honest label for features that do not exist yet.
export default function StatusNote({ children }) {
  return (
    <p className="status-note" role="note">
      <strong>Coming later. </strong>
      {children}
    </p>
  )
}
