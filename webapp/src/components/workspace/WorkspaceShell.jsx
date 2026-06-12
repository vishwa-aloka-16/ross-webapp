import { useEffect, useRef, useState } from 'react'
import DocumentSidebar from './DocumentSidebar'
import PdfViewerPanel from './PdfViewerPanel'
import RightInsightPanel from './RightInsightPanel'
import UploadModal from '../upload/UploadModal'
import IngestionProgressModal from '../upload/IngestionProgressModal'

export default function WorkspaceShell(props) {
  const {
    user,
    documents,
    documentsLoading,
    documentsError,
    filteredDocuments,
    searchTerm,
    activeDocument,
    activeDocumentId,
    activePdfSrc,
    activePdfTitle,
    activePdfPage,
    highlightBlocks,
    deletingId,
    openMenuId,
    sidebarCollapsed,
    uploadModalOpen,
    uploading,
    uploadModalError,
    pendingUploadFiles,
    selectedLayoutStrategy,
    uploadDragActive,
    fileInputRef,
    ingestionTracker,
    trackedIngestionDocuments,
    ingestionComplete,
    summaryTree,
    selectedSummaryNode,
    selectedEvidence,
    rightPanelTab,
    summaryLoading,
    evidenceLoading,
    summaryExplorerExpanded,
    onSearchChange,
    onSelectDocument,
    onUploadClick,
    onToggleSidebarCollapsed,
    onToggleDocumentMenu,
    onCloseDocumentMenu,
    onCloseUploadModal,
    onUploadDropzoneDragOver,
    onUploadDropzoneDragEnter,
    onUploadDropzoneDragLeave,
    onUploadDrop,
    onPendingUploadNameChange,
    onRemovePendingUpload,
    onSelectLayoutStrategy,
    onInitializeAnalytics,
    onRenameDocument,
    onDeleteDocument,
    onLogout,
    onCloseIngestionTracker,
    onTabChange,
    onSelectSummaryNode,
    onViewSources,
    onOpenSummaryPage,
    onOpenEvidenceInPdf,
    onCloseEvidence,
    onToggleSummaryExplorerExpanded,
  } = props

  const mainRef = useRef(null)
  const isDraggingRef = useRef(false)
  const [expandedSplit, setExpandedSplit] = useState(50)

  useEffect(() => {
    if (!summaryExplorerExpanded) {
      isDraggingRef.current = false
      return undefined
    }

    function handlePointerMove(event) {
      if (!isDraggingRef.current || !mainRef.current) {
        return
      }

      const bounds = mainRef.current.getBoundingClientRect()
      const nextSplit = ((event.clientX - bounds.left) / bounds.width) * 100
      const clampedSplit = Math.min(70, Math.max(30, nextSplit))
      setExpandedSplit(clampedSplit)
    }

    function handlePointerUp() {
      isDraggingRef.current = false
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [summaryExplorerExpanded])

  const mainStyle = summaryExplorerExpanded
    ? {
        gridTemplateColumns: `minmax(0, ${expandedSplit}fr) 0.75rem minmax(0, ${100 - expandedSplit}fr)`,
      }
    : undefined

  return (
    <div
      className={`workspace-shell trace-workspace-shell ${
        summaryExplorerExpanded ? 'is-summary-expanded' : ''
      }`}
    >
      <DocumentSidebar
        user={user}
        documents={documents}
        documentsLoading={documentsLoading}
        filteredDocuments={filteredDocuments}
        searchTerm={searchTerm}
        activeDocumentId={activeDocumentId}
        deletingId={deletingId}
        openMenuId={openMenuId}
        documentsError={documentsError}
        collapsed={sidebarCollapsed}
        onSearchChange={onSearchChange}
        onSelectDocument={onSelectDocument}
        onUploadClick={onUploadClick}
        onToggleCollapsed={onToggleSidebarCollapsed}
        onToggleMenu={onToggleDocumentMenu}
        onCloseMenu={onCloseDocumentMenu}
        onRenameDocument={onRenameDocument}
        onDeleteDocument={onDeleteDocument}
        onLogout={onLogout}
      />

      <main className="trace-workspace-main" ref={mainRef} style={mainStyle}>
        <PdfViewerPanel
          activeDocument={activeDocument}
          activePdfSrc={activePdfSrc}
          activePdfTitle={activePdfTitle}
          activePdfPage={activePdfPage}
          highlightBlocks={highlightBlocks}
          onUploadClick={onUploadClick}
        />

        {summaryExplorerExpanded ? (
          <button
            type="button"
            className="workspace-splitter"
            aria-label="Resize PDF and summary panels"
            onPointerDown={() => {
              isDraggingRef.current = true
            }}
          >
            <span />
          </button>
        ) : null}

        <RightInsightPanel
          activeDocument={activeDocument}
          summaryTree={summaryTree}
          selectedSummaryNode={selectedSummaryNode}
          selectedEvidence={selectedEvidence}
          rightPanelTab={rightPanelTab}
          summaryLoading={summaryLoading}
          evidenceLoading={evidenceLoading}
          onTabChange={onTabChange}
          onSelectNode={onSelectSummaryNode}
          onViewSources={onViewSources}
          onOpenPage={onOpenSummaryPage}
          onOpenEvidence={onOpenEvidenceInPdf}
          onCloseEvidence={onCloseEvidence}
          onToggleExpanded={onToggleSummaryExplorerExpanded}
          isExpanded={summaryExplorerExpanded}
        />
      </main>

      <UploadModal
        open={uploadModalOpen}
        uploading={uploading}
        uploadModalError={uploadModalError}
        pendingUploadFiles={pendingUploadFiles}
        selectedLayoutStrategy={selectedLayoutStrategy}
        uploadDragActive={uploadDragActive}
        fileInputRef={fileInputRef}
        onClose={onCloseUploadModal}
        onDropzoneDragOver={onUploadDropzoneDragOver}
        onDropzoneDragEnter={onUploadDropzoneDragEnter}
        onDropzoneDragLeave={onUploadDropzoneDragLeave}
        onDrop={onUploadDrop}
        onNameChange={onPendingUploadNameChange}
        onRemove={onRemovePendingUpload}
        onSelectLayoutStrategy={onSelectLayoutStrategy}
        onSubmit={onInitializeAnalytics}
      />

      <IngestionProgressModal
        open={ingestionTracker.open}
        trackedDocuments={trackedIngestionDocuments}
        ingestionComplete={ingestionComplete}
        onClose={onCloseIngestionTracker}
      />
    </div>
  )
}
