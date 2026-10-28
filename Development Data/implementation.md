# MTO Wizard — End-to-End Implementation Blueprint (`implementation.md`)

> **Instructions for AI Agent (Antigravity):** Follow this specification step-by-step from initialization to final build verification. Do not skip steps, stub out core functions, or leave placeholder UI where working logic is specified. Build the complete, production-ready Version 1 application.

---

## 1. Executive Summary & Architectural Decisions

### 1.1 Purpose
**MTO Wizard** is a specialized Material Take-Off (MTO) calculator and document generator built for a commercial millwork/cabinetry engineering workflow. It bridges the gap between manual material estimation (using a conditional progressive-disclosure wizard)[cite: 1] and automated cutlist nesting (via Cabinet Vision CSV/XML exports, an internal 2D rectangular nesting engine, and an optional Smartcut.dev API integration), culminating in a standardized shop MTO sheet that can be printed/saved as a PDF or emailed[cite: 2].

### 1.2 Core Technical Stack & Packaging Strategy
- **Framework:** React 18+ (Functional Components, Hooks) + Vite.
- **Styling:** Tailwind CSS + Custom Neumorphic CSS Variables & Utility Classes (`https://neumorphism.io` aesthetic).
- **Icons:** `lucide-react`.
- **Distribution Format (Phase 1 — Single-File Web App):** Configured via `vite-plugin-singlefile` (`base: './'`). Running `npm run build` must bundle all JS, CSS, SVG icons, and logic into a single standalone `dist/index.html` file that runs natively when double-clicked from a local or shared network folder (`file://`) with zero local server required.
- **Electron Upgrade Path (Adapter Pattern):** All file system operations (saving/loading `.mto.json` files, linking job folders, scanning directories for Cabinet Vision exports) are isolated inside `src/utils/fileSystem.js`. The app supports the browser's native `window.showDirectoryPicker()` API today and automatically switches to Node.js `window.electronAPI` calls when wrapped in a portable Electron `.exe` in the future.
- **Routing Rule:** Do **not** use `BrowserRouter` (which breaks on `file://` origins). Manage all view/tab switching strictly via React state (`useState`).

---

## 2. Step-by-Step Project Initialization

### Step 2.1: Scaffold Project & Install Dependencies
Run the following commands to initialize the project and install required packages:

```bash
npm create vite@latest mto-wizard -- --template react
cd mto-wizard
npm install lucide-react
npm install -D tailwindcss postcss autoprefixer vite-plugin-singlefile
npx tailwindcss init -p
```

### Step 2.2: Configure `vite.config.js` for Single-File Output
Overwrite `vite.config.js` with the following configuration so `npm run build` outputs a single self-contained HTML file:

```javascript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  base: './',
  plugins: [
    react(),
    viteSingleFile(),
  ],
  build: {
    target: 'esnext',
    assetsInlineLimit: 100000000,
    chunkSizeWarningLimit: 100000000,
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});
```

### Step 2.3: Configure `index.html` with Flagship Google Fonts & Century Gothic Stack
Update `index.html` to load **Questrial** (geometric Century Gothic equivalent), **Plus Jakarta Sans** (flagship Google modern UI font), and **JetBrains Mono** (technical tabular numbers/dimensions):

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>MTO Wizard — Material Takeoff</title>
    <link rel="preconnect" href="[https://fonts.googleapis.com](https://fonts.googleapis.com)">
    <link rel="preconnect" href="[https://fonts.gstatic.com](https://fonts.gstatic.com)" crossorigin>
    <link href="[https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Questrial&display=swap](https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Questrial&display=swap)" rel="stylesheet">
  </head>
  <body class="bg-[#e0e5ec] text-[#2d3748] antialiased selection:bg-blue-600 selection:text-white">
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

---

## 3. Design System: Tactile Neumorphism & Print Reset (`src/index.css`)

