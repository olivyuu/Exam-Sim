import type { PDFPageProxy } from 'pdfjs-dist'
import { assembleSet, needsOcr, type ParsedPage } from '../../../parser/examParser'
import type { FileMeta, ParseProgress, Question, QuestionImage } from '../../../shared/types'
import { createId } from '../../../shared/files'
import { loadPdfDocument } from './pdfjs'

export interface IngestResult {
  questions: Question[]
  warnings: string[]
  questionCount: number
  answerCount: number
}

function itemsToText(items: Array<{ str?: string; transform?: number[] }>): string {
  const rows = items
    .map((item) => ({
      str: item.str ?? '',
      x: item.transform ? item.transform[4] : 0,
      y: item.transform ? item.transform[5] : 0
    }))
    .filter((item) => item.str)
  rows.sort((left, right) => (Math.abs(right.y - left.y) > 2 ? right.y - left.y : left.x - right.x))

  const lines: string[] = []
  let line = ''
  let lastY: number | null = null
  let lastX: number | null = null
  for (const item of rows) {
    const superscript =
      lastY !== null &&
      /^[0-9]$/.test(item.str) &&
      /\/mm\s*$/i.test(line) &&
      Math.abs(item.y - lastY) < 14
    if (superscript) {
      line += item.str === '3' ? '³' : item.str
      continue
    }
    const newLine = lastY !== null && Math.abs(item.y - lastY) > 3.5
    const twoColumnChoice =
      !newLine &&
      line.length > 0 &&
      lastX !== null &&
      item.x - lastX > 36 &&
      /^(?:[O0○●□■✓✔✗✘xXQ•·*]\s*)?[A-Pa-p]\s*[).]/.test(item.str.trim())
    if (newLine || twoColumnChoice) {
      lines.push(line)
      line = item.str
    } else {
      const needsSpace = line.length > 0 && !line.endsWith(' ') && !item.str.startsWith(' ')
      line += (needsSpace ? ' ' : '') + item.str
    }
    lastY = item.y
    lastX = item.x
  }
  if (line) lines.push(line)
  return lines.join('\n')
}

const loadDocument = loadPdfDocument

async function pageText(page: PDFPageProxy): Promise<string> {
  const content = await page.getTextContent()
  return itemsToText(content.items as Array<{ str?: string; transform?: number[] }>)
}

async function renderPagePng(page: PDFPageProxy, scale = 2): Promise<HTMLCanvasElement> {
  const viewport = page.getViewport({ scale })
  const canvas = document.createElement('canvas')
  canvas.width = Math.floor(viewport.width)
  canvas.height = Math.floor(viewport.height)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not create a canvas for PDF rendering.')
  await page.render({ canvasContext: ctx, viewport, canvas }).promise
  return canvas
}

function cropCanvas(
  source: HTMLCanvasElement,
  box: { left: number; top: number; right: number; bottom: number },
  kind: 'figure' | 'table' | 'lab'
): QuestionImage {
  const x = Math.floor(source.width * box.left)
  const y = Math.floor(source.height * box.top)
  const width = Math.max(1, Math.floor(source.width * (box.right - box.left)))
  const height = Math.max(1, Math.floor(source.height * (box.bottom - box.top)))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return { dataUrl: source.toDataURL('image/png'), width, height, kind }
  ctx.drawImage(source, x, y, width, height, 0, 0, width, height)
  return { dataUrl: canvas.toDataURL('image/jpeg', 0.82), width, height, kind }
}

