import * as vscode from 'vscode'
import mammoth from 'mammoth'
import TurndownService from 'turndown'
import { log, logError } from '../utils/logger'
import type { ConversionResult } from '../types'

const turndown = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
  emDelimiter: '*',
})

export async function convertDocx(fileUri: vscode.Uri): Promise<ConversionResult> {
  try {
    log(`Reading DOCX: ${fileUri.fsPath}`)
    const bytes = await vscode.workspace.fs.readFile(fileUri)
    // Pass a Buffer so mammoth doesn't open the file path itself
    const buffer = Buffer.from(bytes)

    const htmlResult = await mammoth.convertToHtml({ buffer })

    for (const msg of htmlResult.messages) {
      log(`mammoth [${msg.type}]: ${msg.message}`)
    }

    const markdown = turndown.turndown(htmlResult.value)

    return {
      success: true,
      content: markdown,
      warnings: htmlResult.messages
        .filter((m) => m.type === 'warning')
        .map((m) => m.message),
    }
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    logError(err)
    return {
      success: false,
      error: 'DOCX_PARSE_ERROR',
      message: `Could not read DOCX — file may be corrupted: ${err.message}`,
    }
  }
}
