export default function PageHeader({ title, intro }) {
  return (
    <div className="page-header">
      <h1>{title}</h1>
      {intro && <p className="lead">{intro}</p>}
    </div>
  )
}
