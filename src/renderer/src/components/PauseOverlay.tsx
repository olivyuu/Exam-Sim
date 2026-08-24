import { formatClock } from '../../../shared/types'
import { useExamStore } from '../store'

export function PauseOverlay() {
  const resumeTimer = useExamStore((s) => s.resumeTimer)
  const secondsRemaining = useExamStore((s) => s.secondsRemaining)

  return (
    <div className="pause-overlay" role="dialog" aria-modal="true" aria-labelledby="pause-title">
      <div className="pause-card">
        <h1 id="pause-title">Timer paused</h1>
        <p>The timer is paused. This function is not available on a normal exam.</p>
        <p className="lede" style={{ marginBottom: 20 }}>
          Time remaining: {formatClock(secondsRemaining)}
        </p>
        <button className="btn primary" onClick={resumeTimer}>
          Resume exam
        </button>
      </div>
    </div>
  )
}
