import { describe, expect, it } from 'vitest'
import { pairingKey, looksLikeAnswerPdf, looksLikeQuestionPdf } from '../shared/files'

describe('filename pairing heuristics', () => {
  it('pairs numbered forms used in the example folder', () => {
    expect(pairingKey('1 Q.pdf')).toBe(pairingKey('1A.pdf'))
    expect(pairingKey('10 Q.pdf')).toBe(pairingKey('10A.pdf'))
    expect(pairingKey('Question Set 2.pdf')).toBe(pairingKey('Question Set 2 Answers.pdf'))
  })

  it('classifies answer vs question names', () => {
    expect(looksLikeAnswerPdf('Set 1 Answers.pdf')).toBe(true)
    expect(looksLikeQuestionPdf('Set 1 Answers.pdf')).toBe(false)
    expect(looksLikeQuestionPdf('Set 1.pdf')).toBe(true)
  })
})
