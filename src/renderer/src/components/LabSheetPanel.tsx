import { useEffect, useMemo, useRef, useState } from 'react'
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist'
import { loadDocument } from '../pdf/ingest'
import { userFacingPdfError } from '../pdf/pdfjs'

interface Match {
  page: number
  left: number
  top: number
  width: number
  height: number
  pageWidth: number
  pageHeight: number
}

export function LabSheetPanel({ filePath, onClose }: { filePath: string; onClose: () => void }) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null)
  const [query, setQuery] = useState('')
  const [matches, setMatches] = useState<Match[]>([])
  const [active, setActive] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const pagesRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelled = false
    loadDocument(filePath)
      .then((loaded) => {
        if (!cancelled) setDoc(loaded)
      })
      .catch((err) => {
        if (!cancelled) setError(userFacingPdfError(err))
      })
    return () => {
      cancelled = true
    }
  }, [filePath])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'f') {
        event.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (!doc) return
    const term = query.trim().toLowerCase()
    if (!term) {
      setMatches([])
      setActive(0)
      return
    }
    let cancelled = false
    ;(async () => {
      const found: Match[] = []
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i)
        const viewport = page.getViewport({ scale: 1 })
        const content = await page.getTextContent()
        for (const item of content.items) {
          if (!('str' in item) || !item.str) continue
          if (!item.str.toLowerCase().includes(term)) continue
          const tx = item.transform
          found.push({
            page: i,
            left: tx[4],
            top: viewport.height - tx[5] - (item.height ?? 8),
            width: item.width ?? item.str.length * 5,
            height: item.height ?? 10,
            pageWidth: viewport.width,
            pageHeight: viewport.height
          })
        }
      }
      if (!cancelled) {
        setMatches(found)
        setActive(0)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [doc, query])

  useEffect(() => {
    const match = matches[active]
    if (!match) return
    const node = pagesRef.current?.querySelector(`[data-page="${match.page}"]`)
    node?.scrollIntoView({ block: 'center' })
  }, [active, matches])

  const pageNumbers = useMemo(() => (doc ? Array.from({ length: doc.numPages }, (_, i) => i + 1) : []), [doc])

  return (
    <aside className="lab-pane">
      <div className="lab-toolbar">
        <strong>Lab Values</strong>
        <input
          ref={inputRef}
          placeholder="Search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <span>{query.trim() ? `${matches.length} match${matches.length === 1 ? '' : 'es'}` : ''}</span>
        <button disabled={matches.length === 0} onClick={() => setActive((i) => (i - 1 + matches.length) % matches.length)}>
          ‹
        </button>
        <button disabled={matches.length === 0} onClick={() => setActive((i) => (i + 1) % matches.length)}>
          ›
        </button>
        <button onClick={onClose}>Close</button>
      </div>
      {error ? <div className="error-banner">{error}</div> : null}
      <div className="lab-pages" ref={pagesRef}>
        {pageNumbers.map((n) => (
          <LabPage
            key={n}
            doc={doc}
            pageNumber={n}
            highlights={matches.filter((m) => m.page === n)}
            active={matches[active]}
          />
        ))}
      </div>
    </aside>
  )
}

function LabPage({
  doc,
  pageNumber,
  highlights,
  active
}: {
  doc: PDFDocumentProxy | null
  pageNumber: number
  highlights: Match[]
  active?: Match
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!doc) return
    let cancelled = false
    let renderTask: { cancel: () => void } | null = null
    ;(async () => {
      const page: PDFPageProxy = await doc.getPage(pageNumber)
      const viewport = page.getViewport({ scale: 1.35 })
      const canvas = canvasRef.current
      if (!canvas || cancelled) return
      canvas.width = viewport.width
      canvas.height = viewport.height
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      renderTask = page.render({ canvasContext: ctx, viewport, canvas })
      await renderTask.promise
    })()
    return () => {
      cancelled = true
      renderTask?.cancel()
    }
  }, [doc, pageNumber])

  return (
    <div className="lab-page" data-page={pageNumber}>
      <canvas ref={canvasRef} />
      {highlights.map((match, index) => {
        const canvas = canvasRef.current
        const scaleX = canvas ? canvas.clientWidth / match.pageWidth : 1
        const scaleY = canvas ? canvas.clientHeight / match.pageHeight : 1
        const isCurrent = active && active.page === match.page && active.left === match.left && active.top === match.top
        return (
          <div
            key={index}
            className={`hl-box ${isCurrent ? 'current' : ''}`}
            style={{
              left: match.left * scaleX,
              top: match.top * scaleY,
              width: match.width * scaleX,
              height: match.height * scaleY
            }}
          />
        )
      })}
    </div>
  )
}
