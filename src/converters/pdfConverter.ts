import * as vscode from 'vscode'
import { log, logError } from '../utils/logger'
import type { ConversionResult } from '../types'

// A single text item extracted from pdfjs, enriched with page coordinates.
// transform[4] = x (horizontal position), transform[5] = y (vertical position).
interface RawItem {
  str: string
  x: number
  y: number
  hasEOL: boolean
  isBold: boolean
}

// Type guard — also validates the transform matrix we depend on for coordinates.
function isTextItem(
  item: unknown,
): item is { str: string; transform: number[]; hasEOL: boolean; fontName?: string } {
  if (typeof item !== 'object' || item === null) return false
  const obj = item as Record<string, unknown>
  return (
    typeof obj.str === 'string' &&
    Array.isArray(obj.transform) &&
    (obj.transform as number[]).length >= 6
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

      // Collect every text item with its real page coordinates.
      const rawItems: RawItem[] = []
      for (const item of textContent.items) {
        if (isTextItem(item) && item.str !== '') {
          rawItems.push({
            str: item.str,
            x: item.transform[4],
            y: item.transform[5],
            hasEOL: !!item.hasEOL,
            isBold: /bold/i.test(item.fontName ?? ''),
          })
        }
      }

      const rows = groupIntoRows(rawItems)
      fullText += buildPageMarkdown(rows) + '\n\n'
      page.cleanup()
    }

    const trimmed = fullText.trim()

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
// Coordinate-based layout analysis
// ---------------------------------------------------------------------------

// Items within Y_TOL points vertically are considered on the same row.
// 4pt covers sub/superscript variation and slight baseline shifts within a line
// without accidentally merging items from adjacent lines (typical line gap ≥12pt).
const Y_TOL = 4

// An item's X position must be within X_TOL points of a column boundary to be
// assigned to that column.  20pt ≈ 7mm — generous enough for bold/italic shifts
// while staying well below the minimum useful column width.
const X_TOL = 20

// Group flat item list into rows sorted top-to-bottom, left-to-right.
// PDF Y-axis points upward, so larger Y = higher on the page.
function groupIntoRows(items: RawItem[]): RawItem[][] {
  if (items.length === 0) return []

  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x)
  const rows: RawItem[][] = []
  let current: RawItem[] = [sorted[0]]
  let rowY = sorted[0].y

  for (let i = 1; i < sorted.length; i++) {
    const item = sorted[i]
    if (Math.abs(item.y - rowY) <= Y_TOL) {
      current.push(item)
    } else {
      rows.push([...current].sort((a, b) => a.x - b.x))
      current = [item]
      rowY = item.y
    }
  }
  rows.push([...current].sort((a, b) => a.x - b.x))

  return rows
}

// Only the non-whitespace items in a row carry meaningful column positions.
function contentItems(row: RawItem[]): RawItem[] {
  return row.filter(r => r.str.trim() !== '')
}

// Returns true if every non-whitespace item in `row` aligns (within X_TOL)
// to at least one of the column X-positions established by the header row.
function rowAlignsToColumns(row: RawItem[], colXs: number[]): boolean {
  const content = contentItems(row)
  if (content.length === 0) return false
  return content.every(item =>
    colXs.some(cx => Math.abs(item.x - cx) <= X_TOL),
  )
}

// Join a list of items into a string, wrapping consecutive bold runs with **…**.
// Only wraps if the bold run contains non-whitespace so we never emit `**  **`.
function itemsToString(items: RawItem[]): string {
  let result = ''
  let boldRun = ''

  for (const item of items) {
    if (item.isBold) {
      boldRun += item.str
    } else {
      if (boldRun) {
        result += boldRun.trim() ? `**${boldRun}**` : boldRun
        boldRun = ''
      }
      result += item.str
    }
  }
  if (boldRun) result += boldRun.trim() ? `**${boldRun}**` : boldRun
  return result
}

