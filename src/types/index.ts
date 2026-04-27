export type FileType = 'pdf' | 'docx' | 'unknown'

export interface ConversionResult {
  success: boolean
  content?: string
  error?: string
  message?: string
  warnings?: string[]
}

export interface ConversionOptions {
  outputFolder: 'same' | 'custom' | 'workspace'
  customOutputPath: string
  conflictBehavior: 'ask' | 'overwrite' | 'rename'
  autoPreview: boolean
  showLogs: boolean
}
