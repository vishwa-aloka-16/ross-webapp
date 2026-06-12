import Button from '../common/Button'

const LAYOUT_STRATEGY_OPTIONS = [
  {
    value: 'ADVERSARIAL',
    icon: 'A',
    title: 'Adversarial & Disputed Records',
    description:
      'Best for case briefs, pleadings, or moot problems containing competing claims from multiple parties.',
  },
  {
    value: 'HIERARCHICAL',
    icon: 'H',
    title: 'Statutory & Codified Frameworks',
    description:
      'Best for legislated acts, multi-part state regulations, compliance manuals, or articles of association.',
  },
  {
    value: 'TRANSACTIONAL',
    icon: 'T',
    title: 'Linear & Contractual Instruments',
    description:
      'Best for non-disclosure agreements, commercial leases, and transactional contracts.',
  },
]

export default function UploadModal({
  open,
  uploading,
  uploadModalError,
  pendingUploadFiles,
  selectedLayoutStrategy,
  uploadDragActive,
  fileInputRef,
  onClose,
  onDropzoneDragOver,
  onDropzoneDragEnter,
  onDropzoneDragLeave,
  onDrop,
  onNameChange,
  onRemove,
  onSelectLayoutStrategy,
  onSubmit,
}) {
  if (!open) {
    return null
  }

  return (
    <section className="workspace-upload-modal-backdrop" onClick={onClose}>
      <div className="workspace-upload-modal" onClick={(event) => event.stopPropagation()}>
        <div className="workspace-upload-modal-header">
          <div>
            <p className="workspace-upload-eyebrow">Document Upload</p>
            <h2>Prepare documents for the workspace.</h2>
          </div>
          <button
            type="button"
            className="workspace-icon-button is-plain"
            onClick={onClose}
            disabled={uploading}
          >
            <CloseIcon />
          </button>
        </div>

        <p className="workspace-upload-modal-copy">
          Add one or more PDFs, set a working name for each document, and choose the document
          type for the upload batch.
        </p>

        <div
          className={`workspace-upload-dropzone ${uploadDragActive ? 'is-dragging' : ''}`}
          onDragOver={onDropzoneDragOver}
          onDragEnter={onDropzoneDragEnter}
          onDragLeave={onDropzoneDragLeave}
          onDrop={onDrop}
        >
          <span className="workspace-upload-drop-icon">
            <UploadTrayIcon />
          </span>
          <div className="workspace-upload-drop-copy">
            <strong>Drag and drop PDF files here</strong>
            <span>or add files manually into this upload workspace.</span>
          </div>
          <Button variant="secondary" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            Browse files
          </Button>
        </div>

        {pendingUploadFiles.length > 0 && (
          <div className="workspace-upload-file-list">
            {pendingUploadFiles.map((entry) => (
              <div key={entry.id} className="workspace-upload-file-card">
                <div className="workspace-upload-file-card-top">
                  <div>
                    <span className="workspace-upload-file-label">Source file</span>
                    <p className="workspace-upload-file-name">{entry.file.name}</p>
                  </div>
                  <button
                    type="button"
                    className="workspace-upload-file-remove"
                    onClick={() => onRemove(entry.id)}
                    disabled={uploading}
                  >
                    Remove
                  </button>
                </div>

                <label className="workspace-upload-name-field">
                  <span>Document name</span>
                  <input
                    type="text"
                    value={entry.displayName}
                    onChange={(event) => onNameChange(entry.id, event.target.value)}
                    placeholder="Enter a workspace title"
                    disabled={uploading}
                  />
                </label>

                <small className="workspace-upload-file-meta">
                  {Math.max(1, Math.round(entry.file.size / 1024))} KB
                </small>
              </div>
            ))}
          </div>
        )}

        <div className="workspace-upload-strategy-head">
          <span>Document type</span>
          <small>Apply one document type to the queued upload batch.</small>
        </div>

        <div className="workspace-layout-grid">
          {LAYOUT_STRATEGY_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`workspace-layout-card ${
                selectedLayoutStrategy === option.value ? 'is-selected' : ''
              }`}
              onClick={() => onSelectLayoutStrategy(option.value)}
            >
              <span className="workspace-layout-icon">{option.icon}</span>
              <span className="workspace-layout-title">{option.title}</span>
              <span className="workspace-layout-description">{option.description}</span>
            </button>
          ))}
        </div>

        {uploadModalError && <p className="error-banner">{uploadModalError}</p>}

        <div className="workspace-upload-modal-actions">
          <Button variant="secondary" onClick={onClose} disabled={uploading}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={onSubmit}
            disabled={
              uploading ||
              !pendingUploadFiles.length ||
              pendingUploadFiles.some((entry) => !(entry.displayName || '').trim())
            }
          >
            {uploading ? 'Queueing...' : 'Upload Documents'}
          </Button>
        </div>
      </div>
    </section>
  )
}

function UploadTrayIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8 10.5V3.5" />
      <path d="M5.25 6.25 8 3.5l2.75 2.75" />
      <path d="M2.5 11.5v1a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-1" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <line x1="4" y1="4" x2="12" y2="12" />
      <line x1="12" y1="4" x2="4" y2="12" />
    </svg>
  )
}
