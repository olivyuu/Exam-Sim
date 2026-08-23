import { useEffect, useState } from 'react'
import type { Question } from '../../../shared/types'
import { HighlightableText } from './HighlightableText'
import { AnswerChoices } from './AnswerChoices'
import { useExamStore } from '../store'
import { stripExplanationFromStem, ORIGINAL_PDF_FALLBACK_MESSAGE } from '../../../parser/examParser'

export function QuestionBody({
  question,
  mode
}: {
  question: Question
  mode: 'exam' | 'review' | 'preview'
}) {
  const selectAnswer = useExamStore((s) => s.selectAnswer)
  const toggleStrike = useExamStore((s) => s.toggleStrike)
  const setHighlights = useExamStore((s) => s.setHighlights)
  const [showOriginal, setShowOriginal] = useState(false)
  const figures = question.questionImages.filter((img) => img.kind === 'figure')
  const tables = question.questionImages.filter((img) => img.kind === 'table')
  const originalSrc = question.pageImageDataUrl
  const canShowOriginal = Boolean(originalSrc)
  const preferOriginal = Boolean(question.usedOriginalImage && originalSrc)

  useEffect(() => {
    setShowOriginal(preferOriginal)
  }, [question.id, preferOriginal])

  return (
    <>
      {canShowOriginal ? (
        <button
          className="btn original-toggle"
          type="button"
          onClick={() => setShowOriginal((open) => !open)}
        >
          {showOriginal ? 'Show formatted text' : 'Show image of original question'}
        </button>
      ) : null}
      {showOriginal && question.usedOriginalImage ? (
        <p className="original-fallback-note">{ORIGINAL_PDF_FALLBACK_MESSAGE}</p>
      ) : null}
      {showOriginal && originalSrc ? (
        <img className="question-original" src={originalSrc} alt="Original question from the uploaded PDF" />
      ) : (
        <div className="question-layout">
          <div className="question-copy">
            <HighlightableText
              text={stripExplanationFromStem(question.questionStem)}
              highlights={question.highlights}
              enabled={mode !== 'preview'}
              onChange={setHighlights}
            />
            {mode !== 'preview' ? (
              <p className="highlight-hint">
                Drag across question text to highlight.
                {question.highlights.length > 0 ? (
                  <button className="btn clear-hl" onClick={() => setHighlights([])}>
                    Clear highlights
                  </button>
                ) : null}
              </p>
            ) : null}
          </div>
          {figures.map((img, index) => (
            <img key={`fig-${index}`} className="question-figure" src={img.dataUrl} alt="Question figure" />
          ))}
        </div>
      )}
      {!showOriginal
        ? tables.map((img, index) => (
            <img key={`tbl-${index}`} className="question-table-image" src={img.dataUrl} alt="Tabular answer choices" />
          ))
        : null}
      <AnswerChoices
        question={question}
        mode={mode === 'preview' ? 'exam' : mode}
        onSelect={mode === 'exam' ? selectAnswer : () => undefined}
        onStrike={mode === 'preview' ? () => undefined : toggleStrike}
      />
    </>
  )
}
