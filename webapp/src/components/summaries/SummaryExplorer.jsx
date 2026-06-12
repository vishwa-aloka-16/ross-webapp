import EmptyState from '../common/EmptyState'
import Spinner from '../common/Spinner'
import SummaryCard from './SummaryCard'

export default function SummaryExplorer({
  root,
  selectedSummaryNode,
  summaryLoading,
  isExpanded = false,
  showExpandCta = false,
  onExpandSummary,
  onSelectNode,
  onViewSources,
  onOpenPage,
}) {
  if (summaryLoading) {
    return <Spinner label="Loading summary tree..." />
  }

  if (!root) {
    return (
      <EmptyState
        title="Summary unavailable"
        message="This document does not yet expose a summary root."
      />
    )
  }

  return (
    <div className={`summary-panel ${isExpanded ? 'is-expanded-view' : 'is-compact-view'}`}>
      {isExpanded ? (
        <>
          <div className="summary-section-header">
            <strong>Root Summary</strong>
            <span>{root.sourceCount ?? 0} sources</span>
          </div>

          <SummaryCard
            node={root}
            isActive={selectedSummaryNode?.id === root.id}
            onSelect={onSelectNode}
            onExpand={onSelectNode}
            onViewSources={onViewSources}
            onOpenPage={onOpenPage}
            showMeta
            showChips
            showActions
          />

          <div className="summary-section-header">
            <strong>Sub-summaries</strong>
            <span>{root.children?.length || 0} nodes</span>
          </div>

          {root.children?.length ? (
            <div className="summary-list">
              {root.children.map((child) => (
                <SummaryCard
                  key={child.id}
                  node={child}
                  isActive={selectedSummaryNode?.id === child.id}
                  onSelect={onSelectNode}
                  onExpand={onSelectNode}
                  onViewSources={onViewSources}
                  onOpenPage={onOpenPage}
                  collapsible
                  defaultCollapsed
                />
              ))}
            </div>
          ) : (
            <EmptyState
              title="No child summaries"
              message="This document currently exposes only a root summary."
            />
          )}
        </>
      ) : (
        <>
          <div className="summary-panel-scroll-body">
            <div className="summary-section-header">
              <strong>Full Summary</strong>
              <CompactSummaryIcon />
            </div>

            <SummaryCard
              node={root}
              isActive={selectedSummaryNode?.id === root.id}
              onSelect={onSelectNode}
              onExpand={onSelectNode}
              onViewSources={onViewSources}
              onOpenPage={onOpenPage}
              showMeta={false}
              showChips={false}
              showActions={false}
              className="summary-card-compact-root"
            />
          </div>

          {showExpandCta ? (
            <div className="summary-expand-cta-wrap">
              <button type="button" className="summary-expand-cta" onClick={onExpandSummary}>
                Expand summary
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}

function CompactSummaryIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="m4.5 9.5 3.5-3.5 3.5 3.5" />
    </svg>
  )
}
