import {
  formatEmbeddedLabs,
  isLabNameLine,
  isLabSection,
  isLabValueLine,
  peelLabTail
} from './labFormat'
import { collapseBrokenPdfSpaces } from './pdfText'

export {
  formatEmbeddedLabs,
  isLabNameLine,
  isLabSection,
  isLabValueLine,
  peelLabTail
} from './labFormat'

const CHROME_LINE =
  /^(exam section|national board|medicine self-assessment|time remaining|lab values|calculator|review|help|pause|previous|next|score report|https?:\/\/|new section|mark|■\s*mark|item:\s*\d+|question id:|test id:|full screen|settings|notes|proceed to next item)/i

const TIMER_LINE = /^\d+\s*hr\s+\d+\s*min(?:\s+\d+\s*sec)?$/i

const ITEM_HEADER =
  /(?:exam\s*section\s*:?\s*)?(?:item|question)\s+(\d{1,3})\s+(?:of|ot|0t|or|\/)\s+(\d{1,3})/i

const NUMBERED_STEM = /(?:^|\n)\s*(\d{1,3})\.\s+(?=[A-Z0-9])/

const CHOICE_SPLIT = /(?:^|\n)\s*(?:[O0○●□■✓✔✗✘xXQ•·*]\s*)?([A-Pa-p])\s*\)(\s*)/g
const CHOICE_DOT_SPLIT = /(?:^|\n)\s*(?:[O0○●□■✓✔✗✘xXQ•·*]\s*)?([A-Pa-p])\.(\s+)/g
const INLINE_CHOICE =
  /(?<=\S)[ \t]+(?:[O0○●□■✓✔✗✘xXQ•·*]\s*)?([A-Pa-p])\s*\)(?=\s+\S)/g
const INLINE_DOT_CHOICE =
  /(?<=\S)[ \t]+(?:[O0○●□■✓✔✗✘xXQ•·*]\s*)?([A-Pa-p])\.(?=\s+[A-Z(])/g
const AFTER_VIGNETTE_CHOICE =
  /(?:^|\n)\s*(?:[O0○●□■Q•·*]\s*)?[A-Pa-p]\s*[\)\.]/

