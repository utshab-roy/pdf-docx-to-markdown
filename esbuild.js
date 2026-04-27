'use strict'

const esbuild = require('esbuild')
const fs = require('node:fs/promises')

const production = process.argv.includes('--production')
const watch = process.argv.includes('--watch')

// ---------------------------------------------------------------------------
// Marketplace security plugin
//
// The VS Code Marketplace static scanner rejects bundles containing eval() or
// new Function().  Each source in the dependency graph requires a targeted fix:
//
//   pdfjs-dist   — eval() / new Function() in font-compiler code paths.
//                  Disabled at runtime via isEvalSupported:false; we also
//                  stub the tokens so nothing appears in the bundle.
//
//   Bluebird     — new Function() used for JIT-optimised promise helpers,
//                  always gated behind `canEvaluate`.
//                  FIX A: patch `var canEvaluate = false` in every Bluebird
//                  file that imports it so `if (canEvaluate)` blocks become
//                  `if (false)` blocks — eliminated by minifySyntax.
//                  FIX B: call_get.js defines makeMethodCaller / makeGetter
//                  inside an `if (!false)` (always-true) block; their bodies
//                  contain new Function() but are only ever invoked from the
//                  canEvaluate-guarded setter.  No-op those calls since they
//                  are dead code once canEvaluate is false.
//                  eval(obj) in toFastProperties is dead code after `return`.
//
//   underscore   — new Function() in _.template() compiler.
//                  mammoth uses underscore utilities but never calls _.template.
//                  Safe to stub.
//
//   setimmediate — new Function(""+callback) for string-typed callbacks.
//                  setImmediate is always invoked with real functions; the
//                  string path is unreachable in practice.
// ---------------------------------------------------------------------------

