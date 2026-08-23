import { ExamHeader } from '../components/ExamHeader'
import { QuestionBody } from '../components/QuestionBody'
import { LabSheetPanel } from '../components/LabSheetPanel'
import { NotesModal, CalculatorModal } from '../components/NotesModal'
import { QuestionSidebar } from './ExamScreen'
import { useExamStore } from '../store'
import { reviewSubset } from '../../../shared/review'

export function ReviewScreen() {
  const questions = useExamStore((s) => s.questions)
  const currentIndex = useExamStore((s) => s.currentIndex)
  const reviewFilter = useExamStore((s) => s.reviewFilter)
  const labOpen = useExamStore((s) => s.labOpen)
  const labSheet = useExamStore((s) => s.labSheet)
  const setLabOpen = useExamStore((s) => s.setLabOpen)
  const next = useExamStore((s) => s.next)
  const prev = useExamStore((s) => s.prev)
  const beginExportPrompt = useExamStore((s) => s.beginExportPrompt)
  const setReviewFilter = useExamStore((s) => s.setReviewFilter)
  const question = questions[currentIndex]
  const subset = reviewSubset(questions, reviewFilter)

  if (!question) return null

  const correct = question.reviewStatus === 'correct'
  const unanswered = question.reviewStatus === 'unanswered'

  return (
    <div className="app-shell">
      <ExamHeader showTimer={false} reviewLabel="ANSWER KEY" />
      <div className="exam-body">
        <QuestionSidebar />
        <main className="question-pane">
          <div className="btn-row">
            <button className={`btn ${reviewFilter === 'all' ? 'primary' : ''}`} onClick={() => setReviewFilter('all')}>
              All
            </button>
            <button
              className={`btn ${reviewFilter === 'flagged' ? 'primary' : ''}`}
              onClick={() => setReviewFilter('flagged')}
            >
              Flagged
            </button>
            <button
              className={`btn ${reviewFilter === 'unanswered' ? 'primary' : ''}`}
              onClick={() => setReviewFilter('unanswered')}
            >
              Unanswered
            </button>
          </div>
          <QuestionBody question={question} mode="review" />
          <div className={`feedback ${correct ? '' : unanswered ? '' : 'incorrect'}`}>
            <h4>{unanswered ? 'Unanswered' : correct ? 'Correct' : 'Incorrect'}</h4>
            <div>Correct answer {question.correctAnswer ?? 'not identified from the explanation PDF'}</div>
          </div>
          <section className="explanation">
            <h3>EXPLANATION</h3>
            {question.explanation || 'No explanation text could be extracted for this item.'}
          </section>
          <div className="btn-row">
            <button className="btn" onClick={prev}>
              Previous
            </button>
            <button className="proceed" onClick={next}>
              Next
            </button>
            <span style={{ color: '#5b6773', alignSelf: 'center' }}>
              {subset.findIndex((q) => q.id === question.id) + 1} of {subset.length} in this review set
            </span>
          </div>
        </main>
        {labOpen && labSheet ? <LabSheetPanel filePath={labSheet.path} onClose={() => setLabOpen(false)} /> : null}
      </div>
      <footer className="exam-footer">
        <div>ANSWER KEY</div>
        <button className="tool-btn danger" onClick={beginExportPrompt}>
          <span className="icon">✕</span>
          <span>End Test</span>
        </button>
      </footer>
      <NotesModal />
      <CalculatorModal />
    </div>
  )
}