const CORRECT_PATTERNS = [
  /correct\s*answer\s*:\s*([A-P])\b/i,
  /\(([A-P])\s*is\s*correct/i,
  /\b([A-P])\s+is\s+correct\b/i,
  /\(([A-P])\)\s+For\b/
]

export interface ParsedPage {
  pageNumber: number
  text: string
  usedOcr: boolean
}

export interface ParsedQuestionDraft {
  sourceItemNumber: number
  questionStem: string
  answerChoices: { label: string; text: string }[]
  correctAnswer: string | null
  explanation: string
  parseWarnings: string[]
  sourceQuestionPage?: number
  sourceAnswerPages: number[]
  needsFigure?: boolean
  needsTableImage?: boolean
  needsLabImage?: boolean
  usedOriginalImage?: boolean
}

export function cleanPageText(raw: string): string {
  return collapseBrokenPdfSpaces(
    raw
      .replace(/\u00a0/g, ' ')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  )
}

export function stripChrome(text: string): string {
  return text
    .split(/\n/)
    .filter((line) => {
      const trimmed = line.trim()
      if (!trimmed) return true
      if (CHROME_LINE.test(trimmed)) return false
      if (TIMER_LINE.test(trimmed)) return false
      if (/^\d+\s*\|\s*laboratory values/i.test(trimmed)) return false
      if (/time remaining/i.test(trimmed) && /hr|min|sec/i.test(trimmed)) return false
      if (/^[r~∼,\s]+$/i.test(trimmed) && /[~∼]/.test(trimmed)) return false
      if (/^\*?\s*\d+\s*all\s+\d+%/i.test(trimmed)) return false
      if (/^[+=\-\s]*question\s+\d{1,3}\s+(?:of|ot|0t|or|\/)\s+\d{1,3}/i.test(trimmed)) return false
      if (/^\d{1,2}:\d{2}\s*[ap]m$/i.test(trimmed)) return false
      if (/^[ILC]\.?$/i.test(trimmed)) return false
      if (/^[ce]3$/i.test(trimmed)) return false
      return true
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

const FOOTER_JUNK = /\s*(?:r\s*)?~+\s*(?:~+\s*)?p,\s*r,?\s*$/i

export function stripFooterJunk(text: string): string {
  return text
    .replace(FOOTER_JUNK, '')
    .replace(/[,.]?\s*["']\s*[~∼'"r\-p,\s.]*$/i, '')
    .replace(/\s*["']\s*[~∼]+\s*p,+\.?,*\s*$/i, '')
    .replace(/\s+r--+\s*$/g, '')
    .replace(/\s*(?:^|\n)\s*[~∼]+\s*$/gim, '')
    .replace(/\s+[r~∼,\s]{3,}$/g, '')
    .replace(/(?:^|\n)\s*r\s*$/gim, '')
    .replace(/,\.\s*$/g, '')
    .replace(/\s+r\s*$/i, '')
    .trim()
}

export function stripLeadingArtifacts(text: string): string {
  let next = text.trim()
  for (let i = 0; i < 4; i++) {
    const stripped = next
      .replace(/^[xX~■✓✔+=<>|:\s•·*]+/g, '')
      .replace(/^(?:[•·*■]\s*)?Mark\s+/i, '')
      .replace(/^(?:item\s+)?\d{1,3}\s*\.\s+/i, '')
      .replace(/^A(\d{2,3}-year-old)/, 'A $1')
      .replace(/^[\-_.=~•·,\\/|'IV\s]{8,}(?=A\s+\d{1,3}-year-old)/, '')
      .trim()
    if (stripped === next) break
    next = stripped
  }
  return next
}

export function fixTypographics(text: string): string {
  return text
    .replace(/\blncorrect\s*Answers/gi, 'Incorrect Answers')
    .replace(/\/mm\s*3\b/gi, '/mm³')
    .replace(/\/mm3\b/gi, '/mm³')
    .replace(/\bµm\s*3\b/g, 'µm³')
    .replace(/\ban S([1-4])1\b/g, 'an S$1')
    .replace(/\bS\s+([1-4])\b/g, 'S$1')
    .replace(/\bV\s+([1-6])\b/g, 'V$1')
    .replace(/\bVitamin B\s+(\d+)/gi, 'Vitamin B$1')
    .replace(/\bFEV\s*[,:]\s*FVC\b/g, 'FEV1:FVC')
    .replace(/(\d)\s+%/g, '$1%')
    .replace(/\b(\d+)\s+Ib\b/g, '$1 lb')
    .replace(/\s+,/g, ',')
    .replace(/[ \t]+\./g, '.')
    .replace(/https?:\/\/\S+/gi, '')
}

export function unwrapProse(text: string): string {
  const lines = text.split('\n')
  const out: string[] = []
  let buffer = ''

  const flush = () => {
    if (buffer) out.push(buffer.trim())
    buffer = ''
  }

  for (const raw of lines) {
    const trimmed = raw.replace(/[ \t]+$/g, '').trim()
    if (!trimmed) {
      flush()
      if (out[out.length - 1] !== '') out.push('')
      continue
    }
    if (
      /^(laboratory|serum|urine|plasma|arterial)$/i.test(buffer) &&
      /studies show|blood gas|show:/i.test(trimmed)
    ) {
      buffer = `${buffer} ${trimmed}`
      flush()
      continue
    }
    if (
      isLabSection(trimmed) ||
      isLabNameLine(trimmed) ||
      /studies show:|urinalysis shows:/i.test(trimmed) ||
      /    /.test(raw)
    ) {
      flush()
      out.push(trimmed)
      continue
    }
    if (isLabValueLine(trimmed) && (isLabNameLine(buffer) || isLabSection(buffer) || /show:/i.test(buffer))) {
      flush()
      out.push(trimmed)
      continue
    }
    if (!buffer) {
      buffer = trimmed
      continue
    }
    if (/\/mm$/i.test(buffer) && /^[23]$/.test(trimmed)) {
      buffer = `${buffer}${trimmed === '3' ? '³' : '²'}`
    } else if (buffer.endsWith('-') && /^[a-z]/.test(trimmed)) {
      buffer = `${buffer}${trimmed}`
    } else {
      buffer = `${buffer} ${trimmed}`
    }
  }
  flush()
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

function isDiagramLine(line: string): boolean {
  const trimmed = line.trim()
  if (!trimmed) return false
  const letters = (trimmed.match(/[A-Za-z]/g) ?? []).length
  const junk = (trimmed.match(/[-_=~•·.,/\\|'^~]/g) ?? []).length
  if (trimmed.length >= 8 && letters <= 6 && junk >= 5) return true
  if (/^(?:aV[RLF]|V[1-6]|I{1,3}|II|III)(?:\s|$)/.test(trimmed) && trimmed.length < 40 && letters < 14) {
    return true
  }
  const realWords = trimmed.split(/\s+/).filter((word) => /[a-z]{4,}/i.test(word) && !/^(aVR|aVL|aVF)$/i.test(word))
  if (junk >= 8 && realWords.length <= 2 && /[-~_.]{2,}/.test(trimmed) && !/year-old|which of the following/i.test(trimmed)) {
    return true
  }
  return false
}

function stripDiagramNoise(text: string): string {
  return text
    .split('\n')
    .filter((line) => !isDiagramLine(line))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function polishStem(text: string): string {
  return unwrapProse(
    fixTypographics(stripLeadingArtifacts(stripFooterJunk(stripExplanationFromStem(stripDiagramNoise(text)))))
  )
}

const EXPLANATION_CUT =
  /(?:^|\n)\s*(?:Correct\s*Answer\s*:|Incorrect Answers\s*:|Educational Objective\s*:|Key Concept\s*:|Choice [A-P]\s*:|\([A-P]\s+is\s+correct\)|Time Spent\b|Explanation\s*\n)/i

export function stripExplanationFromStem(text: string): string {
  if (!text) return ''
  const cut = text.search(EXPLANATION_CUT)
  return (cut >= 0 ? text.slice(0, cut) : text).trim()
}

export function hasExplanationLeak(text: string): boolean {
  return EXPLANATION_CUT.test(text) || /\bthis option is\b|\bis incorrect\b/i.test(text)
}

export const ORIGINAL_PDF_FALLBACK_MESSAGE =
  'The original PDF is shown because formatted text could not be generated reliably for this question.'

export const STEM_QC_WARNING =
  'Formatted text did not match the original PDF closely enough, so the original page will be shown.'

const SOURCE_CHOICE_CUT = /(?:^|\n)\s*(?:[O0○●□■Q•·*]\s*)?A\s*[).]/

export function extractSourceStem(pageText: string, itemNumber?: number): string {
  const cleaned = stripFooterJunk(stripChrome(cleanPageText(pageText)))
  let body = cleaned
  if (itemNumber != null) {
    const numbered = new RegExp(`(?:^|\\n)\\s*${itemNumber}\\.\\s+`)
    const match = numbered.exec(body)
    if (match && match.index !== undefined) body = body.slice(match.index + match[0].length)
  } else {
    body = body.replace(/^(?:item\s+)?\d{1,3}\s*\.\s+/i, '')
  }
  const cut = body.search(SOURCE_CHOICE_CUT)
  if (cut >= 0) body = body.slice(0, cut)
  return stripLeadingArtifacts(stripExplanationFromStem(body)).trim()
}

function contentWords(text: string): string[] {
  return stripExplanationFromStem(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 2 || /^\d{2,}$/.test(word))
}

export function qcStemAgainstSource(
  parsedStem: string,
  sourcePageText: string,
  options: {
    itemNumber?: number
    filledChoices?: number
    needsFigure?: boolean
    needsTableImage?: boolean
  } = {}
): { ok: boolean; reasons: string[] } {
  const reasons: string[] = []
  const parsed = stripExplanationFromStem(parsedStem)
  if (hasExplanationLeak(parsedStem)) reasons.push('explanation text leaked into the stem')
  if (/^\s*(?:[•·*]?\s*)?Mark\b/i.test(parsed) || /~\s*~/.test(parsed)) {
    reasons.push('exam chrome remained in the stem')
  }
  if (parsed.replace(/\s+/g, ' ').trim().length < 30) reasons.push('the stem is too short')
  const gold = extractSourceStem(sourcePageText, options.itemNumber)
  const goldWords = contentWords(gold)
  const parsedWords = new Set(contentWords(parsed))
  const sample = goldWords.slice(0, 18)
  if (sample.length >= 10) {
    const hits = sample.filter((word) => parsedWords.has(word)).length
    if (hits / sample.length < 0.5) reasons.push('the wording diverged from the original PDF')
  }
  if ((options.filledChoices ?? 99) < 2 && !options.needsFigure && !options.needsTableImage) {
    reasons.push('answer choices were missing')
  }
  return { ok: reasons.length === 0, reasons }
}

export function splitStemPrompt(stem: string): { lead: string; prompt: string } {
  const match = stem.match(/\n\s*(Which of the following[\s\S]*)$/i)
  if (!match || match.index === undefined) return { lead: stem, prompt: '' }
  return { lead: stem.slice(0, match.index).trim(), prompt: match[1].trim() }
}

export function looksLikeFigureQuestion(stem: string): boolean {
  return /\b((the )?(lesion|photograph|x-ray|chest x-ray|image|figure|smear|blood smears?|ecg|ekg|graph|life table)\s+is shown|(blood smears?|chest x-rays?|x-rays?|photographs?|ecgs?|ekgs?)\s+are shown|is shown\.|photograph of the|graph shows|appear as shown|\d+\s*mm\/s|\d+\s*mm\/mV)\b/i.test(
    stem
  )
}

const TABLE_STEM =
  /sets? of (findings|laboratory values|laboratory findings|values)|laboratory findings is most likely|additional findings|most appropriate sensitivity|direct antiglobulin|serum osmolality|cardiac output|pulmonary capillary wedge|insulin\s+production|sensitivity\s*\n\s*specificity/i

export function looksLikeTableQuestion(stem: string, choices: { label: string; text: string }[]): boolean {
  if (TABLE_STEM.test(stem)) return true
  if (choices.length < 4) return false
  const tableLike = choices.filter((choice) => {
    const numbers = choice.text.match(/\d/g) ?? []
    const words = choice.text.replace(/[^A-Za-z]/g, ' ').trim().split(/\s+/).filter((w) => w.length > 2)
    return numbers.length >= 3 && words.length <= 6
  }).length
  return tableLike >= Math.ceil(choices.length * 0.6)
}

function stitchTemperatureWraps(text: string): string {
  return text
    .replace(/(\d(?:\.\d+)?\s*°)\s*\n\s*([FC])\b/gi, '$1$2')
    .replace(/(\d(?:\.\d+)?)\s*\n\s*(°\s*[FC])\b/gi, '$1$2')
    .replace(/(\(\s*\d(?:\.\d+)?\s*°?)\s*\n\s*([FC])\s*\)/gi, '$1$2)')
    .replace(/(°)\s*\n\s*([FC])\s*\)/gi, '$1$2)')
}

function protectClinicalUnits(text: string): { text: string; restore: (value: string) => string } {
  const saved: string[] = []
  const stitched = stitchTemperatureWraps(text)
  const masked = stitched.replace(
    /\(\s*\d+(?:\.\d+)?\s*(?:°|deg\.?)?\s*[FC]\s*\)|\b\d+(?:\.\d+)?\s*(?:°|deg\.?)\s*[FC]\b/gi,
    (match) => {
      saved.push(match)
      return `\uE000TEMP${saved.length - 1}\uE001`
    }
  )
  return {
    text: masked,
    restore: (value) => value.replace(/\uE000TEMP(\d+)\uE001/g, (_, index) => saved[Number(index)] ?? _)
  }
}

function applyChoiceMarkup(text: string): string {
  return text
    .replace(/\bProceed to Next Item\b[\s\S]*$/i, '')
    .replace(/\s+Full Screen\b[\s\S]*$/i, '')
    .replace(/(?:^|\n)\s*O([A-Pa-p])\s*([).])/gm, '\nO $1$2')
    .replace(/(?:^|\n)\s*O\s+D[Il1]\b/gm, '\nO D) ')
    .replace(
      /((?:^|\n)\s*(?:[O0•·*]\s*)?H\s*[).][^\n]*)\n(\s*(?:[O0•·*]\s*)?)[1l](\s*[).])/gi,
      '$1\n$2I$3'
    )
    .replace(INLINE_CHOICE, '\n$1) ')
    .replace(INLINE_DOT_CHOICE, '\n$1. ')
    .replace(/(?<=[a-z0-9%.])([A-Pa-p])\s*\)(?=\s*[A-Z(])/g, '\n$1) ')
    .replace(/(?<=\S)[ \t]+(?:[O0○●□■✓✔✗✘xXQ•·*]\s*)?([A-Pa-p])\s*\)(?=[A-Za-z(])/g, '\n$1) ')
    .replace(/\)[ \t]*([B-Pa-p])\s*\)/g, ')\n$1) ')
    .replace(/(?<=\S)\s+[O0]\s+(?=[A-Z][a-z]{2,})/g, '\n')
}

function prepareForChoiceParse(text: string): { text: string; restore: (value: string) => string } {
  const { text: masked, restore } = protectClinicalUnits(text)
  let marked = applyChoiceMarkup(masked)
  for (let i = 0; i < 3; i++) {
    const next = applyChoiceMarkup(marked)
    if (next === marked) break
    marked = next
  }
  return { text: marked, restore }
}

function isPercentChoice(text: string): boolean {
  return /^[\d.+\-]+\s*%$/.test(text.trim())
}

function isSparseChoiceText(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed || /^[-–—+]$/.test(trimmed)) return true
  if (isPercentChoice(trimmed)) return false
  return (trimmed.match(/[A-Za-z]/g) ?? []).length < 3
}

export function isLikelyCoverOrIndex(text: string): boolean {
  const cleaned = stripChrome(text)
  const compact = cleaned.replace(/\s+/g, ' ').trim()
  if (compact.length < 40) return true
  if (/^internal medicine cms/i.test(compact) && compact.length < 80) return true
  if (/system:\s+/i.test(cleaned) && /:\s*\d/.test(cleaned) && !/which of the following/i.test(cleaned)) {
    return true
  }
  if ((ITEM_HEADER.test(cleaned) || NUMBERED_STEM.test(cleaned)) && /[A-P][\)\.]/.test(cleaned)) {
    return false
  }
  if (/correct\s*answer/i.test(cleaned) || /educational objective/i.test(cleaned)) return false
  if (compact.length < 120 && !/[A-J][\)\.]/.test(cleaned)) return true
  return false
}

export function extractItemNumber(text: string): { item: number; of?: number } | null {
  const header = text.match(ITEM_HEADER)
  if (header) return { item: Number(header[1]), of: Number(header[2]) }
  const numbered = text.match(NUMBERED_STEM)
  if (numbered) return { item: Number(numbered[1]) }
  const loose = text.match(/(?:item|question)\s+(\d{1,3})\b/i)
  if (loose) return { item: Number(loose[1]) }
  return null
}

export function splitChoices(body: string): { stem: string; choices: { label: string; text: string }[] } {
  const { text: prepared, restore } = prepareForChoiceParse(body)
  const parsed = splitChoicesOnPrepared(prepared)
  return {
    stem: restore(parsed.stem),
    choices: parsed.choices.map((choice) => ({ ...choice, text: restore(choice.text) }))
  }
}

function splitChoicesOnPrepared(prepared: string): { stem: string; choices: { label: string; text: string }[] } {
  const paren = [...prepared.matchAll(new RegExp(CHOICE_SPLIT.source, 'g'))]
  const dots = [...prepared.matchAll(new RegExp(CHOICE_DOT_SPLIT.source, 'g'))]
  const score = (matches: RegExpMatchArray[]) => new Set(matches.map((match) => match[1].toUpperCase())).size
  const matches = score(paren) >= 4 || score(paren) >= score(dots) ? paren : dots
  if (matches.length < 1) {
    return { stem: prepared.trim(), choices: [] }
  }

  const first = matches[0]
  const stem = prepared.slice(0, first.index).trim()
  const choices: { label: string; text: string }[] = []

  for (let i = 0; i < matches.length; i++) {
    const current = matches[i]
    const next = matches[i + 1]
    const label = current[1].toUpperCase()
    const start = (current.index ?? 0) + current[0].length
    const end = next?.index ?? prepared.length
    let text = prepared.slice(start, end).trim()
    text = stripFooterJunk(
      text
        .replace(/\s+(Correct\s*Answer:.*)$/i, '')
        .replace(/\s+(Incorrect Answers:.*)$/i, '')
        .replace(/\s+(Educational Objective:.*)$/i, '')
        .replace(/\s+Proceed to Next Item[\s\S]*$/i, '')
    )
    choices.push({ label, text })
  }

  const lastReal = findLastRealChoice(
    repairTwoColumnChoices(dropExplanationChoices(explodeMergedChoices(choices)))
  )
  return {
    stem: tidyStem(stem.replace(/^\d{1,3}\.\s*/, '').trim()),
    choices: normalizeChoices(lastReal)
  }
}

function dropExplanationChoices(
  choices: { label: string; text: string }[]
): { label: string; text: string }[] {
  const sparse = choices.filter((choice) => isSparseChoiceText(choice.text)).length
  const tableGrid = choices.length >= 3 && sparse >= Math.ceil(choices.length * 0.5)
  const out: { label: string; text: string }[] = []
  for (let index = 0; index < choices.length; index++) {
    const choice = choices[index]
    const letters = (choice.text.match(/[A-Za-z]/g) ?? []).length
    if (
      index > 0 &&
      letters < 3 &&
      !isPercentChoice(choice.text) &&
      !(tableGrid && isSparseChoiceText(choice.text)) &&
      !/^(no|yes|ct|mri|iv|im|po)$/i.test(choice.text.trim())
    ) {
      continue
    }
    if (index > 0 && out.length > 0) {
      const gap = choice.label.charCodeAt(0) - out[out.length - 1].label.charCodeAt(0)
      if (
        gap > 1 &&
        (choice.text.length > 80 ||
          /this patient|treated using|sensitivity is|full screen|year-old|which of the following/i.test(
            choice.text
          ))
      ) {
        break
      }
    }
    if (index > 0 && choice.text.length > 220 && /this patient|can be treated|sensitivity is a measure/i.test(choice.text)) {
      break
    }
    out.push({ ...choice, text: trimChoiceExplanation(choice.text) })
  }
  return out
}

function explodeMergedChoices(
  choices: { label: string; text: string }[]
): { label: string; text: string }[] {
  const out: { label: string; text: string }[] = []
  const embedded = /(?:^|\s+[O0Q•·*]\s*|\s+)([A-Pa-p])\s*[\)\.]\s+(?=[A-Z0-9("])/g
  for (const choice of choices) {
    const matches = [...choice.text.matchAll(new RegExp(embedded.source, 'g'))].filter((match) => {
      const before = choice.text.slice(Math.max(0, (match.index ?? 0) - 12), match.index)
      if (/[°\d]\s*$/.test(before) && /^[FCfc]$/.test(match[1])) return false
      if (/\d(?:\.\d+)?\s*°?\s*$/.test(before) && /^[FCfc]$/.test(match[1])) return false
      return true
    })
    if (matches.length === 0) {
      out.push(choice)
      continue
    }
    let last = 0
    let label = choice.label
    for (const match of matches) {
      out.push({ label, text: trimChoiceExplanation(choice.text.slice(last, match.index).trim()) })
      label = match[1].toUpperCase()
      last = (match.index ?? 0) + match[0].length
    }
    out.push({ label, text: trimChoiceExplanation(choice.text.slice(last).trim()) })
  }
  return out.filter((choice, _index, all) => {
    if (choice.text.replace(/[^\w%]/g, '').length > 0 || isPercentChoice(choice.text)) return true
    const sparse = all.filter((item) => isSparseChoiceText(item.text)).length
    return all.length >= 3 && sparse >= Math.ceil(all.length * 0.5)
  })
}

function trimChoiceExplanation(text: string): string {
  const cut = text.search(
    /\s(?:The patient's presentation|This patient's presentation|Correct\s*Answer|Incorrect Answers|Educational Objective|\([A-P]\s+is\s+correct\)|Sensitivity is a measure|The life table)/i
  )
  if (cut > 8) text = text.slice(0, cut).trim()
  const graph = text.search(/\s+(?:cij\s*>|(?:\d{2,}\s+){3,}|Years\s+\d)/i)
  if (graph > 12) text = text.slice(0, graph).trim()
  return stripFooterJunk(text)
}

function stripChoiceBubbles(text: string): string {
  return text
    .replace(/^[O0○●□■✓✔✗✘xXQ•·*]+\s+/g, '')
    .replace(/^[O0○●□■✓✔✗✘xXQ•·*]$/g, '')
    .replace(/\s+[O0]+,?\s*$/g, '')
    .replace(/^\s*[A-Pa-p]\s*[).]\s*/g, '')
    .trim()
}

function splitGluedChoicePhrases(text: string): string[] {
  const cleaned = stripChoiceBubbles(text)
  if (!cleaned) return []
  const byBreak = cleaned
    .split(/\s+[O0]+\s+|\n+(?=[A-Z][a-z]{3,})/)
    .map((part) => stripChoiceBubbles(part.replace(/\s+/g, ' ')))
    .filter((part) => part && !/^[,.]+$/.test(part))
  const expanded = byBreak.flatMap((part) => splitTitleCaseChoice(part))
  return expanded.length > 0 ? expanded : [cleaned.replace(/\s+/g, ' ').trim()].filter(Boolean)
}

function looksLikeLabNameList(text: string): boolean {
  if (
    /^(Protein|WBC|RBC|Na\+|K\+|Cl-|Casts|Glucose|Hematocrit|Leukocyte|Creatinine|BUN|pH)\b/i.test(
      text.trim()
    )
  ) {
    return true
  }
  const words = text.split(/\s+/).filter((word) => /[A-Za-z]/.test(word))
  const lab = words.filter((word) =>
    /^(Protein|WBC|RBC|Na\+|K\+|Cl-|Casts|Glucose|Hematocrit|Leukocyte|Creatinine|BUN|pH)$/i.test(word)
  ).length
  return lab >= 1 && words.length > 0 && lab >= Math.ceil(words.length * 0.5)
}

function splitTitleCaseChoice(text: string): string[] {
  const inner = text.search(/\s+[A-Z][a-z]{3,}/)
  if (inner < 8) return [text]
  const left = text.slice(0, inner).trim()
  const right = text.slice(inner).trim()
  if (looksLikeLabNameList(right)) return [text]
  const leftWords = left.split(/\s+/).filter(Boolean)
  const rightWords = right.split(/\s+/).filter(Boolean)
  const leftOk =
    (leftWords.length >= 2 && /[a-z]{3,}$/.test(left)) || (leftWords.length === 1 && left.length >= 12)
  if (!leftOk || right.length < 6) return [text]
  if (rightWords.length === 1 && right.length < 8) return [text]
  return [left, right]
}

function mergeChoiceFragments(parts: string[]): string[] {
  const out: string[] = []
  for (let index = 0; index < parts.length; index++) {
    const part = parts[index]
    const next = parts[index + 1]
    if (/^(?:of|or)\s+/i.test(part) && next) {
      out.push(`${next} ${part}`)
      index++
      continue
    }
    out.push(part)
  }
  return out
}

function needsTwoColumnRepair(choices: { label: string; text: string }[]): boolean {
  if (choices.length < 2) return false
  return choices.some((choice) => {
    const text = choice.text.trim()
    if (/\s+[O0]+(?:\s|,|$)/.test(text) || /(?:^|\s)[O0],?\s*$/.test(text)) return true
    if (/^\s*[A-Pa-p]\s*[).]/.test(text)) return true
    if (/\s+[A-Pa-p]\s*[).]\s+[A-Z]/.test(text)) return true
    return splitGluedChoicePhrases(text).length > 1
  })
}

function repairTwoColumnChoices(
  choices: { label: string; text: string }[]
): { label: string; text: string }[] {
  if (!needsTwoColumnRepair(choices)) return choices
  const phrases = mergeChoiceFragments(choices.flatMap((choice) => splitGluedChoicePhrases(choice.text)))
  if (phrases.length < 4 || phrases.length < choices.length) return choices
  return phrases.map((text, index) => ({
    label: String.fromCharCode(65 + index),
    text
  }))
}

function sortChoices(
  choices: { label: string; text: string }[]
): { label: string; text: string }[] {
  const rank = (label: string) => label.charCodeAt(0)
  const unique = new Map<string, { label: string; text: string }>()
  for (const choice of choices) {
    if (!unique.has(choice.label)) unique.set(choice.label, choice)
  }
  return [...unique.values()].sort((a, b) => rank(a.label) - rank(b.label))
}

function peelTrailingLabs(choices: { label: string; text: string }[]): {
  choices: { label: string; text: string }[]
  values: string[]
} {
  if (choices.length === 0) return { choices, values: [] }
  const last = choices[choices.length - 1]
  const match = last.text.match(
    /\s+(\d[\d.,]*\s*(?:mEq\/L|mg\/dL|g\/dL|U\/L|mm Hg|mmol\/L|sec|%|\/mm³|\/hpf)|(?:negative|positive))\b[\s\S]*$/i
  )
  if (!match || match.index === undefined) return { choices, values: [] }
  // Only peel if there are at least two value tokens — a single number may be part of the choice.
  const tail = last.text.slice(match.index)
  const values = tail.match(
    /\d[\d.,]*\s*(?:mEq\/L|mg\/dL|g\/dL|U\/L|mm Hg|mmol\/L|sec(?:\s*\(INR\s*=\s*[\d.\s]+\))?|%|\/mm³|\/mm3|\/hpf)|(?:negative|positive)|(?:\d+-\d+\/hpf)/gi
  )
  if (!values || values.length < 2) {
    if (/\d\s*%/.test(last.text) && /(\/hpf|\/mm³|\/mm3)/i.test(last.text)) {
      const cut = last.text.search(/\s+\d[\d.,]*\s*%/)
      if (cut > 0) {
        return {
          choices: [...choices.slice(0, -1), { ...last, text: last.text.slice(0, cut).trim() }],
          values: last.text.slice(cut).trim().split(/\s+/)
        }
      }
    }
    return { choices, values: [] }
  }
  const cleaned = stripFooterJunk(last.text.slice(0, match.index).trim())
  return {
    choices: [...choices.slice(0, -1), { ...last, text: cleaned }],
    values
  }
}

export function recoverQuestionLayout(
  cleaned: string,
  itemNumber?: number
): { stem: string; choices: { label: string; text: string }[]; needsLabImage: boolean } {
  const { text: junkFree, restore } = prepareForChoiceParse(stripFooterJunk(cleaned))
  const firstChoice = junkFree.search(/(?:^|\n)\s*(?:[O0○●□■Q•·*]\s*)?[A-Pa-p]\s*[\)\.]/)
  const marker = itemNumber
    ? new RegExp(`(?:^|\\n)\\s*${itemNumber}\\.\\s+(?=[A-Z0-9])`)
    : /(?:^|\n)\s*\d{1,3}\.\s+(?=[A-Z0-9])/
  const vignette = marker.exec(junkFree)

  const finish = (rawStem: string, choices: { label: string; text: string }[], extraTokens: string[] = []) => {
    const extras = [...extraTokens]
    const nextChoices = sortChoices(
      normalizeChoices(
        choices.map((choice) => {
          const peeled = peelLabTail(choice.text)
          extras.push(...peeled.tokens)
          return { ...choice, text: peeled.text }
        })
      )
    )
    const last = nextChoices[nextChoices.length - 1]
    if (last && extras.some((token) => /\/mm³|\/hpf|mEq\/L|mg\/dL/i.test(token))) {
      const percent = last.text.match(/^(.*?)(\s+[\d.,]+\s*%)$/)
      if (percent && !/0\.9\s*%/.test(percent[2]) && !isPercentChoice(last.text)) {
        extras.unshift(percent[2].trim())
        last.text = percent[1].trim()
      }
    }
    let stem = polishStem(formatEmbeddedLabs(stripExplanationFromStem(rawStem), extras))
    stem = stripExplanationFromStem(stem.replace(/\?\s+[\d+.\s\-/%hfpmmdlU]+\s*$/i, '?'))
    if (looksLikeTableQuestion(stem, nextChoices) || looksLikeTableQuestion(junkFree, nextChoices)) {
      const cut = stem.search(/\?\s*(Specific|Gravity|WBC|RBC|$)/i)
      if (cut >= 0) stem = polishStem(stem.slice(0, cut + 1))
      return {
        stem: restore(stem),
        choices: expandTableChoices(nextChoices, junkFree).map((choice) => ({
          ...choice,
          text: restore(choice.text)
        })),
        needsLabImage: false
      }
    }
    return {
      stem: restore(stem),
      choices: nextChoices.map((choice) => ({ ...choice, text: restore(choice.text) })),
      needsLabImage: false
    }
  }

  const afterSlice =
    vignette && vignette.index !== undefined
      ? stripExplanationFromStem(junkFree.slice(vignette.index).replace(/^\s*\d{1,3}\.\s+/, ''))
      : ''
  const afterHasOwnChoices = AFTER_VIGNETTE_CHOICE.test(afterSlice)

  if (vignette && vignette.index > 0 && firstChoice >= 0 && vignette.index > firstChoice && !afterHasOwnChoices) {
    const before = junkFree.slice(0, vignette.index)
    const parsed = splitChoicesOnPrepared(before)
    return finish([parsed.stem, afterSlice].filter(Boolean).join('\n\n'), parsed.choices)
  }

  const body =
    vignette && vignette.index !== undefined && afterHasOwnChoices ? junkFree.slice(vignette.index) : junkFree
  const parsed = splitChoicesOnPrepared(body)
  return finish(parsed.stem, parsed.choices)
}

function expandTableChoices(
  choices: { label: string; text: string }[],
  source = ''
): { label: string; text: string }[] {
  const labels = choices.map((choice) => choice.label).filter((label) => /[A-F]/.test(label))
  let max = labels.reduce((current, label) => (label > current ? label : current), 'A')
  if (max < 'E' || labels.length < 3) {
    max = /(?:^|\n)\s*(?:[O0•·*]\s*)?F\s*[).]/m.test(source) || labels.includes('F') ? 'F' : 'E'
  }
  if (labels.includes('F') && max < 'F') max = 'F'
  const out: { label: string; text: string }[] = []
  for (let code = 65; code <= max.charCodeAt(0); code++) {
    out.push({ label: String.fromCharCode(code), text: '' })
  }
  return out.length >= 2 ? out : choices
}