/** @type {import('esbuild').Plugin} */
const securityPlugin = {
  name: 'marketplace-security',
  setup(build) {

    // ── 1. pdfjs-dist ────────────────────────────────────────────────────────
    // Match all JS/MJS files from pdfjs-dist (pdf.mjs, pdf.worker.mjs, etc.)
    build.onLoad({ filter: /pdfjs-dist[\\/].*\.m?js$/ }, async (args) => {
      let contents = await fs.readFile(args.path, 'utf8')

      // Force isNodeJS=true so PDFWorker.#isWorkerDisabled=true and pdfjs
      // calls _setupFakeWorker() — in-process, no real Worker, no workerSrc.
      // In VS Code's Electron host the original expression evaluates to false
      // because process.versions.electron is set, which would cause pdfjs to
      // require a workerSrc URL we cannot provide.
      contents = contents.replace(
        /const isNodeJS\s*=\s*typeof process[\s\S]*?process\.type\s*!==\s*["']browser["']\)/,
        'const isNodeJS = true',
      )

      if (!contents.includes('eval(') && !contents.includes('new Function(')) {
        return { contents, loader: 'js' }
      }
      const stubs = [
        '/* pdfjs eval paths disabled — VS Code Marketplace compliance */',
        'function __pdf_noop_eval__() { return undefined; }',
        'function __pdf_noop_fn__() { return function() {}; }',
        '',
      ].join('\n')
      contents = stubs +
        contents
          .replace(/\beval\s*\(/g, '__pdf_noop_eval__(')
          .replace(/new\s+Function\s*\(/g, '__pdf_noop_fn__(')
      return { contents, loader: 'js' }
    })

    // ── 2. Bluebird (all release files) ─────────────────────────────────────
    // Strategy:
    //   a) Set canEvaluate = false everywhere (util.js defines it; consumer
    //      files import it as `canEvaluate = util.canEvaluate`).  With
    //      minifySyntax, `if(canEvaluate){…}` → `if(false){…}` → eliminated.
    //   b) Belt-and-suspenders: also stub every remaining new Function() call.
    //      All such calls are inside canEvaluate-gated functions that are never
    //      invoked once canEvaluate is false.  Bluebird's fallback closure paths
    //      (makeNodePromisifiedClosure, etc.) work correctly without new Function.
    build.onLoad({ filter: /bluebird/ }, async (args) => {
      if (!args.path.includes('bluebird')) { return undefined }
      let contents = await fs.readFile(args.path, 'utf8')
      let changed = false

      // util.js: zero out the source of truth
      if (contents.includes('typeof navigator')) {
        contents = contents.replace(
          /var canEvaluate\s*=\s*typeof navigator\s*==\s*["']undefined["']/,
          'var canEvaluate = false',
        )
        changed = true
      }

      // util.js: toFastProperties dead-code eval (after `return`, never runs)
      if (contents.includes('eval(')) {
        contents = contents.replace(/\beval\s*\(/g, '(void 0)(')
        changed = true
      }

      // consumer files: replace the import-time assignment
      if (contents.includes('util.canEvaluate')) {
        contents = contents.replace(
          /\bcanEvaluate\s*=\s*util\.canEvaluate\b/g,
          'canEvaluate = false',
        )
        changed = true
      }

      // belt-and-suspenders: stub every new Function() in Bluebird
      if (contents.includes('new Function(')) {
        contents =
          'function __bb_noop_fn__() { return function() {}; }\n' +
          contents.replace(/\bnew\s+Function\s*\(/g, '__bb_noop_fn__(')
        changed = true
      }

      return changed ? { contents, loader: 'js' } : undefined
    })

    // ── 3. underscore template.js ────────────────────────────────────────────
    // mammoth never calls _.template(); the compiler's new Function() is dead
    // code in this extension.
    build.onLoad({ filter: /underscore[\\/].*template\.js$/ }, async (args) => {
      let contents = await fs.readFile(args.path, 'utf8')
      if (!contents.includes('new Function(')) { return undefined }

      contents =
        'function __tmpl_noop__() { return function() { return ""; }; }\n' +
        contents.replace(/\bnew\s+Function\s*\(/g, '__tmpl_noop__(')
      return { contents, loader: 'js' }
    })

    // ── 4. setimmediate polyfill ─────────────────────────────────────────────
    // The polyfill coerces non-function callbacks via new Function(""+callback).
    // setImmediate is always called with real functions in our dependency graph.
    build.onLoad({ filter: /setimmediate[\\/]setImmediate\.js$/ }, async (args) => {
      let contents = await fs.readFile(args.path, 'utf8')
      if (!contents.includes('new Function(')) { return undefined }

      // Replace the string-coercion line with a no-op that keeps the API intact
      contents = contents.replace(
        /callback\s*=\s*new\s+Function\s*\(\s*""\s*\+\s*callback\s*\)/,
        'callback = function() {}',
      )
      return { contents, loader: 'js' }
    })
  },
}

/** @type {import('esbuild').BuildOptions} */
const buildOptions = {
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'dist/extension.js',
  external: ['vscode', 'canvas'],
  format: 'cjs',
  platform: 'node',
  target: 'node20',
  sourcemap: !production,
  // minifySyntax folds constant expressions and eliminates if(false){} blocks
  // without renaming identifiers or stripping whitespace — the bundle stays
  // readable for Marketplace reviewers and source-maps remain accurate.
  minifySyntax: true,
  minifyIdentifiers: false,
  minifyWhitespace: false,
  define: {
    'process.env.NODE_ENV': production ? '"production"' : '"development"',
  },
  plugins: [securityPlugin],
}

// pdfjs fake-worker mode (isNodeJS=true) calls:
//   await import("./pdf.worker.mjs")
// from inside extension.js.  We build the worker as a separate ESM file so
// that dynamic import resolves correctly at runtime in the extension host.
// The same security plugin strips eval/new Function from the worker bundle.
/** @type {import('esbuild').BuildOptions} */
const workerBuildOptions = {
  entryPoints: ['node_modules/pdfjs-dist/build/pdf.worker.mjs'],
  bundle: true,
  outfile: 'dist/pdf.worker.mjs',
  external: ['canvas'],
  format: 'esm',
  platform: 'node',
  target: 'node20',
  minifySyntax: true,
  minifyIdentifiers: false,
  minifyWhitespace: false,
  plugins: [securityPlugin],
}

async function main() {
  if (watch) {
    const watchLogger = {
      name: 'watch-logger',
      setup(b) {
        b.onEnd((r) => {
          console.log(r.errors.length ? 'Build failed.' : 'Build succeeded.')
        })
      },
    }
    const [ctx, workerCtx] = await Promise.all([
      esbuild.context({ ...buildOptions, plugins: [...buildOptions.plugins, watchLogger] }),
      esbuild.context({ ...workerBuildOptions, plugins: [...workerBuildOptions.plugins, watchLogger] }),
    ])
    await Promise.all([ctx.watch(), workerCtx.watch()])
    console.log('Watching for changes…')
    return
  }

  const [result, workerResult] = await Promise.all([
    esbuild.build(buildOptions),
    esbuild.build(workerBuildOptions),
  ])
  if (result.errors.length > 0 || workerResult.errors.length > 0) {
    console.error('Build failed.')
    process.exit(1)
  }
  console.log('Build complete → dist/extension.js + dist/pdf.worker.mjs')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