async function cropByTextMarkers(
  page: PDFPageProxy,
  source: HTMLCanvasElement,
  start: RegExp,
  end: RegExp | null,
  kind: 'figure' | 'table' | 'lab',
  inset: { left?: number; right?: number; padTop?: number; padBottom?: number } = {}
): Promise<QuestionImage | null> {
  const viewport = page.getViewport({ scale: 1 })
  const content = await page.getTextContent()
  let startY: number | null = null
  let endY: number | null = null
  for (const item of content.items as Array<{ str?: string; transform?: number[] }>) {
    if (!item.str || !item.transform) continue
    const [, y] = viewport.convertToViewportPoint(item.transform[4], item.transform[5])
    if (start.test(item.str) && startY === null) startY = y / viewport.height
    if (end && end.test(item.str)) endY = y / viewport.height
  }
  if (startY === null) return null
  const top = Math.max(0.08, startY - (inset.padTop ?? 0.01))
  const bottom = Math.min(0.92, endY ? endY + (inset.padBottom ?? 0.01) : 0.88)
  if (bottom <= top + 0.05) return null
  return cropCanvas(
    source,
    {
      left: inset.left ?? 0.04,
      top,
      right: inset.right ?? 0.96,
      bottom
    },
    kind
  )
}

async function cropQuestionPage(page: PDFPageProxy, source: HTMLCanvasElement): Promise<QuestionImage> {
  const viewport = page.getViewport({ scale: 1 })
  const content = await page.getTextContent()
  let headerBottom = 0.05
  let footerTop = 0.97
  for (const item of content.items as Array<{ str?: string; transform?: number[] }>) {
    if (!item.str || !item.transform) continue
    const text = item.str.trim()
    if (!text) continue
    const [, y] = viewport.convertToViewportPoint(item.transform[4], item.transform[5])
    const ratio = y / viewport.height
    if (
      /^(exam section|item\s+\d|time remaining|mark|national board|medicine self-assessment)$/i.test(text) ||
      /^\d+\s*hr\s+\d+\s*min/i.test(text)
    ) {
      if (ratio < 0.28) headerBottom = Math.max(headerBottom, ratio + 0.015)
    }
    if (/^(previous|next|lab values|calculator|review|help|pause)$/i.test(text) && ratio > 0.7) {
      footerTop = Math.min(footerTop, ratio - 0.01)
    }
  }
  const top = Math.min(Math.max(0.02, headerBottom), 0.16)
  const bottom = Math.max(top + 0.45, Math.min(0.98, footerTop))
  return cropCanvas(source, { left: 0.008, top, right: 0.992, bottom }, 'lab')
}

async function cropFigure(page: PDFPageProxy, source: HTMLCanvasElement): Promise<QuestionImage | null> {
  const viewport = page.getViewport({ scale: 1 })
  const content = await page.getTextContent()
  let startY: number | null = null
  let endY: number | null = null
  let maxLeftX = 0.42
  for (const item of content.items as Array<{ str?: string; transform?: number[] }>) {
    if (!item.str || !item.transform) continue
    const [x, y] = viewport.convertToViewportPoint(item.transform[4], item.transform[5])
    const xRatio = x / viewport.width
    const yRatio = y / viewport.height
    if (/is shown/i.test(item.str) && startY === null) startY = Math.max(0.12, yRatio - 0.03)
    if (/^(Previous|Next|Lab Values)$/i.test(item.str.trim())) endY = yRatio
    if (xRatio < 0.62 && yRatio > 0.12 && yRatio < 0.85) {
      maxLeftX = Math.max(maxLeftX, xRatio)
    }
  }
  const left = Math.min(0.72, Math.max(0.55, maxLeftX + 0.02))
  const top = startY ?? 0.18
  const bottom = Math.min(0.86, endY ? endY - 0.02 : 0.78)
  if (bottom <= top + 0.12) return null
  return cropCanvas(source, { left, top, right: 0.995, bottom }, 'figure')
}

async function extractPages(
  file: FileMeta,
  onProgress: (current: number, total: number, detail: string) => void
): Promise<ParsedPage[]> {
  const doc = await loadDocument(file.path)
  const pages: ParsedPage[] = []
  for (let i = 1; i <= doc.numPages; i++) {
    onProgress(i, doc.numPages, file.name)
    const page = await doc.getPage(i)
    let text = await pageText(page)
    let usedOcr = false
    if (needsOcr(text)) {
      const canvas = await renderPagePng(page, 1.35)
      const png = canvas.toDataURL('image/png')
      const base64 = png.replace(/^data:image\/png;base64,/, '')
      try {
        text = await window.practiceExam.ocrImage(base64)
        usedOcr = true
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        text = text || ''
        if (needsOcr(text)) {
          throw new Error(`Could not read text from ${file.name} (page ${i}). ${message}`)
        }
      } finally {
        canvas.width = 0
        canvas.height = 0
      }
    }
    pages.push({ pageNumber: i, text, usedOcr })
  }
  return pages
}