function tidyStem(stem: string): string {
  let next = stripLeadingArtifacts(
    stem
      .replace(/^[■~]+\s*/g, '')
      .replace(/^mark\s+/i, '')
      .replace(/^\d+\s*hr\s+\d+\s*min(?:\s+\d+\s*sec)?\s*/i, '')
      .trim()
  )
  const numbered = next.match(/(?:^|\n)\s*\d{1,3}\.\s+([A-Z0-9][\s\S]*)/)
  if (numbered) next = numbered[1].trim()
  return next
}

function normalizeChoices(
  choices: { label: string; text: string }[]
): { label: string; text: string }[] {
  const sparse = choices.filter((choice) => isSparseChoiceText(choice.text)).length
  const tableGrid = choices.length >= 3 && sparse >= Math.ceil(choices.length * 0.5)
  const seen = new Set<string>()
  const out: { label: string; text: string }[] = []
  for (const choice of choices) {
    let text = stripFooterJunk(trimChoiceExplanation(choice.text))
    text = stripFooterJunk(fixTypographics(text.replace(/\s+/g, ' ').replace(/\s*Proceed to Next Item[\s\S]*$/i, '').trim()))
    if (/^(next|previous|score report|lab values|calculator|help|pause)$/i.test(text)) break
    if (isPercentChoice(choice.text.trim()) || isPercentChoice(text)) {
      text = choice.text.trim() || text
    }
    if (text.length < 2 && !isPercentChoice(text)) {
      if (tableGrid && /^[A-F]$/.test(choice.label) && !seen.has(choice.label)) {
        seen.add(choice.label)
        out.push({ ...choice, text: '' })
      }
      continue
    }
    if (/^(full screen|settings)/i.test(text) || /year-old .*(which of the following)/i.test(text)) {
      continue
    }
    if (seen.has(choice.label)) break
    seen.add(choice.label)
    out.push({ ...choice, text })
  }
  return out
}

