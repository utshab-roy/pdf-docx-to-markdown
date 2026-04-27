# ROADMAP.md — Development Phases

## Phase 1 — MVP (Week 1–2)
**Goal: Working extension that converts DOCX and text-based PDF to Markdown**

### Project Setup Tasks
- [ ] Scaffold extension with `yo code` (TypeScript)
- [ ] Create `LICENSE` file (MIT)
- [ ] Create `CHANGELOG.md` (required by Marketplace)
- [ ] Create `.gitignore` (node_modules, out/, dist/, *.vsix)
- [ ] Create `.vscodeignore` (exclude src/, docs/, tests)
- [ ] Set up esbuild for bundling
- [ ] Set up folder structure per ARCHITECTURE.md

### Core Implementation Tasks
- [ ] Implement `logger.ts` (Output Channel)
- [ ] Implement `notifier.ts` (notifications)
- [ ] Implement `fileUtils.ts` (read/write/conflict handling)
- [ ] Implement `docxConverter.ts` using mammoth + turndown
- [ ] Implement `pdfConverter.ts` using pdf-parse v2 (new PDFParse API)
- [ ] Wire up context menu for `.docx`, `.pdf`, `.doc`
- [ ] Implement file conflict handling (overwrite/rename/cancel dialog)
- [ ] Add success/error/warning notifications
- [ ] Handle edge case: empty PDF (scanned detection)

### Testing Tasks
- [ ] Write unit tests for both converters
- [ ] Add test fixtures: normal DOCX, DOCX with tables, DOCX with images
- [ ] Add test fixtures: text PDF, scanned PDF (for error case)
- [ ] **Add Unicode filename test fixture** (Japanese, e.g. `サンプル.docx`)
- [ ] Test on Windows, macOS, Linux
- [ ] Test with files in paths containing spaces and Unicode characters

### Documentation Tasks
- [ ] Write README.md with install + usage guide
- [ ] Take screenshots for Marketplace listing
- [ ] Design extension icon (128x128 PNG)

### Deliverable
A working `.vsix` file installable in VS Code. Right-click any PDF or DOCX and convert to Markdown.

---

## Phase 2 — Enhanced (Week 3–4)
**Goal: Batch conversion, settings, image extraction, auto-preview**

### Tasks
- [ ] Implement `convertBatch.ts` with progress bar
- [ ] Add VS Code settings (autoPreview, outputFolder, conflictBehavior, showLogs)
- [ ] Implement image extraction from DOCX (mammoth `convertImage` handler)
- [ ] Auto-open Markdown preview after conversion
- [ ] Add custom output folder support
- [ ] Improve PDF post-processing (better paragraph detection)
- [ ] Add `turndown-plugin-gfm` for better table support in DOCX conversion
- [ ] Add "Open Folder" batch output button in notification
- [ ] Write publisher profile + get Personal Access Token
- [ ] Publish to VS Code Marketplace

### Deliverable
Published extension on VS Code Marketplace with batch support and settings.

---

## Phase 3 — Advanced (Month 2)
**Goal: OCR support, more file types, drag-and-drop panel**

### Tasks
- [ ] Integrate `tesseract.js` for scanned PDF OCR
- [ ] Add language selection for OCR (English, Japanese, Chinese, etc.)
- [ ] Add PPTX → Markdown conversion
- [ ] Add XLSX → Markdown table conversion
- [ ] Build drag-and-drop Webview panel
- [ ] Add conversion history panel
- [ ] Support `.doc` (legacy Word) via LibreOffice detection

### Deliverable
Full-featured extension with OCR, all Office formats, and polished UI panel.

---

## Milestones

| Milestone | Target | Status |
|---|---|---|
| Architecture complete | Day 1 | ✅ Done |
| Project scaffolded | Day 2 | ⬜ Pending |
| DOCX converter working | Day 4 | ⬜ Pending |
| PDF converter working | Day 6 | ⬜ Pending |
| Context menu + notifications | Day 7 | ⬜ Pending |
| Unicode tests passing | Day 8 | ⬜ Pending |
| Full MVP tested on 3 OSs | Day 12 | ⬜ Pending |
| Published to Marketplace | Day 16 | ⬜ Pending |
| Batch + settings | Day 24 | ⬜ Pending |
| OCR support | Month 2 | ⬜ Pending |

---

## Publishing Checklist

- [ ] Extension name is unique on Marketplace (search first!)
- [ ] Icon (128x128 PNG) created and referenced in package.json
- [ ] README.md has screenshots
- [ ] CHANGELOG.md exists and follows Keep a Changelog format
- [ ] LICENSE file present (MIT)
- [ ] `repository` field in package.json points to GitHub
- [ ] `vsce package` produces clean `.vsix` with no warnings
- [ ] Tested on fresh VS Code install (no side-effects from dev env)
- [ ] Install `@vscode/vsce` globally: `npm install -g @vscode/vsce`
- [ ] Create Azure DevOps Personal Access Token for publishing
- [ ] `vsce login <publisher>` with token
- [ ] `vsce publish` — done!

---

## Known Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Name conflict on Marketplace | Check before publishing; alternative names ready |
| pdf-parse API changes in future | Pin version; add tests for its behavior |
| Unicode handling bugs | Test fixtures with Japanese/Chinese/emoji filenames from Day 1 |
| Large PDF OOM | Stream processing + size warning above 50MB |
| Security CVE in dependency | Weekly `npm audit`, subscribe to advisories |
