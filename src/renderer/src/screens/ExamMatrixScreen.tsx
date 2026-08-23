import { useEffect } from 'react'
import { useExamStore } from '../store'
import { QuestionMatrix } from '../components/QuestionMatrix'
import { formatClock } from '../../../shared/types'

export function ExamMatrixScreen() {
  const questions = useExamStore((s) => s.questions)
  const goTo = useExamStore((s) => s.goTo)
  const returnToExam = useExamStore((s) => s.returnToExam)
  const requestEndExam = useExamStore((s) => s.requestEndExam)
  const tick = useExamStore((s) => s.tick)
  const secondsRemaining = useExamStore((s) => s.secondsRemaining)
  const answered = questions.filter((q) => q.userAnswer).length
  const flagged = questions.filter((q) => q.flagged).length
  const unanswered = questions.filter((q) => !q.userAnswer).length

  useEffect(() => {
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [tick])

  return (
    <div className="completed">
      <h1>Review Questions</h1>
      <p className="lede">
        You are still taking the exam. Click a question number to return to that item. Answers, flags, and notes are
        kept. Time remaining: {formatClock(secondsRemaining)}.
      </p>
      <p>
        Answered {answered} · Flagged {flagged} · Unanswered {unanswered} · Total {questions.length}
      </p>
      <p>Green = answered · Yellow = flagged · Red = unanswered. Flagged is shown if both apply.</p>
      <QuestionMatrix
        questions={questions}
        onJump={(index) => {
          goTo(index)
          returnToExam()
        }}
      />
      <div className="btn-row">
        <button className="btn primary" onClick={returnToExam}>
          Return to questions
        </button>
        <button className="btn danger" onClick={requestEndExam}>
          End Exam
        </button>
      </div>
    </div>
  )
}
