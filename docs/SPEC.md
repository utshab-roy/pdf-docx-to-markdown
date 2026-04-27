# SPEC.md — Feature Specification

## Product Name

**pdf docx to markdown** — PDF & DOCX to Markdown for VS Code

## Tagline

> Convert any PDF or Word document to clean Markdown — free, local, no account needed.

## Target Users

- Developers migrating docs to GitHub/GitLab
- Note-takers using Obsidian or Logseq
- Technical writers standardizing documentation
- Students and researchers converting papers
- Anyone who wants to edit PDFs/DOCX in Markdown

---

## Feature List

### CORE FEATURES (MVP — Phase 1)

#### F01 — DOCX to Markdown Conversion

- Right-click any `.docx` file in VS Code explorer
- Select "Convert to Markdown"
- Output: `filename.md` in the same directory
- Preserves:
  - Headings (H1–H6)
  - Bold and italic text
  - Bullet and numbered lists
  - Hyperlinks
  - Tables (converted to Markdown table syntax)
  - Code blocks (if styled as monospace)
- Strips:
  - Page numbers
  - Headers and footers
  - Comments and revision history
  - Complex multi-column layouts (flattened to single column)

#### F02 — PDF to Markdown Conversion

- Right-click any `.pdf` file in VS Code explorer
- Select "Convert to Markdown"
- Output: `filename.md` in the same directory
- Text-based PDFs: full text extracted and formatted
- Scanned PDFs: user warned with helpful message
- Preserves where detectable:
  - Paragraph breaks
  - Headings (guessed from font size metadata)
  - Lists (guessed from bullet characters)

#### F03 — Context Menu Integration

- Menu item: **"Convert to Markdown"** shown on right-click
- Appears only for `.pdf`, `.docx`, `.doc` files
- Grouped under a submenu **"pdf docx to markdown"** for cleanliness

#### F04 — Success / Error Notifications

- ✅ Success: `"report.md created successfully"` with **Open File** button
- ⚠️ Warning: `"Scanned PDF detected — text extraction may be incomplete"`
- ❌ Error: `"Conversion failed: [reason]"` with **Show Logs** button

#### F05 — File Conflict Handling

- If `output.md` already exists:
  - Show dialog: **Overwrite** | **Save as output_1.md** | **Cancel**

---

### ENHANCED FEATURES (Phase 2)

#### F06 — Batch Conversion

- Select multiple files (Ctrl+Click) in explorer
- Right-click → "Convert All to Markdown"
- Progress bar shown in VS Code status bar
- Summary notification: `"3 of 3 files converted successfully"`

#### F07 — Markdown Preview

- After conversion, auto-open the `.md` file in VS Code's built-in Markdown preview
- Toggled via setting: `mdConverter.autoPreview` (default: `true`)

#### F08 — Output Folder Setting

- Setting: `mdConverter.outputFolder`
  - `"same"` (default) — same directory as source
  - `"custom"` — user specifies absolute path
  - `"workspace"` — root of current VS Code workspace

#### F09 — Image Extraction (DOCX)

- Extract embedded images from DOCX
- Save as `filename_images/image1.png` etc.
- Reference them in Markdown as `![image1](filename_images/image1.png)`

#### F10 — Conversion Log

- Output panel showing conversion details
- Accessible via: View → Output → pdf docx to markdown

---

### FUTURE FEATURES (Phase 3)

#### F11 — OCR for Scanned PDFs

- Integrate Tesseract.js for in-process OCR
- No external dependency required
- Language selection in settings

#### F12 — PPTX to Markdown

- Convert PowerPoint slides to Markdown sections
- Each slide becomes a `##` heading block

#### F13 — Excel/CSV to Markdown Table

- `.xlsx` → Markdown table format

#### F14 — Drag and Drop Webview Panel

- A dedicated VS Code panel with drag-and-drop UI
- Accessible via Command Palette: "pdf docx to markdown: Open Panel"

---

## Settings Reference

| Setting                        | Type    | Default  | Description                                    |
| ------------------------------ | ------- | -------- | ---------------------------------------------- |
| `mdConverter.autoPreview`      | boolean | `true`   | Auto-open MD preview after conversion          |
| `mdConverter.outputFolder`     | string  | `"same"` | Where to save output files                     |
| `mdConverter.customOutputPath` | string  | `""`     | Custom output path if outputFolder is "custom" |
| `mdConverter.conflictBehavior` | string  | `"ask"`  | ask / overwrite / rename                       |
| `mdConverter.showLogs`         | boolean | `false`  | Auto-show output panel on conversion           |

---

## Out of Scope (Explicitly)

- Cloud conversion / uploading files to any server
- User accounts or login of any kind
- Telemetry or usage tracking
- Paid features or freemium model
- Converting Markdown back to PDF/DOCX (separate concern)
