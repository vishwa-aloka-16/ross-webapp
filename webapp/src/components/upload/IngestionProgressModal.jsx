const INGESTION_STEPS = [
  {
    key: 'queued',
    title: 'Queued for ingestion',
    description: 'The upload has been accepted and is waiting to be processed.',
  },
  {
    key: 'processing',
    title: 'Processing document',
    description: 'The file is being parsed and indexed in the background.',
  },
  {
    key: 'ready',
    title: 'Indexed and ready',
    description: 'The document is available in the workspace.',
  },
]

function formatStatusLabel(status) {
  switch (status) {
    case 'indexed':
      return 'Ready'
    case 'processing':
      return 'Ingesting...'
    case 'failed':
      return 'Failed'
    case 'pending':
    default:
      return 'Queued'
  }
}

function getIngestionStepState(stepKey, status) {
  if (status === 'failed') {
    return stepKey === 'processing' ? 'failed' : stepKey === 'queued' ? 'done' : 'pending'
  }

  if (status === 'indexed') {
    return 'done'
  }

  if (status === 'processing') {
    if (stepKey === 'queued') {
      return 'done'
    }
    if (stepKey === 'processing') {
      return 'current'
    }
    return 'pending'
  }

  return stepKey === 'queued' ? 'current' : 'pending'
}

export default function IngestionProgressModal({
  open,
  trackedDocuments,
  ingestionComplete,
  onClose,
}) {
  if (!open || !trackedDocuments.length) {
    return null
  }

  return (
    <section className="workspace-upload-modal-backdrop">
      <div className="workspace-upload-modal workspace-ingestion-modal">
        <div className="workspace-upload-modal-header">
          <div>
            <p className="workspace-upload-eyebrow">Upload Progress</p>
            <h2>We are processing your documents.</h2>
          </div>
          <button
            type="button"
            className="workspace-icon-button is-plain"
            onClick={onClose}
          >
            <CloseIcon />
          </button>
        </div>

        <p className="workspace-upload-modal-copy">
          Follow each document through queueing and indexing while the background worker
          processes it.
        </p>

        <div className="workspace-ingestion-list">
          {trackedDocuments.map((document) => {
            const activeStep =
              INGESTION_STEPS.find(
                (step) => getIngestionStepState(step.key, document.ingestionStatus) === 'current',
              ) || null

            return (
              <article key={document.id} className="workspace-ingestion-card">
                <div className="workspace-ingestion-card-head">
                  <div>
                    <span className="workspace-upload-file-label">Document</span>
                    <h3>{document.name}</h3>
                  </div>
                  <span className={`workspace-ingestion-status is-${document.ingestionStatus}`}>
                    {formatStatusLabel(document.ingestionStatus)}
                  </span>
                </div>

                <div className="workspace-ingestion-current">
                  <strong>
                    {document.ingestionStatus === 'failed'
                      ? 'Processing stopped'
                      : activeStep?.title || 'Upload received'}
                  </strong>
                  <p>
                    {document.ingestionStatus === 'failed'
                      ? document.ingestionError ||
                        'The background ingestion pipeline reported a failure for this document.'
                      : activeStep?.description || INGESTION_STEPS[0].description}
                  </p>
                </div>

                <div className="workspace-ingestion-steps">
                  {INGESTION_STEPS.map((step) => {
                    const state = getIngestionStepState(step.key, document.ingestionStatus)
                    return (
                      <div
                        key={`${document.id}-${step.key}`}
                        className={`workspace-ingestion-step is-${state}`}
                      >
                        <span className="workspace-ingestion-step-dot" aria-hidden="true" />
                        <div>
                          <strong>{step.title}</strong>
                          <p>{step.description}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </article>
            )
          })}
        </div>

        <div className="workspace-upload-modal-actions">
          <button type="button" className="workspace-modal-secondary" onClick={onClose}>
            {ingestionComplete ? 'Close' : 'Hide and keep processing'}
          </button>
        </div>
      </div>
    </section>
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
