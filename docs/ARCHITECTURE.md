# ARCHITECTURE.md — Technical Architecture

## High-Level Overview

```
VS Code Explorer (User Right-Clicks File)
              │
              ▼
   ┌─────────────────────┐
   │   Extension Host    │  ← extension.ts (entry point)
   │   (Node.js process) │
   └─────────────────────┘
              │
     ┌────────┴────────┐
     │                 │
     ▼                 ▼
┌─────────────┐  ┌──────────┐
│ DOCX conv.  │  │ PDF conv.│
│ mammoth →   │  │pdf-parse │
│ turndown    │  │   v2     │
└─────────────┘  └──────────┘
     │                 │
     └────────┬────────┘
              │
              ▼
   ┌─────────────────────┐
   │   File Writer       │  ← writes .md to disk (UTF-8)
   │   + Conflict Check  │
   └─────────────────────┘
              │
              ▼
   ┌─────────────────────┐
   │  Notification Layer │  ← VS Code info/error messages
   └─────────────────────┘
```

---

## Folder Structure

```
vscode-pdf-docx-to-markdown/
├── CLAUDE.md                    ← Instructions for Claude Code
├── README.md                    ← User-facing documentation
├── LICENSE                      ← MIT license text
├── CHANGELOG.md                 ← Version history (required by Marketplace)
├── package.json                 ← Extension manifest + dependencies
├── tsconfig.json                ← TypeScript config
├── .vscodeignore                ← Files excluded from .vsix package
├── .gitignore                   ← Git ignore rules
├── .eslintrc.json               ← Linting rules
│
├── docs/                        ← Project planning docs
│   ├── SPEC.md
│   ├── ARCHITECTURE.md          ← This file
│   ├── TECH_STACK.md
│   ├── ROADMAP.md
│   └── UI_UX.md
│
├── src/                         ← All TypeScript source code
│   ├── extension.ts             ← Entry point, registers commands
│   │
│   ├── commands/                ← VS Code command handlers
│   │   ├── convertSingle.ts     ← Handles single file conversion
│   │   └── convertBatch.ts      ← Handles multi-file conversion
│   │
│   ├── converters/              ← Core conversion logic
│   │   ├── index.ts             ← Exports all converters + router
│   │   ├── docxConverter.ts     ← DOCX → HTML → Markdown
│   │   └── pdfConverter.ts      ← PDF → Text/Markdown (pdf-parse v2)
│   │
│   ├── utils/                   ← Shared utility functions
│   │   ├── fileUtils.ts         ← File read/write, conflict handling
│   │   ├── notifier.ts          ← VS Code notification helpers
│   │   └── logger.ts            ← Output channel logging
│   │
│   └── types/                   ← TypeScript type definitions
│       └── index.ts             ← Shared types and interfaces
│
└── test/                        ← Unit tests
    ├── fixtures/                ← Sample .pdf and .docx files
    │   ├── sample.docx
    │   ├── sample-with-japanese.docx
    │   └── sample.pdf
    ├── converters/
    │   ├── docxConverter.test.ts
    │   └── pdfConverter.test.ts
    └── utils/
        └── fileUtils.test.ts
```

---

## Module Responsibilities

### `src/extension.ts`

- Extension entry point
- Registers all commands with VS Code API
- Initializes the Output Channel (logger)
- Activates/deactivates the extension lifecycle

```typescript
import * as vscode from 'vscode'
import { convertSingleCommand } from './commands/convertSingle'
import { convertBatchCommand } from './commands/convertBatch'
import { initLogger } from './utils/logger'

export function activate(context: vscode.ExtensionContext) {
  initLogger()

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'mdConverter.convertFile',
      convertSingleCommand,
    ),
    // convertBatch handled by same command, with array arg
  )
}

export function deactivate() {}
```

### `src/commands/convertSingle.ts`

