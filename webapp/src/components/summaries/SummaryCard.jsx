import { useEffect, useState } from 'react'
import Button from '../common/Button'
import MarkdownContent from '../common/MarkdownContent'
import { buildMetadataChips, formatPageRange } from './summaryHelpers'

export default function SummaryCard({
  node,
  isActive = false,
  onSelect,
  onExpand,
  onViewSources,
  onOpenPage,
  isExpandable = true,
  collapsible = false,
  defaultCollapsed = false,
  showMeta = true,
  showChips = true,
  showActions = true,
  className = '',
}) {
  const chips = buildMetadataChips(node)
  const [collapsed, setCollapsed] = useState(collapsible ? defaultCollapsed : false)

  useEffect(() => {
    setCollapsed(collapsible ? defaultCollapsed : false)
  }, [collapsible, defaultCollapsed, node.id])

  function handleToggleCollapsed() {
    if (!collapsible) {
      onSelect(node)
      return
    }

    setCollapsed((current) => !current)
  }

  return (
    <article
      className={`summary-card ${isActive ? 'summary-node-active' : ''} ${
        collapsed ? 'is-collapsed' : 'is-expanded'
      } ${collapsible ? 'is-collapsible' : ''} ${className}`}
    >
      <button type="button" className="summary-card-main" onClick={handleToggleCollapsed}>
        <div className="summary-card-meta">
          <strong>{node.title || 'Summary'}</strong>
          {showMeta ? (
            <span>
              {`Level ${node.level} · ${formatPageRange(node.pageStart, node.pageEnd)} · ${node.sourceCount ?? 0} sources`}
            </span>
          ) : null}
        </div>
        {collapsible ? (
          <span className={`summary-card-toggle ${collapsed ? 'is-collapsed' : 'is-open'}`}>
            <ChevronIcon />
          </span>
        ) : null}
      </button>

      {!collapsed ? (
        <>
          <MarkdownContent
            content={node.content || 'No summary content available.'}
            className="summary-markdown"
          />

          {showChips && chips.length > 0 && (
            <div className="summary-chip-row">
              {chips.map((chip) => (
                <span key={`${node.id}-${chip}`} className="source-chip">
                  {chip}
                </span>
              ))}
            </div>
          )}

          {showActions ? (
            <div className="summary-card-actions">
              <Button variant="ghost" className="workspace-summary-button" onClick={() => onSelect(node)}>
                Focus
              </Button>
              <Button
                variant="ghost"
                className="workspace-summary-button"
                onClick={() => onViewSources(node)}
              >
                View Sources
              </Button>
              <Button
                variant="ghost"
                className="workspace-summary-button"
                onClick={() => onOpenPage(node)}
                disabled={!node.pageStart}
              >
                Show in document
              </Button>
              {isExpandable && (
                <Button
                  variant="ghost"
                  className="workspace-summary-button"
                  onClick={() => onExpand(node)}
                  disabled={!node.children?.length}
                >
                  Expand
                </Button>
              )}
            </div>
          ) : null}
        </>
      ) : null}
    </article>
  )
}

function ChevronIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="m4.5 6.5 3.5 3.5 3.5-3.5" />
    </svg>
  )
}
