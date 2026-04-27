import * as vscode from 'vscode'
import * as path from 'node:path'
import { convert, detectFileType } from '../converters'
import { resolveOutputUri, resolveConflict, writeMarkdown } from '../utils/fileUtils'
import {
  notifySuccess,
  notifyScannedPdf,
  notifyError,
  notifyWarning,
} from '../utils/notifier'
import { log, showOutputChannel } from '../utils/logger'
import type { ConversionOptions } from '../types'
import { convertBatch } from './convertBatch'

export function getOptions(): ConversionOptions {
  const cfg = vscode.workspace.getConfiguration('mdConverter')
  return {
    outputFolder: cfg.get<'same' | 'custom' | 'workspace'>('outputFolder', 'same'),
    customOutputPath: cfg.get<string>('customOutputPath', ''),
    conflictBehavior: cfg.get<'ask' | 'overwrite' | 'rename'>('conflictBehavior', 'ask'),
    autoPreview: cfg.get<boolean>('autoPreview', true),
    showLogs: cfg.get<boolean>('showLogs', false),
  }
}

/** Entry point registered as the 'mdConverter.convertFile' command. */
export async function convertFileCommand(
  clickedUri?: vscode.Uri,
  selectedUris?: vscode.Uri[],
): Promise<void> {
  const options = getOptions()
  if (options.showLogs) {
    showOutputChannel()
  }

  // Multi-select: VS Code passes all selected items as selectedUris
  if (selectedUris && selectedUris.length > 1) {
    await convertBatch(selectedUris, options)
    return
  }

  const target = clickedUri
  if (!target) {
    await notifyError('No file selected.')
    return
  }

  await convertOne(target, options)
}

/** Convert a single file. Returns the outcome for batch callers. */
export async function convertOne(
  fileUri: vscode.Uri,
  options: ConversionOptions,
): Promise<'success' | 'cancelled' | 'error'> {
  const fileName = path.basename(fileUri.fsPath)
  const fileType = detectFileType(fileUri)

  if (fileType === 'unknown') {
    await notifyError(`Unsupported file type: ${path.extname(fileUri.fsPath)}`)
    return 'error'
  }

  log(`Starting conversion: ${fileName} (${fileType})`)

  const outputUri = await resolveOutputUri(fileUri, options)
  const finalUri = await resolveConflict(outputUri, options.conflictBehavior)

  if (!finalUri) {
    log(`Cancelled by user: ${fileName}`)
    return 'cancelled'
  }

  const result = await convert(fileUri)

  if (!result.success) {
    if (result.error === 'SCANNED_PDF') {
      // Write a stub markdown so the file appears in the explorer
      const stub = `> ⚠️ ${result.message ?? 'Scanned PDF — OCR required.'}\n`
      await writeMarkdown(finalUri, stub)
      await notifyScannedPdf(finalUri)
      return 'success'
    }
    await notifyError(`Conversion failed: ${result.message}`)
    return 'error'
  }

  if (result.warnings && result.warnings.length > 0) {
    await notifyWarning(`${fileName} converted with warnings — check Output for details`)
  }

  await writeMarkdown(finalUri, result.content ?? '')
  await notifySuccess(finalUri, options)

  log(`Done: ${fileName} → ${path.basename(finalUri.fsPath)}`)
  return 'success'
}
