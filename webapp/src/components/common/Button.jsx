export default function Button({
  children,
  type = 'button',
  variant = 'secondary',
  className = '',
  ...props
}) {
  const variantClass =
    variant === 'primary'
      ? 'workspace-modal-primary'
      : variant === 'ghost'
        ? 'workspace-summary-button is-ghost'
        : 'workspace-modal-secondary'

  return (
    <button type={type} className={`${variantClass} ${className}`.trim()} {...props}>
      {children}
    </button>
  )
}