Configure `tailwind.config.js` and `src/index.css` to implement a tactile, fast, soft-extruded light mode (`#e0e5ec`) inspired by `neumorphism.io`, while guaranteeing a 100% crisp black-and-white technical document when printing (`@media print`).

### Step 3.1: `tailwind.config.js`
```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        geometric: ['"Century Gothic"', 'Questrial', '"Plus Jakarta Sans"', 'sans-serif'],
        sans: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        neu: {
          base: '#e0e5ec',
          dark: '#a3b1c6',
          light: '#ffffff',
          text: '#2d3748',
          muted: '#64748b',
          accent: '#1a73e8',
        },
      },
    },
  },
  plugins: [],
};
```

### Step 3.2: `src/index.css` (Neumorphic Classes + `@media print` Overrides)
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --bg-neu: #e0e5ec;
  --shadow-dark: #bec3c9;
  --shadow-light: #ffffff;
}

body {
  font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
  background-color: var(--bg-neu);
  color: #2d3748;
}

/* Extruded Card Surface */
.neu-flat {
  background: #e0e5ec;
  border-radius: 18px;
  box-shadow: 8px 8px 16px #bec3c9, -8px -8px 16px #ffffff;
}

/* Small Extruded Card */
.neu-card-sm {
  background: #e0e5ec;
  border-radius: 12px;
  box-shadow: 5px 5px 10px #bec3c9, -5px -5px 10px #ffffff;
}

/* Interactive Tactile Button */
.neu-btn {
  background: #e0e5ec;
  border-radius: 12px;
  box-shadow: 5px 5px 10px #bec3c9, -5px -5px 10px #ffffff;
  transition: all 0.14s cubic-bezier(0.4, 0, 0.2, 1);
  user-select: none;
}
.neu-btn:hover:not(:disabled) {
  box-shadow: 3px 3px 6px #bec3c9, -3px -3px 6px #ffffff;
  transform: translateY(-1px);
}
.neu-btn:active:not(:disabled),
.neu-btn-active {
  background: #e0e5ec;
  box-shadow: inset 4px 4px 8px #bec3c9, inset -4px -4px 8px #ffffff;
  transform: translateY(0);
  color: #1a73e8;
  font-weight: 600;
}

