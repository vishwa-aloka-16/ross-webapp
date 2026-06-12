import { memo, useMemo } from 'react'
import ReactFlow, { Background, Controls, Handle, MarkerType, Position } from 'reactflow'
import 'reactflow/dist/style.css'
import { buildMetadataChips, formatPageRange } from './summaryHelpers'

const NODE_WIDTH = 220
const NODE_HEIGHT = 108
const X_GAP = 320
const Y_GAP = 136

function getPreview(content = '') {
  const compact = content.replace(/\s+/g, ' ').trim()
  if (!compact) {
    return 'No preview available.'
  }
  return compact.length > 72 ? `${compact.slice(0, 69)}...` : compact
}

function getIdentifier(node) {
  const metadata = node?.metadata || {}
  const chips = buildMetadataChips(node)

  if (node.nodeType === 'leaf') {
    if (node.chunkIndex !== null && node.chunkIndex !== undefined) {
      return `Chunk ${node.chunkIndex}`
    }
    return node.id ? `Chunk ${String(node.id).slice(0, 8)}` : 'Leaf Chunk'
  }

  if (metadata.clauseNumber || metadata.clause_number) {
    return `Clause ${metadata.clauseNumber || metadata.clause_number}`
  }

  if (metadata.sectionKey || metadata.section_key) {
    return metadata.sectionKey || metadata.section_key
  }

  if (chips[0]) {
    return chips[0]
  }

  if (node.nodeType === 'root_summary') {
    return 'Root Summary'
  }

  return `Level ${node.level}`
}

function countDepth(node) {
  if (!node?.children?.length) {
    return 0
  }
  return 1 + Math.max(...node.children.map(countDepth))
}

function computeLayout(root) {
  const maxDepth = countDepth(root)
  let leafCursor = 0
  const nodes = []
  const edges = []

  function visit(node, depth = 0, parent = null) {
    const children = node.children || []
    let y = 0

    if (!children.length) {
      y = leafCursor * Y_GAP
      leafCursor += 1
    } else {
      const childYs = children.map((child) => visit(child, depth + 1, node))
      y = childYs.reduce((sum, value) => sum + value, 0) / childYs.length
    }

    const x = (maxDepth - depth) * X_GAP

    nodes.push({
      id: node.id,
      type: 'summaryTreeNode',
      position: { x, y },
      draggable: false,
      data: {
        node,
      },
      sourcePosition: 'right',
      targetPosition: 'left',
    })

    if (parent) {
      edges.push({
        id: `${node.id}->${parent.id}`,
        source: node.id,
        target: parent.id,
        type: 'smoothstep',
        animated: false,
        markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18 },
      })
    }

    return y
  }

  visit(root)
  return { nodes, edges }
}

const TreeGraphNode = memo(function TreeGraphNode({ data, selected }) {
  const { node, onSelectNode, onViewSources, onOpenPage } = data
  const identifier = getIdentifier(node)
  const pageLabel = formatPageRange(node.pageStart, node.pageEnd)
  const preview = getPreview(node.content)
  const nodeKind =
    node.nodeType === 'root_summary'
      ? 'Root'
      : node.nodeType === 'leaf'
        ? 'Leaf'
        : 'Summary'

  return (
    <div className={`summary-graph-node ${selected ? 'is-selected' : ''}`}>
      <Handle type="target" position={Position.Left} className="summary-graph-handle" />
      <div className="summary-graph-node-top">
        <span className={`summary-graph-kind is-${node.nodeType}`}>{nodeKind}</span>
        <span className="summary-graph-pages">{pageLabel}</span>
      </div>

      <strong className="summary-graph-identifier">{identifier}</strong>
      <p className="summary-graph-preview">{preview}</p>

      <div className="summary-graph-actions">
        <button type="button" onClick={() => onSelectNode(node)}>
          Focus
        </button>
        <button type="button" onClick={() => onViewSources(node)}>
          Sources
        </button>
        <button type="button" onClick={() => onOpenPage(node)} disabled={!node.pageStart}>
          Show
        </button>
      </div>
      <Handle type="source" position={Position.Right} className="summary-graph-handle" />
    </div>
  )
})

const nodeTypes = {
  summaryTreeNode: TreeGraphNode,
}

export default function SummaryTree({
  root,
  selectedSummaryNode,
  onSelectNode,
  onViewSources,
  onOpenPage,
}) {
  const graph = useMemo(() => {
    if (!root) {
      return { nodes: [], edges: [] }
    }

    const { nodes, edges } = computeLayout(root)
    return {
      nodes: nodes.map((entry) => ({
        ...entry,
        selected: selectedSummaryNode?.id === entry.id,
        data: {
          ...entry.data,
          onSelectNode,
          onViewSources,
          onOpenPage,
        },
      })),
      edges,
    }
  }, [root, selectedSummaryNode?.id, onOpenPage, onSelectNode, onViewSources])

  if (!root) {
    return null
  }

  return (
    <div className="summary-tree-graph-shell">
      <div className="summary-tree-graph-hint">
        <strong>Leaf-to-root trace</strong>
        <span>Compact graph view with chunk/page identifiers and short previews.</span>
      </div>

      <div className="summary-tree-graph">
        <ReactFlow
          nodes={graph.nodes}
          edges={graph.edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.25}
          maxZoom={1.5}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable
          onNodeClick={(_event, node) => onSelectNode(node.data.node)}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#d6d3d1" gap={18} size={1} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </div>
  )
}
