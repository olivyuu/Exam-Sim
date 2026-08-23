import type { Question, ReviewFilter } from './types'

export function reviewSubset<T extends Pick<Question, 'questionNumber' | 'flagged' | 'userAnswer'>>(
  questions: T[],
  filter: ReviewFilter
): T[] {
  if (filter === 'flagged') return questions.filter((q) => q.flagged)
  if (filter === 'unanswered') return questions.filter((q) => !q.userAnswer)
  return questions
}
