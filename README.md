# PDF & Word to Markdown

Convert PDF and Word documents (.docx, .doc) to clean Markdown directly in VS Code.

## Features

- **Local Conversion**: No files are uploaded to any server. Everything happens on your machine.
- **Batch Processing**: Select multiple files and convert them all at once.
- **Smart Formatting**: Preserves headings, lists, tables, and basic styling.
- **Auto-Preview**: Optionally open the Markdown preview as soon as conversion finishes.

## Usage

1. Right-click any `.pdf`, `.docx`, or `.doc` file in the VS Code Explorer.
2. Select **Convert to Markdown**.
3. The `.md` file will be created in the same folder.

For multiple files, use `Ctrl` (or `Cmd`) + click to select them, then right-click → **Convert to Markdown**.

## Settings

| Setting | Default | Description |
|---|---|---|
| `mdConverter.autoPreview` | `true` | Open Markdown preview after conversion |
| `mdConverter.outputFolder` | `same` | Where to save output (`same` / `custom` / `workspace`) |
| `mdConverter.customOutputPath` | `""` | Absolute path when `outputFolder` is `custom` |
| `mdConverter.conflictBehavior` | `ask` | What to do if output file exists (`ask` / `overwrite` / `rename`) |
| `mdConverter.showLogs` | `false` | Auto-show Output panel during conversion |

## Privacy

Privacy is a priority. All document processing is performed locally. No data is collected or transmitted to external services.

## License

MIT
