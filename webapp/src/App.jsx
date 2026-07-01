import { useEffect, useMemo, useRef, useState } from 'react'
import RossAuth from './RossAuth'
import RossLandingPage from './RossLandingPage'
import './App.css'
import { fetchCurrentUser, loginFinish, loginInit, register as registerRequest } from './api/authApi'
import {
  createProcessingGrant,
  deleteDocument as deleteDocumentRequest,
  fetchDocuments,
  fetchDocumentStatus,
  fetchProcessingPublicKey,
  startProcessing,
  uploadDocuments,
} from './api/documentApi'
import { fetchNodeEvidence, fetchSummaryTree } from './api/summaryApi'
import WorkspaceShell from './components/workspace/WorkspaceShell'
import {
  createRegistrationMaterial,
  createLoginMaterial,
  createObjectUrl,
  decryptArtifactText,
  decryptPdfBuffer,
  encryptDocument,
  encryptSessionDekForProcessing,
  revokeObjectUrl,
  unwrapDocumentKey,
} from './utils/crypto'

const TOKEN_STORAGE_KEY = 'ross.gateway.token'

const EMPTY_AUTH_FORM = {
  firstName: '',
  lastName: '',
  email: '',
  firm: '',
  password: '',
  phone: '',
  message: '',
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

function titleFromContent(content = '') {
  const firstLine = content
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean)
  return firstLine || 'Summary'
}

async function decryptSummaryNode(node, dekBytes) {
  if (!node) {
    return null
  }

  const content =
    node.encryptedContent && node.contentIv
      ? await decryptArtifactText(node.encryptedContent, node.contentIv, dekBytes)
      : node.content || ''

  const children = []
  for (const child of node.children || []) {
    children.push(await decryptSummaryNode(child, dekBytes))
  }

  return {
    ...node,
    content,
    title:
      node.title && node.title !== 'Summary' && node.title !== 'Document Summary'
        ? node.title
        : titleFromContent(content),
    children,
  }
}

