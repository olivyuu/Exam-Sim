import { contextBridge, ipcRenderer } from 'electron'
import type { FileMeta } from '../shared/types'
import type { ExcelSource } from '../shared/excelRows'

const api = {
  openPdfs: (kind: 'question' | 'answer' | 'lab') =>
    ipcRenderer.invoke('dialog:openPdfs', kind) as Promise<FileMeta[]>,
  replacePdf: () => ipcRenderer.invoke('dialog:replacePdf') as Promise<FileMeta | null>,
  getDefaultLab: () => ipcRenderer.invoke('lab:default') as Promise<FileMeta | null>,
  readFile: (filePath: string) => ipcRenderer.invoke('fs:readFile', filePath) as Promise<Uint8Array>,
  ocrImage: (pngBase64: string) => ipcRenderer.invoke('ocr:image', pngBase64) as Promise<string>,
  saveSession: (json: string) => ipcRenderer.invoke('session:save', json) as Promise<boolean>,
  loadSession: () => ipcRenderer.invoke('session:load') as Promise<string | null>,
  clearSession: () => ipcRenderer.invoke('session:clear') as Promise<boolean>,
  buildExcel: (rows: ExcelSource[]) => ipcRenderer.invoke('excel:build', rows) as Promise<number[]>,
  saveExcel: (bytes: number[]) => ipcRenderer.invoke('excel:save', bytes) as Promise<boolean>
}

export type PracticeExamApi = typeof api

contextBridge.exposeInMainWorld('practiceExam', api)
