# pdf docx to markdown — PDF & DOCX to Markdown for VS Code

> Convert any PDF or Word document to clean Markdown — free, local, no account needed.

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![VS Code](https://img.shields.io/badge/VS%20Code-1.75%2B-blue)](https://code.visualstudio.com/)

---

## Features

- 📄 **DOCX → Markdown** — Preserves headings, tables, lists, bold, italic, links
- 📕 **PDF → Markdown** — Extracts text from text-based PDFs
- 🖱️ **Right-click to convert** — Works directly from VS Code Explorer
- 📦 **Batch conversion** — Select multiple files, convert them all at once
- 🔒 **100% local** — No uploads, no accounts, no telemetry
- ⚡ **Fast & lightweight** — No heavy ML models required
- 🆓 **Completely free** — MIT licensed, open source forever

---

## Installation

1. Open VS Code
2. Press `Ctrl+Shift+X` to open Extensions
3. Search for **"pdf docx to markdown"**
4. Click **Install**

---

## Usage

### Convert a Single File

1. Right-click any `.pdf` or `.docx` file in the Explorer
2. Select **"Convert to Markdown"**
3. The `.md` file appears in the same folder

### Convert Multiple Files

1. Select multiple files with `Ctrl+Click`
2. Right-click → **"Convert to Markdown"**
3. All files are converted with a progress indicator

---

## Settings

| Setting                        | Default  | Description                                                |
| ------------------------------ | -------- | ---------------------------------------------------------- |
| `mdConverter.autoPreview`      | `true`   | Auto-open Markdown preview after conversion                |
| `mdConverter.outputFolder`     | `"same"` | Where to save output: same / custom / workspace            |
| `mdConverter.conflictBehavior` | `"ask"`  | What to do if .md already exists: ask / overwrite / rename |

---

## Supported Formats

| Format           | Support    | Notes                           |
| ---------------- | ---------- | ------------------------------- |
| `.docx`          | ✅ Full    | Headings, tables, lists, images |
| `.pdf` (text)    | ✅ Full    | Text-based PDFs                 |
| `.pdf` (scanned) | ⚠️ Limited | OCR coming in Phase 3           |
| `.doc`           | ⚠️ Partial | Legacy format, best-effort      |
| `.pptx`          | 🔜 Soon    | Coming in Phase 3               |
| `.xlsx`          | 🔜 Soon    | Coming in Phase 3               |

---

## Why pdf docx to markdown?

| Feature           | pdf docx to markdown | Office to Markdown | OneClick MD |
| ----------------- | -------------------- | ------------------ | ----------- |
| Free forever      | ✅                   | ❌ (20 limit)      | ✅          |
| PDF support       | ✅                   | ❌                 | ⚠️ Basic    |
| No account needed | ✅                   | ❌                 | ✅          |
| Open source       | ✅                   | ❌                 | ✅          |
| Image extraction  | ✅                   | ✅                 | ❌          |
| Batch conversion  | ✅                   | ✅                 | ✅          |

---

## Contributing

Pull requests welcome! See [ARCHITECTURE.md](docs/ARCHITECTURE.md) to understand the codebase.

```bash
git clone https://github.com/yourusername/vscode-pdf-docx-to-markdown
cd vscode-pdf-docx-to-markdown
npm install
npm run compile
# Press F5 in VS Code to launch Extension Development Host
```

---

## License

MIT © 2025 — Free to use, modify, and distribute.