function findLastRealChoice(
  choices: { label: string; text: string }[]
): { label: string; text: string }[] {
  const cut = choices.findIndex((choice, index) => {
    if (index === 0) return false
    if (/^correct answer/i.test(choice.text)) return true
    if (/^incorrect answers/i.test(choice.text)) return true
    if (/^educational objective/i.test(choice.text)) return true
    return false
  })
  const sliced = cut === -1 ? choices : choices.slice(0, cut)
  const nonempty = sliced.filter(
    (choice) => choice.text.replace(/[^\w%]/g, '').length > 0 || isPercentChoice(choice.text)
  )
  if (nonempty.length >= 2) return nonempty
  const sparse = sliced.filter((choice) => isSparseChoiceText(choice.text)).length
  if (sliced.length >= 3 && sparse >= Math.ceil(sliced.length * 0.5)) return sliced
  return nonempty
}

function padStandardChoices(
  choices: { label: string; text: string }[],
  max = 'E'
): { label: string; text: string }[] {
  const byLabel = new Map(choices.map((choice) => [choice.label, choice]))
  const out: { label: string; text: string }[] = []
  for (let code = 65; code <= max.charCodeAt(0); code++) {
    const label = String.fromCharCode(code)
    out.push(byLabel.get(label) ?? { label, text: '' })
  }
  return out
}

