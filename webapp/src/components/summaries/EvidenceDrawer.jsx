import Button from '../common/Button'
import EmptyState from '../common/EmptyState'
import MarkdownContent from '../common/MarkdownContent'
import Spinner from '../common/Spinner'
import { buildMetadataChips, formatPageRange } from './summaryHelpers'

export default function EvidenceDrawer({
  selectedSummaryNode,
  selectedEvidence,
  evidenceLoading,
  onOpenEvidence,
  onClose,
}) {
  if (evidenceLoading) {
    return (
      <div className="evidence-drawer">
        <Spinner label="Loading evidence..." />
      </div>
    )
  }

  if (!selectedSummaryNode) {
    return (
      <div className="evidence-drawer">
        <EmptyState
          title="No summary node selected"
          message="Choose a summary or tree node to inspect the evidence trail behind it."
        />
      </div>
    )
  }

  if (!selectedEvidence.length) {
    return (
      <div className="evidence-drawer">
        <EmptyState
          title="Evidence not available yet"
          message="This summary does not currently expose source chunks. Try another node or load evidence from the tree."
        />
      </div>
    )
  }

  return (
    <div className="evidence-drawer">
      <div className="summary-section-header">
        <div className="summary-section-title-row">
          <strong>Evidence Trail</strong>
          <span>{selectedEvidence.length} sources</span>
        </div>
        <button
          type="button"
          className="summary-dismiss-button"
          onClick={onClose}
          aria-label="Close evidence trail"
        >
          <CloseIcon />
        </button>
      </div>

      <div className="evidence-list">
        {selectedEvidence.map((source, index) => {
          const chips = buildMetadataChips(source)
          const chunkLabel =
            source.chunkId?.split('-').at(-1) || source.chunkId || `source-${index + 1}`
          const layoutStrategy = source.metadata?.layoutStrategy || source.metadata?.layout_strategy

          return (
            <article key={`${source.chunkId || 'source'}-${index}`} className="evidence-card">
              <div className="evidence-card-head">
                <div>
                  <strong>Source {index + 1}</strong>
                  <span>
                    {`${formatPageRange(source.pageStart, source.pageEnd)} · Chunk ${chunkLabel}${
                      layoutStrategy ? ` · ${layoutStrategy}` : ''
                    }`}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  className="workspace-summary-button pdf-page-jump"
                  onClick={() => onOpenEvidence(source)}
                  disabled={!source.pageStart}
                >
                  Show in document
                </Button>
              </div>

              {chips.length > 0 && (
                <div className="summary-chip-row">
                  {chips.map((chip) => (
                    <span key={`${source.chunkId}-${chip}`} className="source-chip">
                      {chip}
                    </span>
                  ))}
                </div>
              )}

              <div className="evidence-content">
                <MarkdownContent content={source.content || ''} className="evidence-markdown" />
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M4 4 12 12" />
      <path d="M12 4 4 12" />
    </svg>
  )
}
