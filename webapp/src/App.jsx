import { useEffect, useMemo, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import RossAuth from './RossAuth'
import './App.css'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''
const TOKEN_STORAGE_KEY = 'ross.gateway.token'

const EMPTY_AUTH_FORM = {
  firstName: '',
  lastName: '',
  email: '',
  firm: '',
  password: '',
}

const tabs = ['Summary', 'Chat']

const LAYOUT_STRATEGY_OPTIONS = [
  {
    value: 'ADVERSARIAL',
    icon: '⚖️',
    title: 'Adversarial & Disputed Records',
    description:
      'Best for case briefs, pleadings, or moot problems containing competing claims from multiple parties.',
  },
  {
    value: 'HIERARCHICAL',
    icon: '📜',
    title: 'Statutory & Codified Frameworks',
    description:
      'Best for legislated acts, multi-part state regulations, compliance manuals, or articles of association.',
  },
  {
    value: 'TRANSACTIONAL',
    icon: '🤝',
    title: 'Linear & Contractual Instruments',
    description:
      'Best for non-disclosure agreements, commercial leases, and transactional contracts.',
  },
]

function buildUrl(path) {
  return `${API_BASE_URL}${path}`
}

async function apiRequest(path, options = {}) {
  const response = await fetch(buildUrl(path), {
    method: options.method || 'GET',
    headers: {
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...(options.headers || {}),
    },
    body: options.body,
  })

  const isJson = response.headers.get('content-type')?.includes('application/json')
  const payload = isJson ? await response.json() : null

  if (!response.ok) {
    throw new Error(
      payload?.error ||
        payload?.detail ||
        payload?.message ||
        `Request failed with status ${response.status}.`,
    )
  }

  return payload
}

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

function formatLayoutStrategyLabel(layoutStrategy) {
  return (
    LAYOUT_STRATEGY_OPTIONS.find((option) => option.value === layoutStrategy)?.title ||
    'Linear & Contractual Instruments'
  )
}

function getInitials(name = '') {
  return (
    name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((segment) => segment[0]?.toUpperCase())
      .join('') || 'U'
  )
}

function withPdf(name) {
  return name.toLowerCase().endsWith('.pdf') ? name : `${name}.pdf`
}

function stripPdfExtension(name = '') {
  return name.replace(/\.pdf$/i, '')
}

function createPendingUploadEntries(files) {
  return files.map((file, index) => ({
    id: `${file.name}-${file.size}-${file.lastModified}-${index}`,
    file,
    displayName: stripPdfExtension(file.name),
  }))
}

function escapePdfText(value) {
  return value.replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)')
}

function buildPdfSource(title) {
  const safeTitle = escapePdfText(title)
  const contentStream = [
    'BT',
    '/F1 22 Tf',
    '72 740 Td',
    `(${safeTitle}) Tj`,
    '0 -34 Td',
    '/F1 13 Tf',
    '(Ross legal assistant preview) Tj',
    '0 -24 Td',
    '(This embedded PDF stands in for the selected document.) Tj',
    '0 -24 Td',
    '(Use your browser PDF controls to zoom, print, or download.) Tj',
    '0 -24 Td',
    '(Later, this same viewer can point to uploaded contract files.) Tj',
    'ET',
  ].join('\n')

  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>\nendobj\n',
    `4 0 obj\n<< /Length ${contentStream.length} >>\nstream\n${contentStream}\nendstream\nendobj\n`,
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
  ]

  let pdf = '%PDF-1.4\n'
  const offsets = [0]

  objects.forEach((objectText) => {
    offsets.push(pdf.length)
    pdf += objectText
  })

  const xrefStart = pdf.length
  pdf += `xref\n0 ${objects.length + 1}\n`
  pdf += '0000000000 65535 f \n'

  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`
  })

  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`

  return `data:application/pdf;base64,${btoa(pdf)}`
}

function summarizeNodeLabel(node, fallbackIndex) {
  const content = prepareSummaryMarkdown(node.content || '')
  const headingMatch = content.match(/^#{2,3}\s+(.+)$/m)
  if (headingMatch?.[1]) {
    return headingMatch[1].trim()
  }

  const sentence = toPlainText(content).replace(/\s+/g, ' ').trim()
  if (!sentence) {
    return `Summary ${fallbackIndex + 1}`
  }

  return sentence.slice(0, 70) + (sentence.length > 70 ? '...' : '')
}

function extractLeadParagraph(content = '') {
  const markdown = prepareSummaryMarkdown(content)
  const blocks = markdown
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)

  for (const block of blocks) {
    if (block.startsWith('## ') || block.startsWith('### ')) {
      continue
    }

    const plain = toPlainText(block).trim()
    if (plain) {
      return plain
    }
  }

  return toPlainText(markdown)
}

function extractPreviewSnippet(content = '', blockCount = 1) {
  const markdown = prepareSummaryMarkdown(content)
  const blocks = markdown
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .filter((block) => !block.startsWith('## ') && !block.startsWith('### '))
    .map((block) => toPlainText(block).trim())
    .filter(Boolean)

  if (!blocks.length) {
    return ''
  }

  return blocks.slice(0, blockCount).join('\n\n')
}

function normalizeForComparison(text = '') {
  return text.replace(/[^a-z0-9]+/gi, ' ').trim().toLowerCase()
}

