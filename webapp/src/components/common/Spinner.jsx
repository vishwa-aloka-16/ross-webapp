export default function Spinner({ label = 'Loading...' }) {
  return (
    <div className="workspace-documents-loading">
      <span className="workspace-documents-loading-spinner" />
      <span>{label}</span>
    </div>
  )
}
