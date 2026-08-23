import { useState } from 'react'
import { useExamStore } from '../store'

export function ExportFlow() {
  const phase = useExamStore((s) => s.phase)
  const globalError = useExamStore((s) => s.globalError)
  const questions = useExamStore((s) => s.questions)
  const exportExcel = useExamStore((s) => s.exportExcel)
  const saveExcel = useExamStore((s) => s.saveExcel)
  const requestDeleteWithoutExport = useExamStore((s) => s.requestDeleteWithoutExport)
  const cancelDelete = useExamStore((s) => s.cancelDelete)
  const confirmReset = useExamStore((s) => s.confirmReset)
  const setPhase = useExamStore((s) => s.setPhase)
  const [info, setInfo] = useState(false)
  const noted = questions.filter((q) => q.notes.trim()).length

  if (phase === 'exporting') {
    return (
      <div className="modal-screen">
        <h1>Creating your Excel file...</h1>
        <div className="progress-bar">
          <span style={{ width: '70%' }} />
        </div>
      </div>
    )
  }

  if (phase === 'exportReady') {
    return (
      <div className="modal-screen">
        <h1>Excel file created successfully.</h1>
        <p className="lede">{noted} noted question(s) are included.</p>
        <button className="btn primary" onClick={() => void saveExcel()}>
          DOWNLOAD EXCEL FILE
        </button>
      </div>
    )
  }

  if (phase === 'resetWarning') {
    return (
      <div className="modal-screen">
        <h1>Your previous test data will now be deleted.</h1>
        <p>This includes:</p>
        <ul>
          <li>Answers</li>
          <li>Flags</li>
          <li>Highlights</li>
          <li>Strikethroughs</li>
          <li>Notes</li>
          <li>Test progress</li>
          <li>Test results</li>
        </ul>
        <p>Are you sure you want to continue?</p>
        <div className="btn-row">
          <button className="btn primary" onClick={() => void confirmReset()}>
            START A NEW TEST
          </button>
          <button className="btn" onClick={() => setPhase('exportReady')}>
            Cancel
          </button>
        </div>
      </div>
    )
  }

  if (phase === 'deleteConfirm') {
    return (
      <div className="modal-screen">
        <h1>Are you sure?</h1>
        <p className="lede">
          Choosing "No" will permanently delete all data from this test, including your answers, flags, highlights,
          strikethroughs, notes, and test results. This cannot be undone.
        </p>
        <div className="btn-row">
          <button className="btn" onClick={cancelDelete}>
            CANCEL
          </button>
          <button className="btn danger" onClick={() => void confirmReset()}>
            YES, DELETE DATA
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-screen">
      <h1>Would you like to export your question data to an Excel document?</h1>
      {globalError ? <div className="error-banner">{globalError}</div> : null}
      <p className="lede" style={{ position: 'relative' }}>
        The Excel file will contain information only for questions that have a sticky note. {noted} question(s)
        currently have notes.{' '}
        <button className="info-bubble" onClick={() => setInfo((v) => !v)}>
          i
        </button>
        {info ? (
          <div className="info-pop">
            The Excel export contains only questions for which you created a sticky note.
            <br />
            <br />
            For each noted question, the spreadsheet will contain:
            <br />
            1. Question number
            <br />
            2. Your sticky note
            <br />
            3. Question stem
            <br />
            4. Answer choices
            <br />
            <br />
            Images from the question are not included.
          </div>
        ) : null}
      </p>
      <div className="btn-row">
        <button className="btn primary" onClick={() => void exportExcel()}>
          YES, EXPORT
        </button>
        <button className="btn" onClick={requestDeleteWithoutExport}>
          NO
        </button>
        <button className="btn" onClick={() => setPhase('review')}>
          Return to review
        </button>
      </div>
    </div>
  )
}
