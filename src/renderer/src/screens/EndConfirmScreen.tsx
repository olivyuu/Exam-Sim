import { useEffect } from 'react'
import { useExamStore } from '../store'

export function EndConfirmScreen() {
  const confirmEndExam = useExamStore((s) => s.confirmEndExam)
  const returnToExam = useExamStore((s) => s.returnToExam)
  const openExamReview = useExamStore((s) => s.openExamReview)
  const tick = useExamStore((s) => s.tick)

  useEffect(() => {
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [tick])

  return (
    <div className="modal-screen">
      <h1>End this exam?</h1>
      <p className="lede">
        After you confirm, you will not be able to change answers. The next screen shows your selections, the correct
        answers, and explanations from your answer PDFs.
      </p>
      <div className="btn-row">
        <button className="btn" onClick={returnToExam}>
          Cancel, keep testing
        </button>
        <button className="btn" onClick={openExamReview}>
          Review Questions
        </button>
        <button className="btn primary" onClick={confirmEndExam}>
          End Exam
        </button>
      </div>
    </div>
  )
}
