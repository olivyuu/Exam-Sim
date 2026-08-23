import type { AnswerChoice } from './types'

export type ExcelSource = {
  questionNumber: number
  notes: string
  questionStem: string
  answerChoices: AnswerChoice[]
}

export function buildExcelRows(questions: ExcelSource[]): Array<[number, string, string, string]> {
  return questions
    .filter((question) => question.notes.trim().length > 0)
    .map((question) => [
      question.questionNumber,
      question.notes.trim(),
      question.questionStem.trim(),
      question.answerChoices.map((choice) => `${choice.label}. ${choice.text}`).join('\n')
    ])
}
