import { useEffect, useRef } from 'react'

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
  const labels = {
    ADVERSARIAL: 'Adversarial & Disputed Records',
    HIERARCHICAL: 'Statutory & Codified Frameworks',
    TRANSACTIONAL: 'Linear & Contractual Instruments',
  }
  return labels[layoutStrategy] || labels.TRANSACTIONAL
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

export default function DocumentSidebar({
  user,
  documents,
  documentsLoading,
  filteredDocuments,
  searchTerm,
  activeDocumentId,
  deletingId,
  openMenuId,
  documentsError,
  collapsed = false,
  onSearchChange,
  onSelectDocument,
  onUploadClick,
  onToggleCollapsed,
  onToggleMenu,
  onCloseMenu,
  onRenameDocument,
  onDeleteDocument,
  onLogout,
}) {
  const sidebarRef = useRef(null)

  useEffect(() => {
    function handlePointerDown(event) {
      if (!openMenuId || !sidebarRef.current) {
        return
      }
      if (!sidebarRef.current.contains(event.target)) {
        onCloseMenu()
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
    }
  }, [openMenuId, onCloseMenu])

  if (collapsed) {
    return (
      <aside className="workspace-sidebar trace-workspace-sidebar is-collapsed-rail" ref={sidebarRef}>
        <div className="workspace-collapsed-rail-top">
          <button
            type="button"
            className="workspace-collapsed-toggle"
            onClick={onToggleCollapsed}
            aria-label="Open documents sidebar"
          >
            <MenuIcon />
          </button>
        </div>
      </aside>
    )
  }

  return (
    <aside className="workspace-sidebar trace-workspace-sidebar" ref={sidebarRef}>
      <div className="workspace-sidebar-header">
        <div className="workspace-sidebar-brand workspace-sidebar-brand-row">
          <button
            type="button"
            className="workspace-header-icon-button"
            onClick={onToggleCollapsed}
            aria-label="Collapse documents sidebar"
          >
            <MenuIcon />
          </button>
          <span className="workspace-logo">ROSS</span>
        </div>
        <div className="workspace-sidebar-actions">
          <button
            type="button"
            className="workspace-header-icon-button"
            onClick={onUploadClick}
            aria-label="Add document"
          >
            <PlusIcon />
          </button>
          <button
            type="button"
            className="workspace-header-icon-button"
            onClick={onToggleCollapsed}
            aria-label="Collapse documents sidebar"
          >
            <CloseIcon />
          </button>
        </div>
      </div>

      <div className="workspace-search-wrap">
        <SearchIcon className="workspace-search-icon" />
        <input
          type="search"
          className="workspace-search"
          placeholder="Search documents"
          value={searchTerm}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </div>

      <div className="workspace-document-section">
        <p className="workspace-section-label">Your Documents</p>

        {documentsLoading && (
          <div className="workspace-documents-loading">
            <span className="workspace-documents-loading-spinner" />
            <span>Loading documents...</span>
          </div>
        )}

        <ul className="workspace-document-list">
          {filteredDocuments.map((document) => {
            const isActive = activeDocumentId === document.id
            return (
              <li key={document.id} className="workspace-document-item">
                <div className={`workspace-document-row ${isActive ? 'is-active' : ''}`}>
                  <button
                    type="button"
                    className="workspace-document-button"
                    onClick={() => onSelectDocument(document.id)}
                  >
                    <span className="workspace-document-icon">
                      <DocumentIcon />
                    </span>
                    <span className="workspace-document-name">{document.name}</span>
                    <span className="workspace-document-status-wrap">
                      <span className="workspace-document-status">
                        {formatStatusLabel(document.ingestionStatus)}
                      </span>
                      <span className="workspace-document-layout">
                        {formatLayoutStrategyLabel(document.layoutStrategy)}
                      </span>
                    </span>
                  </button>

                  <div className="workspace-document-actions">
                    <button
                      type="button"
                      className="workspace-dots-button"
                      onClick={() => onToggleMenu(document.id)}
                      aria-label={`Open actions for ${document.name}`}
                    >
                      <DotsIcon />
                    </button>

                    {openMenuId === document.id ? (
                      <div className="workspace-popover">
                        <button
                          type="button"
                          className="workspace-popover-item"
                          onClick={() => onRenameDocument(document.id)}
                        >
                          Rename
                        </button>
                        <button
                          type="button"
                          className="workspace-popover-item is-danger"
                          onClick={() => onDeleteDocument(document.id)}
                          disabled={deletingId === document.id}
                        >
                          {deletingId === document.id ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>

        {!documentsLoading && !filteredDocuments.length && (
          <div className="workspace-sidebar-note">
            {documents.length ? 'No matching documents found.' : 'No documents uploaded yet.'}
          </div>
        )}

        {documentsError && <p className="error-banner workspace-sidebar-error">{documentsError}</p>}
      </div>

      <div className="workspace-sidebar-footer">
        <button
          type="button"
          className="workspace-add-document-button"
          onClick={onUploadClick}
        >
          <PlusIcon />
          <span>Add document</span>
        </button>
      </div>

      <div className="workspace-userbar">
        <div className="workspace-user-avatar">
          <span className="workspace-user-initials">
            {getInitials(`${user.firstName || ''} ${user.lastName || ''}`)}
          </span>
        </div>
        <div className="workspace-user-meta">
          <span className="workspace-user-email">{user.email}</span>
          <small>{user.firm || 'ROSS workspace'}</small>
        </div>
        <div className="workspace-user-actions">
          <button type="button" className="workspace-logout-button" onClick={onLogout}>
            Log out
          </button>
        </div>
      </div>
    </aside>
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

function DotsIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
    >
      <circle cx="3.25" cy="8" r="1.1" />
      <circle cx="8" cy="8" r="1.1" />
      <circle cx="12.75" cy="8" r="1.1" />
    </svg>
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
      strokeLinecap="round"
    >
      <line x1="2.5" y1="4" x2="13.5" y2="4" />
      <line x1="2.5" y1="8" x2="13.5" y2="8" />
      <line x1="2.5" y1="12" x2="13.5" y2="12" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    >
      <line x1="4" y1="4" x2="12" y2="12" />
      <line x1="12" y1="4" x2="4" y2="12" />
    </svg>
  )
}
