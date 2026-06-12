import { useEffect, useMemo, useRef, useState } from 'react'
import RossAuth from './RossAuth'
import './App.css'
import { fetchCurrentUser, login, register } from './api/authApi'
import {
  deleteDocument as deleteDocumentRequest,
  fetchDocuments,
  fetchDocumentStatus,
  uploadDocuments,
} from './api/documentApi'
import { fetchNodeEvidence, fetchSummaryTree } from './api/summaryApi'
import WorkspaceShell from './components/workspace/WorkspaceShell'

const TOKEN_STORAGE_KEY = 'ross.gateway.token'

const EMPTY_AUTH_FORM = {
  firstName: '',
  lastName: '',
  email: '',
  firm: '',
  password: '',
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
    '(Document preview) Tj',
    '0 -24 Td',
    '(This placeholder is shown when the signed PDF URL is not available.) Tj',
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

function buildPdfUrlWithPage(pdfUrl, page) {
  if (!pdfUrl) {
    return ''
  }
  if (!page) {
    return pdfUrl
  }
  const base = pdfUrl.split('#')[0]
  return `${base}#page=${page}`
}

function findNodeById(node, nodeId) {
  if (!node) {
    return null
  }
  if (node.id === nodeId) {
    return node
  }
  for (const child of node.children || []) {
    const found = findNodeById(child, nodeId)
    if (found) {
      return found
    }
  }
  return null
}

export default function App() {
  const [authMode, setAuthMode] = useState('login')
  const [authForm, setAuthForm] = useState(EMPTY_AUTH_FORM)
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState('')
  const [token, setToken] = useState(() => window.localStorage.getItem(TOKEN_STORAGE_KEY) || '')
  const [user, setUser] = useState(null)

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
  const [selectedSummaryNode, setSelectedSummaryNode] = useState(null)
  const [selectedEvidence, setSelectedEvidence] = useState([])
  const [activePdfPage, setActivePdfPage] = useState(null)
  const [highlightBlocks, setHighlightBlocks] = useState([])
  const [rightPanelTab, setRightPanelTab] = useState('summary')
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [evidenceLoading, setEvidenceLoading] = useState(false)
  const [summaryExplorerExpanded, setSummaryExplorerExpanded] = useState(false)
  const [openMenuId, setOpenMenuId] = useState('')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  const fileInputRef = useRef(null)
  const restoringSession = Boolean(token) && !user

  const filteredDocuments = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()
    return documents.filter((document) => document.name.toLowerCase().includes(normalizedSearch))
  }, [documents, searchTerm])

  const activeDocument =
    documents.find((document) => document.id === activeDocumentId) ||
    filteredDocuments[0] ||
    null

  const activePdfTitle = withPdf(activeDocument?.name || 'Document')
  const activePdfSrc =
    activeDocument?.pdfUrl && activeDocument.mimeType === 'application/pdf'
      ? buildPdfUrlWithPage(activeDocument.pdfUrl, activePdfPage)
      : buildPdfSource(activePdfTitle)

  const trackedIngestionDocuments = ingestionTracker.documentIds
    .map((id) => documents.find((document) => document.id === id))
    .filter(Boolean)

  const ingestionComplete =
    trackedIngestionDocuments.length > 0 &&
    trackedIngestionDocuments.every((document) =>
      ['indexed', 'failed'].includes(document.ingestionStatus),
    )

  useEffect(() => {
    if (!token) {
      return
    }

    let cancelled = false

    async function bootstrap() {
      try {
        const payload = await fetchCurrentUser(token)
        if (!cancelled) {
          setUser(payload.user)
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
        const payload = await fetchDocuments(token)
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
            ...(await fetchDocumentStatus(document.id, token)),
          })),
        )

        setDocuments((current) =>
          current.map((document) => {
            const update = updates.find((entry) => entry.id === document.id)
            return update
              ? {
                  ...document,
                  ingestionStatus: update.ingestionStatus,
                  ingestionError: update.ingestionError,
                  ingestionRequestedAt: update.ingestionRequestedAt,
                  ingestionCompletedAt: update.ingestionCompletedAt,
                }
              : document
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
    setSelectedEvidence([])
    setSelectedSummaryNode(null)
    setHighlightBlocks([])
    setActivePdfPage(null)
    setRightPanelTab('summary')
    setSummaryExplorerExpanded(false)
    setSidebarCollapsed(false)

    if (!token || !activeDocument) {
      setSummaryTree(null)
      return
    }

    if (activeDocument.ingestionStatus !== 'indexed') {
      setSummaryTree(null)
      return
    }

    let cancelled = false

    async function loadSummaryTree() {
      setSummaryLoading(true)
      try {
        const payload = await fetchSummaryTree(activeDocument.id, token)
        if (cancelled) {
          return
        }
        setSummaryTree(payload)
        setSelectedSummaryNode(payload?.root || null)
      } catch (error) {
        if (!cancelled) {
          setSummaryTree(null)
          setDocumentsError((current) => current || error.message)
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
  }, [activeDocument?.id, activeDocument?.ingestionStatus, token])

  async function handleAuthSubmit(event) {
    event.preventDefault()
    setAuthLoading(true)
    setAuthError('')

    try {
      const payload =
        authMode === 'login'
          ? await login({ email: authForm.email, password: authForm.password })
          : await register({
              firstName: authForm.firstName,
              lastName: authForm.lastName,
              email: authForm.email,
              firm: authForm.firm,
              password: authForm.password,
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
    setActiveDocumentId('')
    setSummaryTree(null)
    setSelectedSummaryNode(null)
    setSelectedEvidence([])
  }

  function handleUploadClick() {
    setUploadModalOpen(true)
    setUploadModalError('')
    setOpenMenuId('')
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
    if (!files.length) {
      return
    }

    const pdfFiles = files.filter(
      (file) => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'),
    )

    if (!pdfFiles.length) {
      setUploadModalError('Only PDF files can be added to the upload queue.')
      return
    }

    setPendingUploadFiles((current) => [...current, ...createPendingUploadEntries(pdfFiles)])
    setUploadModalError('')
    setUploadModalOpen(true)
  }

  function handleUploadFileSelection(event) {
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

      const payload = await uploadDocuments({ token, formData })
      setDocuments((current) => [...payload.documents, ...current])
      setActiveDocumentId(payload.documents?.[0]?.id || '')
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
    setOpenMenuId('')
    const documentToRename = documents.find((doc) => doc.id === documentId)
    if (!documentToRename) {
      return
    }

    const nextName = window.prompt('Rename document', documentToRename.name)?.trim()
    if (!nextName) {
      return
    }

    setDocuments((current) =>
      current.map((doc) => (doc.id === documentId ? { ...doc, name: nextName } : doc)),
    )
  }

  async function handleDeleteDocument(documentId) {
    if (!token) {
      return
    }

    setOpenMenuId('')
    setDeletingId(documentId)
    setDocumentsError('')

    try {
      await deleteDocumentRequest(documentId, token)
      const remainingDocuments = documents.filter((document) => document.id !== documentId)
      setDocuments(remainingDocuments)
      if (activeDocumentId === documentId) {
        setActiveDocumentId(remainingDocuments[0]?.id || '')
      }
      setIngestionTracker((current) => ({
        ...current,
        documentIds: current.documentIds.filter((id) => id !== documentId),
      }))
    } catch (error) {
      setDocumentsError(error.message)
    } finally {
      setDeletingId('')
    }
  }

  async function handleSelectSummaryNode(node) {
    setSelectedSummaryNode(node)
    if (node?.pageStart) {
      setActivePdfPage(node.pageStart)
    }
  }

  async function loadEvidenceForNode(node) {
    if (!node || !activeDocument || !token) {
      return
    }
    setSelectedSummaryNode(node)
    if (node.pageStart) {
      setActivePdfPage(node.pageStart)
    }
    setEvidenceLoading(true)
    setRightPanelTab('summary')

    try {
      const fallbackNode = summaryTree?.root ? findNodeById(summaryTree.root, node.id) : node
      const payload = await fetchNodeEvidence(activeDocument.id, node.id, token, fallbackNode)
        setSelectedEvidence(payload.sources || [])
      setHighlightBlocks(
        (payload.sources || [])
          .filter((source) => source.bbox)
          .map((source) => ({
            page: source.pageStart || node.pageStart,
            bbox: source.bbox,
          })),
      )
    } catch (error) {
      setSelectedEvidence([])
      setDocumentsError(error.message)
    } finally {
      setEvidenceLoading(false)
    }
  }

  function handleOpenSummaryPage(node) {
    if (!node?.pageStart) {
      return
    }
    setSelectedSummaryNode(node)
    setActivePdfPage(node.pageStart)
    setHighlightBlocks([])
  }

  function handleOpenEvidenceInPdf(source) {
    if (!source?.pageStart) {
      return
    }
    setActivePdfPage(source.pageStart)
    setHighlightBlocks(
      source.bbox
        ? [
            {
              page: source.pageStart,
              bbox: source.bbox,
            },
          ]
        : [],
    )
  }

  function handleCloseEvidence() {
    setSelectedEvidence([])
    setEvidenceLoading(false)
    setHighlightBlocks([])
  }

  if (!token || !user) {
    return (
      <RossAuth
        mode={authMode}
        form={authForm}
        error={authError}
        loading={authLoading}
        restoringSession={restoringSession}
        wakeScreen={{ visible: false }}
        onModeChange={setAuthMode}
        onFieldChange={(field, value) => setAuthForm((current) => ({ ...current, [field]: value }))}
        onSubmit={handleAuthSubmit}
      />
    )
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        className="visually-hidden"
        onChange={handleUploadFileSelection}
      />

      <WorkspaceShell
        user={user}
        documents={documents}
        documentsLoading={documentsLoading}
        documentsError={documentsError}
        filteredDocuments={filteredDocuments}
        searchTerm={searchTerm}
        activeDocument={activeDocument}
        activeDocumentId={activeDocumentId}
        activePdfSrc={activePdfSrc}
        activePdfTitle={activePdfTitle}
        activePdfPage={activePdfPage}
        highlightBlocks={highlightBlocks}
        deletingId={deletingId}
        openMenuId={openMenuId}
        sidebarCollapsed={sidebarCollapsed}
        uploadModalOpen={uploadModalOpen}
        uploading={uploading}
        uploadModalError={uploadModalError}
        pendingUploadFiles={pendingUploadFiles}
        selectedLayoutStrategy={selectedLayoutStrategy}
        uploadDragActive={uploadDragActive}
        fileInputRef={fileInputRef}
        ingestionTracker={ingestionTracker}
        trackedIngestionDocuments={trackedIngestionDocuments}
        ingestionComplete={ingestionComplete}
        summaryTree={summaryTree}
        selectedSummaryNode={selectedSummaryNode}
        selectedEvidence={selectedEvidence}
        rightPanelTab={rightPanelTab}
        summaryLoading={summaryLoading}
        evidenceLoading={evidenceLoading}
        summaryExplorerExpanded={summaryExplorerExpanded}
        onSearchChange={setSearchTerm}
        onSelectDocument={setActiveDocumentId}
        onUploadClick={handleUploadClick}
        onToggleSidebarCollapsed={() => setSidebarCollapsed((current) => !current)}
        onToggleDocumentMenu={(documentId) =>
          setOpenMenuId((current) => (current === documentId ? '' : documentId))
        }
        onCloseDocumentMenu={() => setOpenMenuId('')}
        onCloseUploadModal={closeUploadModal}
        onUploadDropzoneDragOver={(event) => {
          event.preventDefault()
          setUploadDragActive(true)
        }}
        onUploadDropzoneDragEnter={(event) => {
          event.preventDefault()
          setUploadDragActive(true)
        }}
        onUploadDropzoneDragLeave={(event) => {
          if (event.currentTarget.contains(event.relatedTarget)) {
            return
          }
          setUploadDragActive(false)
        }}
        onUploadDrop={handleUploadDrop}
        onPendingUploadNameChange={handlePendingUploadNameChange}
        onRemovePendingUpload={handleRemovePendingUpload}
        onSelectLayoutStrategy={setSelectedLayoutStrategy}
        onInitializeAnalytics={handleInitializeAnalytics}
        onRenameDocument={handleRenameDocument}
        onDeleteDocument={handleDeleteDocument}
        onLogout={handleLogout}
        onCloseIngestionTracker={() => setIngestionTracker((current) => ({ ...current, open: false }))}
        onTabChange={(tab) => {
          setRightPanelTab(tab)
          if (tab === 'tree') {
            setSummaryExplorerExpanded(true)
            setSidebarCollapsed(true)
          }
        }}
        onSelectSummaryNode={handleSelectSummaryNode}
        onViewSources={loadEvidenceForNode}
        onOpenSummaryPage={handleOpenSummaryPage}
        onOpenEvidenceInPdf={handleOpenEvidenceInPdf}
        onCloseEvidence={handleCloseEvidence}
        onToggleSummaryExplorerExpanded={() => {
          setSummaryExplorerExpanded((current) => {
            const next = !current
            setSidebarCollapsed(next)
            return next
          })
          setOpenMenuId('')
        }}
      />
    </>
  )
}
