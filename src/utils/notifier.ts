import * as vscode from 'vscode'
import * as path from 'node:path'
import { showOutputChannel } from './logger'
import type { ConversionOptions } from '../types'

export async function notifySuccess(
  outputUri: vscode.Uri,
  options: Pick<ConversionOptions, 'autoPreview'>,
): Promise<void> {
  const name = path.basename(outputUri.fsPath)
  const choice = await vscode.window.showInformationMessage(
    `✅ ${name} created successfully`,
    'Open File',
  )
  if (choice === 'Open File') {
    await openFile(outputUri, options.autoPreview)
  }
}

export async function notifyScannedPdf(outputUri: vscode.Uri): Promise<void> {
  const choice = await vscode.window.showWarningMessage(
    '⚠️ Scanned PDF detected — conversion may be incomplete',
    'Open Anyway',
    'Dismiss',
  )
  if (choice === 'Open Anyway') {
    await vscode.window.showTextDocument(outputUri)
  }
}

export async function notifyWarning(message: string): Promise<void> {
  await vscode.window.showWarningMessage(`⚠️ ${message}`)
}

export async function notifyError(message: string): Promise<void> {
  const choice = await vscode.window.showErrorMessage(
    `❌ ${message}`,
    'Show Logs',
  )
  if (choice === 'Show Logs') {
    showOutputChannel()
  }
}

export async function notifyBatchSuccess(count: number, folderUri?: vscode.Uri): Promise<void> {
  const label = count === 1 ? '1 file' : `${count} files`
  const buttons: string[] = folderUri ? ['Open Folder'] : []
  const choice = await vscode.window.showInformationMessage(
    `✅ ${label} converted to Markdown`,
    ...buttons,
  )
  if (choice === 'Open Folder' && folderUri) {
    await vscode.commands.executeCommand('revealFileInOS', folderUri)
  }
}

export async function notifyBatchPartial(succeeded: number, failed: number): Promise<void> {
  const choice = await vscode.window.showWarningMessage(
    `⚠️ ${succeeded} succeeded, ${failed} failed`,
    'Show Details',
  )
  if (choice === 'Show Details') {
    showOutputChannel()
  }
}

async function openFile(uri: vscode.Uri, preview: boolean): Promise<void> {
  if (preview) {
    await vscode.commands.executeCommand('markdown.showPreview', uri)
  } else {
    await vscode.window.showTextDocument(uri)
  }
}
