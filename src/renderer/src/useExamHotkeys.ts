import { useEffect } from 'react'
import { useExamStore } from './store'

export function useExamHotkeys() {
  const phase = useExamStore((s) => s.phase)
  const next = useExamStore((s) => s.next)
  const prev = useExamStore((s) => s.prev)
  const toggleFlag = useExamStore((s) => s.toggleFlag)
  const labOpen = useExamStore((s) => s.labOpen)
  const labSheet = useExamStore((s) => s.labSheet)
  const setLabOpen = useExamStore((s) => s.setLabOpen)
  const notesOpen = useExamStore((s) => s.notesOpen)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const typing =
        target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      if (typing || notesOpen) return
      if (phase !== 'exam' && phase !== 'review' && phase !== 'examReview') return
      if (event.key === 'ArrowRight') {
        event.preventDefault()
        next()
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault()
        prev()
      } else if (event.key.toLowerCase() === 'f' && !event.metaKey && !event.ctrlKey) {
        event.preventDefault()
        toggleFlag()
      } else if (event.key.toLowerCase() === 'l' && !event.metaKey && !event.ctrlKey && labSheet) {
        event.preventDefault()
        setLabOpen(!labOpen)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, next, prev, toggleFlag, labOpen, labSheet, setLabOpen, notesOpen])
}