export function extractCorrectAnswer(text: string): string | null {
  for (const pattern of CORRECT_PATTERNS) {
    const match = text.match(pattern)
    if (match) return match[1].toUpperCase()
  }
  return null
}

export function extractExplanation(text: string): string {
  const cleaned = stripChrome(text)
  const correct = cleaned.search(/correct\s*answer\s*:/i)
  const educational = cleaned.search(/educational objective\s*:/i)
  const start = correct >= 0 ? correct : educational
  let body = ''
  if (start >= 0) {
    body = cleaned.slice(start).trim()
  } else {
    const afterChoices = cleaned.search(/\n\s*(?:incorrect answers|this patient|patients with)/i)
    if (afterChoices >= 0) body = cleaned.slice(afterChoices).trim()
  }
  if (!body) return ''
  body = body
    .replace(/\n(?:Previous|Next|Score Report|Lab Values|Calculator|Help|Pause)\b[\s\S]*$/i, '')
    .replace(/https?:\/\/\S+/gi, '')
  return unwrapProse(fixTypographics(stripFooterJunk(body)))
}

export function parseQuestionPage(text: string, pageNumber: number): ParsedQuestionDraft | null {
  const raw = cleanPageText(text)
  const item = extractItemNumber(raw)
  const cleaned = stripFooterJunk(stripChrome(raw))
  if (!cleaned || isLikelyCoverOrIndex(cleaned)) return null

  const { stem, choices, needsLabImage } = recoverQuestionLayout(cleaned, item?.item)
  if (!stem && choices.length === 0) return null

  const needsFigure = looksLikeFigureQuestion(stem || cleaned)
  const needsTableImage = looksLikeTableQuestion(stem || cleaned, choices) || looksLikeTableQuestion(cleaned, choices)
  let answerChoices = choices
  if (answerChoices.length < 2 && (needsFigure || needsTableImage)) {
    answerChoices = padStandardChoices(
      answerChoices,
      needsTableImage && /(?:^|\n)\s*(?:[O0•·*]\s*)?F\s*[).]/m.test(cleaned) ? 'F' : 'E'
    )
  }

  const warnings: string[] = []
  if (answerChoices.filter((choice) => choice.text.trim()).length < 2 && !needsFigure && !needsTableImage) {
    warnings.push('Fewer than two answer choices were detected.')
  }
  if (!stem || stem.length < 20) warnings.push('Question stem may be incomplete.')

  return {
    sourceItemNumber: item?.item ?? pageNumber,
    questionStem: stripExplanationFromStem(stem || cleaned),
    answerChoices,
    correctAnswer: extractCorrectAnswer(raw),
    explanation: extractExplanation(cleaned),
    parseWarnings: warnings,
    sourceQuestionPage: pageNumber,
    sourceAnswerPages: [],
    needsFigure,
    needsTableImage,
    needsLabImage
  }
}

