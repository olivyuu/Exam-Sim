import type { PracticeExamApi } from '../../preload/index'

declare global {
  interface Window {
    practiceExam: PracticeExamApi
  }
}

export {}
