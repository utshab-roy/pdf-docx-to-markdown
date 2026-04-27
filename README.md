# pdf docx to markdown

Convert any PDF or Word document to clean Markdown — **free, local, no account needed**.

## Usage

1. Right-click any `.pdf`, `.docx`, or `.doc` file in the VS Code Explorer
2. Select **Convert to Markdown**
3. The `.md` file appears in the same folder

For multiple files, Ctrl-click to select them all, then right-click → **Convert to Markdown**.

## Settings

| Setting | Default | Description |
|---|---|---|
| `mdConverter.autoPreview` | `true` | Open Markdown preview after conversion |
| `mdConverter.outputFolder` | `same` | Where to save output (`same` / `custom` / `workspace`) |
| `mdConverter.customOutputPath` | `""` | Absolute path when `outputFolder` is `custom` |
| `mdConverter.conflictBehavior` | `ask` | What to do if output file exists (`ask` / `overwrite` / `rename`) |
| `mdConverter.showLogs` | `false` | Auto-show Output panel during conversion |

## What is preserved

- **DOCX**: headings, bold/italic, lists, hyperlinks, tables, code blocks
- **PDF** (text-based): paragraphs, basic structure, headings (heuristic)

## Scanned PDFs

Scanned (image-only) PDFs cannot be converted without OCR. The extension detects this and warns you.

## Privacy

All conversion happens locally on your machine. No files are uploaded anywhere.

## License

MIT
