import { beforeEach, describe, expect, it } from 'vitest'
import { useExamStore } from './store'
import type { Question } from '../../shared/types'

function sampleQuestion(n: number, extras: Partial<Question> = {}): Question {
  return {
    id: `q${n}`,
    questionNumber: n,
    sourceItemNumber: n,
    sourceQuestionPdf: 'Q.pdf',
    sourceAnswerPdf: 'A.pdf',
    sourceQuestionPage: n,
    sourceAnswerPages: [n],
    questionStem: `Stem ${n}`,
    questionImages: [],
    answerChoices: [
      { label: 'A', text: 'One' },
      { label: 'B', text: 'Two' },
      { label: 'C', text: 'Three' }
    ],
    correctAnswer: 'B',
    explanation: 'Because B.',
    explanationImages: [],
    userAnswer: null,
    flagged: false,
    highlights: [],
    strikethroughChoices: [],
    notes: '',
    reviewStatus: 'unanswered',
    parseWarnings: [],
    ...extras
  }
}

describe('exam store interactions', () => {
  beforeEach(() => {
    useExamStore.setState({
      ...useExamStore.getState(),
      phase: 'exam',
      questions: [sampleQuestion(1), sampleQuestion(2), sampleQuestion(3)],
      currentIndex: 0,
      secondsRemaining: 5,
      timerRunning: true
    })
  })

  it('selects, changes, flags, strikes, and keeps notes per question', () => {
    const store = useExamStore.getState()
    store.selectAnswer('A')
    store.toggleFlag()
    store.toggleStrike('C')
    store.setNotes('first note')
    store.next()
    store.selectAnswer('B')
    store.setNotes('second note')
    store.prev()
    const first = useExamStore.getState().questions[0]
    const second = useExamStore.getState().questions[1]
    expect(first.userAnswer).toBe('A')
    expect(first.flagged).toBe(true)
    expect(first.strikethroughChoices).toContain('C')
    expect(first.notes).toBe('first note')
    expect(second.userAnswer).toBe('B')
    expect(second.notes).toBe('second note')
    store.selectAnswer('C')
    expect(useExamStore.getState().questions[0].userAnswer).toBe('C')
  })

  it('ends the exam when the timer reaches zero', () => {
    useExamStore.setState({ secondsRemaining: 1, timerRunning: true, phase: 'exam' })
    useExamStore.getState().tick()
    expect(useExamStore.getState().phase).toBe('review')
    expect(useExamStore.getState().secondsRemaining).toBe(0)
  })

  it('keeps test-taking mode from Review Questions until End Exam is confirmed', () => {
    useExamStore.getState().openExamReview()
    expect(useExamStore.getState().phase).toBe('examReview')
    useExamStore.getState().requestEndExam()
    expect(useExamStore.getState().phase).toBe('endConfirm')
    useExamStore.getState().selectAnswer('B')
    expect(useExamStore.getState().questions[0].userAnswer).toBe(null)
    useExamStore.getState().confirmEndExam()
    expect(useExamStore.getState().phase).toBe('review')
  })

  it('scores review coloring from the stored key', () => {
    useExamStore.getState().selectAnswer('B')
    useExamStore.getState().confirmEndExam()
    expect(useExamStore.getState().questions[0].reviewStatus).toBe('correct')
    useExamStore.setState({
      phase: 'exam',
      questions: [sampleQuestion(1, { userAnswer: 'A' })],
      currentIndex: 0
    })
    useExamStore.getState().confirmEndExam()
    expect(useExamStore.getState().questions[0].reviewStatus).toBe('incorrect')
  })
})
