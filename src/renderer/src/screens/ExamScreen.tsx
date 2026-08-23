import { QuestionBody } from '../components/QuestionBody'
import { LabSheetPanel } from '../components/LabSheetPanel'
import { NotesModal, CalculatorModal } from '../components/NotesModal'
import { ExamHeader } from '../components/ExamHeader'
import { useExamStore } from '../store'
import { useEffect } from 'react'
import { reviewSubset } from '../../../shared/review'

export function ExamScreen() {
  const questions = useExamStore((s) => s.questions)
  const currentIndex = useExamStore((s) => s.currentIndex)
  const labOpen = useExamStore((s) => s.labOpen)
  const labSheet = useExamStore((s) => s.labSheet)
  const tick = useExamStore((s) => s.tick)
  const next = useExamStore((s) => s.next)
  const setLabOpen = useExamStore((s) => s.setLabOpen)
  const persist = useExamStore((s) => s.persist)
  const openExamReview = useExamStore((s) => s.openExamReview)
  const requestEndExam = useExamStore((s) => s.requestEndExam)
  const question = questions[currentIndex]

  useEffect(() => {
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [tick])

  useEffect(() => {
    const id = window.setInterval(persist, 8000)
    return () => window.clearInterval(id)
  }, [persist])

  if (!question) return null

  return (
    <div className="app-shell">
      <ExamHeader showTimer />
      <div className="exam-body">
        <QuestionSidebar />
        <main className="question-pane">
          <QuestionBody question={question} mode="exam" />
          <button className="proceed" onClick={next}>
            Proceed to Next Item
          </button>
        </main>
        {labOpen && labSheet ? <LabSheetPanel filePath={labSheet.path} onClose={() => setLabOpen(false)} /> : null}
      </div>
      <footer className="exam-footer">
        <div>Practice block · {questions.length} items</div>
        <div className="footer-actions">
          <button className="tool-btn secondary" onClick={openExamReview}>
            <span className="icon">☰</span>
            <span>Review Questions</span>
          </button>
          <button className="tool-btn danger" onClick={requestEndExam}>
            <span className="icon">✕</span>
            <span>End Exam</span>
          </button>
        </div>
      </footer>
      <NotesModal />
      <CalculatorModal />
    </div>
  )
}

function QuestionSidebar() {
  const questions = useExamStore((s) => s.questions)
  const currentIndex = useExamStore((s) => s.currentIndex)
  const phase = useExamStore((s) => s.phase)
  const reviewFilter = useExamStore((s) => s.reviewFilter)
  const goTo = useExamStore((s) => s.goTo)
  const visible = phase === 'review' ? reviewSubset(questions, reviewFilter) : questions

  return (
    <aside className="question-sidebar">
      <h3>Question Status</h3>
      {visible.map((question) => {
        const index = questions.findIndex((q) => q.id === question.id)
        const reviewMark =
          question.reviewStatus === 'correct' ? '✓' : question.reviewStatus === 'incorrect' ? '✕' : '•'
        return (
          <button
            key={question.id}
            className={`qnum ${index === currentIndex ? 'current' : ''}`}
            onClick={() => goTo(phase === 'review' ? visible.findIndex((q) => q.id === question.id) : index)}
          >
            {phase === 'review' ? <span className={`status ${question.reviewStatus}`}>{reviewMark}</span> : null}
            <span>{question.questionNumber}</span>
            {question.flagged ? <span className="flag">⚑</span> : null}
          </button>
        )
      })}
    </aside>
  )
}

export { QuestionSidebar }
