export type PdfTextItem = {
  str?: string
  transform?: number[]
  width?: number
  height?: number
  hasEOL?: boolean
}

const TINY_SPACE_WIDTH = 1.6

const KEEP_WORDS = new Set(
  `
    a an and are as at be but by can did do does for from had has have he her hers him his
    how if in into is it its may me my no nor not of on or our out per she so than that
    the their them then there these they this those to too up us was we were what when
    where which who will with would you your
    also both each more most only over some such than then very
    after before during since until while about against between without within
    left right upper lower acute chronic mild severe high low more less
    pain rash mass cyst cell lung bone skin iron oral risk diet rest test scan rate
    chest
    time week weeks day days hour hours year years month months male female
    plus note show shown next last past once also into over most both each such
    come came take took give given find found seen done poor good many much
    type size area side part body blood heart liver kidney brain nerve bone
    mill min mg dl mm hg cbc iv im po
    man men woman women old one two new few all any own end use way
    young adult child boy girl long short big small
    has had have been being does did doing
    most more less than then
    likely diagnosis treatment history patient patients
    year years old
    brought comes come came given found seen
    because after before during since until while
    which what when where who whom
    following appropriate next step
    emergency department office physician hospital
    examination shows show shown
    temperature pulse respirations pressure
    cranial muscle strength
    oral aspirin warfarin
    stenosis disorder neuropathy
    plexopathy syringomyelia
    conversion diabetic cervical brachial
  `
    .trim()
    .split(/\s+/)
)

export function joinPdfTextItems(items: PdfTextItem[]): string {
  const rows = items
    .map((item) => ({
      str: item.str ?? '',
      x: item.transform ? item.transform[4] : 0,
      y: item.transform ? item.transform[5] : 0,
      width: item.width ?? 0,
      height: item.height ?? 0,
      hasEOL: Boolean(item.hasEOL)
    }))
    .filter((item) => item.str)

  rows.sort((left, right) => (Math.abs(right.y - left.y) > 2 ? right.y - left.y : left.x - right.x))

  const lines: string[] = []
  let line = ''
  let lastY: number | null = null
  let lastX: number | null = null
  let lastWidth = 0
  let lastLen = 1
  let lastHeight = 12

  const flush = () => {
    if (line) lines.push(line)
    line = ''
    lastX = null
    lastWidth = 0
  }

  for (const item of rows) {
    if (/^\s+$/.test(item.str)) {
      if (item.width >= TINY_SPACE_WIDTH && line.length > 0 && !line.endsWith(' ')) line += ' '
      if (item.hasEOL) flush()
      continue
    }

    const superscript =
      lastY !== null &&
      /^[0-9]$/.test(item.str) &&
      /\/mm\s*$/i.test(line) &&
      Math.abs(item.y - lastY) < 14
    if (superscript) {
      line += item.str === '3' ? '³' : item.str
      lastX = item.x
      lastWidth = item.width
      lastLen = 1
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
      flush()
      line = item.str
    } else if (line.length > 0) {
      const gap = item.x - ((lastX ?? 0) + lastWidth)
      const em = lastHeight || item.height || 12
      const charW = lastWidth / Math.max(lastLen, 1)
      const needsSpace =
        !line.endsWith(' ') &&
        !item.str.startsWith(' ') &&
        gap > Math.max(em * 0.12, charW * 0.28, 2.2)
      line += (needsSpace ? ' ' : '') + item.str
    } else {
      line = item.str
    }

    lastY = item.y
    lastX = item.x
    lastWidth = item.width
    lastLen = Math.max(item.str.replace(/\s+/g, '').length, 1)
    lastHeight = item.height || lastHeight
    if (item.hasEOL) flush()
  }
  if (line) lines.push(line)
  return lines.join('\n')
}

