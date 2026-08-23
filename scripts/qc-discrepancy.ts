import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { assembleSet, extractCorrectAnswer, hasExplanationLeak, stripExplanationFromStem } from '../src/parser/examParser'

const FORMS = ['3', '4', '5', '6', '7', '8', '9', '10']
const ROOT = '/tmp/exam_parse/forms'

function norm(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokens(text: string, count = 10): string[] {
  return norm(stripExplanationFromStem(text))
    .split(' ')
    .filter((word) => word.length > 2 || /^\d{2,}$/.test(word))
    .slice(0, count)
}

function overlap(needle: string[], haystack: string): number {
  if (needle.length === 0) return 0
  const hay = ` ${norm(haystack)} `
  const hits = needle.filter((word) => hay.includes(` ${word} `)).length
  return hits / needle.length
}

function sourceForItem(
  pages: Array<{ text: string; pageNumber: number }>,
  item: number,
  kind: 'q' | 'a'
): string {
  const header = new RegExp(`(?:item|question)\\s+${item}\\s+(?:of|ot|0t|or|/)`, 'i')
  const matched = pages.filter((page) => header.test(page.text))
  if (matched.length > 0) return matched.map((page) => page.text).join('\n')
  if (kind === 'a') return pages.map((page) => page.text).join('\n')
  return ''
}

type Issue = { form: string; item: number; kind: string; detail: string }

const issues: Issue[] = []
for (const form of FORMS) {
  const qPath = `${ROOT}/${form} Q.json`
  const aPath = `${ROOT}/${form}A.json`
  if (!existsSync(qPath)) {
    console.log(`form ${form}: missing extract`)
    continue
  }
  const q = JSON.parse(readFileSync(qPath, 'utf8')).q as Array<{ text: string; pageNumber: number }>
  const a = existsSync(aPath)
    ? (JSON.parse(readFileSync(aPath, 'utf8')).a as Array<{ text: string; pageNumber: number }>)
    : []
  const result = assembleSet(q, a)
  const nums = result.questions.map((question) => question.sourceItemNumber)
  const missing = []
  for (let i = 1; i <= 50; i++) if (!nums.includes(i)) missing.push(i)
  const formIssues: Issue[] = []
  const add = (item: number, kind: string, detail: string) => {
    formIssues.push({ form, item, kind, detail })
  }
  if (missing.length) add(0, 'missing-items', missing.join(','))
  if (result.questions.length !== 50) add(0, 'count', `${result.questions.length} items`)

  for (const question of result.questions) {
    const source = sourceForItem(q, question.sourceItemNumber, 'q')
    const stem = stripExplanationFromStem(question.questionStem)
    const stemTok = tokens(stem, 12)
    if (hasExplanationLeak(question.questionStem)) {
      add(question.sourceItemNumber, 'explanation-in-stem', stem.slice(0, 160))
    }
    if (source && stemTok.length >= 6 && overlap(stemTok, source) < 0.5) {
      add(
        question.sourceItemNumber,
        'stem-not-in-pdf',
        `${Math.round(overlap(stemTok, source) * 100)}% overlap :: ${stemTok.join(' ')}`
      )
    }
    if (!question.needsTableImage && !question.needsFigure) {
      const filled = question.answerChoices.filter((choice) => choice.text.trim().length > 2)
      if (filled.length < 2) add(question.sourceItemNumber, 'too-few-choices', `${filled.length}`)
      for (const choice of filled.slice(0, 5)) {
        const choiceTok = tokens(choice.text, 5)
        if (source && choiceTok.length >= 3 && overlap(choiceTok, source) < 0.4) {
          add(
            question.sourceItemNumber,
            'choice-not-in-pdf',
            `${choice.label}) ${choice.text.slice(0, 80)}`
          )
        }
      }
    }
    if (question.correctAnswer && question.explanation) {
      const fromExpl = extractCorrectAnswer(question.explanation)
      if (fromExpl && fromExpl !== question.correctAnswer) {
        add(question.sourceItemNumber, 'key-mismatch', `parsed ${question.correctAnswer} vs explanation ${fromExpl}`)
      }
    }
  }
  issues.push(...formIssues)
  console.log(
    `form ${form}: ${result.questions.length} items, keyed=${result.questions.filter((q) => q.correctAnswer).length}, ${formIssues.length} discrepancy(ies)`
  )
}

console.log(`\nTOTAL discrepancies: ${issues.length}`)
for (const issue of issues) {
  console.log(`[${issue.form} Q${issue.item} ${issue.kind}] ${issue.detail}`)
}
mkdirSync('/tmp/exam_parse', { recursive: true })
writeFileSync('/tmp/exam_parse/discrepancy-qc.json', JSON.stringify(issues, null, 2))
