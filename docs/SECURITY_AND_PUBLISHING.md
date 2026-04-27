# SECURITY_AND_PUBLISHING.md — VS Code Marketplace Compliance

## The Prime Directive

This project is intended to be published to the official Microsoft VS Code Marketplace. The Marketplace uses aggressive static analysis tools to scan the `.vsix` file for malware, obfuscation, and suspicious behavior.

**If you write code or introduce dependencies that trigger these heuristics, the publishing pipeline will fail with a "suspicious code" error.**

You MUST adhere to the following rules with zero exceptions.

---

## 1. Absolute Code Prohibitions (The "Suspicious Code" Triggers)

The following JavaScript patterns are strictly forbidden in both first-party code and third-party dependencies. If a required library uses these, you must find an alternative or configure it to bypass those execution paths.

- **No `eval()`:** Never use `eval()`.
- **No `new Function()`:** Do not construct functions dynamically from strings. _(Note: Many older DOM polyfills and PDF parsers do this. You must avoid them)._
- **No Dynamic `setTimeout` or `setInterval`:** Do not pass strings to these timers (e.g., `setTimeout("doSomething()", 1000)`).
- **No Dynamic Requires:** Do not use `require()` with variable arguments (e.g., `require(moduleName)`). Bundlers like `esbuild` cannot resolve these statically and will generate suspicious fallback code.

---

## 2. Dependency Management & Auditing

Third-party dependencies are the #1 cause of Marketplace rejections.

- **Vetting:** Before adding _any_ new library via `npm install`, verify that it does not execute remote code or rely on `eval()`.
- **The `pdf-parse` Warning:** Standard `pdf-parse` is known to trigger VS Code security scanners because it bundles older `pdf.js` worker scripts. You must ensure the PDF text extraction implementation relies on a strictly static, modern implementation (like `pdfjs-dist` carefully imported without the font-rendering `eval()` traps) or a clean alternative.
- **No Minified/Obfuscated Blobs:** Do not commit minified library files directly into the source tree. Let `esbuild` handle the bundling.

---

## 3. Remote Execution & Payloads

The VS Code Marketplace forbids extensions from acting as downloaders for executable code.

- **No Remote Code:** Do not use APIs or libraries that download WebAssembly (`.wasm`), binaries (`.exe`, `.sh`), or JavaScript workers from remote servers (e.g., unpkg, CDNJS) at runtime.
- **Local Assets Only:** If the extension requires WebAssembly (e.g., for future OCR features), the `.wasm` file MUST be downloaded at build time and bundled directly into the `.vsix` package.
- **Data vs. Code:** Downloading data (like a JSON configuration) is acceptable. Downloading logic is forbidden.

---

## 4. File System & OS Interactions

- **No Unsanitized `child_process`:** Do not use `child_process.exec()` or `spawn()` to run arbitrary system commands derived from user input or filenames.
- **Safe Path Resolution:** Always use `node:path` methods (`path.join`, `path.basename`) and `vscode.Uri` to manipulate files. Never concatenate file paths using strings, as this opens the door to directory traversal vulnerabilities.
- **Workspace FS:** Prefer `vscode.workspace.fs` over `node:fs` wherever possible, as it is strictly governed by VS Code's permissions and handles virtual file systems securely.

---

## 5. Build & Bundling Integrity

- **Source Maps:** Always generate source maps (`sourceMap: true` in `tsconfig.json` and esbuild). The Marketplace scanners are less likely to flag bundled code as "obfuscated" if an accurate source map is present.
- **Lockfiles:** Never delete `package-lock.json`. Dependency versions must be strictly locked to prevent supply-chain attacks from pulling malicious minor versions during the build process.