export function looksLikeSpacedGlyphText(text: string): boolean {
  const tokens = text.split(/\s+/).filter((token) => /^[A-Za-z]{2,}$/.test(token))
  const leftover = [...text.matchAll(/\b([A-Za-z]{2,5}) ([a-z]{3,7})\b/g)].filter(([, left, right]) => {
    return !KEEP_WORDS.has(left.toLowerCase()) && !KEEP_WORDS.has(right.toLowerCase())
  })
  const dangling = [...text.matchAll(/\b([A-Za-z]{4,8}) ([a-z])\b/g)].filter(([, left]) => {
    return !KEEP_WORDS.has(left.toLowerCase())
  })
  if (leftover.length + dangling.length >= 2) return true
  if (tokens.length < 8) return false
  const odd = tokens.filter((token) => token.length <= 3 && !KEEP_WORDS.has(token.toLowerCase())).length
  return odd / tokens.length >= 0.12
}

function isGlyphFragment(word: string): boolean {
  const lower = word.toLowerCase()
  if (KEEP_WORDS.has(lower)) return false
  if (word.length <= 3) return true
  if (word.length <= 6 && /^[^aeiou]{2}/i.test(word)) return true
  if (word.length === 4 && !KEEP_WORDS.has(lower)) return true
  return false
}

function shouldJoinGlyphs(left: string, right: string): boolean {
  const a = left.toLowerCase()
  const b = right.toLowerCase()
  if (isGlyphFragment(left) && isGlyphFragment(right)) return true
  if (a === 'me' && isGlyphFragment(right) && /^[^aeiou]{2}/i.test(right)) return true
  if (left.length === 1 && isGlyphFragment(right) && !KEEP_WORDS.has(b)) return true
  if (left.length === 1 && /^[aeiou]/i.test(right) && right.length >= 4 && !KEEP_WORDS.has(b)) return true
  if (isGlyphFragment(left) && !KEEP_WORDS.has(b) && right.length >= 3 && left.length <= 4) return true
  if (!KEEP_WORDS.has(a) && isGlyphFragment(right) && right.length <= 3 && left.length >= 4) return true
  if (left.length >= 4 && /^(pathy|plasia|penia|itis|emia|osis|oma)$/i.test(right)) return true
  if (left.length >= 3 && /^(ly|ing|ness|tion|sion|ety|iety|ous|able|ment|ities|alities)$/i.test(right)) {
    return true
  }
  return false
}

function joinGlyphTokens(text: string): string {
  return text.split('\n').map(joinGlyphLine).join('\n')
}

function splitAffixes(token: string): { lead: string; core: string; trail: string } {
  const match = token.match(/^([^A-Za-z]*)([A-Za-z]+)([^A-Za-z]*)$/)
  if (!match) return { lead: '', core: token, trail: '' }
  return { lead: match[1], core: match[2], trail: match[3] }
}

function joinGlyphLine(line: string): string {
  const words = line.split(/[^\S\n]+/)
  const out: string[] = []
  for (const word of words) {
    const previous = out[out.length - 1]
    if (!previous) {
      out.push(word)
      continue
    }
    const left = splitAffixes(previous)
    const right = splitAffixes(word)
    if (
      left.trail === '' &&
      right.lead === '' &&
      /^[A-Za-z]+$/.test(left.core) &&
      /^[a-z]+$/.test(right.core) &&
      shouldJoinGlyphs(left.core, right.core)
    ) {
      out[out.length - 1] = left.lead + left.core + right.core + right.trail
    } else {
      out.push(word)
    }
  }
  return out.join(' ')
}

export function collapseBrokenPdfSpaces(text: string): string {
  let next = text.replace(/(?<=[A-Za-z])!(?=\s*[a-z])/g, 'l')
  next = next.replace(/(\d)\s+\.\s*(\d)/g, '$1.$2')
  next = next.replace(/\b(\d)\s+(\d)\./g, '$1$2.')
  next = next.replace(/([A-Za-z]\/[A-Za-z])\s+([A-Za-z])\b/g, '$1$2')
  if (!looksLikeSpacedGlyphText(next)) return next

  let previous = ''
  for (let i = 0; i < 8 && next !== previous; i++) {
    previous = next
    next = joinGlyphTokens(next)
  }
  return next
}