- Receives URI (or URI[]) of file(s) from context menu
- VS Code passes `(clickedUri, selectedUris)` — selectedUris is the multi-select array
- If only one file → single conversion path
- If multiple files → calls batch handler

### `src/commands/convertBatch.ts`

- Receives array of URIs
- Loops through, calls single convert logic per file
- Shows progress bar via `vscode.window.withProgress`
- Shows summary notification when done

### `src/converters/docxConverter.ts`

**Uses mammoth + turndown (NOT mammoth.convertToMarkdown — deprecated):**

```typescript
import mammoth from 'mammoth'
import TurndownService from 'turndown'

export async function convertDocx(filePath: string): Promise<ConversionResult> {
  const htmlResult = await mammoth.convertToHtml({ path: filePath })
  const turndown = new TurndownService({
    headingStyle: 'atx',
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
  })
  const markdown = turndown.turndown(htmlResult.value)

  return {
    success: true,
    content: markdown,
    warnings: htmlResult.messages.map((m) => m.message),
  }
}
```

### `src/converters/pdfConverter.ts`

**Uses pdf-parse v2 API (new PDFParse class):**

```typescript
import { readFile } from 'node:fs/promises'
import { PDFParse } from 'pdf-parse'

export async function convertPdf(filePath: string): Promise<ConversionResult> {
  const buffer = await readFile(filePath)
  const parser = new PDFParse({ data: buffer })
  const result = await parser.getText()

  // Detect scanned PDFs
  if (!result.text || result.text.trim().length < 20) {
    return {
      success: false,
      error: 'SCANNED_PDF',
      message:
        'This PDF appears to be scanned (image-only). Text extraction is not possible without OCR.',
    }
  }

  // Basic post-processing: clean up whitespace, format paragraphs
  const markdown = postProcessPdfText(result.text)
  return { success: true, content: markdown }
}

function postProcessPdfText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n') // Collapse excess blank lines
    .trim()
}
```

### `src/utils/fileUtils.ts`

- `resolveOutputPath(inputPath: string): string` — computes output .md path
- `checkConflict(path: string): Promise<'ok' | 'exists'>` — checks if file exists
- `writeMarkdown(path: string, content: string): Promise<void>` — writes UTF-8
- **Always use `vscode.workspace.fs`** for cross-platform file I/O with Unicode safety
- Use `path.basename(filePath, path.extname(filePath))` for base name — never split by `.`

### `src/utils/notifier.ts`

- `showSuccess(filePath: string)` — info message with [Open File] button
- `showWarning(message: string)` — warning notification
- `showError(message: string, error?: Error)` — error with [Show Logs] button

### `src/utils/logger.ts`

- Creates VS Code Output Channel "pdf docx to markdown"
- `log(message: string)` — appends timestamped log entry
- `logError(error: Error)` — logs full error stack trace

### `src/types/index.ts`

```typescript
export type FileType = 'pdf' | 'docx' | 'doc' | 'unknown'

export interface ConversionResult {
  success: boolean
  content?: string
  outputPath?: string
  error?: string
  message?: string
  warnings?: string[]
}

export interface ConversionOptions {
  outputFolder: 'same' | 'custom' | 'workspace'
  customOutputPath?: string
  conflictBehavior: 'ask' | 'overwrite' | 'rename'
  autoPreview: boolean
}
```

---

## Data Flow — Single File Conversion

```
1. User right-clicks "報告書.docx" → clicks "Convert to Markdown"
   (Note: Unicode filename — must be handled correctly)

2. VS Code fires command: "mdConverter.convertFile"
   with args: (clickedUri: Uri, selectedUris: Uri[])

3. convertSingle.ts:
   - Reads settings (ConversionOptions)
   - Detects FileType from extension (case-insensitive)
   - Routes to docxConverter.convert(filePath)

4. docxConverter.ts:
   - Reads file via mammoth.convertToHtml({ path })
   - Passes HTML through TurndownService
   - Returns markdown string + any warnings

5. convertSingle.ts:
   - Calls fileUtils.resolveOutputPath() → "報告書.md"
   - Calls fileUtils.checkConflict()
     - If exists → show dialog (Overwrite / Rename / Cancel)
   - Calls fileUtils.writeMarkdown(path, content)
     - Writes with UTF-8 BOM-free encoding

6. notifier.ts:
   - Shows: "✅ 報告書.md created" [Open File]

7. If autoPreview setting is true:
   - Executes: vscode.commands.executeCommand('markdown.showPreview', uri)
```

