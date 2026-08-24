import { Component, type ErrorInfo, type ReactNode, useEffect } from 'react'
import { SetupScreen } from './screens/SetupScreen'
import { ImportReviewScreen } from './screens/ImportReviewScreen'
import { ExamScreen } from './screens/ExamScreen'
import { ExamMatrixScreen } from './screens/ExamMatrixScreen'
import { EndConfirmScreen } from './screens/EndConfirmScreen'
import { ReviewScreen } from './screens/ReviewScreen'
import { ExportFlow } from './screens/ExportFlow'
import { PauseOverlay } from './components/PauseOverlay'
import { useExamStore } from './store'
import { useExamHotkeys } from './useExamHotkeys'

class ErrorBoundary extends Component<{ children: ReactNode }, { message: string | null }> {
  state = { message: null as string | null }

  static getDerivedStateFromError(error: unknown) {
    const raw = error instanceof Error ? error.message : String(error)
    const dump = raw.length > 180 || /jsxRuntime|@__PURE__|WorkerMessageHandler|pdfjsWorker|children:\s*\[/.test(raw)
    return {
      message: dump
        ? 'The app hit an internal error while starting. Quit Practice Exam completely and open it again.'
        : raw
    }
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error(error, info.componentStack)
  }

  render() {
    if (this.state.message) {
      return (
        <div className="setup">
          <h1>Practice Exam</h1>
          <div className="error-banner">{this.state.message}</div>
        </div>
      )
    }
    return this.props.children
  }
}

function ExamApp() {
  const phase = useExamStore((s) => s.phase)
  const timerPaused = useExamStore((s) => s.timerPaused)
  const setLabSheet = useExamStore((s) => s.setLabSheet)
  useExamHotkeys()

  useEffect(() => {
    if (phase !== 'setup') return
    void window.practiceExam.getDefaultLab().then((file) => {
      if (file && !useExamStore.getState().labSheet) setLabSheet(file)
    })
  }, [setLabSheet, phase])

  if (phase === 'setup') return <SetupScreen />
  if (phase === 'importReview') return <ImportReviewScreen />
  const exam =
    phase === 'exam' ? (
      <ExamScreen />
    ) : phase === 'examReview' ? (
      <ExamMatrixScreen />
    ) : phase === 'endConfirm' ? (
      <EndConfirmScreen />
    ) : phase === 'review' ? (
      <ReviewScreen />
    ) : (
      <ExportFlow />
    )
  return (
    <>
      {exam}
      {timerPaused ? <PauseOverlay /> : null}
    </>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <ExamApp />
    </ErrorBoundary>
  )
}
