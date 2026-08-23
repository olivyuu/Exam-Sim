import { useEffect, useState } from 'react'
import { useExamStore } from '../store'

export function NotesModal() {
  const open = useExamStore((s) => s.notesOpen)
  const questions = useExamStore((s) => s.questions)
  const currentIndex = useExamStore((s) => s.currentIndex)
  const setNotes = useExamStore((s) => s.setNotes)
  const setNotesOpen = useExamStore((s) => s.setNotesOpen)
  const question = questions[currentIndex]
  const [draft, setDraft] = useState(question?.notes ?? '')

  useEffect(() => {
    setDraft(question?.notes ?? '')
  }, [question?.id, question?.notes, open])

  if (!open || !question) return null

  return (
    <div className="modal-backdrop" onClick={() => setNotesOpen(false)}>
      <div className="sticky" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>NOTES — Question {question.questionNumber}</h3>
        <textarea
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Type your notes here..."
        />
        <div className="btn-row">
          <button
            className="btn primary"
            onClick={() => {
              setNotes(draft)
              setNotesOpen(false)
            }}
          >
            Save
          </button>
          <button className="btn" onClick={() => setNotesOpen(false)}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export function CalculatorModal() {
  const open = useExamStore((s) => s.calculatorOpen)
  const setOpen = useExamStore((s) => s.setCalculatorOpen)
  const [display, setDisplay] = useState('0')
  const [store, setStore] = useState<number | null>(null)
  const [op, setOp] = useState<string | null>(null)
  const [fresh, setFresh] = useState(true)

  if (!open) return null

  const input = (digit: string) => {
    setDisplay((value) => (fresh || value === '0' ? digit : value + digit))
    setFresh(false)
  }
  const operate = (next: string) => {
    const current = Number(display)
    if (store === null || op === null) setStore(current)
    else setStore(compute(store, current, op))
    setOp(next)
    setFresh(true)
  }
  const equals = () => {
    if (store === null || op === null) return
    const result = compute(store, Number(display), op)
    setDisplay(String(result))
    setStore(null)
    setOp(null)
    setFresh(true)
  }

  return (
    <div className="modal-backdrop" onClick={() => setOpen(false)}>
      <div className="calculator" onClick={(e) => e.stopPropagation()}>
        <div className="calc-display">{display}</div>
        <div className="calc-grid">
          {['7', '8', '9', '/', '4', '5', '6', '*', '1', '2', '3', '-', '0', '.', 'C', '+'].map((key) => (
            <button
              key={key}
              onClick={() => {
                if (key === 'C') {
                  setDisplay('0')
                  setStore(null)
                  setOp(null)
                  setFresh(true)
                } else if ('+-*/'.includes(key)) operate(key)
                else input(key)
              }}
            >
              {key}
            </button>
          ))}
          <button onClick={equals} style={{ gridColumn: 'span 4' }}>
            =
          </button>
        </div>
      </div>
    </div>
  )
}

function compute(a: number, b: number, op: string): number {
  if (op === '+') return a + b
  if (op === '-') return a - b
  if (op === '*') return a * b
  if (op === '/') return b === 0 ? NaN : a / b
  return b
}