// Bucket each non-whitespace item into the nearest column slot.
// Multiple items that land in the same slot are collected then joined via
// itemsToString so that bold runs within a cell are preserved.
function assignToCols(row: RawItem[], colXs: number[]): string[] {
  const slotItems: RawItem[][] = colXs.map(() => [])
  for (const item of contentItems(row)) {
    let best = 0
    let bestDist = Infinity
    for (let c = 0; c < colXs.length; c++) {
      const d = Math.abs(item.x - colXs[c])
      if (d < bestDist) { bestDist = d; best = c }
    }
    slotItems[best].push(item)
  }
  return slotItems.map(items => itemsToString(items).trim())
}

// Minimum gap (pt) between adjacent column X positions for the row to be
// treated as a table header.  Body-text word spacing is 15–40 pt; real table
// columns are typically 50 pt+ apart.  Items closer than this are merged into
// a single column, collapsing flowing prose into one column and rejecting it.
const MIN_COL_GAP = 50

// Derive distinct column X positions from a header row by merging items that
// are closer than MIN_COL_GAP to each other.
function detectColXs(content: RawItem[]): number[] {
  const xs = content.map(it => it.x).sort((a, b) => a - b)
  const cols: number[] = [xs[0]]
  for (let k = 1; k < xs.length; k++) {
    if (xs[k] - cols[cols.length - 1] >= MIN_COL_GAP) {
      cols.push(xs[k])
    }
  }
  return cols
}

// Convert one page's rows into Markdown, detecting tables via X alignment.
function buildPageMarkdown(rows: RawItem[][]): string {
  const lines: string[] = []
  let i = 0

  while (i < rows.length) {
    const row = rows[i]
    const content = contentItems(row)

    // Derive distinct, well-separated column positions.  Two or more are
    // required — a single merged column means it is flowing prose, not a table.
    if (content.length >= 2) {
      const colXs = detectColXs(content)

      if (colXs.length >= 2) {
        let j = i + 1

        // Extend the table while every subsequent row aligns to those columns.
        while (j < rows.length && rowAlignsToColumns(rows[j], colXs)) {
          j++
        }

        // Need at least one data row beneath the header to form a real table.
        if (j - i >= 2) {
          // Reject label:value layouts where every filled first-column item ends
          // with ':' — e.g. "Name:", "Date of Birth:", "Address:".  Those are
          // field labels, not table column headers.
          const col0Values = rows
            .slice(i, j)
            .map(r => assignToCols(r, colXs)[0].trim())
            .filter(v => v !== '')
          const isLabelValue =
            col0Values.length > 0 && col0Values.every(v => v.endsWith(':'))

          if (!isLabelValue) {
            const logicalRows = groupVisualRowsIntoLogical(rows.slice(i, j), colXs)

            if (logicalRows.length >= 2) {
              const header = logicalRows[0]
              lines.push('| ' + header.join(' | ') + ' |')
              lines.push('| ' + header.map(() => '---').join(' | ') + ' |')
              for (const dataRow of logicalRows.slice(1)) {
                lines.push('| ' + dataRow.join(' | ') + ' |')
              }
              lines.push('')
              i = j
              continue
            }
          }
        }
      }
    }

    // Regular text row — join all items in left-to-right reading order.
    const text = itemsToString(row).trimEnd()
    if (text) lines.push(text)
    i++
  }

  return lines.join('\n')
}

