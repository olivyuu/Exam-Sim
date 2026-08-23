import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs'
import { assembleSet } from '../src/parser/examParser'

const FORMS = ['3', '4', '5', '6', '7', '8', '9', '10']
const ROOT = '/tmp/exam_parse/forms'

const LEAK = [
  [/correct\s*answer\s*:/i, 'correct-answer'],
  [/incorrect answers\s*:/i, 'incorrect-answers'],
  [/educational objective\s*:/i, 'educational-objective'],
  [/\([A-P]\s+is\s+correct\)/i, 'paren-correct'],
  [/\bchoice [A-P]\s*:/i, 'choice-explanation'],
  [/\bkey concept\s*:/i, 'key-concept'],
  [/\bis incorrect\b/i, 'is-incorrect'],
  [/\bthis option is\b/i, 'this-option'],
  [/score report/i, 'score-report'],
  [/https?:\/\//i, 'url']
] as const

const issues: Array<{ form: string; item: number; kind: string; stem: string }> = []

for (const form of FORMS) {
  const qPath = `${ROOT}/${form} Q.json`
  const aPath = `${ROOT}/${form}A.json`
  if (!existsSync(qPath)) {
    console.log(`form ${form}: missing extract`)
    continue
  }
  const q = JSON.parse(readFileSync(qPath, 'utf8')).q
  const a = existsSync(aPath) ? JSON.parse(readFileSync(aPath, 'utf8')).a : []
  const result = assembleSet(q, a)
  const nums = result.questions.map((item) => item.sourceItemNumber).sort((x, y) => x - y)
  const missing = []
  for (let i = 1; i <= 50; i++) if (!nums.includes(i)) missing.push(i)
  const formIssues: typeof issues = []
  for (const question of result.questions) {
    const stem = question.questionStem
    for (const [pattern, kind] of LEAK) {
      if (pattern.test(stem)) {
        formIssues.push({
          form,
          item: question.sourceItemNumber,
          kind,
          stem: stem.replace(/\s+/g, ' ').slice(0, 220)
        })
        break
      }
    }
    if (stem.length < 30) {
      formIssues.push({
        form,
        item: question.sourceItemNumber,
        kind: 'short-stem',
        stem: stem.replace(/\s+/g, ' ').slice(0, 220)
      })
    }
  }
  issues.push(...formIssues)
  console.log(
    `form ${form}: ${result.questions.length} items, missing=${missing.join(',') || 'none'}, ${formIssues.length} stem issue(s), warnings=${result.warnings.join(' | ') || 'none'}`
  )
}

console.log(`\nTOTAL stem issues: ${issues.length}`)
for (const issue of issues) {
  console.log(`\n[${issue.form} Q${issue.item} ${issue.kind}] ${issue.stem}`)
}

mkdirSync('/tmp/exam_parse', { recursive: true })
writeFileSync('/tmp/exam_parse/stem-qc.json', JSON.stringify(issues, null, 2))
