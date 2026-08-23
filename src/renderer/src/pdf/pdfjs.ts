import './pdf-worker-setup'
import * as pdfjsLib from 'pdfjs-dist'

pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(
  new Blob([`export {};`], { type: 'text/javascript' })
)

export { pdfjsLib }

export function bytesFromBase64(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

export async function loadPdfDocument(filePath: string): Promise<pdfjsLib.PDFDocumentProxy> {
  const data = asPdfBytes(await window.practiceExam.readFile(filePath))
  return pdfjsLib.getDocument({
    data,
    isEvalSupported: false,
    useSystemFonts: true,
    useWorkerFetch: false
  }).promise
}

function asPdfBytes(data: unknown): Uint8Array {
  if (data instanceof Uint8Array) return data
  if (data instanceof ArrayBuffer) return new Uint8Array(data)
  if (ArrayBuffer.isView(data)) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
  }
  if (typeof data === 'string') return bytesFromBase64(data)
  if (
    data &&
    typeof data === 'object' &&
    'data' in data &&
    Array.isArray((data as { data: unknown }).data)
  ) {
    return Uint8Array.from((data as { data: number[] }).data)
  }
  throw new Error('Could not read PDF bytes from disk.')
}

export function userFacingPdfError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error)
  const looksLikeLibraryDump =
    raw.length > 180 ||
    /htmlForXfa|setupDoc|WorkerMessageHandler|pdfjsWorker|PasswordException|jsxRuntime|@__PURE__|children:\s*\[/.test(
      raw
    )
  if (looksLikeLibraryDump) {
    return 'Could not open a PDF in this app. Quit and reopen Practice Exam, then try the PDFs again.'
  }
  return raw
}
