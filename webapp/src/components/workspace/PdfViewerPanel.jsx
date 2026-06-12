import { useEffect, useMemo, useRef, useState } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/TextLayer.css'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import EmptyState from '../common/EmptyState'
import Spinner from '../common/Spinner'

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

function normalizeBbox(rawBbox) {
  if (!rawBbox) {
    return null
  }

  const left = rawBbox.left ?? rawBbox.x0 ?? rawBbox.x ?? 0
  const top = rawBbox.top ?? rawBbox.y0 ?? rawBbox.y ?? 0
  const right = rawBbox.right ?? rawBbox.x1 ?? left
  const bottom = rawBbox.bottom ?? rawBbox.y1 ?? top

  if (Number.isNaN(left) || Number.isNaN(top) || Number.isNaN(right) || Number.isNaN(bottom)) {
    return null
  }

  return { left, top, right, bottom }
}

export default function PdfViewerPanel({
  activeDocument,
  activePdfSrc,
  activePdfTitle,
  activePdfPage,
  highlightBlocks,
  onUploadClick,
}) {
  const containerRef = useRef(null)
  const pageRefs = useRef({})
  const pageMetricsRef = useRef({})
  const [numPages, setNumPages] = useState(0)
  const [viewerWidth, setViewerWidth] = useState(860)
  const [pdfLoadError, setPdfLoadError] = useState('')

  const pdfFile = useMemo(() => {
    if (!activeDocument) {
      return null
    }
    if (activeDocument?.pdfUrl && activeDocument.mimeType === 'application/pdf') {
      return activeDocument.pdfUrl.split('#')[0]
    }
    return activePdfSrc
  }, [activeDocument, activePdfSrc])

  useEffect(() => {
    function updateWidth() {
      const nextWidth = containerRef.current?.clientWidth || 860
      setViewerWidth(Math.max(320, Math.floor(nextWidth - 32)))
    }

    updateWidth()

    if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
      const observer = new ResizeObserver(() => updateWidth())
      observer.observe(containerRef.current)
      return () => observer.disconnect()
    }

    window.addEventListener('resize', updateWidth)
    return () => window.removeEventListener('resize', updateWidth)
  }, [])

  useEffect(() => {
    if (!activeDocument) {
      return
    }

    const targetPage = activePdfPage
    if (!targetPage) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      const pageElement = pageRefs.current[targetPage]
      const scrollContainer = containerRef.current

      if (!pageElement || !scrollContainer) {
        return
      }

      const highlightEntry = (highlightBlocks || []).find((entry) => entry.page === targetPage)
      const normalizedBbox = normalizeBbox(highlightEntry?.bbox)

      if (!normalizedBbox) {
        pageElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
        return
      }

      const metrics = pageMetricsRef.current[targetPage]
      const originalHeight = metrics?.height || 1
      const renderedHeight = pageElement.clientHeight || 1
      const centerY = (normalizedBbox.top + normalizedBbox.bottom) / 2
      const ratio = Math.min(1, Math.max(0, centerY / originalHeight))
      const targetScrollTop =
        pageElement.offsetTop + renderedHeight * ratio - scrollContainer.clientHeight / 2

      scrollContainer.scrollTo({
        top: Math.max(0, targetScrollTop),
        behavior: 'smooth',
      })
    }, 160)

    return () => window.clearTimeout(timeoutId)
  }, [activeDocument?.id, activePdfPage, highlightBlocks, numPages])

  function renderHighlight(pageNumber) {
    const entry = (highlightBlocks || []).find((item) => item.page === pageNumber)
    const bbox = normalizeBbox(entry?.bbox)
    const metrics = pageMetricsRef.current[pageNumber]

    if (!bbox || !metrics) {
      return null
    }

    const width = metrics.width || 1
    const height = metrics.height || 1
    const overlayStyle = {
      left: `${(bbox.left / width) * 100}%`,
      top: `${(bbox.top / height) * 100}%`,
      width: `${((bbox.right - bbox.left) / width) * 100}%`,
      height: `${((bbox.bottom - bbox.top) / height) * 100}%`,
    }

    return <div className="workspace-pdf-highlight" style={overlayStyle} />
  }

  return (
    <section className="workspace-viewer-shell">
      <header className="workspace-main-header trace-viewer-header">
        <div className="trace-viewer-title-wrap">
          <div className="workspace-main-title">
            {activeDocument?.name || 'Document workspace'}
          </div>
          <p className="trace-viewer-subtitle">
            Original PDF stays visible while summaries and evidence remain traceable.
          </p>
        </div>
        {activeDocument && (
          <div className="trace-viewer-actions">
            <span className={`workspace-ingestion-status is-${activeDocument.ingestionStatus}`}>
              {formatStatusLabel(activeDocument.ingestionStatus)}
            </span>
            {activePdfPage ? (
              <span className="pdf-page-jump">Jumped to page {activePdfPage}</span>
            ) : null}
            {highlightBlocks?.length ? (
              <span className="source-chip">Evidence highlight active</span>
            ) : null}
          </div>
        )}
      </header>

      <div className="workspace-viewer-frame trace-viewer-frame">
        <div className="workspace-viewer-topbar">
          <span>Document Viewer</span>
          <div className="trace-viewer-topbar-actions">
            {activeDocument?.layoutStrategy ? (
              <span className="source-chip">{activeDocument.layoutStrategy}</span>
            ) : null}
            {activeDocument?.pdfUrl && (
              <a
                className="workspace-download-link"
                href={activeDocument.pdfUrl}
                target="_blank"
                rel="noreferrer"
              >
                Open PDF
              </a>
            )}
          </div>
        </div>

        {activeDocument ? (
          <div ref={containerRef} className="workspace-viewer-body workspace-pdf-scroll-container">
            {pdfLoadError ? (
              <EmptyState
                title="Unable to render PDF inline"
                message={pdfLoadError}
                action={
                  activeDocument?.pdfUrl ? (
                    <a
                      className="workspace-modal-primary workspace-pdf-fallback-link"
                      href={activeDocument.pdfUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open PDF
                    </a>
                  ) : null
                }
              />
            ) : (
              <Document
                file={pdfFile}
                loading={<Spinner label="Loading PDF..." />}
                onLoadSuccess={({ numPages: loadedPages }) => {
                  setPdfLoadError('')
                  setNumPages(loadedPages)
                }}
                onLoadError={(error) => {
                  setPdfLoadError(error?.message || 'Failed to load this PDF in the embedded viewer.')
                }}
                className="workspace-pdf-document"
              >
                {Array.from(new Array(numPages), (_entry, index) => {
                  const pageNumber = index + 1
                  return (
                    <div
                      key={pageNumber}
                      ref={(element) => {
                        pageRefs.current[pageNumber] = element
                      }}
                      className={`workspace-pdf-page-shell ${
                        activePdfPage === pageNumber ? 'is-active-page' : ''
                      }`}
                    >
                      <div className="workspace-pdf-page-label">Page {pageNumber}</div>
                      <div className="workspace-pdf-page-inner">
                        <Page
                          pageNumber={pageNumber}
                          width={viewerWidth}
                          renderAnnotationLayer
                          renderTextLayer
                          onLoadSuccess={(page) => {
                            const viewport = page.getViewport({ scale: 1 })
                            pageMetricsRef.current[pageNumber] = {
                              width: viewport.width,
                              height: viewport.height,
                            }
                          }}
                        />
                        {renderHighlight(pageNumber)}
                      </div>
                    </div>
                  )
                })}
              </Document>
            )}
          </div>
        ) : (
          <EmptyState
            title="No document selected"
            message="Upload a PDF to start the summary workspace, or select an existing document from the sidebar."
            action={
              <button type="button" className="workspace-modal-primary" onClick={onUploadClick}>
                Upload Documents
              </button>
            }
          />
        )}
      </div>
    </section>
  )
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
