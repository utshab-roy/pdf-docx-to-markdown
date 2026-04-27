import * as vscode from 'vscode'

let channel: vscode.OutputChannel | undefined

export function initLogger(): void {
  channel = vscode.window.createOutputChannel('pdf docx to markdown')
}

export function log(message: string): void {
  const ts = new Date().toISOString()
  channel?.appendLine(`[${ts}] ${message}`)
}

export function logError(error: Error): void {
  const ts = new Date().toISOString()
  channel?.appendLine(`[${ts}] ERROR: ${error.message}`)
  if (error.stack) {
    channel?.appendLine(error.stack)
  }
}

export function showOutputChannel(): void {
  channel?.show(true)
}

export function disposeLogger(): void {
  channel?.dispose()
  channel = undefined
}
