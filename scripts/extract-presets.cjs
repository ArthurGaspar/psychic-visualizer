'use strict'
const fs   = require('fs')
const path = require('path')

// ── Load butterchurn-presets (handles both CJS and CJS-wrapped-ESM) ──────────
let bcp
try {
  bcp = require('butterchurn-presets')
} catch (e) {
  console.error('Could not require butterchurn-presets:', e.message)
  process.exit(1)
}
const getPresets = typeof bcp.getPresets === 'function'         ? bcp.getPresets
                 : typeof bcp.default?.getPresets === 'function' ? bcp.default.getPresets
                 : null
if (!getPresets) {
  console.error('getPresets() not found on butterchurn-presets module')
  process.exit(1)
}

const presetsObj = getPresets()
const names      = Object.keys(presetsObj)

// ── Output directory ──────────────────────────────────────────────────────────
const outDir = path.resolve(__dirname, '../src/visualizers/milkdrop/presets')
fs.mkdirSync(outDir, { recursive: true })

// ── Sanitize name → filename (unique) ─────────────────────────────────────────
const usedFilenames = new Set()
function toFilename(name) {
  let base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
  let filename = base + '.json'
  let n = 1
  while (usedFilenames.has(filename)) filename = `${base}-${n++}.json`
  usedFilenames.add(filename)
  return filename
}

// ── Write one file per preset ─────────────────────────────────────────────────
let written = 0
for (const name of names) {
  const filename = toFilename(name)
  const entry    = { name, preset: presetsObj[name] }
  fs.writeFileSync(path.join(outDir, filename), JSON.stringify(entry, null, 2))
  written++
}

console.log(`✓  Extracted ${written} presets → src/visualizers/milkdrop/presets/`)
console.log('   Restart the dev server (or rebuild) to pick up the new files.')
