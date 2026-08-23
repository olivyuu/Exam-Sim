import { create } from 'zustand'
import type {
  AppPhase,
  FileMeta,
  Question,
  QuestionSetSummary,
  ReviewFilter,
  SessionState
} from '../../shared/types'
import { computeReviewStatus, emptySession, totalTestSeconds } from '../../shared/types'
import { createId, pairingKey } from '../../shared/files'
import { reviewSubset } from '../../shared/review'

interface Actions {
  addQuestionPdfs: (files: FileMeta[]) => void
  addAnswerPdfs: (files: FileMeta[]) => void
  assignAnswer: (setId: string, answer: FileMeta | null) => void
  replaceQuestion: (setId: string, file: FileMeta) => void
  replaceAnswer: (setId: string, file: FileMeta) => void
  removeSet: (setId: string) => void
  setLabSheet: (file: FileMeta | null) => void
  chooseLabSheet: () => Promise<boolean>
  clearAll: () => void
  parseAndReview: () => Promise<void>
  startExam: () => void
  tick: () => void
  goTo: (index: number) => void
  next: () => void
  prev: () => void
  selectAnswer: (label: string) => void
  toggleFlag: () => void
  toggleStrike: (label: string) => void
  setHighlights: (highlights: Question['highlights']) => void
  setNotes: (notes: string) => void
  setLabOpen: (open: boolean) => void
  setNotesOpen: (open: boolean) => void
  setCalculatorOpen: (open: boolean) => void
  setReviewOpen: (open: boolean) => void
  openExamReview: () => void
  returnToExam: () => void
  requestEndExam: () => void
  confirmEndExam: () => void
  endExam: () => void
  enterReview: (filter: ReviewFilter) => void
  setReviewFilter: (filter: ReviewFilter) => void
  beginExportPrompt: () => void
  exportExcel: () => Promise<void>
  saveExcel: () => Promise<void>
  confirmReset: () => Promise<void>
  requestDeleteWithoutExport: () => void
  cancelDelete: () => void
  setPhase: (phase: AppPhase) => void
  persist: () => void
}

function autoPair(sets: QuestionSetSummary[], answers: FileMeta[]): QuestionSetSummary[] {
  const unused = [...answers]
  return sets.map((set) => {
    if (set.answerPdf) return { ...set, status: 'matched' as const }
    const key = pairingKey(set.questionPdf.name)
    const index = unused.findIndex((file) => pairingKey(file.name) === key)
    if (index >= 0) {
      const answerPdf = unused.splice(index, 1)[0]
      return { ...set, answerPdf, status: 'matched' as const }
    }
    return { ...set, status: 'unmatched' as const }
  })
}

function withCurrent(questions: Question[], index: number, patch: Partial<Question>): Question[] {
  return questions.map((question, i) => (i === index ? { ...question, ...patch } : question))
}

