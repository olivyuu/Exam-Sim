import { useExamStore } from '../store'
import { stripExplanationFromStem, ORIGINAL_PDF_FALLBACK_MESSAGE } from '../../../parser/examParser'
import { formatClock, totalTestSeconds } from '../../../shared/types'

export function ImportReviewScreen() {
  const sets = useExamStore((s) => s.sets)
  const questions = useExamStore((s) => s.questions)
  const startExam = useExamStore((s) => s.startExam)
  const clearAll = useExamStore((s) => s.clearAll)
  const currentIndex = useExamStore((s) => s.currentIndex)
  const goTo = useExamStore((s) => s.goTo)
  const question = questions[currentIndex]
  const total = questions.length
  const mismatch = sets.some((s) => s.status === 'mismatch' || s.status === 'error')
  const missingAnswers = questions.filter((q) => !q.correctAnswer).length
  const originalFallbacks = questions.filter((q) => q.usedOriginalImage).length

  return (
    <div className="setup">
      <h1>Import validation</h1>
      <p className="lede">
        Review what was extracted before the timer starts. If counts do not match, fix the PDFs or proceed only if you
        accept the warning.
      </p>
      <div className="summary">
        {sets.map((set) => (
          <div className="set-block" key={set.id}>
            <h3>{set.label}</h3>
            <div>✓ Question PDF loaded — {set.questionPdf.name}</div>
            <div>✓ Answer PDF loaded — {set.answerPdf?.name}</div>
            <div>
              {set.questionCount > 0 ? '✓' : '✕'} {set.questionCount} questions detected
            </div>
            <div>
              {set.answerCount > 0 ? '✓' : '✕'} {set.answerCount} explanation items detected
            </div>
            {set.warnings.length > 0 ? (
              <ul className="warn-list">
                {set.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            ) : null}
            {set.error ? <div className="error-banner">{set.error}</div> : null}
          </div>
        ))}
      </div>
      <p>
        <strong>Total Questions:</strong> {total}
        <br />
        <strong>Total Test Time:</strong> {total * 1.5} minutes ({formatClock(totalTestSeconds(total))})
      </p>
      {missingAnswers > 0 ? (
        <div className="error-banner">
          {missingAnswers} item(s) could not be fully keyed from the explanation PDF. You can still take the test.
        </div>
      ) : null}
      {originalFallbacks > 0 ? (
        <div className="error-banner">
          {originalFallbacks} item(s) will show the original PDF page because formatted text could not be generated
          reliably.
        </div>
      ) : null}
      {mismatch ? (
        <div className="error-banner">
          One or more sets have mismatched question/answer counts. The pairing was not assumed to be correct.
        </div>
      ) : null}

      {question ? (
        <div className="card" style={{ marginTop: 18 }}>
          <h3 style={{ marginTop: 0 }}>
            Preview item {question.questionNumber} of {total}
          </h3>
          {question.usedOriginalImage && question.pageImageDataUrl ? (
            <>
              <p className="original-fallback-note">{ORIGINAL_PDF_FALLBACK_MESSAGE}</p>
              <img
                className="question-original"
                src={question.pageImageDataUrl}
                alt="Original question from the uploaded PDF"
              />
            </>
          ) : (
            <p>
              {stripExplanationFromStem(question.questionStem).slice(0, 500)}
              {question.questionStem.length > 500 ? '…' : ''}
            </p>
          )}
          <ol type="A">
            {question.answerChoices.map((choice) => (
              <li key={choice.label}>{choice.text}</li>
            ))}
          </ol>
          {question.parseWarnings.length > 0 ? (
            <ul className="warn-list">
              {question.parseWarnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          ) : null}
          <div className="btn-row">
            <button className="btn" onClick={() => goTo(currentIndex - 1)}>
              Previous extracted item
            </button>
            <button className="btn" onClick={() => goTo(currentIndex + 1)}>
              Next extracted item
            </button>
          </div>
        </div>
      ) : null}

      <div className="btn-row">
        <button className="btn primary" disabled={total === 0} onClick={startExam}>
          START TIMED PRACTICE TEST
        </button>
        <button className="btn" onClick={clearAll}>
          Back to setup
        </button>
      </div>
    </div>
  )
}
