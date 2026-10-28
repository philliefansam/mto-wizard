# MTO Wizard

A high-performance Material Take-Off (MTO) and cutlist nesting application designed for commercial casework, millwork, and architectural woodwork engineering.

Built with React 19, Vite, and Tailwind CSS.

---

## ✨ Features

- **Cutlist Importer**: Parse and import Cabinet Vision cutlist exports and `.pnc` / Access job files.
- **2D Rectangular Nesting Engine**: Automatic panel optimization with configurable sheet dimensions (e.g. 4x8, 5x10, 5x12), kerf clearance, edge trimming, and waste factor calculations.
- **Catalog Integration**: Built-in laminate catalogs for Formica and Wilsonart with search and finish selection.
- **Component Breakdown**: Auto-segregate substrates (particleboard, MDF, plywood), high-pressure laminates (HPL), backer sheets, and solid surfaces.
- **MTO Document Generator**: Standardized tabular material take-off schedule ready for purchasing, inventory requisition, and shop floor staging.
- **Single-File Distribution**: Bundled into a standalone, portable HTML file with `vite-plugin-singlefile` for offline desktop and intranet access.

---

## 🚀 Getting Started

### Prerequisites

- Node.js (v18 or higher recommended)
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/philliefansam/mto-wizard.git
cd mto-wizard

# Install dependencies
npm install
```

### Development

Run the local Vite development server with hot module replacement:

```bash
npm run dev
```

### Production Build

Compile the production bundle (creates a single self-contained `dist/index.html` file):

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

---

## 🛠️ Tech Stack

- **Frontend**: [React 19](https://react.dev/), [Vite](https://vitejs.dev/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/), [Lucide React](https://lucide.dev/)
- **File Parsing & Utilities**: `mdb-reader`, `stream-browserify`, `buffer`
- **Bundler**: `vite-plugin-singlefile`
- **Testing**: Puppeteer automated browser testing

---

## 📄 License

ISC / Proprietary - All rights reserved.
