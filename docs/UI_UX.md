# UI_UX.md — User Experience Guidelines

## Design Philosophy

- **Zero friction** — conversion should take 2 clicks maximum
- **Stay out of the way** — don't open panels or tabs the user didn't ask for
- **Speak plainly** — notifications use plain language, not technical jargon
- **Respect the workspace** — output files go where the user expects them

---

## User Flows

### Flow 1 — Single File Conversion (Happy Path)

```
1. User sees "report.pdf" in VS Code Explorer
2. User right-clicks → sees "Convert to Markdown"
3. User clicks it
4. [~1 second passes]
5. "report.md" appears in Explorer (same folder)
6. Notification: "✅ report.md created"  [Open File]
7. User clicks "Open File" → report.md opens in editor
```

### Flow 2 — File Already Exists

```
1. User converts "report.pdf" (report.md already exists)
2. Dialog appears:
   "report.md already exists. What would you like to do?"
   [Overwrite]  [Save as report_1.md]  [Cancel]
3. User picks an option → proceeds accordingly
```

### Flow 3 — Scanned PDF

```
1. User converts "scanned_invoice.pdf"
2. Extension detects no text content
3. Warning notification:
   "⚠️ This PDF appears to be scanned (image-only).
    Text extraction was limited. An empty or partial .md
    file has been created."
   [Open Anyway]  [Dismiss]
```

### Flow 4 — Batch Conversion

```
1. User selects 5 files (Ctrl+Click)
2. Right-click → "Convert to Markdown"
3. Progress bar in notification:
   "Converting files... (2/5)"
4. When done:
   "✅ 5 files converted successfully"  [Open Folder]
5. If some failed:
   "⚠️ 3 succeeded, 2 failed"  [Show Details]
```

### Flow 5 — Error

```
1. User converts a password-protected PDF
2. Error notification:
   "❌ Could not convert report.pdf
    This PDF is password protected."
   [Show Logs]
3. User clicks "Show Logs" → Output Channel opens with details
```

---

## Context Menu Design

```
Right-click menu on .pdf or .docx file:

┌─────────────────────────────┐
│  Open                       │
│  Open With...               │
│  ─────────────────────────  │
│  Convert to Markdown    →   │  ← Our menu item (clean, simple)
│  ─────────────────────────  │
│  Copy                       │
│  Cut                        │
│  ...                        │
└─────────────────────────────┘
```

The menu item should:

- Be labeled exactly: **"Convert to Markdown"**
- Appear only for `.pdf`, `.docx`, `.doc` files
- Not appear for any other file type
- Be in the navigation group (near top), not at the bottom

---

## Notification Design

### Success

```
✅ report.md created successfully
[Open File]
```

### Warning (Scanned PDF)

```
⚠️ Scanned PDF detected — conversion may be incomplete
[Open Anyway]  [Dismiss]
```

### Error

```
❌ Conversion failed: report.pdf is password protected
[Show Logs]
```

### Batch Progress

```
[=====>    ] Converting... (3/7)
```

### Batch Complete

```
✅ 7 files converted to Markdown
[Open Folder]
```

---

## Settings UI (VS Code Settings Panel)

Settings appear under: **Extensions → pdf docx to markdown**

```
pdf docx to markdown

  Auto Preview
  [✓] Automatically open Markdown preview after conversion

  Output Folder
  [ same ▾ ]   same / custom / workspace

  Conflict Behavior
  [ ask ▾ ]    ask / overwrite / rename

  Show Logs
  [ ] Automatically show Output panel during conversion
```

---

## Output File Naming

| Input              | Output (no conflict) | Output (conflict exists) |
| ------------------ | -------------------- | ------------------------ |
| `report.pdf`       | `report.md`          | `report_1.md`            |
| `My Document.docx` | `My Document.md`     | `My Document_1.md`       |
| `invoice-2024.pdf` | `invoice-2024.md`    | `invoice-2024_1.md`      |

---

## Accessibility

- All notifications are dismissible with keyboard (Escape)
- No color-only indicators — always use icons + text
- Progress notifications include text percentage for screen readers
- Context menu item has a clear, descriptive label (not abbreviations)
