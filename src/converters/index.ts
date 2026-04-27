import * as vscode from 'vscode'
import * as path from 'node:path'
import { convertDocx } from './docxConverter'
import { convertPdf } from './pdfConverter'
import type { ConversionResult, FileType } from '../types'

export function detectFileType(uri: vscode.Uri): FileType {
  const ext = path.extname(uri.fsPath).toLowerCase()
  if (ext === '.pdf') { return 'pdf' }
  if (ext === '.docx' || ext === '.doc') { return 'docx' }
  return 'unknown'
}

export async function convert(fileUri: vscode.Uri): Promise<ConversionResult> {
  const type = detectFileType(fileUri)
  if (type === 'pdf') { return convertPdf(fileUri) }
  if (type === 'docx') { return convertDocx(fileUri) }
  return {
    success: false,
    error: 'UNSUPPORTED_TYPE',
    message: `Unsupported file type: ${path.extname(fileUri.fsPath)}`,
  }
}
