export const SECONDS_PER_QUESTION = 90
export const LOW_TIME_SECONDS = 5 * 60
export const CRITICAL_TIME_SECONDS = 60

export const APP_NAME = 'Practice Exam'

export type AppPhase =
  | 'setup'
  | 'importReview'
  | 'exam'
  | 'examReview'
  | 'endConfirm'
  | 'review'
  | 'exportPrompt'
  | 'exporting'
  | 'exportReady'
  | 'resetWarning'
  | 'deleteConfirm'

export type PairStatus = 'unmatched' | 'matched' | 'parsed' | 'mismatch' | 'error'

export type ReviewFilter = 'all' | 'flagged' | 'unanswered'

export type ReviewStatus = 'unanswered' | 'correct' | 'incorrect'

export interface FileMeta {
  id: string
  name: string
  path: string
  size: number
}

export interface AnswerChoice {
  label: string
  text: string
}

export interface QuestionImage {
  dataUrl: string
  width?: number
  height?: number
  kind?: 'figure' | 'table' | 'lab'
}

export interface TextHighlight {
  start: number
  end: number
  text: string
}

export interface Question {
  id: string
  questionNumber: number
  sourceItemNumber: number
  sourceQuestionPdf: string
  sourceQuestionPdfPath?: string
  sourceAnswerPdf: string
  sourceQuestionPage: number
  sourceAnswerPages: number[]
  questionStem: string
  questionImages: QuestionImage[]
  pageImageDataUrl?: string
  answerChoices: AnswerChoice[]
  correctAnswer: string | null
  explanation: string
  explanationImages: QuestionImage[]
  userAnswer: string | null
  flagged: boolean
  highlights: TextHighlight[]
  strikethroughChoices: string[]
  notes: string
  reviewStatus: ReviewStatus
  parseWarnings: string[]
  usedOriginalImage?: boolean
}

export interface QuestionSetSummary {
  id: string
  label: string
  questionPdf: FileMeta
  answerPdf: FileMeta | null
  status: PairStatus
  questionCount: number
  answerCount: number
  warnings: string[]
  error?: string
}

export interface ParseProgress {
  stage: string
  current: number
  total: number
  detail?: string
}

export interface SessionState {
  phase: AppPhase
  sets: QuestionSetSummary[]
  questions: Question[]
  currentIndex: number
  secondsRemaining: number
  timerRunning: boolean
  labSheet: FileMeta | null
  labOpen: boolean
  notesOpen: boolean
  calculatorOpen: boolean
  reviewOpen: boolean
  reviewFilter: ReviewFilter
  exportBuffer: number[] | null
  parseProgress: ParseProgress | null
  globalError: string | null
}

export function emptySession(): SessionState {
  return {
    phase: 'setup',
    sets: [],
    questions: [],
    currentIndex: 0,
    secondsRemaining: 0,
    timerRunning: false,
    labSheet: null,
    labOpen: false,
    notesOpen: false,
    calculatorOpen: false,
    reviewOpen: false,
    reviewFilter: 'all',
    exportBuffer: null,
    parseProgress: null,
    globalError: null
  }
}

export function computeReviewStatus(question: Pick<Question, 'userAnswer' | 'correctAnswer'>): ReviewStatus {
  if (!question.userAnswer) return 'unanswered'
  if (!question.correctAnswer) return 'unanswered'
  return question.userAnswer === question.correctAnswer ? 'correct' : 'incorrect'
}

export function totalTestSeconds(questionCount: number): number {
  return questionCount * SECONDS_PER_QUESTION
}

export function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  const seconds = safe % 60
  if (hours > 0) {
    return `${hours} hr ${String(minutes).padStart(2, '0')} min ${String(seconds).padStart(2, '0')} sec`
  }
  return `${minutes} min ${String(seconds).padStart(2, '0')} sec`
}

export function matrixStatus(question: Question): 'answered' | 'flagged' | 'unanswered' {
  if (question.flagged) return 'flagged'
  if (question.userAnswer) return 'answered'
  return 'unanswered'
}
