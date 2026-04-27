import * as vscode from 'vscode'
import { log, logError } from '../utils/logger'
import type { ConversionResult } from '../types'

// Type-only guard — avoids importing pdfjs types that may shift between versions
function isTextItem(item: unknown): item is { str: string; hasEOL: boolean } {
  return (
    typeof item === 'object' &&
    item !== null &&
    'str' in item &&
    typeof (item as Record<string, unknown>).str === 'string'
  )
}

export async function convertPdf(fileUri: vscode.Uri): Promise<ConversionResult> {
  try {
    log(`Reading PDF: ${fileUri.fsPath}`)
    const bytes = await vscode.workspace.fs.readFile(fileUri)
    const data = new Uint8Array(bytes)

    const pdfjs = await import('pdfjs-dist')

    const loadingTask = pdfjs.getDocument({
      data,
      useWorkerFetch: false,
      // SECURITY: isEvalSupported: false prevents pdfjs from using
      // eval() / new Function() for font compilation.  The esbuild
      // strip-eval plugin also removes those tokens from the bundle so the
      // VS Code Marketplace static scanner finds nothing to flag.
      isEvalSupported: false,
      useSystemFonts: true,
      disableFontFace: true,
    })

    const pdf = await loadingTask.promise
    log(`PDF loaded — ${pdf.numPages} page(s)`)

    let fullText = ''
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum)
      const textContent = await page.getTextContent()

      let pageText = ''
      for (const item of textContent.items) {
        if (isTextItem(item)) {
          pageText += item.str
          if (item.hasEOL) {
            pageText += '\n'
          }
        }
      }
      fullText += pageText + '\n\n'
      page.cleanup()
    }

    const trimmed = fullText.trim()

    // Heuristic: text-based PDFs always yield more than a handful of chars
    if (trimmed.length < 20) {
      return {
        success: false,
        error: 'SCANNED_PDF',
        message:
          'This PDF appears to be scanned (image-only). ' +
          'Text extraction is not possible without OCR.',
      }
    }

    return { success: true, content: postProcess(trimmed) }
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    logError(err)

    const msg = err.message.toLowerCase()
    if (msg.includes('password')) {
      return {
        success: false,
        error: 'PASSWORD_PROTECTED',
        message: 'This PDF is password protected — cannot convert.',
      }
    }

    return {
      success: false,
      error: 'PARSE_ERROR',
      message: `Could not parse PDF: ${err.message}`,
    }
  }
}

function postProcess(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