function cleanMarkdownLine(text = '') {
  return text
    .replace(/^\s*#{1,6}\s*/, '')
    .replace(/^\s*[-*+]\s+/, '')
    .replace(/^\s*>\s?/, '')
    .replace(/\*\*/g, '')
    .replace(/__/g, '')
    .replace(/^\*+/, '')
    .replace(/\*+$/, '')
    .replace(/^_+/, '')
    .replace(/_+$/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function looksLikeTitle(text = '') {
  return (
    text.includes('SUMMARY:') ||
    (/^[A-Z0-9 ,:&()/'".-]+$/.test(text) && text.length < 180)
  )
}

function looksLikeSectionHeading(text = '') {
  return /^([IVX]+|\d+)\.\s+/.test(text) || /^[A-Z]\.\s+/.test(text)
}

function prepareSummaryMarkdown(content = '') {
  const normalized = content
    .replace(/\r/g, '')
    .replace(/^\s*\*+(?=[A-Z])/gm, '')
    .replace(/\*\s+\*\*/g, '\n\n**')
    .replace(/\n([IVX]{1,8}\.\s+[A-Z])/g, '\n\n$1')
    .replace(/\s+([IVX]{1,8}\.\s+[A-Z][^\n]{4,140})(?=\s+[A-Z][a-z]+:|\s+[IVX]{1,8}\.\s+[A-Z]|$)/g, '\n\n$1')
    .replace(/([.?!])\s+([A-Z][A-Za-z'()/-]{2,40}:)/g, '$1\n\n$2')
    .replace(/(:\s+[^\n]{40,}?)\s+([A-Z][A-Za-z'()/-]{2,40}:)/g, '$1\n\n$2')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  if (!normalized) {
    return ''
  }

  const paragraphs = normalized
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
  const renderedBlocks = []

  for (const paragraph of paragraphs) {
    const lines = paragraph
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)

    for (const rawLine of lines) {
      const line = cleanMarkdownLine(rawLine)
      const previous = renderedBlocks[renderedBlocks.length - 1]

      if (!line) {
        continue
      }

      if (previous && normalizeForComparison(previous) === normalizeForComparison(line)) {
        continue
      }

      if (looksLikeTitle(line)) {
        renderedBlocks.push(`## ${line}`)
        continue
      }

      if (looksLikeSectionHeading(line)) {
        renderedBlocks.push(`### ${line}`)
        continue
      }

      const keypointMatch = line.match(/^([A-Z][A-Za-z0-9/&()'". -]{2,120}):\s*(.*)$/)
      if (keypointMatch) {
        renderedBlocks.push(`- **${keypointMatch[1].trim()}:** ${keypointMatch[2].trim()}`)
        continue
      }

      renderedBlocks.push(line)
    }
  }

  return renderedBlocks.join('\n\n').replace(/\n{3,}/g, '\n\n').trim()
}

function toPlainText(content = '') {
  return content
    .replace(/^\s*#{1,6}\s+/gm, '')
    .replace(/^\s*[-*]\s+/gm, '')
    .replace(/^\s*>\s?/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*\*/g, '')
    .replace(/__/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

function SummaryLoadingState({ expanded = false }) {
  return (
    <div className={`workspace-summary-loading${expanded ? ' is-expanded' : ''}`}>
      <span className="workspace-summary-loading-spinner" aria-hidden="true" />
      <p className={`workspace-summary-copy${expanded ? ' expanded' : ''}`}>Loading summary</p>
    </div>
  )
}

function SummaryText({
  content,
  preview = false,
  previewBlocks = 1,
  expandable = false,
  onExpand,
}) {
  const markdown = prepareSummaryMarkdown(content)

  if (!markdown) {
    return <p className="workspace-summary-copy">No summary available yet.</p>
  }

  if (preview) {
    const previewSnippet = extractPreviewSnippet(content, previewBlocks) || extractLeadParagraph(content)

    return (
      <div className="workspace-summary-rich">
        <div className="workspace-summary-preview-wrap">
          <p className="workspace-summary-copy workspace-summary-preview-copy">{previewSnippet}</p>
          {expandable && <div className="workspace-summary-preview-fade" aria-hidden="true" />}
        </div>
        {expandable && (
          <button
            type="button"
            className="workspace-inline-expand workspace-inline-expand-icon"
            onClick={onExpand}
            aria-label="Expand full summary"
            title="Expand full summary"
          >
            <span>Expand summary</span>
            <ExpandIcon />
          </button>
        )}
      </div>
    )
  }

  return (
    <ReactMarkdown
      className="workspace-summary-markdown"
      remarkPlugins={[remarkGfm]}
      components={{
        h2: ({ children }) => (
          <div className="workspace-summary-title-card">
            <h3 className="workspace-summary-title">{children}</h3>
          </div>
        ),
        h3: ({ children }) => (
          <div className="workspace-summary-section-break">
            <h4 className="workspace-summary-heading is-major">{children}</h4>
          </div>
        ),
        p: ({ children }) => <p className="workspace-summary-copy section">{children}</p>,
        ul: ({ children }) => <ul className="workspace-summary-bullets">{children}</ul>,
        ol: ({ children }) => <ol className="workspace-summary-numbers">{children}</ol>,
        li: ({ children }) => <li className="workspace-summary-bullet-item">{children}</li>,
        strong: ({ children }) => <strong className="workspace-summary-inline-label">{children}</strong>,
        blockquote: ({ children }) => (
          <blockquote className="workspace-summary-blockquote">{children}</blockquote>
        ),
        code({ inline, className, children, ...props }) {
          if (!inline) {
            return (
              <pre className="workspace-summary-codeblock">
                <code {...props} className={className}>
                  {String(children).replace(/\n$/, '')}
                </code>
              </pre>
            )
          }

          return (
            <code {...props} className="workspace-summary-inline-code">
              {children}
            </code>
          )
        },
      }}
    >
      {markdown}
    </ReactMarkdown>
  )
}

function TreeSummaryText({ content, rootLabel = '' }) {
  const markdown = prepareSummaryMarkdown(content)
  const blocks = markdown
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .filter((block, index) => {
      if (index !== 0 || !rootLabel) {
        return true
      }

      const normalizedBlock = normalizeForComparison(toPlainText(block))
      const normalizedLabel = normalizeForComparison(rootLabel)
      return normalizedBlock !== normalizedLabel
    })

  if (!blocks.length) {
    return <p className="workspace-summary-copy">No summary available yet.</p>
  }

  return (
    <div className="workspace-tree-summary-copy">
      {blocks.map((block, index) => {
        if (block.startsWith('## ')) {
          return (
            <div key={`tree-title-${index}`} className="workspace-tree-title-card">
              <h4 className="workspace-tree-title">{block.slice(3).trim()}</h4>
            </div>
          )
        }

        if (block.startsWith('### ')) {
          return (
            <div key={`tree-heading-${index}`} className="workspace-tree-section">
              <h5 className="workspace-tree-heading">{block.slice(4).trim()}</h5>
            </div>
          )
        }

        if (block.startsWith('- ')) {
          const bulletText = block.replace(/^-\s+/, '')
          return (
            <div key={`tree-bullet-${index}`} className="workspace-tree-bullet">
              <span className="workspace-tree-bullet-mark">&bull;</span>
              <p className="workspace-tree-bullet-text">{toPlainText(bulletText)}</p>
            </div>
          )
        }

        return (
          <p key={`tree-paragraph-${index}`} className="workspace-tree-paragraph">
            {toPlainText(block)}
          </p>
        )
      })}
    </div>
  )
}

function SummaryTreeNode({ node, depth = 0, ancestorIds = [], forceOpenIds = new Set() }) {
  const isLeaf = node.node_type === 'leaf'
  const normalizedContent = toPlainText(prepareSummaryMarkdown(node.content || ''))
  const label = summarizeNodeLabel(node, depth)
  const hasCycle = ancestorIds.includes(node.id)
  const [localOpen, setLocalOpen] = useState(false)
  const isOpen = localOpen || forceOpenIds.has(node.id)

  if (hasCycle) {
    return (
      <div className={`workspace-tree-node workspace-tree-node-summary depth-${depth}`}>
        <div className="workspace-tree-summary-card">
          <p className="workspace-tree-label">{label}</p>
          <p className="workspace-summary-copy">
            Recursive summary branch detected. This node was skipped to keep the expanded view stable.
          </p>
        </div>
      </div>
    )
  }

  if (isLeaf) {
    return (
      <div className={`workspace-tree-node workspace-tree-node-leaf depth-${depth}`}>
        <button
          type="button"
          className="workspace-tree-toggle"
          onClick={() => setLocalOpen((current) => !current)}
        >
          <span className="workspace-tree-toggle-label">Raw chunk</span>
          <ChevronIcon open={isOpen} />
        </button>
        {isOpen && <blockquote className="workspace-tree-quote">"{normalizedContent}"</blockquote>}
      </div>
    )
  }

  const childSummaries = (node.children || []).filter((child) => child.node_type !== 'leaf')
  const childLeaves = (node.children || []).filter((child) => child.node_type === 'leaf')
  const nextAncestorIds = [...ancestorIds, node.id]

  return (
    <div className={`workspace-tree-node workspace-tree-node-summary depth-${depth}`}>
      <div className="workspace-tree-summary-card">
        <button
          type="button"
          className="workspace-tree-toggle"
          onClick={() => setLocalOpen((current) => !current)}
        >
          <span className="workspace-tree-label">{label}</span>
          <ChevronIcon open={isOpen} />
        </button>
        {isOpen && <TreeSummaryText content={node.content || ''} rootLabel={label} />}
      </div>

      {isOpen && !!childSummaries.length && (
        <div className="workspace-tree-children">
          {childSummaries.map((child) => (
            <SummaryTreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              ancestorIds={nextAncestorIds}
              forceOpenIds={forceOpenIds}
            />
          ))}
        </div>
      )}

      {isOpen && !!childLeaves.length && (
        <div className="workspace-tree-leaves">
          {childLeaves.map((child) => (
            <SummaryTreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              ancestorIds={nextAncestorIds}
              forceOpenIds={forceOpenIds}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function flattenSummaryNodes(rootNodes = []) {
  return rootNodes.map((node, index) => ({
    id: node.id,
    title: summarizeNodeLabel(node, index),
    previewSummary: extractLeadParagraph(node.content),
    fullSummary: node.content || '',
    pageLabel:
      node.page_start && node.page_end
        ? `Page ${node.page_start} - ${node.page_end}`
        : node.page_start
          ? `Page ${node.page_start}`
          : 'Document overview',
    children: (node.children || []).map((child, childIndex) => ({
      id: child.id,
      title: summarizeNodeLabel(child, childIndex),
      previewSummary: extractLeadParagraph(child.content),
      fullSummary: child.content || '',
      pageLabel:
        child.page_start && child.page_end
          ? `Page ${child.page_start} - ${child.page_end}`
          : child.page_start
            ? `Page ${child.page_start}`
            : 'Section',
    })),
  }))
}

function findSummaryNodePath(nodes = [], targetId, ancestors = []) {
  for (const node of nodes) {
    const nextPath = [...ancestors, node.id]
    if (node.id === targetId) {
      return nextPath
    }

    const nestedPath = findSummaryNodePath(node.children || [], targetId, nextPath)
    if (nestedPath.length) {
      return nestedPath
    }
  }

  return []
}

function resetChatMessages() {
  return [
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Hey Flippy! Ask me anything about your documents.',
      citations: [],
    },
  ]
}

const INGESTION_STEPS = [
  {
    key: 'received',
    title: 'Upload received',
    description: 'The gateway has accepted the PDF and recorded it for ingestion.',
  },
  {
    key: 'queued',
    title: 'Queued for ingestion',
    description: 'The document is waiting for the background worker to pick it up.',
  },
  {
    key: 'processing',
    title: 'Indexing and summarizing',
    description:
      'We are extracting pages, splitting legal chunks, embedding content, and building the summary tree.',
  },
  {
    key: 'ready',
    title: 'Ready for chat and summaries',
    description: 'The document is indexed and available in the workspace.',
  },
]

function getIngestionStageKey(status) {
  switch (status) {
    case 'pending':
      return 'queued'
    case 'processing':
      return 'processing'
    case 'indexed':
      return 'ready'
    case 'failed':
      return 'processing'
    default:
      return 'received'
  }
}

function getIngestionStepState(stepKey, status) {
  const order = INGESTION_STEPS.map((step) => step.key)
  const activeKey = getIngestionStageKey(status)
  const stepIndex = order.indexOf(stepKey)
  const activeIndex = order.indexOf(activeKey)

  if (status === 'failed') {
    if (stepKey === 'processing') {
      return 'failed'
    }
    return stepIndex < activeIndex ? 'done' : 'pending'
  }

  if (stepIndex < activeIndex) {
    return 'done'
  }

  if (stepIndex === activeIndex) {
    return status === 'indexed' && stepKey === 'ready' ? 'done' : 'current'
  }

  return 'pending'
}

export default function App() {
  const [token, setToken] = useState(() => window.localStorage.getItem(TOKEN_STORAGE_KEY) || '')
  const [user, setUser] = useState(null)
  const [authMode, setAuthMode] = useState('login')
  const [authForm, setAuthForm] = useState(EMPTY_AUTH_FORM)
  const [authError, setAuthError] = useState('')
  const [authLoading, setAuthLoading] = useState(false)

  const [documents, setDocuments] = useState([])
  const [documentsLoading, setDocumentsLoading] = useState(false)
  const [documentsError, setDocumentsError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [activeDocumentId, setActiveDocumentId] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const [uploadModalError, setUploadModalError] = useState('')
  const [pendingUploadFiles, setPendingUploadFiles] = useState([])
  const [selectedLayoutStrategy, setSelectedLayoutStrategy] = useState('ADVERSARIAL')
  const [uploadDragActive, setUploadDragActive] = useState(false)
  const [ingestionTracker, setIngestionTracker] = useState({ open: false, documentIds: [] })
  const [deletingId, setDeletingId] = useState('')

  const [summaryTree, setSummaryTree] = useState(null)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summaryError, setSummaryError] = useState('')

  const [question, setQuestion] = useState('')
  const [chatMessages, setChatMessages] = useState(resetChatMessages)
  const [chatLoading, setChatLoading] = useState(false)
  const [chatError, setChatError] = useState('')

  const [activeTab, setActiveTab] = useState('Summary')
  const [summaryMode, setSummaryMode] = useState('Brief')
  const [fullSummaryOpen, setFullSummaryOpen] = useState(true)
  const [summaryExpanded, setSummaryExpanded] = useState(false)
  const [summaryVisible, setSummaryVisible] = useState(false)
  const [expandedSummaryTargetId, setExpandedSummaryTargetId] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [leftWidth, setLeftWidth] = useState(208)
  const [rightWidth, setRightWidth] = useState(() =>
    typeof window === 'undefined' ? 520 : Math.max(420, Math.round(window.innerWidth * 0.5)),
  )
  const [resizing, setResizing] = useState(null)
  const [openMenuId, setOpenMenuId] = useState(null)

  const fileInputRef = useRef(null)
  const containerRef = useRef(null)

  const filteredDocuments = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()
    return documents.filter((document) =>
      document.name.toLowerCase().includes(normalizedSearch),
    )
  }, [documents, searchTerm])

  const activeDocument =
    documents.find((document) => document.id === activeDocumentId) ||
    filteredDocuments[0] ||
    null

  const activeDocName = activeDocument?.name ?? ''
  const activePdfTitle = withPdf(activeDocName || 'Document')
  const activePdfSrc =
    activeDocument?.pdfUrl && activeDocument.mimeType === 'application/pdf'
      ? activeDocument.pdfUrl
      : buildPdfSource(activePdfTitle)

  const summaryCards = useMemo(
    () => flattenSummaryNodes(summaryTree?.root_nodes || []),
    [summaryTree],
  )
  const summaryRootNodes = summaryTree?.root_nodes || []
  const fullSummaryCard = summaryCards[0] || null
  const subTopicCards = fullSummaryCard?.children?.length
    ? fullSummaryCard.children
    : summaryCards.slice(1)
  const restoringSession = Boolean(token) && !user
  const fullSummaryPreview = fullSummaryCard?.previewSummary || ''
  const fullSummaryText = fullSummaryCard?.fullSummary || fullSummaryPreview
  const hasMoreFullSummary =
    Boolean(fullSummaryPreview) &&
    Boolean(fullSummaryText) &&
    fullSummaryText.trim() !== fullSummaryPreview.trim()
  const expandedSummaryPath = expandedSummaryTargetId
    ? findSummaryNodePath(summaryRootNodes, expandedSummaryTargetId)
    : []
  const expandedSummaryOpenIds = new Set(expandedSummaryPath)
  const trackedIngestionDocuments = ingestionTracker.documentIds
    .map((id) => documents.find((document) => document.id === id))
    .filter(Boolean)
  const ingestionComplete =
    trackedIngestionDocuments.length > 0 &&
    trackedIngestionDocuments.every((document) =>
      ['indexed', 'failed'].includes(document.ingestionStatus),
    )
  const summaryPreviewBlocks = summaryMode === 'Brief' ? 4 : 8

  useEffect(() => {
    if (!token) {
      return
    }

    let cancelled = false

    async function bootstrap() {
      try {
        const me = await apiRequest('/api/auth/me', { token })
        if (!cancelled) {
          setUser(me.user)
        }
      } catch {
        if (!cancelled) {
          window.localStorage.removeItem(TOKEN_STORAGE_KEY)
          setToken('')
          setUser(null)
        }
      }
    }

    bootstrap()

    return () => {
      cancelled = true
    }
  }, [token])

  useEffect(() => {
    if (!token || !user) {
      return
    }

    let cancelled = false

    async function loadDocuments() {
      setDocumentsLoading(true)
      setDocumentsError('')

      try {
        const payload = await apiRequest('/api/documents', { token })
        if (cancelled) {
          return
        }

        setDocuments(payload.documents || [])
        setActiveDocumentId((current) => {
          if (current && (payload.documents || []).some((document) => document.id === current)) {
            return current
          }
          return payload.documents?.[0]?.id || ''
        })
      } catch (error) {
        if (!cancelled) {
          setDocumentsError(error.message)
        }
      } finally {
        if (!cancelled) {
          setDocumentsLoading(false)
        }
      }
    }

    loadDocuments()

    return () => {
      cancelled = true
    }
  }, [token, user])

  useEffect(() => {
    if (!token) {
      return
    }

    const pendingDocuments = documents.filter((document) =>
      ['pending', 'processing'].includes(document.ingestionStatus),
    )

    if (!pendingDocuments.length) {
      return
    }

    const intervalId = window.setInterval(async () => {
      try {
        const updates = await Promise.all(
          pendingDocuments.map(async (document) => ({
            id: document.id,
            ...(await apiRequest(`/api/documents/${document.id}/status`, { token })),
          })),
        )

        setDocuments((current) =>
          current.map((document) => {
            const update = updates.find((entry) => entry.id === document.id)
            return update ? { ...document, ...update } : document
          }),
        )
      } catch {
        // silent polling
      }
    }, 5000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [documents, token])

  useEffect(() => {
    if (!activeDocument || activeDocument.ingestionStatus !== 'indexed') {
      return
    }

    let cancelled = false

    async function loadSummaryTree() {
      setSummaryLoading(true)
      setSummaryError('')

      try {
        const payload = await apiRequest(`/api/rag/summary-tree/${activeDocument.id}`, { token })
        if (!cancelled) {
          setSummaryTree(payload)
        }
      } catch (error) {
        if (!cancelled) {
          setSummaryError(error.message)
        }
      } finally {
        if (!cancelled) {
          setSummaryLoading(false)
        }
      }
    }

    loadSummaryTree()

    return () => {
      cancelled = true
    }
  }, [activeDocument, token])

  useEffect(() => {
    if (!resizing) {
      return undefined
    }

    const handleMove = (event) => {
      if (!containerRef.current) {
        return
      }

      const bounds = containerRef.current.getBoundingClientRect()

      if (resizing === 'left') {
        const nextWidth = Math.min(Math.max(event.clientX - bounds.left, 180), 420)
        setLeftWidth(nextWidth)
      }

      if (resizing === 'right') {
        const viewportHalfWidth = Math.round(window.innerWidth * 0.5)
        const nextWidth = Math.min(
          Math.max(bounds.right - event.clientX, Math.max(420, viewportHalfWidth - 40)),
          viewportHalfWidth,
        )
        setRightWidth(nextWidth)
      }
    }

    const handleUp = () => {
      setResizing(null)
    }

    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)

    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }
  }, [resizing])

  useEffect(() => {
    const syncRightWidth = () => {
      setRightWidth(Math.max(420, Math.round(window.innerWidth * 0.5)))
    }

    window.addEventListener('resize', syncRightWidth)
    return () => {
      window.removeEventListener('resize', syncRightWidth)
    }
  }, [])

  useEffect(() => {
    let timeoutId

    if (!summaryExpanded && summaryVisible) {
      timeoutId = window.setTimeout(() => {
        setSummaryVisible(false)
      }, 220)
    }

    return () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId)
      }
    }
  }, [summaryExpanded, summaryVisible])

  useEffect(() => {
    const handleWindowClick = () => {
      setOpenMenuId(null)
    }

    window.addEventListener('click', handleWindowClick)

    return () => {
      window.removeEventListener('click', handleWindowClick)
    }
  }, [])

  async function handleAuthSubmit(event) {
    event.preventDefault()
    setAuthLoading(true)
    setAuthError('')

    try {
      const path = authMode === 'login' ? '/api/auth/login' : '/api/auth/register'
      const payload = await apiRequest(path, {
        method: 'POST',
        body: JSON.stringify(
          authMode === 'login'
            ? { email: authForm.email, password: authForm.password }
            : {
                firstName: authForm.firstName,
                lastName: authForm.lastName,
                email: authForm.email,
                firm: authForm.firm,
                password: authForm.password,
              },
        ),
      })

      window.localStorage.setItem(TOKEN_STORAGE_KEY, payload.token)
      setToken(payload.token)
      setUser(payload.user)
      setAuthForm(EMPTY_AUTH_FORM)
    } catch (error) {
      setAuthError(error.message)
    } finally {
      setAuthLoading(false)
    }
  }

  function handleLogout() {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY)
    setToken('')
    setUser(null)
    setDocuments([])
    setSummaryTree(null)
    setChatMessages(resetChatMessages())
  }

  function handleUploadClick() {
    setUploadModalOpen(true)
    setUploadModalError('')
  }

  function closeUploadModal() {
    setUploadModalOpen(false)
    setUploadModalError('')
    setPendingUploadFiles([])
    setUploadDragActive(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  function appendPendingFiles(files) {
    if (!files.length || !token) {
      return
    }

    const pdfFiles = files.filter(
      (file) => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'),
    )

    if (!pdfFiles.length) {
      setUploadModalError('Only PDF files can be added to the ingestion queue.')
      setUploadModalOpen(true)
      return
    }

    setPendingUploadFiles((current) => {
      const existingKeys = new Set(
        current.map((entry) => `${entry.file.name}-${entry.file.size}-${entry.file.lastModified}`),
      )
      const nextEntries = createPendingUploadEntries(pdfFiles).filter(
        (entry) =>
          !existingKeys.has(
            `${entry.file.name}-${entry.file.size}-${entry.file.lastModified}`,
          ),
      )

      return [...current, ...nextEntries]
    })
    setUploadModalError('')
    setUploadModalOpen(true)
  }

  function handleUploadChange(event) {
    appendPendingFiles(Array.from(event.target.files || []))
  }

  function handleUploadDrop(event) {
    event.preventDefault()
    setUploadDragActive(false)
    appendPendingFiles(Array.from(event.dataTransfer?.files || []))
  }

  function handlePendingUploadNameChange(entryId, value) {
    setPendingUploadFiles((current) =>
      current.map((entry) => (entry.id === entryId ? { ...entry, displayName: value } : entry)),
    )
  }

  function handleRemovePendingUpload(entryId) {
    setPendingUploadFiles((current) => current.filter((entry) => entry.id !== entryId))
  }

  async function handleInitializeAnalytics() {
    if (!pendingUploadFiles.length || !token) {
      return
    }

    setUploading(true)
    setDocumentsError('')
    setUploadModalError('')

    try {
      const formData = new FormData()
      pendingUploadFiles.forEach((entry) => {
        const normalizedName = withPdf((entry.displayName || '').trim() || entry.file.name)
        const uploadFile =
          normalizedName === entry.file.name
            ? entry.file
            : new File([entry.file], normalizedName, {
                type: entry.file.type || 'application/pdf',
                lastModified: entry.file.lastModified,
              })

        formData.append('documents', uploadFile)
      })
      formData.append('layoutStrategy', selectedLayoutStrategy)

      const payload = await apiRequest('/api/documents/upload', {
        method: 'POST',
        body: formData,
        token,
      })

      setDocuments((current) => [...payload.documents, ...current])
      setActiveDocumentId(payload.documents?.[0]?.id || '')
      setOpenMenuId(null)
      setIngestionTracker({
        open: true,
        documentIds: (payload.documents || []).map((document) => document.id),
      })
      closeUploadModal()
    } catch (error) {
      setUploadModalError(error.message)
    } finally {
      setUploading(false)
    }
  }

  function handleRenameDocument(documentId) {
    const documentToRename = documents.find((doc) => doc.id === documentId)
    if (!documentToRename) {
      return
    }

    const nextName = window.prompt('Rename document', documentToRename.name)?.trim()
    if (!nextName) {
      setOpenMenuId(null)
      return
    }

    setDocuments((current) =>
      current.map((doc) => (doc.id === documentId ? { ...doc, name: nextName } : doc)),
    )
    setOpenMenuId(null)
  }

  async function handleDeleteDocument(documentId) {
    if (!token) {
      return
    }

    setDeletingId(documentId)
    setDocumentsError('')

    try {
      await apiRequest(`/api/documents/${documentId}`, {
        method: 'DELETE',
        token,
      })

      const remainingDocuments = documents.filter((document) => document.id !== documentId)
      setDocuments(remainingDocuments)

      if (activeDocumentId === documentId) {
        setActiveDocumentId(remainingDocuments[0]?.id || '')
      }
    } catch (error) {
      setDocumentsError(error.message)
    } finally {
      setDeletingId('')
      setOpenMenuId(null)
    }
  }

  async function handleAskQuestion(promptOverride) {
    const nextQuestion = (promptOverride || question).trim()
    if (!token || !activeDocument || !nextQuestion) {
      return
    }

    setChatLoading(true)
    setChatError('')
    setChatMessages((current) => [
      ...current,
      {
        id: `user-${Date.now()}`,
        role: 'user',
        content: nextQuestion,
        citations: [],
      },
    ])
    setQuestion('')

    try {
      const payload = await apiRequest('/api/rag/query', {
        method: 'POST',
        token,
        body: JSON.stringify({
          documentId: activeDocument.id,
          question: nextQuestion,
        }),
      })

      setChatMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: payload.answer,
          citations: payload.citations || [],
        },
      ])
    } catch (error) {
      setChatError(error.message)
      setChatMessages((current) => current.slice(0, -1))
      setQuestion(nextQuestion)
    } finally {
      setChatLoading(false)
    }
  }

  function openExpandedSummary(targetId = '') {
    setActiveTab('Summary')
    setFullSummaryOpen(true)
    setExpandedSummaryTargetId(targetId)
    setSummaryVisible(true)
    setSummaryExpanded(true)
  }

  function handleSummaryModeChange(mode) {
    setSummaryMode(mode)

    if (mode === 'Full') {
      openExpandedSummary(fullSummaryCard?.id || '')
      return
    }

    if (summaryExpanded || summaryVisible) {
      setSummaryExpanded(false)
      setExpandedSummaryTargetId('')
    }
  }

  function handleClearChat() {
    setChatError('')
    setChatLoading(false)
    setQuestion('')
    setChatMessages(resetChatMessages())
  }

  if (!user) {
    return (
      <RossAuth
        mode={authMode}
        form={authForm}
        error={authError}
        loading={authLoading}
        restoringSession={restoringSession}
        onModeChange={setAuthMode}
        onFieldChange={(field, value) =>
          setAuthForm((current) => ({
            ...current,
            [field]: value,
          }))
        }
        onSubmit={handleAuthSubmit}
      />
    )
  }

  return (
    <div
      ref={containerRef}
      className={`workspace-shell ${resizing ? 'is-resizing' : ''}`}
    >
      <aside
        className={`workspace-sidebar ${sidebarOpen ? '' : 'is-collapsed'}`}
        style={sidebarOpen ? { width: `${leftWidth}px` } : undefined}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          onChange={handleUploadChange}
          className="visually-hidden"
        />

        <div className="workspace-sidebar-header">
          <div className="workspace-sidebar-brand">
            <button
              onClick={() => setSidebarOpen(false)}
              className="workspace-icon-button"
              title="Close sidebar"
              type="button"
            >
              <MenuIcon />
            </button>
            <span className="workspace-logo">ROSS</span>
          </div>

          <div className="workspace-sidebar-actions">
            <button
              onClick={handleUploadClick}
              className="workspace-icon-button"
              type="button"
              disabled={uploading}
              aria-label="Upload PDF"
            >
              <PlusIcon />
            </button>

            <button
              onClick={() => setSidebarOpen(false)}
              className="workspace-icon-button workspace-sidebar-close"
              type="button"
              aria-label="Close sidebar"
            >
              <CloseIcon />
            </button>
          </div>
        </div>

        <div className="workspace-search-wrap">
          <SearchIcon className="workspace-search-icon" />
          <input
            type="text"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search"
            className="workspace-search"
          />
        </div>

        <div className="workspace-document-section">
          <p className="workspace-section-label">Your Documents</p>
          {documentsError && <p className="error-banner">{documentsError}</p>}
          {documentsLoading && (
            <div className="workspace-documents-loading" role="status" aria-live="polite">
              <span className="workspace-documents-loading-spinner" aria-hidden="true" />
              <span>Loading documents...</span>
            </div>
          )}

          <ul className="workspace-document-list">
            {filteredDocuments.map((document) => (
              <li key={document.id} className="workspace-document-item">
                <div
                  className={`workspace-document-row ${
                    activeDocument?.id === document.id ? 'is-active' : ''
                  }`}
                >
                  <button
                    onClick={() => setActiveDocumentId(document.id)}
                    className="workspace-document-button"
                    type="button"
                  >
                    <span className="workspace-document-icon" aria-hidden="true">
                      <DocumentIcon />
                    </span>
                    <span className="workspace-document-name">{document.name}</span>
                    <span className="workspace-document-status-wrap">
                      <span className="workspace-document-status">
                        {formatStatusLabel(document.ingestionStatus)}
                      </span>
                      <small className="workspace-document-layout">
                        {formatLayoutStrategyLabel(document.layoutStrategy)}
                      </small>
                    </span>
                  </button>

                  <div className="workspace-document-actions">
                    <button
                      onClick={(event) => {
                        event.stopPropagation()
                        setOpenMenuId((current) => (current === document.id ? null : document.id))
                      }}
                      className="workspace-dots-button"
                      aria-label={`Open actions for ${document.name}`}
                      type="button"
                    >
                      <HorizontalDotsIcon />
                    </button>

                    {openMenuId === document.id && (
                      <div
                        className="workspace-popover"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <button
                          onClick={() => handleRenameDocument(document.id)}
                          className="workspace-popover-item"
                          type="button"
                        >
                          Rename
                        </button>
                        <button
                          onClick={() => handleDeleteDocument(document.id)}
                          className="workspace-popover-item is-danger"
                          type="button"
                          disabled={deletingId === document.id}
                        >
                          {deletingId === document.id ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="workspace-userbar">
          <div className="workspace-user-avatar">
            <UserIcon className="workspace-user-icon" size={12} />
          </div>
          <div className="workspace-user-meta">
            <span className="workspace-user-email">{user.email}</span>
            <small>{user.name}</small>
          </div>
          <div className="workspace-user-actions">
            <span className="workspace-user-initials">{getInitials(user.name)}</span>
            <button type="button" className="workspace-logout-button" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </div>
      </aside>

      {sidebarOpen && (
        <button
          type="button"
          aria-label="Resize left sidebar"
          onMouseDown={() => setResizing('left')}
          className="workspace-resizer"
        >
          <span />
        </button>
      )}

      <div className="workspace-main-wrap">
        <main className="workspace-main">
          <div className="workspace-main-header">
            {!sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(true)}
                className="workspace-icon-button"
                type="button"
              >
                <MenuIcon />
              </button>
            )}
            <span className="workspace-main-title">{activePdfTitle}</span>
          </div>

          <div className="workspace-viewer-frame">
            <div className="workspace-viewer-topbar">
              <span>PDF Viewer</span>
              <a
                href={activePdfSrc}
                download={activePdfTitle}
                className="workspace-download-link"
              >
                <ArrowDownLeftIcon />
                Download
              </a>
            </div>

            <div className="workspace-viewer-body">
              <iframe
                key={activePdfTitle}
                title={`${activePdfTitle} PDF viewer`}
                src={`${activePdfSrc}#toolbar=1&navpanes=0&scrollbar=1&view=FitH`}
                className="workspace-pdf-frame"
              />
            </div>
          </div>
        </main>

        {!summaryExpanded && (
          <button
            type="button"
            aria-label="Resize right sidebar"
            onMouseDown={() => setResizing('right')}
            className="workspace-resizer"
          >
            <span />
          </button>
        )}

        {!summaryExpanded && (
          <aside className="workspace-rightbar" style={{ width: `${rightWidth}px` }}>
            <div className="workspace-tabs">
              {tabs.map((tab, index) => (
                <button
                  key={`${tab}-${index}`}
                  onClick={() => setActiveTab(tab)}
                  className={`workspace-tab ${activeTab === tab ? 'is-active' : ''}`}
                  type="button"
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="workspace-rightbar-scroll">
              {activeTab === 'Summary' ? (
                <div className="workspace-summary-panel is-full-height">
                  <div className="workspace-summary-header">
                    <div className="workspace-summary-header-main">
                      <div className="workspace-panel-heading">
                        <span>Document Summary</span>
                      </div>
                      <div className="workspace-summary-mode-switch" role="tablist" aria-label="Summary mode">
                        {['Brief', 'Full'].map((mode) => (
                          <button
                            key={mode}
                            type="button"
                            className={`workspace-summary-mode-button ${
                              summaryMode === mode ? 'is-active' : ''
                            }`}
                            onClick={() => handleSummaryModeChange(mode)}
                          >
                            {mode}
                          </button>
                        ))}
                      </div>
                    </div>
                    <button
                      className="workspace-icon-button is-plain"
                      onClick={() => openExpandedSummary(fullSummaryCard?.id || '')}
                      type="button"
                    >
                      <ExpandIcon />
                    </button>
                  </div>

                  <div className="workspace-summary-block">
                    <button
                      onClick={() => setFullSummaryOpen(!fullSummaryOpen)}
                      className="workspace-summary-toggle"
                      type="button"
                    >
                      <span>Full Summary</span>
                      <ChevronIcon open={fullSummaryOpen} />
                    </button>

                      {fullSummaryOpen && (
                        summaryLoading ? (
                          <SummaryLoadingState />
                        ) : summaryError ? (
                          <p className="workspace-summary-copy">{summaryError}</p>
                        ) : activeDocument?.ingestionStatus !== 'indexed' ? (
                          <p className="workspace-summary-copy">
                            {`Summary tree will appear after ingestion finishes. Current status: ${activeDocument ? formatStatusLabel(activeDocument.ingestionStatus) : 'No document'}.`}
                          </p>
                        ) : (
                        <SummaryText
                          content={fullSummaryText}
                          preview
                          previewBlocks={summaryPreviewBlocks}
                          expandable={hasMoreFullSummary}
                          onExpand={() => openExpandedSummary(fullSummaryCard?.id || '')}
                        />
                        )
                      )}
                  </div>

                  <div className="workspace-subtopics-group">
                    {subTopicCards.map((topic) => (
                      <div key={topic.id} className="workspace-subtopic">
                        <button
                          onClick={() => openExpandedSummary(topic.id)}
                          className="workspace-summary-toggle"
                          type="button"
                        >
                          <span className="workspace-subtopic-title">{topic.title}</span>
                          <span className="workspace-subtopic-action">
                            <ExpandIcon />
                          </span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="workspace-chat-panel is-full-height">
                  <div className="workspace-chat-header">
                    <div className="workspace-chat-header-main">
                      <div className="workspace-chat-brandmark">
                        <BrandLayersIcon />
                      </div>
                      <div className="workspace-chat-heading-copy">
                        <span>Ross Chat</span>
                        <small>Active on this document</small>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="workspace-chat-clear"
                      onClick={handleClearChat}
                    >
                      Clear
                    </button>
                  </div>

                  <div className="workspace-chat-body">
                    <div className="workspace-chat-intro">
                      {chatMessages[chatMessages.length - 1]?.role === 'assistant'
                        ? chatMessages[chatMessages.length - 1].content
                        : 'Hey Flippy! Ask me anything about your documents.'}
                    </div>

                    {(chatError || chatLoading || chatMessages.length > 1) && (
                      <div className="workspace-chat-history">
                        {chatMessages.map((message) => (
                          <div
                            key={message.id}
                            className={`workspace-chat-row ${
                              message.role === 'assistant' ? 'is-assistant' : 'is-user'
                            }`}
                          >
                            {message.role === 'assistant' && (
                              <div className="workspace-chat-avatar">
                                <BrandLayersIcon />
                              </div>
                            )}

                            <div
                              className={`workspace-chat-message ${
                                message.role === 'assistant' ? 'is-assistant' : 'is-user'
                              }`}
                            >
                              <strong>{message.role === 'assistant' ? 'ROSS AI' : 'You'}</strong>
                              <p>{message.content}</p>
                              {!!message.citations?.length && (
                                <div className="workspace-citations">
                                  {message.citations.map((citation) => (
                                    <span key={`${message.id}-${citation.node_id}`}>
                                      {citation.page_start
                                        ? `Page ${citation.page_start}${citation.page_end && citation.page_end !== citation.page_start ? `-${citation.page_end}` : ''}`
                                        : 'Citation'}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}

                        {chatLoading && <p className="status-note">Generating grounded answer...</p>}
                        {chatError && <p className="error-banner">{chatError}</p>}
                      </div>
                    )}
                  </div>

                  <div className="workspace-chat-input-wrap">
                    <div className="workspace-chat-input">
                      <textarea
                        rows={1}
                        value={question}
                        onChange={(event) => setQuestion(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' && !event.shiftKey) {
                            event.preventDefault()
                            handleAskQuestion()
                          }
                        }}
                        placeholder="Ask about this document..."
                        disabled={activeDocument?.ingestionStatus !== 'indexed' || chatLoading}
                      />

                      <button
                        className={`workspace-send-button ${question ? 'is-active' : ''}`}
                        type="button"
                        onClick={() => handleAskQuestion()}
                        disabled={
                          !question.trim() ||
                          activeDocument?.ingestionStatus !== 'indexed' ||
                          chatLoading
                        }
                      >
                        <SendIcon />
                      </button>
                    </div>
                    <p className="workspace-chat-footnote">
                      ROSS cites clauses. Always verify with the source document.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </aside>
        )}

        {summaryVisible && (
          <section
            className={`workspace-summary-overlay ${summaryExpanded ? 'is-open' : ''}`}
          >
            <div className="workspace-summary-overlay-header">
              <span>Document Summery</span>

              <div className="workspace-summary-overlay-tabs">
                {tabs.map((tab, index) => (
                  <button
                    key={`expanded-${tab}-${index}`}
                    onClick={() => setActiveTab(tab)}
                    className={`workspace-tab ${activeTab === tab ? 'is-active' : ''}`}
                    type="button"
                  >
                    {tab}
                  </button>
                ))}
              </div>

              <button
                className="workspace-icon-button is-plain"
                onClick={() => {
                  setSummaryExpanded(false)
                  setExpandedSummaryTargetId('')
                  setSummaryMode('Brief')
                }}
                type="button"
              >
                <CloseIcon />
              </button>
            </div>

            <div className="workspace-summary-overlay-body">
              <div className="workspace-summary-overlay-card">
                <div className="workspace-summary-overlay-lead">
                  <button
                    onClick={() => setFullSummaryOpen(!fullSummaryOpen)}
                    className="workspace-summary-toggle"
                    type="button"
                  >
                    <span>Full Summery</span>
                    <ChevronIcon open={fullSummaryOpen} />
                  </button>

                  <span className="workspace-page-pill">
                    {fullSummaryCard?.pageLabel || 'Page 1 - 5'}
                  </span>
                </div>

                {fullSummaryOpen && (
                  summaryLoading ? (
                    <SummaryLoadingState expanded />
                  ) : summaryError ? (
                    <p className="workspace-summary-copy expanded">{summaryError}</p>
                  ) : activeDocument?.ingestionStatus !== 'indexed' ? (
                    <p className="workspace-summary-copy expanded">
                      {`Summary tree will appear after ingestion finishes. Current status: ${activeDocument ? formatStatusLabel(activeDocument.ingestionStatus) : 'No document'}.`}
                    </p>
                  ) : (
                    <div className="workspace-tree-root">
                      {summaryRootNodes.map((node) => (
                        <SummaryTreeNode
                          key={node.id}
                          node={node}
                          forceOpenIds={expandedSummaryOpenIds}
                        />
                      ))}
                    </div>
                  )
                )}

              </div>
            </div>
          </section>
        )}

        {uploadModalOpen && (
          <section className="workspace-upload-modal-backdrop" onClick={closeUploadModal}>
            <div
              className="workspace-upload-modal"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="workspace-upload-modal-header">
                <div>
                  <p className="workspace-upload-eyebrow">Initialize Analytics</p>
                  <h2>Declare the document architecture before ingestion.</h2>
                </div>
                <button
                  type="button"
                  className="workspace-icon-button is-plain"
                  onClick={closeUploadModal}
                  disabled={uploading}
                >
                  <CloseIcon />
                </button>
              </div>

              <p className="workspace-upload-modal-copy">
                Add one or more PDFs, give each document a working title, and choose the layout
                strategy so the chunking and RAPTOR pipeline preserve the right legal structure
                from the start.
              </p>

              <div
                className={`workspace-upload-dropzone ${uploadDragActive ? 'is-dragging' : ''}`}
                onDragOver={(event) => {
                  event.preventDefault()
                  setUploadDragActive(true)
                }}
                onDragEnter={(event) => {
                  event.preventDefault()
                  setUploadDragActive(true)
                }}
                onDragLeave={(event) => {
                  if (event.currentTarget.contains(event.relatedTarget)) {
                    return
                  }
                  setUploadDragActive(false)
                }}
                onDrop={handleUploadDrop}
              >
                <span className="workspace-upload-drop-icon">
                  <UploadTrayIcon />
                </span>
                <div className="workspace-upload-drop-copy">
                  <strong>Drag and drop PDF files here</strong>
                  <span>or add files manually into this intake workspace.</span>
                </div>
                <button
                  type="button"
                  className="workspace-modal-secondary"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  Browse files
                </button>
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
                          onClick={() => handleRemovePendingUpload(entry.id)}
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
                          onChange={(event) =>
                            handlePendingUploadNameChange(entry.id, event.target.value)
                          }
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
                <small>Apply one architecture strategy to the queued upload batch.</small>
              </div>

              <div className="workspace-layout-grid">
                {LAYOUT_STRATEGY_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`workspace-layout-card ${
                      selectedLayoutStrategy === option.value ? 'is-selected' : ''
                    }`}
                    onClick={() => setSelectedLayoutStrategy(option.value)}
                  >
                    <span className="workspace-layout-icon">{option.icon}</span>
                    <span className="workspace-layout-title">{option.title}</span>
                    <span className="workspace-layout-description">{option.description}</span>
                  </button>
                ))}
              </div>

              {uploadModalError && <p className="error-banner">{uploadModalError}</p>}

              <div className="workspace-upload-modal-actions">
                <button
                  type="button"
                  className="workspace-modal-secondary"
                  onClick={closeUploadModal}
                  disabled={uploading}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="workspace-modal-primary"
                  onClick={handleInitializeAnalytics}
                  disabled={
                    uploading ||
                    !pendingUploadFiles.length ||
                    pendingUploadFiles.some((entry) => !(entry.displayName || '').trim())
                  }
                >
                  {uploading ? 'Queueing...' : 'Initialize Analytics'}
                </button>
              </div>
            </div>
          </section>
        )}

        {ingestionTracker.open && trackedIngestionDocuments.length > 0 && (
          <section className="workspace-upload-modal-backdrop">
            <div className="workspace-upload-modal workspace-ingestion-modal">
              <div className="workspace-upload-modal-header">
                <div>
                  <p className="workspace-upload-eyebrow">Ingestion progress</p>
                  <h2>We are preparing your document workspace.</h2>
                </div>
                <button
                  type="button"
                  className="workspace-icon-button is-plain"
                  onClick={() => setIngestionTracker((current) => ({ ...current, open: false }))}
                >
                  <CloseIcon />
                </button>
              </div>

              <p className="workspace-upload-modal-copy">
                Follow each document through queueing, indexing, and summary generation while the
                background worker processes it.
              </p>

              <div className="workspace-ingestion-list">
                {trackedIngestionDocuments.map((document) => {
                  const activeStep =
                    INGESTION_STEPS.find(
                      (step) =>
                        getIngestionStepState(step.key, document.ingestionStatus) === 'current',
                    ) || null

                  return (
                    <article key={document.id} className="workspace-ingestion-card">
                      <div className="workspace-ingestion-card-head">
                        <div>
                          <span className="workspace-upload-file-label">Document</span>
                          <h3>{document.name}</h3>
                        </div>
                        <span
                          className={`workspace-ingestion-status is-${document.ingestionStatus}`}
                        >
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
                            ? 'The background ingestion pipeline reported a failure for this document.'
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
                <button
                  type="button"
                  className="workspace-modal-secondary"
                  onClick={() => setIngestionTracker((current) => ({ ...current, open: false }))}
                >
                  {ingestionComplete ? 'Close' : 'Hide and keep processing'}
                </button>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

function MenuIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <line x1="2" y1="4" x2="14" y2="4" />
      <line x1="2" y1="8" x2="14" y2="8" />
      <line x1="2" y1="12" x2="14" y2="12" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <line x1="8" y1="3" x2="8" y2="13" />
      <line x1="3" y1="8" x2="13" y2="8" />
    </svg>
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

function HorizontalDotsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
      <circle cx="4" cy="8" r="1.2" />
      <circle cx="8" cy="8" r="1.2" />
      <circle cx="12" cy="8" r="1.2" />
    </svg>
  )
}

function SearchIcon({ className }) {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className={className}
    >
      <circle cx="7" cy="7" r="4.5" />
      <line x1="10.5" y1="10.5" x2="14" y2="14" />
    </svg>
  )
}

function DocumentIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
    >
      <path d="M5 2.5h4l2.5 2.5v8A1.5 1.5 0 0 1 10 14.5H5A1.5 1.5 0 0 1 3.5 13V4A1.5 1.5 0 0 1 5 2.5Z" />
      <path d="M9 2.5V5h2.5" />
      <path d="M5.75 7.25h4.5M5.75 9.25h4.5M5.75 11.25h3" />
    </svg>
  )
}

function UserIcon({ size = 14, className }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className={className}
    >
      <circle cx="8" cy="5.5" r="2.5" />
      <path d="M3 13c0-2.76 2.24-5 5-5s5 2.24 5 5" />
    </svg>
  )
}

function ExpandIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M9 3h4v4M7 9H3v4M13 3l-5 5M3 13l5-5" />
    </svg>
  )
}

function BrandLayersIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
    </svg>
  )
}

function ChevronIcon({ open }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
    >
      <polyline points="4,6 8,10 12,6" />
    </svg>
  )
}

function ArrowDownLeftIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <line x1="16" y1="4" x2="4" y2="16" />
      <polyline points="12,16 4,16 4,8" />
    </svg>
  )
}

function ImageIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <rect x="2" y="2" width="12" height="12" rx="2" />
      <circle cx="6" cy="6" r="1.2" />
      <polyline points="2,12 5.5,8 8,10.5 10.5,8 14,12" />
    </svg>
  )
}

function CodeIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <polyline points="5,4 1,8 5,12" />
      <polyline points="11,4 15,8 11,12" />
      <line x1="9" y1="3" x2="7" y2="13" />
    </svg>
  )
}

function MicIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <rect x="5.5" y="1" width="5" height="8" rx="2.5" />
      <path d="M3 8a5 5 0 0010 0" />
      <line x1="8" y1="13" x2="8" y2="15.5" />
    </svg>
  )
}

function SendIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
    >
      <line x1="8" y1="13" x2="8" y2="3" />
      <polyline points="4,7 8,3 12,7" />
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
