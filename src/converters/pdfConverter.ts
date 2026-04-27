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

// ---------------------------------------------------------------------------
// Post-processing: convert flat PDF text into structured Markdown
// ---------------------------------------------------------------------------

function postProcess(text: string): string {
  const lines = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .split('\n')
    .map(l => l.trimEnd())

  // Order matters: bullets first (so converted lines are excluded from tables)
  const withBullets  = detectBullets(lines)
  const withTables   = detectTables(withBullets)
  const withHeadings = detectHeadings(withTables)
  const spaced       = ensureSpacing(withHeadings)
  const withBreaks   = addLineBreaks(spaced)

  return withBreaks.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

// ── Bullet detection ─────────────────────────────────────────────────────────
// Convert PDF bullet symbols to Markdown `- ` and normalise `1)` → `1.`

const PDF_BULLET_RE = /^[●•◦▪▸▷►◆◇○▶✓✔✗✘→‣⁃–—]\s*/

function detectBullets(lines: string[]): string[] {
  return lines.map(line => {
    const t = line.trim()
    if (!t) return line

    if (PDF_BULLET_RE.test(t)) {
      const indent = /^(\s*)/.exec(line)?.[1] ?? ''
      return indent + '- ' + t.replace(PDF_BULLET_RE, '').trimStart()
    }

    // Normalise "1) text" → "1. text" for standard Markdown numbered lists
    const numMatch = /^(\d+)\)\s+(.+)/.exec(t)
    if (numMatch) {
      const indent = /^(\s*)/.exec(line)?.[1] ?? ''
      return indent + numMatch[1] + '. ' + numMatch[2]
    }

    return line
  })
}

// ── Table detection ──────────────────────────────────────────────────────────
// Consecutive lines with ≥2 tab- or multi-space-separated columns → table.
// Requires ≥2 rows and identical column counts to reduce false positives.

function splitCols(line: string): string[] {
  const trimmed = line.trim()
  // Tab-separated (explicit table export from some tools)
  if (trimmed.includes('\t')) {
    return trimmed.split('\t').map(s => s.trim()).filter(Boolean)
  }
  // Multiple spaces (≥2) as column separator
  return trimmed.split(/\s{2,}/).map(s => s.trim()).filter(Boolean)
}

function isTableCandidate(line: string): boolean {
  const t = line.trim()
  // Skip empty lines, headings, existing table rows, list items, numbered items
  if (!t) return false
  if (t.startsWith('#') || t.startsWith('|')) return false
  if (t.startsWith('- ') || t.startsWith('* ')) return false
  if (/^\d+[.)]\s/.test(t)) return false
  return splitCols(line).length >= 2
}

function detectTables(lines: string[]): string[] {
  const out: string[] = []
  let i = 0

  while (i < lines.length) {
    if (!isTableCandidate(lines[i])) {
      out.push(lines[i])
      i++
      continue
    }

    // Collect a run of consecutive, non-blank table-candidate rows
    let j = i
    while (j < lines.length && lines[j].trim() !== '' && isTableCandidate(lines[j])) {
      j++
    }

    const block = lines.slice(i, j)

    if (block.length >= 2) {
      const colCounts = block.map(l => splitCols(l).length)
      const maxCols   = Math.max(...colCounts)
      const minCols   = Math.min(...colCounts)

      // Accept only when every row has the same number of columns
      if (maxCols >= 2 && maxCols === minCols) {
        const rows = block.map(l => splitCols(l))
        out.push('| ' + rows[0].join(' | ') + ' |')
        out.push('| ' + rows[0].map(() => '---').join(' | ') + ' |')
        for (const row of rows.slice(1)) {
          out.push('| ' + row.join(' | ') + ' |')
        }
        out.push('')
        i = j
        continue
      }
    }

    // Not a valid table — emit only the first line and retry from the next
    out.push(lines[i])
    i++
  }

  return out
}

// ── Heading detection ────────────────────────────────────────────────────────

const SENTENCE_PUNCT = /[.,:;]$/
const ALL_CAPS_RE    = /^[A-Z][A-Z0-9\s\-&:/.''()]+$/

function detectHeadings(lines: string[]): string[] {
  const out: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const t    = line.trim()

    if (!t || t.startsWith('|') || t.startsWith('#') || t.startsWith('- ') || /^\d+[.)]\s/.test(t)) {
      out.push(line)
      continue
    }

    const prevBlank  = i === 0 || !lines[i - 1].trim()
    const nextExists = lines.slice(i + 1).some(l => l.trim())
    const isShort    = t.length >= 3 && t.length <= 72
    const noEndPunct = !SENTENCE_PUNCT.test(t)
    const wordCount  = t.split(/\s+/).length

    if (ALL_CAPS_RE.test(t) && isShort && noEndPunct) {
      out.push('# ' + toTitleCase(t))
      continue
    }

    if (isShort && noEndPunct && prevBlank && nextExists && wordCount <= 10) {
      out.push('## ' + t)
      continue
    }

    out.push(line)
  }

  return out
}

function toTitleCase(str: string): string {
  const minor = new Set(['a','an','the','and','but','or','for','nor','on','at','to','by','in','of','up','as'])
  return str.toLowerCase().replace(/\S+/g, (w, offset) =>
    offset === 0 || !minor.has(w) ? w[0].toUpperCase() + w.slice(1) : w
  )
}

// ── Paragraph spacing ────────────────────────────────────────────────────────

function ensureSpacing(lines: string[]): string[] {
  const out: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const t     = lines[i].trim()
    const prevT = i > 0 ? lines[i - 1].trim() : ''

    if (t.startsWith('#') && prevT && !prevT.startsWith('#')) {
      out.push('')
    }
    out.push(lines[i])
  }

  return out
}

// ── Hard line breaks ─────────────────────────────────────────────────────────
// Markdown collapses a single newline into a space.  Appending two spaces
// before each newline forces a visible line break in the rendered preview.
// Block-level elements (headings, table rows, list items) are excluded.

function addLineBreaks(lines: string[]): string[] {
  return lines.map(line => {
    const t = line.trim()
    if (
      !t ||
      t.startsWith('#') ||
      t.startsWith('|') ||
      t.startsWith('- ') ||
      t.startsWith('* ') ||
      t === '---' ||
      /^\d+[.)]\s/.test(t)
    ) return line
    return line + '  '
  })
}
