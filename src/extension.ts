import * as vscode from 'vscode'
import { initLogger, disposeLogger } from './utils/logger'
import { convertFileCommand } from './commands/convertSingle'

export function activate(context: vscode.ExtensionContext): void {
  initLogger()

  context.subscriptions.push(
    vscode.commands.registerCommand('mdConverter.convertFile', convertFileCommand),
  )
}

export function deactivate(): void {
  disposeLogger()
}