export function parseAnswerPage(text: string, pageNumber: number): ParsedQuestionDraft | null {
  const raw = cleanPageText(text)
  const item = extractItemNumber(raw)
  const cleaned = stripChrome(raw)
  if (!cleaned || isLikelyCoverOrIndex(cleaned)) return null

  const { stem, choices } = recoverQuestionLayout(cleaned, item?.item)
  const correct = extractCorrectAnswer(raw)
  const explanation = extractExplanation(cleaned)

  if (!item && !correct && !explanation) return null

  const warnings: string[] = []
  if (!correct) warnings.push('Correct answer letter could not be identified automatically.')
  if (!explanation) warnings.push('Explanation text could not be isolated.')

  return {
    sourceItemNumber: item?.item ?? 0,
    questionStem: stripExplanationFromStem(stem),
    answerChoices: choices,
    correctAnswer: correct,
    explanation: explanation || cleaned,
    parseWarnings: warnings,
    sourceAnswerPages: [pageNumber],
    needsFigure: looksLikeFigureQuestion(stem || cleaned),
    needsTableImage: looksLikeTableQuestion(stem || cleaned, choices)
  }
}

function filledChoiceCount(choices: { label: string; text: string }[]): number {
  return choices.filter((choice) => choice.text.trim().length > 2).length
}

