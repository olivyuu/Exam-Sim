import { useMemo, type MouseEvent } from 'react'
import type { TextHighlight } from '../../../shared/types'

function offsetsFromRange(root: HTMLElement, range: Range): { start: number; end: number } | null {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let start = -1
  let end = -1
  let acc = 0
  let node = walker.nextNode()
  while (node) {
    const len = node.textContent?.length ?? 0
    if (node === range.startContainer) start = acc + range.startOffset
    if (node === range.endContainer) end = acc + range.endOffset
    acc += len
    node = walker.nextNode()
  }
  if (start < 0 || end < 0 || start === end) return null
  return { start: Math.min(start, end), end: Math.max(start, end) }
}

function segments(text: string, highlights: TextHighlight[]) {
  const sorted = [...highlights].sort((a, b) => a.start - b.start)
  const out: Array<{ text: string; marked: boolean }> = []
  let cursor = 0
  for (const highlight of sorted) {
    const start = Math.max(0, Math.min(text.length, highlight.start))
    const end = Math.max(start, Math.min(text.length, highlight.end))
    if (start > cursor) out.push({ text: text.slice(cursor, start), marked: false })
    if (end > start) out.push({ text: text.slice(start, end), marked: true })
    cursor = Math.max(cursor, end)
  }
  if (cursor < text.length) out.push({ text: text.slice(cursor), marked: false })
  return out
}

export function HighlightableText({
  text,
  highlights,
  enabled,
  onChange
}: {
  text: string
  highlights: TextHighlight[]
  enabled: boolean
  onChange: (next: TextHighlight[]) => void
}) {
  const parts = useMemo(() => segments(text, highlights), [text, highlights])

  const handleMouseUp = (event: MouseEvent<HTMLDivElement>) => {
    if (!enabled) return
    const selection = window.getSelection()
    if (!selection || selection.isCollapsed) return
    const range = selection.getRangeAt(0)
    const root = event.currentTarget
    if (!root.contains(range.commonAncestorContainer)) return
    const offsets = offsetsFromRange(root, range)
    selection.removeAllRanges()
    if (!offsets) return
    onChange([
      ...highlights,
      { start: offsets.start, end: offsets.end, text: text.slice(offsets.start, offsets.end) }
    ])
  }

  return (
    <div className="question-prose" onMouseUp={handleMouseUp}>
      {parts.map((part, index) => (part.marked ? <mark key={index}>{part.text}</mark> : <span key={index}>{part.text}</span>))}
    </div>
  )
}
