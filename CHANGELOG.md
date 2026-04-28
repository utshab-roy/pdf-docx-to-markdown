# Changelog

## [0.1.3] — 2026-04-27

### Fixed
- Table multi-line cell detection now handles the case where the first column itself wraps across multiple visual lines (Y-gap calibration from confirmed continuation rows)

## [0.1.2] — 2026-04-27

### Fixed
- DOCX conversion no longer shows a warning popup for unsupported styles or embedded objects — mammoth messages are still logged to the Output channel but do not interrupt the user

## [0.1.1] — 2026-04-27

### Fixed
- PDF output now preserves line breaks in Markdown preview (hard line breaks via trailing spaces)
- PDF bullet symbols (●, •, ◦, ▪, etc.) are converted to Markdown `- ` list items
- Numbered lists using `1)` format normalised to standard `1.` Markdown syntax
- Improved table detection — requires consistent column counts across all rows to avoid false positives
- Tab-separated columns in PDFs now detected as tables

## [0.1.0] — 2026-04-27

### Added
- Right-click context menu on `.pdf`, `.docx`, and `.doc` files → **Convert to Markdown**
- Single-file conversion with success / warning / error notifications
- Multi-file batch conversion with progress bar
- File conflict handling (ask / overwrite / rename)
- Markdown preview auto-open after conversion (`mdConverter.autoPreview`)
- Output folder settings: same, custom, workspace root
- Full Output Channel logging (`pdf docx to markdown`)
- Unicode filename support (Japanese, Chinese, Arabic, emoji, etc.)
