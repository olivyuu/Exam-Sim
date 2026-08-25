import { parseQuestionPage, type ParsedQuestionDraft } from './examParser'
import { looksLikeSpacedGlyphText } from './pdfText'

const VISUAL_KEEP_THRESHOLD = 0.72
const VISUAL_FALLBACK_THRESHOLD = 0.52

export function visualTokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 1)
}

export function scoreTextAgainstVisual(candidate: string, visual: string): number {
  const visualSet = new Set(visualTokens(visual))
  const candidateTokens = visualTokens(candidate)
  if (candidateTokens.length < 8 || visualSet.size < 8) return 0
  const hits = candidateTokens.filter((token) => visualSet.has(token)).length
  return hits / candidateTokens.length
}

export function questionTextBlob(draft: {
  questionStem: string
  answerChoices: { label: string; text: string }[]
}): string {
  return [draft.questionStem, ...draft.answerChoices.map((choice) => choice.text)].join(' ')
}

export function shouldCheckVisual(draft: ParsedQuestionDraft): boolean {
  if (draft.parseWarnings.some((warning) => /original (PDF|page|question)/i.test(warning))) return true
  const blob = questionTextBlob(draft)
  if (looksLikeSpacedGlyphText(blob)) return true
  const filled = draft.answerChoices.filter((choice) => choice.text.trim().length > 2).length
  return filled < 4 && !draft.needsFigure && !draft.needsTableImage
}

export function refineWithVisualPage(
  draft: ParsedQuestionDraft,
  visualText: string
): ParsedQuestionDraft {
  const visual = visualText.trim()
  if (!visual) return draft
  const currentBlob = questionTextBlob(draft)
  const currentScore = scoreTextAgainstVisual(currentBlob, visual)
  if (currentScore >= VISUAL_KEEP_THRESHOLD) return draft

  const visualParsed = parseQuestionPage(visual, draft.sourceQuestionPage ?? 1)
  const visualFilled = visualParsed
    ? visualParsed.answerChoices.filter((choice) => choice.text.trim().length > 2).length
    : 0
  const currentFilled = draft.answerChoices.filter((choice) => choice.text.trim().length > 2).length
  const currentBroken = looksLikeSpacedGlyphText(currentBlob)

  if (
    visualParsed &&
    visualFilled >= 2 &&
    visualFilled >= Math.min(4, currentFilled || 4) &&
    (currentBroken || currentScore < VISUAL_FALLBACK_THRESHOLD)
  ) {
    return {
      ...draft,
      questionStem: visualParsed.questionStem || draft.questionStem,
      answerChoices: visualParsed.answerChoices,
      parseWarnings: [
        ...draft.parseWarnings,
        'Question text was aligned to the original page image.'
      ]
    }
  }

  if (currentScore < VISUAL_FALLBACK_THRESHOLD && !draft.needsFigure && !draft.needsTableImage) {
    return {
      ...draft,
      parseWarnings: [
        ...draft.parseWarnings,
        'Formatted text may not match the original page image closely. Use “Show image of original question” if needed.'
      ]
    }
  }
  return draft
}
