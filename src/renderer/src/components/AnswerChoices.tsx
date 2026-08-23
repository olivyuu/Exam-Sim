import type { AnswerChoice, Question } from '../../../shared/types'

export function AnswerChoices({
  question,
  mode,
  onSelect,
  onStrike
}: {
  question: Question
  mode: 'exam' | 'review' | 'preview'
  onSelect: (label: string) => void
  onStrike: (label: string) => void
}) {
  return (
    <div className="choice-box">
      {question.answerChoices.map((choice) => {
        const selected = question.userAnswer === choice.label
        const struck = question.strikethroughChoices.includes(choice.label)
        const correct = mode === 'review' && question.correctAnswer === choice.label
        const incorrect = mode === 'review' && selected && question.correctAnswer !== choice.label
        return (
          <div
            key={choice.label}
            className={[
              'choice',
              selected ? 'selected' : '',
              struck ? 'struck' : '',
              correct ? 'correct' : '',
              incorrect ? 'incorrect' : ''
            ].join(' ')}
            onClick={(event) => {
              if (event.ctrlKey) {
                event.preventDefault()
                onStrike(choice.label)
                return
              }
              onSelect(choice.label)
            }}
            onContextMenu={(event) => {
              event.preventDefault()
              onStrike(choice.label)
            }}
            role="button"
            tabIndex={0}
          >
            <span className="radio" />
            <span className="choice-text">
              {choice.label}. {choice.text}
            </span>
            <button
              className="strike-icon"
              title="Strike through this option"
              onClick={(event) => {
                event.stopPropagation()
                onStrike(choice.label)
              }}
            >
              <span className="strike-abc">abc</span>
            </button>
          </div>
        )
      })}
    </div>
  )
}

export function choiceSummary(choices: AnswerChoice[]): string {
  return choices.map((choice) => `${choice.label}. ${choice.text}`).join('\n')
}
