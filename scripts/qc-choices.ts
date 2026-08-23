import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs'
import { assembleSet, type ParsedPage, type ParsedQuestionDraft } from '../src/parser/examParser'

const FORMS = ['3', '4', '5', '6', '7', '8', '9', '10']
const ROOT = '/tmp/exam_parse/forms'

export interface ChoiceIssue {
  form: string
  item: number
  label?: string
  kind: string
  detail: string
  choices: string
}

const JUNK = [
  /~\s*~/,
  /\bp,\s*r,?\b/i,
  /(?:^|\s)previous(?:\s|$)/i,
  /(?:^|\s)lab values(?:\s|$)/i,
  /\bcalculator\b/i,
  /\bscore report\b/i,
  /https?:\/\//i,
  /t\.me\//i,
  /["']\s*[~∼]/,
  /r--/,
  /,\.\s*$/
]

const LAB_LEAK =
  /(?:\d[\d.,]*\s*(?:mEq\/L|mg\/dL|mg\/dl|g\/dL|U\/L|\/mm³|\/hpf|mm Hg)|(?:\d+\s*-\s*\d+\s*\/hpf)|(?:\bProtein\s+WBC\s+RBC\b))/i

const SECOND_CHOICE = /(?:^|\s)[O0Q]\s*[A-P][\)\.]\s+\S/

function issuesForQuestion(form: string, question: ParsedQuestionDraft): ChoiceIssue[] {
  const issues: ChoiceIssue[] = []
  const choices = question.answerChoices
  const list = choices.map((choice) => `${choice.label}) ${choice.text}`).join(' || ')
  const add = (kind: string, detail: string, label?: string) => {
    issues.push({ form, item: question.sourceItemNumber, label, kind, detail, choices: list })
  }

  if (question.needsTableImage) return issues
  if (question.needsFigure) {
    for (const choice of choices) {
      const text = choice.text.trim()
      if (!text) continue
      for (const pattern of JUNK) {
        if (pattern.test(text)) {
          add('junk', `"${text}"`, choice.label)
          break
        }
      }
      if (SECOND_CHOICE.test(text)) add('merged-choice', `"${text}"`, choice.label)
    }
    return issues
  }

  if (choices.length < 2) {
    add('too-few', `${choices.length} choice(s)`)
    return issues
  }

  const labels = choices.map((choice) => choice.label)
  for (let i = 1; i < labels.length; i++) {
    if (labels[i].charCodeAt(0) !== labels[i - 1].charCodeAt(0) + 1) {
      add('non-sequential', labels.join(''))
      break
    }
  }

  for (const choice of choices) {
    const text = choice.text.trim()
    if (!text) {
      add('empty', 'blank choice text', choice.label)
      continue
    }
    for (const pattern of JUNK) {
      if (pattern.test(text)) {
        add('junk', `"${text}"`, choice.label)
        break
      }
    }
    if (SECOND_CHOICE.test(text)) add('merged-choice', `"${text}"`, choice.label)
    if (
      LAB_LEAK.test(text) &&
      !/\bsaline\b/i.test(text) &&
      !/\bpercent\b/i.test(text) &&
      !/\b0\.9%\b/.test(text) &&
      !/^(?:\d+%|\d+\.\d+%|10%|20%|40%|60%|80%)$/.test(text)
    ) {
      add('lab-leak', `"${text}"`, choice.label)
    }
  }
  return issues
}

function loadPages(form: string): { q: ParsedPage[]; a: ParsedPage[] } | null {
  const qPath = `${ROOT}/${form} Q.json`
  const aPath = `${ROOT}/${form}A.json`
  if (!existsSync(qPath)) return null
  const q = JSON.parse(readFileSync(qPath, 'utf8')).q as ParsedPage[]
  const a = existsSync(aPath) ? ((JSON.parse(readFileSync(aPath, 'utf8')).a as ParsedPage[]) ?? []) : []
  const qLetters = q.reduce((sum, page) => sum + (page.text.match(/[A-Za-z]/g)?.length ?? 0), 0)
  if (qLetters < 2000) return { q, a, } && null
  return { q, a }
}

export function runQc(forms = FORMS): { issues: ChoiceIssue[]; summary: string } {
  const issues: ChoiceIssue[] = []
  const lines: string[] = []
  for (const form of forms) {
    const qPath = `${ROOT}/${form} Q.json`
    const aPath = `${ROOT}/${form}A.json`
    if (!existsSync(qPath)) {
      lines.push(`form ${form}: missing question extract`)
      continue
    }
    const q = JSON.parse(readFileSync(qPath, 'utf8')).q as ParsedPage[]
    const a = existsSync(aPath) ? ((JSON.parse(readFileSync(aPath, 'utf8')).a as ParsedPage[]) ?? []) : []
    const qLetters = q.reduce((sum, page) => sum + (page.text.match(/[A-Za-z]/g)?.length ?? 0), 0)
    if (qLetters < 2000) {
      lines.push(`form ${form}: skipped (image/OCR needed, letters=${qLetters})`)
      continue
    }
    const result = assembleSet(q, a)
    const formIssues: ChoiceIssue[] = []
    for (const question of result.questions) {
      formIssues.push(...issuesForQuestion(form, question))
    }
    issues.push(...formIssues)
    lines.push(
      `form ${form}: ${result.questions.length} items, ${formIssues.length} choice issue(s) across ${new Set(formIssues.map((i) => i.item)).size} question(s)`
    )
  }
  return { issues, summary: lines.join('\n') }
}

const { issues, summary } = runQc()
mkdirSync('/tmp/exam_parse', { recursive: true })
writeFileSync('/tmp/exam_parse/choice-qc.json', JSON.stringify(issues, null, 2))
console.log(summary)
console.log(`\nTOTAL issues: ${issues.length}`)
for (const issue of issues) {
  console.log(`\n[${issue.form} Q${issue.item} ${issue.label ?? ''} ${issue.kind}] ${issue.detail}`)
  console.log(issue.choices)
}
