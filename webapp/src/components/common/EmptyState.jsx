export default function EmptyState({ title, message, action = null }) {
  return (
    <div className="workspace-empty-state">
      <div className="workspace-empty-state-card">
        <h3>{title}</h3>
        <p>{message}</p>
        {action}
      </div>
    </div>
  )
}