export async function ingestPair(
  questionPdf: FileMeta,
  answerPdf: FileMeta,
  onProgress: (progress: ParseProgress) => void
): Promise<IngestResult> {
  onProgress({ stage: 'Reading question PDF', current: 0, total: 1, detail: questionPdf.name })
  const questionPages = await extractPages(questionPdf, (current, total, detail) => {
    onProgress({ stage: 'Reading question PDF', current, total, detail })
  })
  onProgress({ stage: 'Reading answer PDF', current: 0, total: 1, detail: answerPdf.name })
  const answerPages = await extractPages(answerPdf, (current, total, detail) => {
    onProgress({ stage: 'Reading answer PDF', current, total, detail })
  })

  const assembled = assembleSet(questionPages, answerPages)
  const questionDoc = await loadDocument(questionPdf.path)
  const questions: Question[] = []
  for (let index = 0; index < assembled.questions.length; index++) {
    const draft = assembled.questions[index]
    const questionImages: QuestionImage[] = []
    let pageImageDataUrl: string | undefined
    try {
      const page = await questionDoc.getPage(draft.sourceQuestionPage ?? index + 1)
      const canvas = await renderPagePng(page, 1.45)
      pageImageDataUrl = (await cropQuestionPage(page, canvas)).dataUrl
      if (draft.needsTableImage) {
        const table =
          (await cropByTextMarkers(
            page,
            canvas,
            /specific|urinalysis|gravity/i,
            /previous|next|lab values/i,
            'table',
            { padTop: 0.04, padBottom: 0.02 }
          )) ?? cropCanvas(canvas, { left: 0.04, top: 0.28, right: 0.96, bottom: 0.88 }, 'table')
        questionImages.push(table)
      }
      if (draft.needsFigure) {
        const figure =
          (await cropFigure(page, canvas)) ??
          (await cropByTextMarkers(
            page,
            canvas,
            /is shown/i,
            /previous|next|lab values/i,
            'figure',
            { left: 0.62, right: 0.995, padTop: 0.02, padBottom: 0.08 }
          )) ??
          cropCanvas(canvas, { left: 0.62, top: 0.22, right: 0.995, bottom: 0.78 }, 'figure')
        questionImages.push(figure)
      }
    } catch {
      /* keep text-only if a page cannot be rendered */
    }
    questions.push({
      id: createId('q'),
      questionNumber: index + 1,
      sourceItemNumber: draft.sourceItemNumber,
      sourceQuestionPdf: questionPdf.name,
      sourceQuestionPdfPath: questionPdf.path,
      sourceAnswerPdf: answerPdf.name,
      sourceQuestionPage: draft.sourceQuestionPage ?? index + 1,
      sourceAnswerPages: draft.sourceAnswerPages,
      questionStem: draft.questionStem,
      questionImages,
      pageImageDataUrl,
      answerChoices: draft.answerChoices,
      correctAnswer: draft.correctAnswer,
      explanation: draft.explanation,
      explanationImages: [],
      userAnswer: null,
      flagged: false,
      highlights: [],
      strikethroughChoices: [],
      notes: '',
      reviewStatus: 'unanswered',
      parseWarnings: draft.parseWarnings,
      usedOriginalImage: Boolean(pageImageDataUrl && draft.usedOriginalImage)
    })
  }

  return {
    questions,
    warnings: assembled.warnings,
    questionCount: assembled.questions.length,
    answerCount: new Set(assembled.questions.map((q) => q.sourceItemNumber).filter(Boolean)).size
      ? assembled.questions.filter((q) => q.correctAnswer || q.explanation).length
      : assembled.questions.filter((q) => q.correctAnswer || q.explanation).length
  }
}

export { loadDocument }
