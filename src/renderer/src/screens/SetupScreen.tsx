import { useExamStore } from '../store'

export function SetupScreen() {
  const sets = useExamStore((s) => s.sets)
  const globalError = useExamStore((s) => s.globalError)
  const parseProgress = useExamStore((s) => s.parseProgress)
  const addQuestionPdfs = useExamStore((s) => s.addQuestionPdfs)
  const addAnswerPdfs = useExamStore((s) => s.addAnswerPdfs)
  const assignAnswer = useExamStore((s) => s.assignAnswer)
  const replaceQuestion = useExamStore((s) => s.replaceQuestion)
  const replaceAnswer = useExamStore((s) => s.replaceAnswer)
  const removeSet = useExamStore((s) => s.removeSet)
  const clearAll = useExamStore((s) => s.clearAll)
  const parseAndReview = useExamStore((s) => s.parseAndReview)
  const labSheet = useExamStore((s) => s.labSheet)
  const setLabSheet = useExamStore((s) => s.setLabSheet)

  const unmatched = sets.some((s) => !s.answerPdf)
  const canStart = sets.length > 0 && !unmatched && !parseProgress

  return (
    <div className="setup">
      <h1>Practice Exam Setup</h1>
      <p className="lede">
        Upload your own question PDFs and matching answer/explanation PDFs. Nothing leaves this computer. The exam
        timer is 1.5 minutes per extracted question. Laboratory values are optional: add your own PDF below if you want
        Lab Values during the test.
      </p>
      {globalError ? <div className="error-banner">{globalError}</div> : null}

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Laboratory values PDF (optional)</h2>
        <p className="lede" style={{ marginBottom: 12 }}>
          Use a lab-reference sheet you are allowed to use. This is not required to start a test.
        </p>
        <div className="btn-row">
          <button
            className="btn"
            onClick={() =>
              void window.practiceExam.openPdfs('lab').then((files) => {
                if (files[0]) setLabSheet(files[0])
              })
            }
          >
            Choose lab values PDF
          </button>
          {labSheet ? (
            <button className="btn" onClick={() => setLabSheet(null)}>
              Remove lab PDF
            </button>
          ) : null}
        </div>
        <p style={{ margin: '12px 0 0', color: '#5b6773' }}>
          {labSheet
            ? `Using: ${labSheet.name}`
            : 'No lab PDF selected. Lab Values stays off until you add one.'}
        </p>
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <h2 style={{ marginTop: 0 }}>Question and answer PDFs</h2>
        <div className="btn-row">
          <button className="btn" onClick={() => window.practiceExam.openPdfs('question').then(addQuestionPdfs)}>
            Add Question PDF
          </button>
          <button className="btn" onClick={() => window.practiceExam.openPdfs('answer').then(addAnswerPdfs)}>
            Add Answer PDF
          </button>
          <button className="btn danger" onClick={clearAll}>
            Clear All
          </button>
        </div>
        <table className="pair-table">
          <thead>
            <tr>
              <th>Question PDF</th>
              <th>Answer / Explanation PDF</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sets.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ color: '#5b6773' }}>
                  No PDFs uploaded yet. Add question files first, then matching answer files.
                </td>
              </tr>
            ) : (
              sets.map((set) => (
                <tr key={set.id}>
                  <td>{set.questionPdf.name}</td>
                  <td>{set.answerPdf?.name ?? '— not matched —'}</td>
                  <td>
                    <span className={`status-pill ${set.answerPdf ? 'ok' : 'bad'}`}>
                      {set.answerPdf ? '✓ Matched' : 'Needs answer PDF'}
                    </span>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button
                        className="btn"
                        onClick={() => window.practiceExam.replacePdf().then((file) => file && replaceQuestion(set.id, file))}
                      >
                        Replace question
                      </button>
                      <button
                        className="btn"
                        onClick={() => window.practiceExam.replacePdf().then((file) => file && replaceAnswer(set.id, file))}
                      >
                        Replace answer
                      </button>
                      <button className="btn" onClick={() => assignAnswer(set.id, null)}>
                        Unmatch
                      </button>
                      <button className="btn danger" onClick={() => removeSet(set.id)}>
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {parseProgress ? (
        <div className="card" style={{ marginTop: 18 }}>
          <strong>{parseProgress.stage}</strong>
          <div>{parseProgress.detail}</div>
          <div className="progress-bar">
            <span style={{ width: `${parseProgress.total ? (100 * parseProgress.current) / parseProgress.total : 8}%` }} />
          </div>
        </div>
      ) : null}

      <div className="btn-row" style={{ marginTop: 24 }}>
        <button className="btn primary" disabled={!canStart} onClick={() => void parseAndReview()}>
          START TIMED PRACTICE TEST
        </button>
      </div>
      {!canStart && sets.length > 0 ? (
        <p className="lede">Match an answer PDF to every question PDF before starting.</p>
      ) : null}
    </div>
  )
}
