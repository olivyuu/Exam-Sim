import { WorkerMessageHandler } from 'pdfjs-dist/build/pdf.worker.min.mjs'

type PdfjsWorkerGlobal = typeof globalThis & {
  pdfjsWorker?: { WorkerMessageHandler: typeof WorkerMessageHandler }
}

;(globalThis as PdfjsWorkerGlobal).pdfjsWorker = { WorkerMessageHandler }
