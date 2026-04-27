# TECH_STACK.md — Technology Stack

## Summary Table

| Layer           | Technology                    | Version | Reason                                   |
| --------------- | ----------------------------- | ------- | ---------------------------------------- |
| Language        | TypeScript                    | 5.x     | VS Code extensions standard, type safety |
| Extension API   | VS Code API                   | 1.85+   | Required for all extensions              |
| DOCX → HTML     | mammoth.js                    | 1.11+   | Best free DOCX→HTML library, active      |
| HTML → MD       | turndown                      | 7.x     | Standard HTML to Markdown converter      |
| PDF Conversion  |
| Build Tool      | esbuild                       | 0.20+   | Fast bundling, used by VS Code itself    |
| Testing         | Mocha + @vscode/test-electron | latest  | Official VS Code extension testing       |
| Linting         | ESLint + typescript-eslint    | latest  | Standard for TS projects                 |
| Package Manager | npm                           | 10+     | Default, universally supported           |

---

## Core Libraries

### mammoth.js (+ turndown)

- **Purpose**: DOCX → HTML → Markdown conversion (two-step)
- **Install**: `npm install mammoth turndown`
- **Types**: `npm install --save-dev @types/turndown`
- **Why two-step?** Mammoth's `convertToMarkdown()` is **deprecated** by the library author. The recommended approach (per mammoth's own docs) is: convert DOCX → HTML with mammoth, then HTML → Markdown with turndown. This produces cleaner output.

**Correct API usage:**

````typescript
import mammoth from 'mammoth'
import TurndownService from 'turndown'

async function docxToMarkdown(filePath: string): Promise<string> {
  // Step 1: DOCX → HTML via mammoth
  const result = await mammoth.convertToHtml({ path: filePath })
  const html = result.value
  const warnings = result.messages // Log these

  // Step 2: HTML → Markdown via turndown
  const turndown = new TurndownService({
    headingStyle: 'atx', // Use # instead of underline
    bulletListMarker: '-',
    codeBlockStyle: 'fenced', // Use ``` instead of indent
    emDelimiter: '*',
  })

  // Add table support (turndown doesn't support tables by default)
  // Install: npm install turndown-plugin-gfm
  // Import: import { gfm } from 'turndown-plugin-gfm';
  // turndown.use(gfm);

  return turndown.turndown(html)
}
````

### PDF Parsing (Security Critical)

- **Library**: `pdfjs-dist` (or a strictly vetted text-extraction library that does NOT use `eval()`).
- **Why**: Standard `pdf-parse` bundles older `pdf.js` workers that heavily utilize `eval()` and `new Function()`. The VS Code Marketplace static scanners will reject the extension for "suspicious code" if `eval()` is detected in the bundled output.
- **Rule**: Ensure whichever PDF library is used is strictly for text extraction and has dynamic code execution stripped or disabled.

### esbuild (Bundler)

Make sure `esbuild` is configured to avoid injecting dynamic fallbacks.

````bash
npx esbuild src/extension.ts \
  --bundle \
  --outfile=dist/extension.js \
  --external:vscode \
  --format=cjs \
  --platform=node \
  --target=node20 \
  --define:process.env.NODE_ENV=\"production\"

---

## VS Code Extension Infrastructure

### package.json (Extension Manifest)
The single most important file. Defines:
- Extension name, version, description
- Which commands the extension registers
- What appears in context menus (`contributes.menus`)
- User settings (`contributes.configuration`)
- Engine version requirement (`engines.vscode`)

> **Note**: With VS Code 1.75+, you no longer need explicit `activationEvents` entries for commands — they are auto-generated from the `contributes.commands` section.

### VS Code API (built-in, no install needed)
Key APIs used in this project:
```typescript
import * as vscode from 'vscode';

// Show notifications
vscode.window.showInformationMessage('Done!');
vscode.window.showErrorMessage('Failed!');
vscode.window.showWarningMessage('Warning!');

// Open a file in editor / markdown preview
vscode.commands.executeCommand('markdown.showPreview', uri);

// Read settings
const config = vscode.workspace.getConfiguration('mdConverter');
const autoPreview = config.get<boolean>('autoPreview', true);

// Show progress
vscode.window.withProgress({
  location: vscode.ProgressLocation.Notification,
  title: "Converting files...",
  cancellable: false
}, async (progress) => {
  progress.report({ increment: 20, message: "Processing..." });
});

// Output channel (logs)
const channel = vscode.window.createOutputChannel('pdf docx to markdown');
channel.appendLine('Converting report.pdf...');

// File system (use workspace.fs for cross-platform safety)
const bytes = await vscode.workspace.fs.readFile(uri);
await vscode.workspace.fs.writeFile(outputUri, Buffer.from(content, 'utf-8'));
````

---

## Build & Tooling

### TypeScript Config (tsconfig.json)

```json
{
  "compilerOptions": {
    "module": "Node16",
    "moduleResolution": "Node16",
    "target": "ES2022",
    "outDir": "out",
    "lib": ["ES2022"],
    "sourceMap": true,
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "exclude": ["node_modules", ".vscode-test", "out", "dist"]
}
```

### esbuild (Bundler)

Used to bundle the extension into a single file for distribution:

```bash
npx esbuild src/extension.ts \
  --bundle \
  --outfile=dist/extension.js \
  --external:vscode \
  --format=cjs \
  --platform=node \
  --target=node20
```

### .vscodeignore

Files excluded from the published `.vsix` package:

```
.vscode/**
.vscode-test/**
src/
docs/
test/
.eslintrc.json
tsconfig.json
*.map
*.ts
!dist/extension.js
node_modules/
```

### .gitignore

```
node_modules/
out/
dist/
*.vsix
.vscode-test/
*.log
```

---

## Why NOT These Alternatives

| Alternative                        | Rejected Because                          |
| ---------------------------------- | ----------------------------------------- |
| `docx2md` npm package              | Unmaintained, poor table support          |
| `pandoc` CLI                       | Requires external install, not bundleable |
| `marker-pdf`                       | Python only, 2GB+ ML models, overkill     |
| `pdfjs-dist` directly              | Heavier, complex API for text extraction  |
| `mammoth.convertToMarkdown`        | Deprecated by author                      |
| `Electron` for packaging           | Not needed — VS Code IS the shell         |
| `JavaScript` instead of TypeScript | No type safety, harder to maintain        |
| `webpack` instead of esbuild       | 10x slower, more config complexity        |

---

## Node.js Compatibility

- VS Code 1.85+ bundles Node.js 18, but newer versions ship Node 20+
- For extensions targeting VS Code 1.89+, Node 20 is safely available
- All libraries must be pure Node.js (no browser-only APIs)
- No native addons (.node files) — they don't cross-compile cleanly

---

## Future Phase Libraries (Don't Install Now)

| Phase   | Library               | Purpose                          |
| ------- | --------------------- | -------------------------------- |
| Phase 2 | `turndown-plugin-gfm` | Better table support in turndown |

#### **Update to `ROADMAP.md` (Phase 3)**

The plan to use `tesseract.js` in Phase 3 is a massive red flag for the Marketplace. By default, `tesseract.js` fetches WebAssembly workers and language models from third-party CDNs (like unpkg) at runtime. The Marketplace strictly forbids downloading executable code at runtime.

**Modify Phase 3:**

```markdown
- [ ] Integrate OCR for Scanned PDFs
  - _WARNING_: Do NOT use standard `tesseract.js` if it fetches Wasm workers remotely.
  - All workers and language models MUST be packaged locally within the `.vsix` to pass Marketplace security scans. No remote execution payloads.
```
