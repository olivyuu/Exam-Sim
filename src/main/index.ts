import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { join } from 'node:path'
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import ExcelJS from 'exceljs'
import type { ExcelSource } from '../shared/excelRows'
import { buildExcelRows } from '../shared/excelRows'

function createWindow(): void {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 720,
    title: 'Practice Exam',
    backgroundColor: '#f4f6f8',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    window.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    window.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  registerIpc()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

function uploadsDir(): string {
  const dir = join(app.getPath('userData'), 'uploads')
  mkdirSync(dir, { recursive: true })
  return dir
}

function sessionPath(): string {
  return join(app.getPath('userData'), 'session.json')
}

function defaultLabPath(): string | null {
  const packaged = join(process.resourcesPath, 'lab-reference.pdf')
  const dev = join(app.getAppPath(), 'resources', 'lab-reference.pdf')
  if (existsSync(packaged)) return packaged
  if (existsSync(dev)) return dev
  return null
}

function ocrHelperPath(): string | null {
  const packaged = join(process.resourcesPath, 'ocr-helper')
  const dev = join(app.getAppPath(), 'resources', 'ocr-helper')
  if (existsSync(packaged)) return packaged
  if (existsSync(dev)) return dev
  return null
}

function registerIpc(): void {
  ipcMain.handle('dialog:openPdfs', async (_event, kind: 'question' | 'answer' | 'lab') => {
    const result = await dialog.showOpenDialog({
      title:
        kind === 'lab'
          ? 'Select laboratory reference PDF'
          : kind === 'answer'
            ? 'Select answer/explanation PDFs'
            : 'Select question PDFs',
      properties: kind === 'lab' ? ['openFile'] : ['openFile', 'multiSelections'],
      filters: [{ name: 'PDF', extensions: ['pdf'] }]
    })
    if (result.canceled) return []
    return copyIncoming(result.filePaths)
  })

  ipcMain.handle('dialog:replacePdf', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Replace PDF',
      properties: ['openFile'],
      filters: [{ name: 'PDF', extensions: ['pdf'] }]
    })
    if (result.canceled || result.filePaths.length === 0) return null
    const copied = copyIncoming(result.filePaths)
    return copied[0] ?? null
  })

  ipcMain.handle('lab:default', async () => {
    const path = defaultLabPath()
    if (!path) return null
    const data = readFileSync(path)
    return {
      id: 'bundled-lab',
      name: 'Laboratory Reference Values.pdf',
      path,
      size: data.length
    }
  })

  ipcMain.handle('fs:readFile', async (_event, filePath: string) => {
    return new Uint8Array(readFileSync(filePath))
  })

  ipcMain.handle('ocr:image', async (_event, pngBase64: string) => {
    const helper = ocrHelperPath()
    if (!helper) {
      throw new Error('The macOS OCR helper is not available. Rebuild the app after compiling resources/ocr-helper.')
    }
    const temp = join(tmpdir(), `practice-exam-ocr-${randomUUID()}.png`)
    writeFileSync(temp, Buffer.from(pngBase64, 'base64'))
    try {
      const text = await runOcr(helper, temp)
      return text
    } finally {
      try {
        rmSync(temp)
      } catch {
        /* ignore */
      }
    }
  })

  ipcMain.handle('session:save', async (_event, json: string) => {
    writeFileSync(sessionPath(), json, 'utf8')
    return true
  })

  ipcMain.handle('session:load', async () => {
    if (!existsSync(sessionPath())) return null
    return readFileSync(sessionPath(), 'utf8')
  })

  ipcMain.handle('session:clear', async () => {
    try {
      rmSync(sessionPath(), { force: true })
      rmSync(uploadsDir(), { recursive: true, force: true })
      mkdirSync(uploadsDir(), { recursive: true })
    } catch {
      /* ignore */
    }
    return true
  })

  ipcMain.handle('excel:build', async (_event, rows: ExcelSource[]) => {
    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'Practice Exam'
    const sheet = workbook.addWorksheet('Noted Questions')
    sheet.columns = [
      { header: 'Question Number', key: 'n', width: 18 },
      { header: 'Notes', key: 'notes', width: 40 },
      { header: 'Question Stem', key: 'stem', width: 60 },
      { header: 'Answer Choices', key: 'choices', width: 40 }
    ]
    const data = buildExcelRows(rows)
    for (const row of data) {
      sheet.addRow(row)
    }
    sheet.eachRow((row) => {
      row.alignment = { wrapText: true, vertical: 'top' }
    })
    const buffer = await workbook.xlsx.writeBuffer()
    return Array.from(new Uint8Array(buffer as ArrayBuffer))
  })

  ipcMain.handle('excel:save', async (_event, bytes: number[]) => {
    const result = await dialog.showSaveDialog({
      title: 'Save Excel file',
      defaultPath: 'practice-exam-notes.xlsx',
      filters: [{ name: 'Excel', extensions: ['xlsx'] }]
    })
    if (result.canceled || !result.filePath) return false
    writeFileSync(result.filePath, Buffer.from(bytes))
    return true
  })

  ipcMain.handle('shell:openPath', async (_event, target: string) => {
    return shell.openPath(target)
  })
}

function copyIncoming(paths: string[]): Array<{ id: string; name: string; path: string; size: number }> {
  return paths.map((source) => {
    const id = randomUUID()
    const name = source.split('/').pop() ?? 'file.pdf'
    const dest = join(uploadsDir(), `${id}-${name}`)
    writeFileSync(dest, readFileSync(source))
    const size = readFileSync(dest).length
    return { id, name, path: dest, size }
  })
}

function runOcr(helper: string, imagePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(helper, [imagePath], { stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString()
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) resolve(stdout)
      else reject(new Error(stderr || `OCR helper exited with code ${code}`))
    })
  })
}
