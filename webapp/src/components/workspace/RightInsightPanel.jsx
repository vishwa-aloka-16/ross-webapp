import EmptyState from '../common/EmptyState'
import Spinner from '../common/Spinner'
import EvidenceDrawer from '../summaries/EvidenceDrawer'
import SummaryExplorer from '../summaries/SummaryExplorer'
import SummaryTree from '../summaries/SummaryTree'

const TABS = [
  { key: 'summary', label: 'Summary' },
  { key: 'tree', label: 'Tree' },
]

export default function RightInsightPanel({
  activeDocument,
  summaryTree,
  selectedSummaryNode,
  selectedEvidence,
  rightPanelTab,
  summaryLoading,
  evidenceLoading,
  onTabChange,
  onSelectNode,
  onViewSources,
  onOpenPage,
  onOpenEvidence,
  onCloseEvidence,
  onToggleExpanded,
  isExpanded = false,
}) {
  const isIndexed = activeDocument?.ingestionStatus === 'indexed'

  return (
    <aside className={`workspace-rightbar summary-panel-shell ${isExpanded ? 'is-expanded' : ''}`}>
      <div className="summary-panel-header">
        <div>
          <h2>Summary Explorer</h2>
        </div>
        <div className="summary-panel-header-actions">
          <button
            type="button"
            className="summary-expand-button"
            onClick={onToggleExpanded}
            disabled={!activeDocument}
            aria-label={isExpanded ? 'Close summary explorer' : 'Expand summary explorer'}
          >
            {isExpanded ? <CollapseIcon /> : <ExpandIcon />}
          </button>
        </div>
      </div>

      <div className="summary-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`summary-tab ${rightPanelTab === tab.key ? 'is-active' : ''}`}
            onClick={() => onTabChange(tab.key)}
            disabled={!isIndexed}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {!activeDocument ? (
        <EmptyState
          title="No active document"
          message="Select a document from the left rail to open its summary explorer."
        />
      ) : !isIndexed ? (
        <div className="summary-locked-state">
          <strong>Summary will be available after ingestion is completed.</strong>
          <p>
            Current status: <span>{activeDocument.ingestionStatus}</span>
          </p>
          {activeDocument.ingestionError ? <p>{activeDocument.ingestionError}</p> : null}
        </div>
      ) : rightPanelTab === 'summary' ? (
        <div className="summary-combined-panel">
          <SummaryExplorer
            root={summaryTree?.root || null}
            selectedSummaryNode={selectedSummaryNode}
            summaryLoading={summaryLoading}
            isExpanded={isExpanded}
            showExpandCta={!isExpanded}
            onExpandSummary={onToggleExpanded}
            onSelectNode={onSelectNode}
            onViewSources={onViewSources}
            onOpenPage={onOpenPage}
          />
          {(evidenceLoading || selectedEvidence.length > 0) && (
            <EvidenceDrawer
              selectedSummaryNode={selectedSummaryNode}
              selectedEvidence={selectedEvidence}
              evidenceLoading={evidenceLoading}
              onOpenEvidence={onOpenEvidence}
              onClose={onCloseEvidence}
            />
          )}
        </div>
      ) : rightPanelTab === 'tree' ? (
        <div className="summary-panel">
          {summaryLoading ? (
            <Spinner label="Loading tree graph..." />
          ) : summaryTree?.root ? (
            <SummaryTree
              root={summaryTree.root}
              selectedSummaryNode={selectedSummaryNode}
              onSelectNode={onSelectNode}
              onViewSources={onViewSources}
              onOpenPage={onOpenPage}
            />
          ) : (
            <EmptyState
              title="No tree available"
              message="This document does not yet expose a RAPTOR summary tree."
            />
          )}
        </div>
      ) : null}
    </aside>
  )
}

function ExpandIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M6 3.5H12.5V10" />
      <path d="M12 4L4 12" />
      <path d="M10.5 12.5H3.5V5.5" />
    </svg>
  )
}

function CollapseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M10 12.5H3.5V6" />
      <path d="M4 12L12 4" />
      <path d="M6 3.5H12.5V10" />
    </svg>
  )
}