export const useExamStore = create<SessionState & Actions>((set, get) => ({
  ...emptySession(),

  addQuestionPdfs: (files) => {
    set((state) => {
      const existingPaths = new Set(state.sets.map((s) => s.questionPdf.name.toLowerCase()))
      const additions: QuestionSetSummary[] = []
      const errors: string[] = []
      for (const file of files) {
        if (existingPaths.has(file.name.toLowerCase())) {
          errors.push(`${file.name} was already added.`)
          continue
        }
        additions.push({
          id: createId('set'),
          label: file.name.replace(/\.pdf$/i, ''),
          questionPdf: file,
          answerPdf: null,
          status: 'unmatched',
          questionCount: 0,
          answerCount: 0,
          warnings: []
        })
      }
      const alreadyPaired = new Set(state.sets.map((s) => s.answerPdf?.id).filter(Boolean))
      const freeAnswers = state.sets.map((s) => s.answerPdf).filter((file): file is FileMeta => !!file && !alreadyPaired.has(file.id))
      return {
        sets: autoPair([...state.sets, ...additions], freeAnswers),
        globalError: errors[0] ?? null
      }
    })
  },

  addAnswerPdfs: (files) => {
    set((state) => {
      const already = new Set(
        state.sets.map((s) => s.answerPdf?.name.toLowerCase()).filter(Boolean) as string[]
      )
      const incoming: FileMeta[] = []
      const errors: string[] = []
      for (const file of files) {
        if (already.has(file.name.toLowerCase()) || incoming.some((f) => f.name.toLowerCase() === file.name.toLowerCase())) {
          errors.push(`${file.name} was already added.`)
          continue
        }
        incoming.push(file)
      }
      const sets = autoPair(
        state.sets.map((s) => ({ ...s })),
        incoming
      )
      const used = new Set(sets.map((s) => s.answerPdf?.id).filter(Boolean))
      const leftover = incoming.filter((f) => !used.has(f.id))
      if (leftover.length > 0 && sets.length > 0) {
        const unmatched = sets.find((s) => !s.answerPdf)
        if (unmatched) {
          unmatched.answerPdf = leftover[0]
          unmatched.status = 'matched'
        }
      }
      return { sets, globalError: errors[0] ?? null }
    })
  },

  assignAnswer: (setId, answer) => {
    set((state) => ({
      sets: state.sets.map((s) =>
        s.id === setId
          ? { ...s, answerPdf: answer, status: answer ? 'matched' : 'unmatched', error: undefined }
          : s
      )
    }))
  },

  replaceQuestion: (setId, file) => {
    set((state) => ({
      sets: state.sets.map((s) =>
        s.id === setId ? { ...s, questionPdf: file, label: file.name.replace(/\.pdf$/i, ''), status: s.answerPdf ? 'matched' : 'unmatched' } : s
      )
    }))
  },

  replaceAnswer: (setId, file) => {
    set((state) => ({
      sets: state.sets.map((s) => (s.id === setId ? { ...s, answerPdf: file, status: 'matched' } : s))
    }))
  },

  removeSet: (setId) => {
    set((state) => ({ sets: state.sets.filter((s) => s.id !== setId) }))
  },

  setLabSheet: (file) => {
    set({ labSheet: file, labOpen: file ? get().labOpen : false })
    get().persist()
  },

  chooseLabSheet: async () => {
    const files = await window.practiceExam.openPdfs('lab')
    const file = files[0]
    if (!file) return false
    get().setLabSheet(file)
    return true
  },

  clearAll: () => set({ ...emptySession() }),

  parseAndReview: async () => {
    const { sets } = get()
    if (sets.length === 0) {
      set({ globalError: 'Add at least one question PDF and a matching answer PDF.' })
      return
    }
    if (sets.some((s) => !s.answerPdf)) {
      set({ globalError: 'Every question PDF must have a matching answer/explanation PDF before you can continue.' })
      return
    }
    set({ parseProgress: { stage: 'Starting', current: 0, total: sets.length }, globalError: null })
    const { ingestPair } = await import('./pdf/ingest')
    const allQuestions: Question[] = []
    const nextSets: QuestionSetSummary[] = []
    try {
      for (let i = 0; i < sets.length; i++) {
        const current = sets[i]
        const result = await ingestPair(current.questionPdf, current.answerPdf!, (progress) => {
          set({
            parseProgress: {
              ...progress,
              detail: `Set ${i + 1}/${sets.length}: ${progress.detail ?? current.label}`
            }
          })
        })
        const offset = allQuestions.length
        const numbered = result.questions.map((question, index) => ({
          ...question,
          questionNumber: offset + index + 1
        }))
        allQuestions.push(...numbered)
        const answerCount = result.questions.filter((q) => q.correctAnswer || q.explanation).length
        const mismatch = result.questionCount !== answerCount
        nextSets.push({
          ...current,
          status: result.questions.length === 0 ? 'error' : mismatch ? 'mismatch' : 'parsed',
          questionCount: result.questionCount,
          answerCount,
          warnings: result.warnings,
          error: result.questions.length === 0 ? 'No questions could be extracted from this pair.' : undefined
        })
      }
      if (allQuestions.length === 0) {
        set({
          sets: nextSets,
          parseProgress: null,
          globalError: 'No questions were extracted. Check that the PDFs contain readable exam items.'
        })
        return
      }
      set({
        sets: nextSets,
        questions: allQuestions,
        parseProgress: null,
        phase: 'importReview',
        currentIndex: 0,
        secondsRemaining: totalTestSeconds(allQuestions.length)
      })
    } catch (error) {
      const { userFacingPdfError } = await import('./pdf/pdfjs')
      set({
        parseProgress: null,
        globalError: userFacingPdfError(error)
      })
    }
  },

  startExam: () => {
    const { questions, sets } = get()
    if (questions.length === 0) return
    if (sets.some((s) => s.status === 'error')) return
    set({
      phase: 'exam',
      currentIndex: 0,
      timerRunning: true,
      secondsRemaining: totalTestSeconds(questions.length),
      labOpen: false,
      notesOpen: false,
      calculatorOpen: false,
      reviewOpen: false
    })
    get().persist()
  },

  tick: () => {
    const { phase, timerRunning, secondsRemaining } = get()
    if ((phase !== 'exam' && phase !== 'examReview' && phase !== 'endConfirm') || !timerRunning) return
    if (secondsRemaining <= 1) {
      const questions = get().questions.map((question) => ({
        ...question,
        reviewStatus: computeReviewStatus(question)
      }))
      set({
        questions,
        secondsRemaining: 0,
        timerRunning: false,
        phase: 'review',
        reviewOpen: false,
        labOpen: false
      })
      get().persist()
      return
    }
    set({ secondsRemaining: secondsRemaining - 1 })
  },

  goTo: (index) => {
    const { questions, reviewFilter, phase } = get()
    if (phase === 'review') {
      const subset = reviewSubset(questions, reviewFilter)
      const bounded = Math.max(0, Math.min(index, subset.length - 1))
      const target = subset[bounded]
      if (!target) return
      set({ currentIndex: questions.findIndex((q) => q.id === target.id) })
      return
    }
    set({ currentIndex: Math.max(0, Math.min(index, questions.length - 1)) })
  },

  next: () => {
    const { questions, currentIndex, phase, reviewFilter } = get()
    if (phase === 'review') {
      const subset = reviewSubset(questions, reviewFilter)
      const pos = subset.findIndex((q) => q.id === questions[currentIndex]?.id)
      const nextQ = subset[pos + 1]
      if (nextQ) set({ currentIndex: questions.findIndex((q) => q.id === nextQ.id) })
      return
    }
    set({ currentIndex: Math.min(currentIndex + 1, questions.length - 1) })
  },

  prev: () => {
    const { questions, currentIndex, phase, reviewFilter } = get()
    if (phase === 'review') {
      const subset = reviewSubset(questions, reviewFilter)
      const pos = subset.findIndex((q) => q.id === questions[currentIndex]?.id)
      const prevQ = subset[pos - 1]
      if (prevQ) set({ currentIndex: questions.findIndex((q) => q.id === prevQ.id) })
      return
    }
    set({ currentIndex: Math.max(currentIndex - 1, 0) })
  },

  selectAnswer: (label) => {
    const { phase, questions, currentIndex } = get()
    if (phase !== 'exam') return
    set({ questions: withCurrent(questions, currentIndex, { userAnswer: label }) })
  },

  toggleFlag: () => {
    const { questions, currentIndex, phase } = get()
    if (phase !== 'exam' && phase !== 'review') return
    const current = questions[currentIndex]
    if (!current) return
    set({ questions: withCurrent(questions, currentIndex, { flagged: !current.flagged }) })
  },

  toggleStrike: (label) => {
    const { questions, currentIndex, phase } = get()
    if (phase !== 'exam' && phase !== 'review') return
    const current = questions[currentIndex]
    if (!current) return
    const next = current.strikethroughChoices.includes(label)
      ? current.strikethroughChoices.filter((item) => item !== label)
      : [...current.strikethroughChoices, label]
    set({ questions: withCurrent(questions, currentIndex, { strikethroughChoices: next }) })
  },

  setHighlights: (highlights) => {
    const { questions, currentIndex } = get()
    set({ questions: withCurrent(questions, currentIndex, { highlights }) })
  },

  setNotes: (notes) => {
    const { questions, currentIndex } = get()
    set({ questions: withCurrent(questions, currentIndex, { notes }) })
  },

  setLabOpen: (open) => set({ labOpen: open }),
  setNotesOpen: (open) => set({ notesOpen: open }),
  setCalculatorOpen: (open) => set({ calculatorOpen: open }),
  setReviewOpen: (open) => set({ reviewOpen: open }),

  openExamReview: () => set({ phase: 'examReview', reviewOpen: false }),
  returnToExam: () => set({ phase: 'exam', reviewOpen: false }),
  requestEndExam: () => set({ phase: 'endConfirm', reviewOpen: false }),

  confirmEndExam: () => {
    const questions = get().questions.map((question) => ({
      ...question,
      reviewStatus: computeReviewStatus(question)
    }))
    set({
      questions,
      phase: 'review',
      timerRunning: false,
      reviewOpen: false,
      labOpen: false,
      reviewFilter: 'all'
    })
    get().persist()
  },

  endExam: () => {
    get().requestEndExam()
  },

  enterReview: (filter) => {
    const questions = get().questions.map((question) => ({
      ...question,
      reviewStatus: computeReviewStatus(question)
    }))
    const subset = reviewSubset(questions, filter)
    const first = subset[0] ?? questions[0]
    set({
      questions,
      phase: 'review',
      reviewFilter: filter,
      currentIndex: first ? questions.findIndex((q) => q.id === first.id) : 0,
      reviewOpen: false
    })
  },

  setReviewFilter: (filter) => {
    const { questions } = get()
    const subset = reviewSubset(questions, filter)
    const first = subset[0]
    set({
      reviewFilter: filter,
      currentIndex: first ? questions.findIndex((q) => q.id === first.id) : get().currentIndex
    })
  },

  beginExportPrompt: () => set({ phase: 'exportPrompt' }),

  exportExcel: async () => {
    set({ phase: 'exporting' })
    const started = Date.now()
    try {
      const rows = get().questions.map((q) => ({
        questionNumber: q.questionNumber,
        notes: q.notes,
        questionStem: q.questionStem,
        answerChoices: q.answerChoices
      }))
      const bytes = await window.practiceExam.buildExcel(rows)
      const wait = 800 - (Date.now() - started)
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait))
      set({ exportBuffer: bytes, phase: 'exportReady' })
    } catch (error) {
      set({
        phase: 'exportPrompt',
        globalError: error instanceof Error ? error.message : 'Excel generation failed.'
      })
    }
  },

  saveExcel: async () => {
    const buffer = get().exportBuffer
    if (!buffer) return
    const saved = await window.practiceExam.saveExcel(buffer)
    if (saved) set({ phase: 'resetWarning' })
  },

  confirmReset: async () => {
    await window.practiceExam.clearSession()
    set({ ...emptySession() })
  },

  requestDeleteWithoutExport: () => set({ phase: 'deleteConfirm' }),
  cancelDelete: () => set({ phase: 'exportPrompt' }),
  setPhase: (phase) => set({ phase }),

  persist: () => {
    if (typeof window === 'undefined' || !window.practiceExam?.saveSession) return
    const snapshot = get()
    const lean = {
      phase: snapshot.phase,
      sets: snapshot.sets,
      questions: snapshot.questions.map(({ pageImageDataUrl, questionImages, explanationImages, ...rest }) => rest),
      currentIndex: snapshot.currentIndex,
      secondsRemaining: snapshot.secondsRemaining,
      labSheet: snapshot.labSheet,
      reviewFilter: snapshot.reviewFilter
    }
    void window.practiceExam.saveSession(JSON.stringify(lean))
  }
}))

export function currentQuestion(): Question | undefined {
  const { questions, currentIndex } = useExamStore.getState()
  return questions[currentIndex]
}
