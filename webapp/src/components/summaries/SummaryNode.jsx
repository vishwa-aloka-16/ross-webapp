import { useState } from 'react'
import SummaryCard from './SummaryCard'

export default function SummaryNode({
  node,
  selectedSummaryNode,
  onSelectNode,
  onViewSources,
  onOpenPage,
}) {
  const [expanded, setExpanded] = useState(node.level >= 2)
  const hasChildren = Boolean(node.children?.length)

  return (
    <div className={`summary-node ${selectedSummaryNode?.id === node.id ? 'summary-node-active' : ''}`}>
      <SummaryCard
        node={node}
        isActive={selectedSummaryNode?.id === node.id}
        onSelect={onSelectNode}
        onExpand={() => setExpanded((current) => !current)}
        onViewSources={onViewSources}
        onOpenPage={onOpenPage}
        isExpandable={hasChildren}
      />

      {hasChildren && expanded && (
        <div className="summary-node-children">
          {node.children.map((child) => (
            <SummaryNode
              key={child.id}
              node={child}
              selectedSummaryNode={selectedSummaryNode}
              onSelectNode={onSelectNode}
              onViewSources={onViewSources}
              onOpenPage={onOpenPage}
            />
          ))}
        </div>
      )}
    </div>
  )
}