function looksLikeQuestionChoices(choices: { label: string; text: string }[]): boolean {
  const filled = choices.filter((choice) => choice.text.trim().length > 2)
  if (filled.length < 2) return false
  if (!/^[A-P]+$/.test(filled.map((choice) => choice.label).join(''))) return false
  if (filled[0].label !== 'A') return false
  const explanationLike = filled.filter((choice) =>
    /correct\s*answer|incorrect answers|educational objective|this option is|\bis incorrect\b/i.test(choice.text)
  ).length
  const long = filled.filter((choice) => choice.text.length > 180).length
  return explanationLike === 0 && long < Math.ceil(filled.length * 0.6)
}

function pickMergedChoices(question: ParsedQuestionDraft, answer: ParsedQuestionDraft): { label: string; text: string }[] {
  if (question.needsTableImage) return question.answerChoices
  if (looksLikeQuestionChoices(question.answerChoices)) return question.answerChoices
  if (
    filledChoiceCount(answer.answerChoices) > filledChoiceCount(question.answerChoices) &&
    looksLikeQuestionChoices(answer.answerChoices) &&
    choiceQuality(answer.answerChoices) > choiceQuality(question.answerChoices)
  ) {
    return answer.answerChoices
  }
  return question.answerChoices.length >= 2 ? question.answerChoices : answer.answerChoices
}

function choiceQuality(choices: { label: string; text: string }[]): number {
  const filled = choices.filter((choice) => choice.text.trim().length > 2).length
  let penalty = 0
  for (const choice of choices) {
    const text = choice.text
    if (/correct\s*answer|incorrect answers|educational objective|\([A-P]\s+is\s+correct\)/i.test(text)) penalty += 8
    if (/\s+[O0Q]\s*[A-P]\s*[\)\.]/.test(text)) penalty += 4
    if (/~\s*~|p,\s*r/i.test(text)) penalty += 3
    if (text.length > 280) penalty += 5
  }
  return filled * 10 - penalty
}

export function mergeQuestionAndAnswer(
  question: ParsedQuestionDraft,
  answer: ParsedQuestionDraft | undefined
): ParsedQuestionDraft {
  if (!answer) {
    return {
      ...question,
      parseWarnings: [
        ...question.parseWarnings,
        'No matching explanation page was found for this question.'
      ]
    }
  }

  const qChoices = pickMergedChoices(question, answer)

  const qStem = stripExplanationFromStem(question.questionStem)
  const aStem = stripExplanationFromStem(answer.questionStem ?? '')
  const qLen = qStem.replace(/\s+/g, ' ').length
  const stem = qLen >= 40 || qLen >= aStem.replace(/\s+/g, ' ').length * 0.5 ? qStem : aStem || qStem
  const needsFigure = question.needsFigure || answer.needsFigure || looksLikeFigureQuestion(stem)
  const needsTableImage = question.needsTableImage || answer.needsTableImage || looksLikeTableQuestion(stem, qChoices)
  let choices = qChoices
  if (choices.length < 2 && (needsFigure || needsTableImage)) {
    choices = padStandardChoices(choices)
  }

  return {
    sourceItemNumber: question.sourceItemNumber || answer.sourceItemNumber,
    questionStem: stripExplanationFromStem(stem),
    answerChoices: choices,
    correctAnswer: answer.correctAnswer ?? question.correctAnswer,
    explanation: answer.explanation || question.explanation,
    parseWarnings: [...question.parseWarnings, ...answer.parseWarnings.filter((w) => !question.parseWarnings.includes(w))],
    needsFigure,
    needsTableImage,
    needsLabImage: false,
    usedOriginalImage: question.usedOriginalImage,
    sourceQuestionPage: question.sourceQuestionPage,
    sourceAnswerPages: answer.sourceAnswerPages
  }
}

function coalesceQuestionDrafts(drafts: ParsedQuestionDraft[]): ParsedQuestionDraft[] {
  const byItem = new Map<number, ParsedQuestionDraft>()
  const leftovers: ParsedQuestionDraft[] = []
  for (const draft of drafts) {
    if (!draft.sourceItemNumber) {
      leftovers.push(draft)
      continue
    }
    const existing = byItem.get(draft.sourceItemNumber)
    if (!existing) {
      byItem.set(draft.sourceItemNumber, { ...draft, answerChoices: [...draft.answerChoices] })
      continue
    }
    const betterChoices =
      looksLikeQuestionChoices(draft.answerChoices) && !looksLikeQuestionChoices(existing.answerChoices)
        ? draft.answerChoices
        : looksLikeQuestionChoices(existing.answerChoices) && !looksLikeQuestionChoices(draft.answerChoices)
          ? existing.answerChoices
          : filledChoiceCount(draft.answerChoices) > filledChoiceCount(existing.answerChoices)
            ? draft.answerChoices
            : existing.answerChoices
    const betterStem =
      draft.questionStem.replace(/\s+/g, ' ').length > existing.questionStem.replace(/\s+/g, ' ').length
        ? draft.questionStem
        : existing.questionStem
    const stemFromDraft =
      draft.questionStem.replace(/\s+/g, ' ').length > existing.questionStem.replace(/\s+/g, ' ').length
    byItem.set(draft.sourceItemNumber, {
      ...existing,
      questionStem: stripExplanationFromStem(betterStem),
      answerChoices: betterChoices,
      correctAnswer: existing.correctAnswer ?? draft.correctAnswer,
      explanation: existing.explanation || draft.explanation,
      parseWarnings: [...existing.parseWarnings, ...draft.parseWarnings.filter((w) => !existing.parseWarnings.includes(w))],
      needsFigure: existing.needsFigure || draft.needsFigure,
      needsTableImage: existing.needsTableImage || draft.needsTableImage,
      needsLabImage: existing.needsLabImage || draft.needsLabImage,
      usedOriginalImage: existing.usedOriginalImage || draft.usedOriginalImage,
      sourceQuestionPage: stemFromDraft
        ? draft.sourceQuestionPage ?? existing.sourceQuestionPage
        : existing.sourceQuestionPage ?? draft.sourceQuestionPage
    })
  }
  return [...[...byItem.values()].sort((a, b) => a.sourceItemNumber - b.sourceItemNumber), ...leftovers]
}

