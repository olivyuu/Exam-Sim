import { describe, expect, it } from 'vitest'
import { parseQuestionPage } from './examParser'
import {
  questionTextBlob,
  refineWithVisualPage,
  scoreTextAgainstVisual,
  shouldCheckVisual
} from './visualMatch'

const VISUAL_PAGE = `Exam Section : Item 1 of 50
1. A 37-year-old woman with type 1 diabetes mellitus is brought to the emergency department because of anxiety. Which of the following is the most likely diagnosis?
O A) Brachial plexopathy
O B) Cervical stenosis
O C) Conversion disorder
O D) Diabetic polyneuropathy
O E) Syringomyelia`

describe('visualMatch', () => {
  it('scores a matching stem higher than a spaced-glyph stem', () => {
    const parsed = parseQuestionPage(VISUAL_PAGE, 1)
    expect(parsed).not.toBeNull()
    const good = scoreTextAgainstVisual(questionTextBlob(parsed!), VISUAL_PAGE)
    const bad = scoreTextAgainstVisual(
      'A woman with diabetes me llitus has anx i ety and nu mb ness r ecent ly during numerous cranial muscle findings extra filler words here',
      VISUAL_PAGE
    )
    expect(good).toBeGreaterThan(bad)
    expect(good).toBeGreaterThan(0.72)
  })

  it('replaces parsed text when the original page image OCR is closer', () => {
    const broken = {
      sourceItemNumber: 1,
      questionStem:
        'An unrelated generated paragraph about lakes mountains forests and weather systems that is long enough to score.',
      answerChoices: [
        { label: 'A', text: 'Alpha option one' },
        { label: 'B', text: 'Bravo option two' },
        { label: 'C', text: 'Charlie option three' },
        { label: 'D', text: 'Delta option four' },
        { label: 'E', text: 'Echo option five' }
      ],
      correctAnswer: 'D',
      explanation: 'keep me',
      parseWarnings: [],
      sourceQuestionPage: 1,
      sourceAnswerPages: []
    }
    const refined = refineWithVisualPage(broken, VISUAL_PAGE)
    expect(refined.questionStem).toMatch(/diabetes mellitus/)
    expect(refined.questionStem).toMatch(/anxiety/)
    expect(refined.answerChoices.map((choice) => choice.text)).toEqual([
      'Brachial plexopathy',
      'Cervical stenosis',
      'Conversion disorder',
      'Diabetic polyneuropathy',
      'Syringomyelia'
    ])
    expect(refined.correctAnswer).toBe('D')
    expect(refined.explanation).toBe('keep me')
    expect(refined.usedOriginalImage).toBeFalsy()
  })

  it('keeps a parse that already matches the original page', () => {
    const good = parseQuestionPage(VISUAL_PAGE, 1)
    expect(good).not.toBeNull()
    const refined = refineWithVisualPage(good!, VISUAL_PAGE)
    expect(refined.questionStem).toBe(good!.questionStem)
    expect(refined.parseWarnings).toEqual(good!.parseWarnings)
    expect(shouldCheckVisual(good!)).toBe(false)
    expect(shouldCheckVisual({ ...good!, usedOriginalImage: true })).toBe(true)
    expect(
      shouldCheckVisual({
        ...good!,
        answerChoices: good!.answerChoices.slice(0, 2)
      })
    ).toBe(true)
  })

  it('does not replace a fluent parse when page OCR is only a partial match', () => {
    const good = parseQuestionPage(VISUAL_PAGE, 1)
    expect(good).not.toBeNull()
    const blob = questionTextBlob(good!)
    const partial =
      blob
        .split(/\s+/)
        .filter((_, index) => index % 3 !== 0)
        .join(' ') + ' extra ocr noise banners headers timers remaining calculator'
    expect(scoreTextAgainstVisual(blob, partial)).toBeGreaterThan(0.52)
    expect(scoreTextAgainstVisual(blob, partial)).toBeLessThan(0.72)
    const refined = refineWithVisualPage(good!, partial)
    expect(refined.questionStem).toBe(good!.questionStem)
    expect(refined.parseWarnings).toEqual(good!.parseWarnings)
  })
})
