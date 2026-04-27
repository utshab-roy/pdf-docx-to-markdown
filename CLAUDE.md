# CLAUDE.md — VS Code PDF & DOCX to Markdown Converter Extension

- **NO Dynamic Code Execution**: Absolutely no `eval()`, `new Function()`, or dynamic `setTimeout` strings. The VS Code Marketplace will reject the extension.
- **NO Dynamic Requires**: Ensure esbuild does not compile any `require(variable)` statements.
- **NO Remote Payloads**: Do not download binary files, Wasm workers, or executable scripts at runtime.

## Commands to Bootstrap

````bash
# Recommended: Scaffold using npx to avoid global install issues
npx --package yo --package generator-code -- yo code

# Selection during prompt:
# ? What type of extension do you want to create? New Extension (TypeScript)
# ? What's the name of your extension? pdf docx to markdown
# ? What's the identifier of your extension? pdf-docx-to-markdown
# ? What's the description of your extension? Convert PDF/DOCX to Markdown
# ? Initialize a git repository? Yes
# ? Which bundler to use? esbuild (CRITICAL: See TECH_STACK.md for config)
# ? Which package manager to use? npm

## Project Overview

This is a **VS Code extension** that allows users to convert PDF and DOCX files into clean Markdown (`.md`) format directly from the VS Code file explorer via right-click context menu. It is fully free, open source, privacy-first (fully local, no cloud/account needed), and aims to be the best free alternative to existing paywalled or low-quality extensions on the VS Code Marketplace.

## Key References

- Full feature spec: `docs/SPEC.md`
- Architecture details: `docs/ARCHITECTURE.md`
- Tech stack decisions: `docs/TECH_STACK.md`
- Roadmap and phases: `docs/ROADMAP.md`
- UI/UX guidelines: `docs/UI_UX.md`

---

## What Claude Code Should Do

When implementing this project, Claude Code should:

1. **Read all docs/** files before writing any code
2. Scaffold the VS Code extension using `yo code` or manually create the structure
3. Implement converters one at a time: DOCX first, then PDF
4. Write TypeScript throughout — no plain JavaScript
5. Keep all conversion logic local — no API calls, no telemetry
6. Test each converter independently before wiring to the UI
7. Follow the file structure defined in `docs/ARCHITECTURE.md` exactly
8. **Always verify library APIs** before implementing — mammoth and pdf-parse APIs have changed; check `docs/TECH_STACK.md` for current usage

---

## Commands to Bootstrap

```bash
# Install VS Code extension generator
npm install -g yo generator-code

# Scaffold the extension
yo code

# Choose: "New Extension (TypeScript)", name: vscode-pdf-docx-to-markdown

# Install runtime dependencies
npm install mammoth turndown pdf-parse

# Install dev dependencies
npm install --save-dev @types/node @types/vscode @types/turndown
````

> ⚠️ **Why turndown?** Mammoth's direct `convertToMarkdown()` is deprecated by the author. The recommended approach is: mammoth → HTML → turndown → Markdown. This produces cleaner output.

---

## Core Constraints

- **No external API calls** — all conversion happens locally
- **No user accounts or login** — fully anonymous
- **No telemetry** — respect user privacy
- **TypeScript only** — no plain `.js` files in `src/`
- **Target VS Code version**: 1.85.0+ (February 2024)
- **Node.js**: 20.16+ (required by pdf-parse v2)
- **License**: MIT
- **Encoding**: All file I/O must be UTF-8 (important for non-Latin filenames like Japanese, Chinese, Arabic, etc.)

---

## Critical Implementation Notes

### DOCX → Markdown

- **Step 1**: Use `mammoth.convertToHtml({ buffer })` to get HTML
- **Step 2**: Use `turndown` to convert that HTML to Markdown
- Preserve: headings, bold, italic, tables, lists, hyperlinks
- Strip: complex layout, embedded macros, revision history
- Output: clean `.md` file in same directory as source
- **Do NOT use mammoth.convertToMarkdown** — it's deprecated

### PDF → Markdown

- Use **pdf-parse v2+** (note: API changed from v1)
- New API: `const parser = new PDFParse({ data: buffer }); const result = await parser.getText();`
- Detect if PDF is scanned (empty or very short text) and warn the user
- Output: `.md` file with extracted text

### File Naming & Unicode

- Always read/write files with `utf-8` encoding
- Use `path.basename()` / `path.extname()` — never string splitting (breaks on Unicode)
- Input: `report.docx` → Output: `report.md`
- If `report.md` already exists → prompt user: overwrite or rename to `report_1.md`
- Filenames with Japanese, Chinese, Arabic, emoji etc. must work correctly

### Error Handling

- Always show VS Code notification on success (`vscode.window.showInformationMessage`)
- Always show actionable error messages on failure (`vscode.window.showErrorMessage`)
- Log full stack traces to Output Channel
- Never silently fail

---

## Required Files at Root

- `package.json` — extension manifest
- `tsconfig.json` — TypeScript config
- `.vscodeignore` — exclude files from .vsix
- `.gitignore` — node_modules, out/, dist/, \*.vsix
- `.eslintrc.json` — linting rules
- `LICENSE` — MIT license text
- `CHANGELOG.md` — version history (required by Marketplace)
- `README.md` — user documentation

---

## Definition of Done (MVP)

- [ ] Right-click on `.pdf` → "Convert to Markdown" appears
- [ ] Right-click on `.docx` → "Convert to Markdown" appears
- [ ] Right-click on multiple files → batch convert all
- [ ] Converted `.md` file appears in same folder
- [ ] Works with Unicode filenames (Japanese, Chinese, emoji, etc.)
- [ ] Success/error notifications shown
- [ ] Works on Windows, macOS, Linux
- [ ] README.md is complete with install + usage instructions
- [ ] LICENSE and CHANGELOG.md files exist
- [ ] Published to VS Code Marketplace