function vignetteFingerprint(text: string): string {
  const clipped = stripExplanationFromStem(text).replace(/which of the following[\s\S]*$/i, '')
  const words = clipped
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 2 || /^\d{2,}$/.test(word))
  return words.slice(0, 12).join(' ')
}

function fingerprintScore(left: string, right: string): number {
  if (!left || !right) return 0
  if (left === right) return 100
  const prefix = left.slice(0, 48)
  if (prefix.length >= 24 && (left.startsWith(right.slice(0, 48)) || right.startsWith(prefix))) return 85
  const leftWords = new Set(left.split(' '))
  const rightWords = right.split(' ')
  if (rightWords.length === 0) return 0
  return (rightWords.filter((word) => leftWords.has(word)).length / rightWords.length) * 70
}

function takeBestAnswer(
  question: ParsedQuestionDraft,
  pool: ParsedQuestionDraft[]
): ParsedQuestionDraft | undefined {
  const target = vignetteFingerprint(question.questionStem)
  let bestIndex = -1
  let bestScore = 0
  pool.forEach((answer, index) => {
    const score = Math.max(
      fingerprintScore(target, vignetteFingerprint(answer.questionStem)),
      fingerprintScore(target, vignetteFingerprint(answer.explanation))
    )
    if (score > bestScore) {
      bestScore = score
      bestIndex = index
    }
  })
  if (bestIndex < 0 || bestScore < 40) return undefined
  return pool.splice(bestIndex, 1)[0]
}

export function assembleSet(
  questionPages: ParsedPage[],
  answerPages: ParsedPage[]
): { questions: ParsedQuestionDraft[]; warnings: string[] } {
  const questionDrafts: ParsedQuestionDraft[] = []
  for (const page of questionPages) {
    const parsed = parseQuestionPage(page.text, page.pageNumber)
    if (parsed) questionDrafts.push(parsed)
  }
  const coalesced = coalesceQuestionDrafts(questionDrafts)

  const answersByItem = new Map<number, ParsedQuestionDraft>()
  const orphanAnswers: ParsedQuestionDraft[] = []
  let lastAnswer: ParsedQuestionDraft | undefined
  for (const page of answerPages) {
    const parsed = parseAnswerPage(page.text, page.pageNumber)
    if (!parsed) continue
    if (parsed.sourceItemNumber > 0) {
      const existing = answersByItem.get(parsed.sourceItemNumber)
      if (existing) {
        existing.explanation = [existing.explanation, parsed.explanation].filter(Boolean).join('\n\n')
        existing.sourceAnswerPages.push(...parsed.sourceAnswerPages)
        existing.correctAnswer = existing.correctAnswer ?? parsed.correctAnswer
        if (choiceQuality(parsed.answerChoices) > choiceQuality(existing.answerChoices)) {
          existing.answerChoices = parsed.answerChoices
        }
        existing.needsFigure = existing.needsFigure || parsed.needsFigure
        existing.needsTableImage = existing.needsTableImage || parsed.needsTableImage
        lastAnswer = existing
      } else {
        answersByItem.set(parsed.sourceItemNumber, parsed)
        lastAnswer = parsed
      }
    } else if (parsed.correctAnswer && vignetteFingerprint(parsed.questionStem).split(' ').length >= 6) {
      orphanAnswers.push(parsed)
      lastAnswer = parsed
    } else if (lastAnswer) {
      lastAnswer.explanation = [lastAnswer.explanation, parsed.explanation].filter(Boolean).join('\n\n')
      lastAnswer.sourceAnswerPages.push(...parsed.sourceAnswerPages)
      lastAnswer.correctAnswer = lastAnswer.correctAnswer ?? parsed.correctAnswer
    } else {
      orphanAnswers.push(parsed)
    }
  }

  const unusedOrphans = [...orphanAnswers]
  const merged = coalesced.map((question) => {
    const byItem = answersByItem.get(question.sourceItemNumber)
    if (byItem) return mergeQuestionAndAnswer(question, byItem)
    return mergeQuestionAndAnswer(question, takeBestAnswer(question, unusedOrphans))
  })

  const sourceByItem = new Map<number, string>()
  for (const page of questionPages) {
    const item = extractItemNumber(page.text)?.item
    if (!item) continue
    sourceByItem.set(item, [sourceByItem.get(item), page.text].filter(Boolean).join('\n'))
  }

  let fallbackCount = 0
  for (const question of merged) {
    const source =
      sourceByItem.get(question.sourceItemNumber) ??
      questionPages.find((page) => page.pageNumber === question.sourceQuestionPage)?.text ??
      ''
    if (!source) continue
    const filledChoices = question.answerChoices.filter((choice) => choice.text.trim().length > 2).length
    const qc = qcStemAgainstSource(question.questionStem, source, {
      itemNumber: question.sourceItemNumber,
      filledChoices,
      needsFigure: question.needsFigure,
      needsTableImage: question.needsTableImage
    })
    if (!qc.ok) {
      fallbackCount += 1
      question.usedOriginalImage = true
      const detail = `${STEM_QC_WARNING} ${qc.reasons.join('; ')}`
      if (!question.parseWarnings.includes(detail)) question.parseWarnings.push(detail)
    }
  }

  const warnings: string[] = []
  const answerCount = answersByItem.size + orphanAnswers.length
  if (merged.length !== answerCount && answerCount > 0) {
    warnings.push(
      `Detected ${merged.length} question(s) and ${answerCount} answer/explanation item(s). Counts do not match.`
    )
  }
  if (merged.length === 0) {
    warnings.push('No questions could be extracted from the uploaded PDFs.')
  }
  if (fallbackCount > 0) {
    warnings.push(
      `${fallbackCount} question(s) will show the original PDF page because formatted text could not be generated reliably.`
    )
  }

  return { questions: merged, warnings }
}

export function textQualityScore(text: string): number {
  const cleaned = cleanPageText(text)
  if (!cleaned) return 0
  const letters = (cleaned.match(/[A-Za-z]/g) ?? []).length
  return letters
}

export function needsOcr(text: string): boolean {
  return textQualityScore(stripChrome(text)) < 80
}
