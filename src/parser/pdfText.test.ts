import { describe, expect, it } from 'vitest'
import { collapseBrokenPdfSpaces, joinPdfTextItems } from './pdfText'

describe('pdfText', () => {
  it('joins Form 6 glyph runs and drops fake tiny spaces', () => {
    const y = 100
    const text = joinPdfTextItems([
      { str: 'On admissi', transform: [1, 0, 0, 1, 100, y], width: 132, height: 24 },
      { str: 'on', transform: [1, 0, 0, 1, 232, y], width: 28, height: 24 },
      { str: ' ', transform: [1, 0, 0, 1, 260, y], width: 0.09, height: 0 },
      { str: ', she is awake.', transform: [1, 0, 0, 1, 262, y], width: 180, height: 24 },
      { str: ' ', transform: [1, 0, 0, 1, 443, y], width: 0.3, height: 0 },
      { str: 'Her', transform: [1, 0, 0, 1, 452, y], width: 42, height: 24 },
      { str: ' ', transform: [1, 0, 0, 1, 494, y], width: 0.3, height: 0 },
      { str: 't', transform: [1, 0, 0, 1, 501, y], width: 7, height: 24 },
      { str: 'empe', transform: [1, 0, 0, 1, 508, y], width: 64, height: 24 },
      { str: 'rature is 38.3°C', transform: [1, 0, 0, 1, 573, y], width: 190, height: 24, hasEOL: true }
    ])
    expect(text).toMatch(/On admission, she is awake/)
    expect(text).toMatch(/Her temperature is 38\.3°C/)
    expect(text).not.toMatch(/admissi on/)
    expect(text).not.toMatch(/t empe/)
  })

  it('collapses spaced letters already present in a PDF string', () => {
    const text = collapseBrokenPdfSpaces(
      'A 37-year-old woman with diabetes me llitus has anx i ety and nu mb ness. Ce rvica l stenosis. Oral aspirin.'
    )
    expect(text).toMatch(/diabetes mellitus/)
    expect(text).toMatch(/anxiety/)
    expect(text).toMatch(/numbness/)
    expect(text).toMatch(/Cervical stenosis/)
    expect(text).toMatch(/Oral aspirin/)
  })

  it('does not smash normal exam prose', () => {
    const stem =
      'A 45-year-old man with hypertension is brought to the emergency department because of chest pain. Which of the following is the most appropriate next step?'
    expect(collapseBrokenPdfSpaces(stem)).toBe(stem)
  })
})
