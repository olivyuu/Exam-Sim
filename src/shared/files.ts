export function createId(prefix = 'id'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`
}

export function normalizeFilename(name: string): string {
  return name
    .replace(/\.pdf$/i, '')
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function pairingKey(name: string): string {
  const base = normalizeFilename(name)
    .replace(/\b(answer|answers|explanation|explanations|key|solutions?)\b/g, '')
    .replace(/\bquestions?\b/g, '')
    .replace(/\bset\b/g, '')
    .replace(/\bq\b/g, '')
    .replace(/\ba\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const numeric = base.match(/^(\d+)/)
  if (numeric) return numeric[1]
  return base || normalizeFilename(name)
}

export function looksLikeAnswerPdf(name: string): boolean {
  const n = normalizeFilename(name)
  if (/\b(answer|answers|explanation|explanations|key|solutions?)\b/.test(n)) return true
  if (/\d+\s*a$/.test(n)) return true
  if (/a$/.test(n) && !/\bq$/.test(n)) return true
  return false
}

export function looksLikeQuestionPdf(name: string): boolean {
  const n = normalizeFilename(name)
  if (looksLikeAnswerPdf(name) && !/\bq\b/.test(n)) return false
  return true
}

export function formatDurationMinutes(questionCount: number): string {
  const minutes = questionCount * 1.5
  return Number.isInteger(minutes) ? `${minutes}` : minutes.toFixed(1)
}
