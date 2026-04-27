import * as vscode from 'vscode'
import * as path from 'node:path'
import { log } from './logger'
import type { ConversionOptions } from '../types'

export async function resolveOutputUri(
  sourceUri: vscode.Uri,
  options: ConversionOptions,
): Promise<vscode.Uri> {
  // Always use path.basename/extname — never string-split on '.'
  const ext = path.extname(sourceUri.fsPath)
  const stem = path.basename(sourceUri.fsPath, ext)
  const sourceDir = path.dirname(sourceUri.fsPath)

  let outputDir: string
  switch (options.outputFolder) {
    case 'custom': {
      outputDir = options.customOutputPath.trim() || sourceDir
      break
    }
    case 'workspace': {
      const folders = vscode.workspace.workspaceFolders
      outputDir = folders?.[0]?.uri.fsPath ?? sourceDir
      break
    }
    default:
      outputDir = sourceDir
  }

  return vscode.Uri.file(path.join(outputDir, `${stem}.md`))
}

/**
 * Returns the URI to write to, or null when the user cancels.
 */
export async function resolveConflict(
  outputUri: vscode.Uri,
  behavior: ConversionOptions['conflictBehavior'],
): Promise<vscode.Uri | null> {
  const exists = await fileExists(outputUri)
  if (!exists) {
    return outputUri
  }

  if (behavior === 'overwrite') {
    return outputUri
  }

  const renamedUri = await nextAvailableUri(outputUri)

  if (behavior === 'rename') {
    return renamedUri
  }

  // 'ask'
  const baseName = path.basename(outputUri.fsPath)
  const renamedName = path.basename(renamedUri.fsPath)
  const choice = await vscode.window.showWarningMessage(
    `${baseName} already exists. What would you like to do?`,
    { modal: true },
    'Overwrite',
    `Save as ${renamedName}`,
    'Cancel',
  )

  if (choice === 'Overwrite') {
    return outputUri
  }
  if (choice === `Save as ${renamedName}`) {
    return renamedUri
  }
  return null
}

export async function writeMarkdown(uri: vscode.Uri, content: string): Promise<void> {
  const bytes = Buffer.from(content, 'utf-8')
  await vscode.workspace.fs.writeFile(uri, bytes)
  log(`Written: ${uri.fsPath}`)
}

async function fileExists(uri: vscode.Uri): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(uri)
    return true
  } catch {
    return false
  }
}

async function nextAvailableUri(uri: vscode.Uri): Promise<vscode.Uri> {
  const ext = path.extname(uri.fsPath)
  const stem = path.basename(uri.fsPath, ext)
  const dir = path.dirname(uri.fsPath)

  let counter = 1
  while (true) {
    const candidate = vscode.Uri.file(path.join(dir, `${stem}_${counter}${ext}`))
    if (!(await fileExists(candidate))) {
      return candidate
    }
    counter++
  }
}
