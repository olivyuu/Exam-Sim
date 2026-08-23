import type { Question } from '../../../shared/types'
import { matrixStatus } from '../../../shared/types'

export function QuestionMatrix({
  questions,
  onJump
}: {
  questions: Question[]
  onJump: (index: number) => void
}) {
  return (
    <div className="matrix">
      {questions.map((question, index) => (
        <button
          key={question.id}
          className={matrixStatus(question)}
          onClick={() => onJump(index)}
          title={`Question ${question.questionNumber}`}
        >
          {question.questionNumber}
        </button>
      ))}
    </div>
  )
}
