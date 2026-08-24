import { CRITICAL_TIME_SECONDS, LOW_TIME_SECONDS, formatClock } from '../../../shared/types'
import { Icons } from './Icons'
import { useExamStore } from '../store'

export function ExamHeader({
  showTimer,
  reviewLabel
}: {
  showTimer: boolean
  reviewLabel?: string
}) {
  const questions = useExamStore((s) => s.questions)
  const currentIndex = useExamStore((s) => s.currentIndex)
  const secondsRemaining = useExamStore((s) => s.secondsRemaining)
  const timerPaused = useExamStore((s) => s.timerPaused)
  const pauseTimer = useExamStore((s) => s.pauseTimer)
  const resumeTimer = useExamStore((s) => s.resumeTimer)
  const labOpen = useExamStore((s) => s.labOpen)
  const notesOpen = useExamStore((s) => s.notesOpen)
  const calculatorOpen = useExamStore((s) => s.calculatorOpen)
  const labSheet = useExamStore((s) => s.labSheet)
  const prev = useExamStore((s) => s.prev)
  const next = useExamStore((s) => s.next)
  const toggleFlag = useExamStore((s) => s.toggleFlag)
  const setLabOpen = useExamStore((s) => s.setLabOpen)
  const chooseLabSheet = useExamStore((s) => s.chooseLabSheet)
  const setNotesOpen = useExamStore((s) => s.setNotesOpen)
  const setCalculatorOpen = useExamStore((s) => s.setCalculatorOpen)
  const question = questions[currentIndex]
  const warn = secondsRemaining <= LOW_TIME_SECONDS
  const critical = secondsRemaining <= CRITICAL_TIME_SECONDS

  return (
    <header className="exam-header">
      <div className="item-meta">
        <div className="kicker">
          Item {question?.questionNumber ?? 0} of {questions.length}
          {reviewLabel ? ` · ${reviewLabel}` : ''}
        </div>
        <button className={`mark-btn ${question?.flagged ? 'flagged' : ''}`} onClick={toggleFlag}>
          <span className="box">{question?.flagged ? '✓' : ''}</span>
          <span className="flag-dot">⚑</span>
          Mark
        </button>
      </div>
      <div className="header-center">
        <div>
          <button className="nav-arrow" onClick={prev} aria-label="Previous question">
            ‹
          </button>
          <div className="nav-caption">Previous</div>
        </div>
        <div className="progress-pill">
          {question?.questionNumber ?? 0} / {questions.length}
        </div>
        <div>
          <button className="nav-arrow" onClick={next} aria-label="Next question">
            ›
          </button>
          <div className="nav-caption">Next</div>
        </div>
      </div>
      {showTimer ? (
        <div className={`timer ${critical ? 'critical' : warn ? 'warn' : ''}`}>
          Time Remaining
          <div>{formatClock(secondsRemaining)}</div>
          <button
            className="pause-btn"
            type="button"
            onClick={timerPaused ? resumeTimer : pauseTimer}
          >
            {timerPaused ? 'Resume' : 'Pause'}
          </button>
        </div>
      ) : (
        <div className="timer">Review</div>
      )}
      <div className="tool-row">
        <button
          className={`tool-btn ${labOpen ? 'active' : ''}`}
          onClick={() => {
            if (labSheet) {
              setLabOpen(!labOpen)
              return
            }
            void chooseLabSheet().then((ok) => {
              if (ok) setLabOpen(true)
            })
          }}
          title={labSheet ? 'Lab sheet (L)' : 'Choose a lab values PDF'}
        >
          <span className="icon">{Icons.lab}</span>
          <span>Lab Values</span>
        </button>
        <button className={`tool-btn ${notesOpen ? 'active' : ''}`} onClick={() => setNotesOpen(!notesOpen)}>
          <span className="icon">{Icons.notes}</span>
          <span>Notes</span>
        </button>
        <button
          className={`tool-btn ${calculatorOpen ? 'active' : ''}`}
          onClick={() => setCalculatorOpen(!calculatorOpen)}
        >
          <span className="icon">{Icons.calc}</span>
          <span>Calculator</span>
        </button>
      </div>
    </header>
  )
}