---

## package.json Contributions (Key Sections)

```json
{
  "name": "vscode-pdf-docx-to-markdown",
  "displayName": "pdf docx to markdown",
  "version": "0.1.0",
  "engines": {
    "vscode": "^1.85.0"
  },
  "categories": ["Formatters", "Other"],
  "main": "./dist/extension.js",
  "contributes": {
    "commands": [
      {
        "command": "mdConverter.convertFile",
        "title": "Convert to Markdown",
        "category": "pdf docx to markdown"
      }
    ],
    "menus": {
      "explorer/context": [
        {
          "command": "mdConverter.convertFile",
          "when": "resourceExtname == .pdf || resourceExtname == .docx || resourceExtname == .doc",
          "group": "7_modification@1"
        }
      ]
    },
    "configuration": {
      "title": "pdf docx to markdown",
      "properties": {
        "mdConverter.autoPreview": {
          "type": "boolean",
          "default": true,
          "description": "Automatically open Markdown preview after conversion"
        },
        "mdConverter.outputFolder": {
          "type": "string",
          "enum": ["same", "custom", "workspace"],
          "default": "same",
          "description": "Where to save converted files"
        },
        "mdConverter.customOutputPath": {
          "type": "string",
          "default": "",
          "description": "Custom output path (used when outputFolder is 'custom')"
        },
        "mdConverter.conflictBehavior": {
          "type": "string",
          "enum": ["ask", "overwrite", "rename"],
          "default": "ask",
          "description": "What to do if the output .md file already exists"
        },
        "mdConverter.showLogs": {
          "type": "boolean",
          "default": false,
          "description": "Automatically show the Output panel during conversion"
        }
      }
    }
  }
}
```

> **Note**: No `activationEvents` array needed — VS Code 1.75+ auto-derives them from `contributes.commands`.

---

## Error Handling Strategy

| Scenario               | Behavior                                                                |
| ---------------------- | ----------------------------------------------------------------------- |
| File not found         | Show error: "File not found"                                            |
| Corrupt DOCX           | Show error: "Could not read DOCX — file may be corrupted"               |
| Scanned PDF            | Show warning: "This PDF appears to be scanned — text may be incomplete" |
| Password-protected PDF | Show error: "PDF is password protected — cannot convert"                |
| Disk write failure     | Show error: "Could not write output file — check folder permissions"    |
| Unknown file type      | Show error: "Unsupported file type"                                     |
| Unicode filename issue | Never — use `path.basename()` always                                    |

All errors are also logged to the Output Channel for debugging.

---

## Unicode & Internationalization Notes

Because filenames can contain any Unicode characters (especially in Japanese, Chinese, Korean, Arabic, emoji, etc.), the extension must:

1. Always use `vscode.Uri` or `node:path` for filename manipulation — NEVER string-split on `.`
2. Always read/write files as UTF-8
3. Use `buffer.toString('utf-8')` when converting buffers to strings
4. Use `Buffer.from(content, 'utf-8')` when writing strings to disk
5. Avoid regex patterns that assume Latin characters

---

## Performance Targets

| File Size | Expected Conversion Time     |
| --------- | ---------------------------- |
| < 1 MB    | < 1 second                   |
| 1–10 MB   | < 5 seconds                  |
| 10–50 MB  | < 20 seconds                 |
| > 50 MB   | Show progress bar, warn user |