// Group visual rows (one per PDF text line) into logical table rows.
//
// Three-case decision per visual row, backed by a calibrated Y-gap reference:
//
//   col[0] empty              → continuation (certain — other columns are wrapping)
//   col[0] only, others empty → col[0] itself is wrapping; treat as continuation
//                               unless the Y gap is distinctly larger than the
//                               known within-cell line spacing
//   col[0] + other cols       → new logical row, unless the Y gap is within the
//                               within-cell range (all columns wrapping together)
//
// The within-cell line spacing is calibrated from rows where col[0] is empty —
// those are unambiguously continuations, so their gap is a confirmed line gap.
//
//   Visual rows:                    Logical row output:
//   | Long Title L1 | Desc | ... |  | Long Title L1<br>Long Title L2 | Desc | ...
//   | Long Title L2 |      |     |
//
function groupVisualRowsIntoLogical(
  visualRows: RawItem[][],
  colXs: number[],
): string[][] {
  if (visualRows.length === 0) return []

  // Average Y of a visual row (accounts for minor baseline variations)
  const avgY = (row: RawItem[]) =>
    row.length === 0 ? 0 : row.reduce((s, r) => s + r.y, 0) / row.length

  // Pre-compute Y gap before each visual row (index 0 is unused / 0)
  const yGaps: number[] = [0]
  for (let vi = 1; vi < visualRows.length; vi++) {
    yGaps.push(Math.abs(avgY(visualRows[vi - 1]) - avgY(visualRows[vi])))
  }

  // Calibrate the within-cell line gap from rows where col[0] is definitely
  // empty — those are unambiguous continuations of another column's text.
  const confirmedGaps: number[] = []
  for (let vi = 1; vi < visualRows.length; vi++) {
    const slots = assignToCols(visualRows[vi], colXs)
    if (slots[0] === '' && slots.some(s => s !== '')) {
      confirmedGaps.push(yGaps[vi])
    }
  }
  confirmedGaps.sort((a, b) => a - b)
  const medianWithin =
    confirmedGaps.length > 0
      ? confirmedGaps[Math.floor(confirmedGaps.length / 2)]
      : null

  const logical: string[][] = []

  for (let vi = 0; vi < visualRows.length; vi++) {
    const slots = assignToCols(visualRows[vi], colXs)
    if (slots.every(s => s === '')) continue  // skip blank/separator lines

    if (logical.length === 0) {
      logical.push([...slots])
      continue
    }

    const gap    = yGaps[vi]
    const col0   = slots[0] !== ''
    const others = slots.slice(1).some(s => s !== '')

    let isNewRow: boolean

    if (!col0) {
      // col[0] empty → definitely a continuation of another column's text
      isNewRow = false
    } else if (!others) {
      // col[0] content only, all other slots empty → col[0] itself is wrapping.
      // Treat as a new row only when the gap is clearly larger than within-cell
      // spacing (meaning there really is a row boundary here).
      isNewRow = medianWithin !== null && gap > medianWithin * 1.5
    } else {
      // col[0] + other columns have content → most likely a new logical row.
      // Treat as a continuation only when the gap is tightly within the
      // within-cell range (all columns happening to wrap on the same line).
      isNewRow = medianWithin === null || gap > medianWithin * 1.3
    }

    if (isNewRow) {
      logical.push([...slots])
    } else {
      const current = logical[logical.length - 1]
      for (let c = 0; c < slots.length; c++) {
        if (slots[c]) {
          current[c] = current[c] ? current[c] + '<br>' + slots[c] : slots[c]
        }
      }
    }
  }

  return logical
}

// ---------------------------------------------------------------------------
// Post-processing: headings, bullets, spacing, line breaks
// Table detection is now handled upstream by buildPageMarkdown using real
// coordinates, so detectTables is no longer needed here.
// ---------------------------------------------------------------------------

function postProcess(text: string): string {
  const lines = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .split('\n')
    .map(l => l.trimEnd())

  const withBullets  = detectBullets(lines)
  const withHeadings = detectHeadings(withBullets)
  const spaced       = ensureSpacing(withHeadings)
  const withBreaks   = addLineBreaks(spaced)

  return withBreaks.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

// ── Bullet detection ─────────────────────────────────────────────────────────

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
// Markdown collapses a single newline into a space.  Two trailing spaces force
// a visible line break in the rendered preview without creating a new paragraph.

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