/* Primary Action Button (Google Flagship Blue with Neumorphic Lift) */
.neu-btn-primary {
  background: linear-gradient(145deg, #1d7cf2, #1868d1);
  color: #ffffff;
  border-radius: 12px;
  box-shadow: 5px 5px 12px #b0b8c5, -5px -5px 12px #ffffff;
  transition: all 0.14s ease;
}
.neu-btn-primary:hover:not(:disabled) {
  filter: brightness(1.06);
  transform: translateY(-1px);
}
.neu-btn-primary:active:not(:disabled) {
  box-shadow: inset 3px 3px 6px #0f458c, inset -3px -3px 6px #2790ff;
  transform: translateY(0);
}

/* Pressed / Carved Input Well */
.neu-pressed {
  background: #e0e5ec;
  border-radius: 12px;
  box-shadow: inset 5px 5px 10px #bec3c9, inset -5px -5px 10px #ffffff;
}
.neu-pressed:focus-within {
  outline: 2px solid rgba(26, 115, 232, 0.35);
}

/* Segmented Pill Track */
.neu-well {
  background: #e0e5ec;
  border-radius: 9999px;
  box-shadow: inset 4px 4px 8px #bec3c9, inset -4px -4px 8px #ffffff;
  padding: 6px;
}

/* Print Stylesheet: Hides Builder UI, Formats Right Panel as Exact Shop MTO Document */
@media print {
  @page {
    size: letter portrait;
    margin: 0.5in;
  }
  body {
    background: #ffffff !important;
    color: #000000 !important;
  }
  .no-print {
    display: none !important;
  }
  .print-only {
    display: block !important;
  }
  .print-container {
    width: 100% !important;
    max-width: 100% !important;
    margin: 0 !important;
    padding: 0 !important;
    box-shadow: none !important;
    background: #ffffff !important;
    border: none !important;
  }
}
```

---

## 4. Unified Data Model & Nomenclature Engine (`src/utils/mtoFormatter.js`)

Both the **Manual Wizard** and the **Cabinet Vision / Nesting Importer** push items into a single unified `mtoItems` state array.

### Step 4.1: Line Item Schema
```javascript
{
  id: "crypto.randomUUID()",
  source: "manual" | "cv-import",
  category: "laid_up" | "loose" | "solid_surface",
  qty: 1,
  thickness: '3/4"',          // e.g. '3/4"', '1/2"', '1/4"', '1"', or ''
  materialName: "Wilsonart Sap Walnut 8221-38",
  substrate: "PB",            // "PB" | "MDF" | "PLY" | "HPL" | ""
  sheetSize: "4x8",           // "4x8" | "5x10" | "5x12" | "30x144" | custom
  sides: "2S",                // "2S" | "1S" | "LOOSE SHEET" | ""
  customOverrideText: null    // If user manually edits the generated description inline
}
```

### Step 4.2: Standardized Shop Description Generator
Create `src/utils/mtoFormatter.js` to format items to match the exact historical shop MTO sheet (`MTO-KOP RD BLD 12.pdf`)[cite: 2]:
- **If `category === 'laid_up'`[cite: 1]:**
  - When `showSubstrateTag` is `false` (default, matching `KOP RD BLD 12` PDF)[cite: 2]:
    `${thickness} ${materialName} (${sheetSize}) ${sides}`
    -> Example: `3/4" Wilsonart Sap Walnut 8221-38 (4x8) 2S`[cite: 2]
  - When `showSubstrateTag` is `true`:
    `${thickness} ${substrate} ${materialName} (${sheetSize}) ${sides}`[cite: 1, 2]
    -> Example: `3/4" PB Wilsonart Sap Walnut 8221-38 (4x8) 2S`[cite: 1, 2]
- **If `category === 'loose'`[cite: 1]:**
  - `${thickness ? thickness + ' ' : ''}${materialName} (${sheetSize}) LOOSE SHEET`[cite: 2]
  - -> Example: `3/4" Wilsonart Sap Walnut 8221-38 (4x8) LOOSE SHEET`[cite: 2]
- **If `category === 'solid_surface'`:**
  - `${thickness ? thickness + ' ' : ''}${materialName} (${sheetSize})`[cite: 2]
  - -> Example: `1/2" Corian Glacier Ice (30x144)`[cite: 2]

### Step 4.3: Raw Component Breakdown Calculator
Also in `src/utils/mtoFormatter.js`, export `calculateComponentBreakdown(mtoItems)`:
- Loops through all `laid_up` items[cite: 1] and explodes them into purchasing components:
  1. **Raw Substrate Sheets Needed:** Sums quantities grouped by `${thickness} ${substrate} (${sheetSize})` (e.g., `4x8 3/4" PB`, `5x12 3/4" MDF`)[cite: 1, 2].
  2. **Loose HPL Face/Backer Sheets Needed:**
     - If `sides === '2S'`, adds `qty * 2` sheets of `${materialName} (${sheetSize})`[cite: 2].
     - If `sides === '1S'`, adds `qty * 1` sheet of `${materialName} (${sheetSize})` + `qty * 1` sheet of `Standard Backer (${sheetSize})`.
  3. Adds any direct `loose` items[cite: 1] to the Loose HPL totals so purchasing can toggle between **As-Built Line Items** and **Raw Purchasing Totals**.

### Step 4.4: Pre-loaded Demo Preset (`KOP RD BLD 12`)
Export `SAMPLE_MTO_STATE` in `src/utils/mtoFormatter.js` containing the exact sample job from `MTO-KOP RD BLD 12.pdf` so the user can test one-click loading[cite: 2]:
- **Job Name:** `KOP RD BLD 12`[cite: 2]
- **Engineer:** `Sam H`[cite: 2]
- **Job Number:** `180180-7`[cite: 2]
- **Date:** `06/04/26`[cite: 2]
- **Items:**
  1. Qty `1` | `3/4" Wilsonart Sap Walnut 8221-38 (4x8) 2S` (Laid Up, PB)[cite: 1, 2]
  2. Qty `1` | `3/4" Wilsonart Sap Walnut 8221-38 (5x10) 2S` (Laid Up, PB)[cite: 1, 2]
  3. Qty `1` | `3/4" Wilsonart Sap Walnut 8221-38 (4x8) LOOSE SHEET` (Loose)[cite: 1, 2]
  4. Qty `1` | `3/4" Wilsonart Sap Walnut 8221-38 (5x10) LOOSE SHEET` (Loose)[cite: 1, 2]
  5. Qty `1` | `1/2" Corian Glacier Ice (30x144)` (Solid Surface)[cite: 2]

---

## 5. File System & Future Electron Adapter (`src/utils/fileSystem.js`)

Build `src/utils/fileSystem.js` so all local/network file operations pass through a clean abstraction layer:

1. **Environment Detection:**
   ```javascript
   export const isElectron = typeof window !== 'undefined' && Boolean(window.electronAPI);
   export const supportsDirectoryPicker = typeof window !== 'undefined' && 'showDirectoryPicker' in window;
   ```
2. **Job Folder Linking (`linkJobDirectory()`):**
   - If `isElectron`: Calls `window.electronAPI.selectOrScanFolder(pastedPath)`.
   - If `supportsDirectoryPicker`: Calls `const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' })`. Scans the selected folder for:
     - Existing `*.mto.json` files (offers to load them).
     - Cabinet Vision exports (`*.csv`, `*.txt`, `*.xml`) and surfaces them in a quick-load list inside the CV Import tab.
   - Stores `dirHandle` in state for the active session so clicking **Save MTO** writes `${jobNumber}_MTO.json` directly into that linked job folder without a browser download prompt.
3. **Save / Load MTO Project State (`saveMtoJson()`, `loadMtoJson()`):**
   - If `dirHandle` is linked (or running in Electron with a path), writes `${jobNumber || 'Project'}_MTO.json` directly into the job directory.
   - Otherwise, triggers a clean browser file download / file input dialog.

---

## 6. Built-In 2D Nesting Engine & Smartcut.dev Integration (`src/utils/nestingEngine.js`)

Build a two-tier nesting engine in `src/utils/nestingEngine.js` so Cabinet Vision part exports can be nested immediately offline or via Smartcut.dev.

### Step 6.1: CSV / Cutlist Parser (`parseCabinetVisionExport(rawText)`)
- Automatically handles comma-separated (`.csv`), tab-separated (`.txt`), or semicolon-separated exports from Cabinet Vision.
- Auto-detects headers matching variations of:
  - `Part Name` / `Description` / `Label`
  - `Material` / `Mat` / `Code`
  - `Length` / `L` / `Height` (supports decimal inches `30.5`, fractional inches `30 1/2`, or millimeters with an `[ IN / MM ]` unit toggle)
  - `Width` / `W`
  - `Qty` / `Quantity` / `Count`
  - `Grain` / `Rotation` (`0/1`, `Y/N`, `true/false`)

### Step 6.2: Local 2D Guillotine / Shelf Bin-Packer (`nestPartsLocal(parts, stockSheet, options)`)
- **Inputs:**
  - `parts`: Array of `{ id, name, length, width, qty, grainLocked }`
  - `stockSheet`: `{ width: 48, length: 96 }` (for `4x8`), `{ width: 60, length: 120 }` (`5x10`), `{ width: 60, length: 144 }` (`5x12`)
  - `options`: `{ kerf: 0.25, edgeTrim: 0.5, wastePercent: 10 }`
- **Algorithm:**
  1. Expand part quantities into individual part instances.
  2. Deduct `edgeTrim * 2` from usable stock sheet dimensions.
  3. Sort parts by longest dimension / area descending (Best-Fit Decreasing).
  4. Place parts onto sheets using a Guillotine free-rectangle splitting algorithm (accounting for `kerf` between cuts and allowing 90° rotation only if `grainLocked === false`).
  5. Return `{ totalSheets, utilizationPercent, sheets: [{ sheetIndex, placedParts: [{ x, y, w, h, name }] }], unplacedParts }`.
  6. Render a clean, interactive mini **SVG Nest Preview** modal or drawer so the engineer can visually inspect how the parts fit on the sheets.

### Step 6.3: Smartcut.dev Cloud API Client (`nestPartsSmartcut(parts, stockSheet, options, apiKey)`)
- Sends a `POST` request to Smartcut's calculation endpoint when the user enables the **Use Smartcut.dev API** toggle and provides an API key (persisted in `localStorage`).
- Automatically falls back to `nestPartsLocal` if offline or if no API key is configured.

---

## 7. User Interface Layout & Component Architecture

Build a responsive **Split-Workspace Layout** inside `src/App.jsx` with the following components:

### 7.1 Top Job Metadata Bar (`src/components/TopJobBar.jsx`)
A full-width `neu-flat` bar (`no-print`) containing:
- **App Brand Badge:** Geometric title `MTO WIZARD` with a tactile icon badge.
- **Job Inputs (`neu-pressed` compact inputs):**
  - `Job Name` (placeholder: `KOP RD BLD 12`)[cite: 2]
  - `Job #` (placeholder: `180180-7`)[cite: 2]
  - `Engineer` (defaults to `Sam H`, saved to `localStorage`)[cite: 2]
  - `Date` (defaults to current `MM/DD/YY`, e.g., `10/14/26`)[cite: 2]
- **Folder & Project Actions (`neu-btn` icon+label buttons):**
  - `[ 📂 Link Folder ]`: Opens directory picker (or path modal) and displays active folder badge when linked.
  - `[ 🧪 Demo (KOP RD) ]`: Loads `SAMPLE_MTO_STATE` (`MTO-KOP RD BLD 12.pdf` data) in one click[cite: 2].
  - `[ 📂 Load JSON ]` & `[ 💾 Save JSON ]`.
  - `[ 🗑️ Reset ]`.

### 7.2 Left Panel (58% Width on Desktop) — The Inflow Builder (`no-print`)
Contains a top `neu-well` segmented pill switcher:
- **`[ ⚡ Material Wizard ]`** (`src/components/MaterialWizard.jsx`)
- **`[ 📐 CV Cutlist + Nesting ]`** (`src/components/CutlistImporter.jsx`)

#### Component A: `MaterialWizard.jsx` (Flowchart Implementation)
Implements the user's flowchart (`LOOSE` vs. `LAID UP` -> `SUBSTRATE` -> `MATL. TABLE`)[cite: 1] plus `SOLID SURFACE` on a single zero-latency progressive card:
1. **Step 1 — Category Toggle (`neu-well` with 3 big tactile buttons):**
   - `LOOSE LAMINATE`[cite: 1]
   - `LAID UP PANELS`[cite: 1]
   - `SOLID SURFACE / OTHER`
2. **Step 2 — Laminate / Material Name Bar:**
   - Large `neu-pressed` text input (`e.g., PL-1 or Wilsonart Sap Walnut 8221-38`)[cite: 1, 2].
   - **Recent Materials Bar:** Displays clickable `neu-btn` chips below the input for the last 6 materials used (plus a preset chip for `Wilsonart Sap Walnut 8221-38`, `PL-1`, and `Corian Glacier Ice`) so the engineer doesn't have to re-type laminate names when switching from `LAID UP` to `LOOSE`[cite: 1, 2].
3. **Step 3 — Conditional Spec & Quantity Builder:**
   - **When `LAID UP PANELS` is active[cite: 1]:**
     - **Thickness Pills:** `[ 1/4" ]`, `[ 1/2" ]`, `[ 3/4" ]` (default), `[ 1" ]`, `[ Custom ]`.
     - **Layup Faces Pills:** `[ 2S (Good 2 Sides) ]` (default)[cite: 2], `[ 1S (Face + Backer) ]`, `[ Raw Core Only ]`.
     - **The Flowchart Material Matrix Table (`MATL. TABLE`)[cite: 1]:**
       - Columns: `SIZE` | `PB` | `MDF` | `PLY` | `HPL`[cite: 1].
       - Rows: `4x8`, `5x10`, `5x12`[cite: 1] (plus a 4th row with an editable custom size like `4x10`).
       - Each cell is a `neu-pressed` numeric input with subtle hover `[-]`/`[+]` controls.
       - Pressing `Enter` or clicking **`[ + Add Matrix to MTO ]`** (`neu-btn-primary`) scans all non-zero cells, creates the corresponding MTO line items, appends them to the Right Panel, and clears the matrix quantities while keeping the Material Name loaded so the user can immediately click `LOOSE LAMINATE` if they also need loose sheets of that same laminate[cite: 1].
   - **When `LOOSE LAMINATE` is active[cite: 1]:**
     - **Sheet Size Pills:** `[ 4x8 ]`, `[ 5x10 ]`, `[ 5x12 ]`[cite: 1], `[ Custom ]`.
     - **Optional Thickness Prefix Pill:** `[ None ]`, `[ 3/4" ]` (included because `MTO-KOP RD BLD 12.pdf` includes `3/4"` on loose sheet lines[cite: 2]), `[ Standard HPL ]`.
     - **Quantity Stepper:** Tactile `[-]` `[ Qty ]` `[+]` control.
     - **`[ + Add Loose Sheet to MTO ]`** button[cite: 1, 2].
   - **When `SOLID SURFACE / OTHER` is active:**
     - **Thickness Pills:** `[ 1/4" ]`, `[ 1/2" ]` (default)[cite: 2], `[ 3/4" ]`.
     - **Sheet Size Pills:** `[ 30x144 ]` (default)[cite: 2], `[ 36x144 ]`, `[ 4x8 ]`, `[ Custom ]`.
     - **Quantity Stepper** + **`[ + Add Item to MTO ]`** button.

#### Component B: `CutlistImporter.jsx` (Cabinet Vision + Nesting)
1. **Import Bar:** Drag-and-drop zone for `.csv`/`.txt` Cabinet Vision part lists, a `[ Paste Clipboard Data ]` button, and a `[ Load Sample CV Cutlist ]` button for instant testing.
2. **Global Nesting Parameters (`neu-card-sm`):**
   - Stock Sheet Default (`4x8`, `5x10`, `5x12`)[cite: 1], Kerf (`0.25"`), Trim (`0.5"`), Waste Buffer (`0%`, `+10%`, `+15%`).
   - Collapsible `Smartcut.dev API Configuration` drawer.
3. **Grouped Materials Review Table:**
   - Lists each unique Material Tag found in the CV file, total part count, total net sq.ft., target sheet size selector, category selector (`Laid Up 2S`, `Laid Up 1S`, `Loose`)[cite: 1, 2], and calculated **Nested Sheet Count**.
   - Includes a `[ 🔍 View SVG Nest ]` button per material group to inspect the sheet layout visually.
   - **`[ + Push Selected Materials to MTO ]`** button pushes the nested sheet quantities directly into the Right Panel MTO list.

### 7.3 Right Panel (42% Width on Desktop) — Live MTO Document & Export Dock (`src/components/MtoDocumentPanel.jsx`)
1. **Top Control Strip (`no-print`):**
   - Segmented View Switcher: **`[ 📄 Standard MTO Sheet ]`** vs. **`[ 🧮 Raw Purchasing Totals ]`**.
   - Checkbox Toggle: **`[ ] Include Substrate (PB/MDF/PLY) in Line Text`**[cite: 1].
2. **The Live Paper Document (`print-container`):**
   - Styled on screen as a crisp white/off-white document sheet inset inside the Neumorphic frame, and styled in `@media print` to fill the printed page identically to `MTO-KOP RD BLD 12.pdf`[cite: 2]:
   - **Header Section (Font: `font-geometric` / Century Gothic / Questrial):**
     - Centered Title: `Material Takeoff` (`text-4xl font-normal tracking-wide text-slate-800`)[cite: 2]
     - Centered Project Subtitle: `{jobName || 'UNTITLED PROJECT'}` (`text-2xl mt-2 text-slate-700`)[cite: 2]
     - Metadata Row (`flex justify-between items-baseline border-b-2 border-slate-400 pb-1 mt-6 text-lg`):
       - Left: `{engineer || 'Sam H'}`[cite: 2]
       - Right: `{jobNumber || '—'}`[cite: 2]
   - **Table Body:**
     - Header Row: `Qty` (left/center column, width `80px`, underlined)[cite: 2] and `Description`.
     - Item Rows (`border-b border-slate-300 py-3.5 text-lg font-geometric`):
       - **Qty Cell:** Displays quantity in parentheses: `(${item.qty})`[cite: 2]. On screen hover (`no-print`), clicking or hovering allows instant `[-]`/`[+]` adjustment.
       - **Description Cell:** Displays the formatted string (e.g., `3/4" Wilsonart Sap Walnut 8221-38 (4x8) 2S`)[cite: 2]. Clicking the text on screen allows inline text override; hovering shows a delete (`Trash2`) button on the right (`no-print`).
   - **Document Footer:**
     - Horizontal rule (`border-t-2 border-slate-400 mt-12 pt-2 flex justify-end`).
     - Bottom-Right Date: `{date}` (e.g., `06/04/26`) in `font-geometric text-lg`[cite: 2].
3. **Bottom Export Action Bar (`no-print`):**
   - **`[ 🖨️ Print / Save PDF ]` (`neu-btn-primary`):** Calls `window.print()`.
   - **`[ 📋 Copy Table for Email ]` (`neu-btn`):** Uses `navigator.clipboard.write` to write both a styled HTML table (`text/html`) and an aligned ASCII plain-text table (`text/plain`) to the clipboard, with a visual `"Copied!"` state.
   - **`[ ✉️ Open in Email ]` (`neu-btn`):** Triggers `mailto:?subject=...&body=...` with the pre-formatted plain-text MTO table.

---

## 8. Verification & Acceptance Criteria

Before completing the task, verify the following steps:
1. **Demo Verification:** Click `[ 🧪 Demo (KOP RD) ]` in the top bar and confirm that the Right Panel renders the exact 5 rows, header (`KOP RD BLD 12`, `Sam H`, `180180-7`), parenthesized quantities `(1)`, and footer date (`06/04/26`) matching `MTO-KOP RD BLD 12.pdf`[cite: 2].
2. **Matrix Flow Verification:** In the Left Panel under `LAID UP PANELS`, enter `PL-1`, type `1` in `4x8 PB` and `2` in `5x12 MDF`, and click `[ + Add Matrix to MTO ]`[cite: 1]. Confirm both rows appear immediately in the MTO sheet and that switching to `Raw Purchasing Totals` accurately totals the substrates and laminates.
3. **Nesting Verification:** Switch to the `CV Cutlist + Nesting` tab, click `[ Load Sample CV Cutlist ]`, verify that the 2D bin-packer calculates sheet counts and renders the SVG nest preview, and push the results to the MTO sheet.
4. **Single-File Build Verification:** Run `npm run build` and verify that `dist/index.html` is generated as a single self-contained file with zero external JS or CSS chunks.