export default function App() {
  const [entryScreen, setEntryScreen] = useState('landing')
  const [authMode, setAuthMode] = useState('login')
  const [authForm, setAuthForm] = useState(EMPTY_AUTH_FORM)
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState('')
  const [token, setToken] = useState(() => window.localStorage.getItem(TOKEN_STORAGE_KEY) || '')
  const [user, setUser] = useState(null)
  const [cryptoSession, setCryptoSession] = useState(null)

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
  const [decryptedPdfUrl, setDecryptedPdfUrl] = useState('')

  const fileInputRef = useRef(null)
  const documentKeysRef = useRef(new Map())
  const restoringSession = Boolean(token) && !user && Boolean(cryptoSession?.wrappingKey)

  const filteredDocuments = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()
    return documents.filter((document) => document.name.toLowerCase().includes(normalizedSearch))
  }, [documents, searchTerm])

  const activeDocument =
    documents.find((document) => document.id === activeDocumentId) ||
    filteredDocuments[0] ||
    null

  const activePdfTitle = withPdf(activeDocument?.name || 'Document')
  const activePdfSrc = decryptedPdfUrl || buildPdfSource(activePdfTitle)

  const trackedIngestionDocuments = ingestionTracker.documentIds
    .map((id) => documents.find((document) => document.id === id))
    .filter(Boolean)

  const ingestionComplete =
    trackedIngestionDocuments.length > 0 &&
    trackedIngestionDocuments.every((document) =>
      ['indexed', 'failed'].includes(document.ingestionStatus),
    )

  useEffect(() => {
    if (token && user) {
      document.title = 'ROSS Workspace'
      return
    }

    if (entryScreen === 'auth') {
      document.title = 'ROSS Legal Intelligence Platform | Sign In'
      return
    }

    document.title = 'ROSS Legal Intelligence Platform'
  }, [entryScreen, token, user])

  useEffect(() => {
    if (!token) {
      return
    }

    if (!cryptoSession?.wrappingKey) {
      window.localStorage.removeItem(TOKEN_STORAGE_KEY)
      setToken('')
      setUser(null)
      setDocuments([])
      setAuthError('Please sign in again to restore your encryption session.')
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
  }, [cryptoSession, token])

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

  useEffect(
    () => () => {
      revokeObjectUrl(decryptedPdfUrl)
    },
    [decryptedPdfUrl],
  )

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
    let cancelled = false

    async function loadDecryptedPdf() {
      if (!activeDocument?.pdfUrl || !activeDocument?.storageEncryption?.fileIv || !cryptoSession?.wrappingKey) {
        setDecryptedPdfUrl('')
        return
      }

      try {
        let dekBytes = documentKeysRef.current.get(activeDocument.id)
        if (!dekBytes) {
          dekBytes = await unwrapDocumentKey(activeDocument.storageEncryption, cryptoSession.wrappingKey)
          documentKeysRef.current.set(activeDocument.id, dekBytes)
        }

        const response = await fetch(activeDocument.pdfUrl)
        const encryptedBuffer = await response.arrayBuffer()
        const decryptedBuffer = await decryptPdfBuffer(
          encryptedBuffer,
          activeDocument.storageEncryption.fileIv,
          dekBytes,
        )
        if (cancelled) {
          return
        }
        setDecryptedPdfUrl((current) => {
          revokeObjectUrl(current)
          return createObjectUrl(decryptedBuffer, activeDocument.storageEncryption.originalMimeType || 'application/pdf')
        })
      } catch (error) {
        if (!cancelled) {
          setDecryptedPdfUrl('')
          setDocumentsError((current) => current || error.message || 'Failed to decrypt PDF.')
        }
      }
    }

    loadDecryptedPdf()

    return () => {
      cancelled = true
    }
  }, [activeDocument?.id, activeDocument?.pdfUrl, activeDocument?.storageEncryption, cryptoSession])

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
        let dekBytes = documentKeysRef.current.get(activeDocument.id)
        if (!dekBytes) {
          dekBytes = await unwrapDocumentKey(activeDocument.storageEncryption, cryptoSession.wrappingKey)
          documentKeysRef.current.set(activeDocument.id, dekBytes)
        }
        const payload = await fetchSummaryTree(activeDocument.id, token)
        const decryptedRoot = await decryptSummaryNode(payload?.root || null, dekBytes)
        if (cancelled) {
          return
        }
        setSummaryTree(payload ? { ...payload, root: decryptedRoot } : null)
        setSelectedSummaryNode(decryptedRoot || null)
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
  }, [activeDocument?.id, activeDocument?.ingestionStatus, cryptoSession, token])

  async function handleAuthSubmit(event) {
    event.preventDefault()
    setAuthLoading(true)
    setAuthError('')

    try {
      const initPayload = await loginInit({ email: authForm.email })
      const loginMaterial = await createLoginMaterial({
        password: authForm.password,
        email: authForm.email,
        challengeId: initPayload.challengeId,
        serverNonce: initPayload.serverNonce,
        authSalt: initPayload.authSalt,
        kdfParams: initPayload.kdfParams,
        keyVersion: initPayload.keyVersion,
      })
      const payload = await loginFinish({
        email: authForm.email,
        challengeId: initPayload.challengeId,
        clientNonce: loginMaterial.clientNonce,
        clientProof: loginMaterial.clientProof,
      })

      if (payload.serverProof !== loginMaterial.expectedServerProof) {
        throw new Error('Server proof verification failed.')
      }

      setCryptoSession({
        wrappingKey: loginMaterial.wrappingKey,
        keyVersion: loginMaterial.keyVersion,
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

  async function handleRegisterSubmit(event) {
    event.preventDefault()
    setAuthLoading(true)
    setAuthError('')

    try {
      if (!authForm.firstName || !authForm.lastName || !authForm.email || !authForm.firm || !authForm.password) {
        throw new Error('First name, last name, work email, firm, and password are required.')
      }

      if (authForm.password.length < 10) {
        throw new Error('Password must be at least 10 characters long.')
      }

      const registrationMaterial = await createRegistrationMaterial(authForm.password)
      const payload = await registerRequest({
        firstName: authForm.firstName,
        lastName: authForm.lastName,
        email: authForm.email,
        firm: authForm.firm,
        authSalt: registrationMaterial.authSalt,
        authVerifier: registrationMaterial.authVerifier,
        kdfAlgorithm: registrationMaterial.kdfAlgorithm,
        kdfParams: registrationMaterial.kdfParams,
        keyVersion: registrationMaterial.keyVersion,
      })

      setCryptoSession({
        wrappingKey: registrationMaterial.wrappingKey,
        keyVersion: registrationMaterial.keyVersion,
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
    revokeObjectUrl(decryptedPdfUrl)
    setToken('')
    setUser(null)
    setCryptoSession(null)
    setDocuments([])
    setActiveDocumentId('')
    setSummaryTree(null)
    setSelectedSummaryNode(null)
    setSelectedEvidence([])
    setDecryptedPdfUrl('')
    documentKeysRef.current = new Map()
  }

  function handleDemoRequestSubmit(event) {
    event.preventDefault()
    setAuthError('')

    const fullName = `${authForm.firstName} ${authForm.lastName}`.trim()
    const subject = `ROSS demo request from ${fullName || authForm.email || 'website visitor'}`
    const body = [
      'Hello,',
      '',
      'I would like to request a demo of ROSS.',
      '',
      `Name: ${fullName || 'Not provided'}`,
      `Email: ${authForm.email || 'Not provided'}`,
      `Phone: ${authForm.phone || 'Not provided'}`,
      `Firm / Organisation: ${authForm.firm || 'Not provided'}`,
      '',
      'Notes:',
      authForm.message?.trim() || 'No additional details provided.',
    ].join('\n')

    const mailtoUrl = `mailto:vishwaaloka16@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    window.location.href = mailtoUrl
  }

  function handleResetPasswordSubmit(event) {
    event.preventDefault()
    setAuthError('')

    const fullName = `${authForm.firstName} ${authForm.lastName}`.trim()
    const subject = `ROSS password reset request from ${authForm.email || fullName || 'website visitor'}`
    const body = [
      'Hello,',
      '',
      'I would like to reset my ROSS password.',
      '',
      `Name: ${fullName || 'Not provided'}`,
      `Email: ${authForm.email || 'Not provided'}`,
      `Phone: ${authForm.phone || 'Not provided'}`,
      '',
      'Notes:',
      authForm.message?.trim() || 'Please help me reset my password.',
    ].join('\n')

    const mailtoUrl = `mailto:vishwaaloka16@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    window.location.href = mailtoUrl
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
    if (!pendingUploadFiles.length || !token || !cryptoSession?.wrappingKey) {
      return
    }

    setUploading(true)
    setDocumentsError('')
    setUploadModalError('')

    try {
      const processingKeyPayload = await fetchProcessingPublicKey(token)
      const encryptedUploads = []
      const formData = new FormData()
      for (const entry of pendingUploadFiles) {
        const normalizedName = withPdf((entry.displayName || '').trim() || entry.file.name)
        const uploadFile =
          normalizedName === entry.file.name
            ? entry.file
            : new File([entry.file], normalizedName, {
                type: entry.file.type || 'application/pdf',
                lastModified: entry.file.lastModified,
              })
        const encrypted = await encryptDocument(uploadFile, cryptoSession.wrappingKey, cryptoSession.keyVersion)
        encryptedUploads.push({
          originalName: normalizedName,
          ...encrypted,
        })
        formData.append(
          'documents',
          new File([encrypted.encryptedFileBlob], `${normalizedName}.enc`, {
            type: 'application/octet-stream',
          }),
        )
      }
      formData.append(
        'cryptoMetadata',
        JSON.stringify(
          encryptedUploads.map((entry) => ({
            originalName: entry.originalName,
            wrappedDek: entry.wrappedDek,
            fileIv: entry.fileIv,
            wrapIv: entry.wrapIv,
            cryptoVersion: entry.cryptoVersion,
            contentLength: entry.contentLength,
            contentSha256: entry.contentSha256,
            mimeType: entry.mimeType,
            keyVersion: entry.keyVersion,
          })),
        ),
      )
      formData.append('layoutStrategy', selectedLayoutStrategy)

      const payload = await uploadDocuments({ token, formData })
      await Promise.all(
        (payload.documents || []).map(async (document, index) => {
          const encrypted = encryptedUploads[index]
          if (!encrypted) {
            return
          }
          documentKeysRef.current.set(document.id, encrypted.dekBytes)
          const grantPayload = await createProcessingGrant(document.id, token)
          const encryptedSessionDek = await encryptSessionDekForProcessing(
            encrypted.dekBase64,
            processingKeyPayload.publicKeyPem,
          )
          await startProcessing({
            documentId: document.id,
            token,
            encryptedSessionDek,
            processingGrant: grantPayload.processingGrant,
          })
        }),
      )
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
      documentKeysRef.current.delete(documentId)
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
    if (entryScreen === 'landing') {
      return (
        <RossLandingPage
          onSignIn={() => {
            setAuthMode('login')
            setEntryScreen('auth')
          }}
          onGetStarted={() => {
            setAuthMode('demo')
            setEntryScreen('auth')
          }}
        />
      )
    }

    return (
      <RossAuth
        mode={authMode}
        form={authForm}
        error={authError}
        loading={authLoading}
        restoringSession={restoringSession}
        wakeScreen={{ visible: false }}
        onBackToLanding={() => setEntryScreen('landing')}
        onModeChange={(mode) => {
          setAuthMode(mode)
          setEntryScreen('auth')
        }}
        onFieldChange={(field, value) => setAuthForm((current) => ({ ...current, [field]: value }))}
        onSubmit={handleAuthSubmit}
        onRegisterSubmit={handleRegisterSubmit}
        onDemoRequestSubmit={handleDemoRequestSubmit}
        onResetPasswordSubmit={handleResetPasswordSubmit}
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
