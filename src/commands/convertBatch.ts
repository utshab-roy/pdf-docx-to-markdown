import * as vscode from 'vscode'
import * as path from 'node:path'
import { convertOne } from './convertSingle'
import { notifyBatchSuccess, notifyBatchPartial } from '../utils/notifier'
import { log } from '../utils/logger'
import type { ConversionOptions } from '../types'

export async function convertBatch(
  uris: vscode.Uri[],
  options: ConversionOptions,
): Promise<void> {
  const total = uris.length
  let succeeded = 0
  let failed = 0

  log(`Batch started: ${total} file(s)`)

  // Batch conversions never auto-open markdown preview for each file
  const batchOptions: ConversionOptions = { ...options, autoPreview: false }

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Converting files…',
      cancellable: false,
    },
    async (progress) => {
      const step = Math.round(100 / total)

      for (let i = 0; i < uris.length; i++) {
        const uri = uris[i]
        const name = path.basename(uri.fsPath)
        progress.report({ increment: step, message: `(${i + 1}/${total}) ${name}` })

        const outcome = await convertOne(uri, batchOptions)
        if (outcome === 'success') {
          succeeded++
        } else if (outcome === 'error') {
          failed++
        }
      }
    },
  )

  log(`Batch done: ${succeeded} succeeded, ${failed} failed`)

  if (failed === 0) {
    const folder = vscode.workspace.workspaceFolders?.[0]?.uri
    await notifyBatchSuccess(succeeded, folder)
  } else {
    await notifyBatchPartial(succeeded, failed)
  }
}
