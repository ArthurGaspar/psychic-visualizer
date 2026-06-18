// Local preset registry — populated by running: node scripts/extract-presets.cjs
// Each file under ./presets/ has shape { name: string; preset: unknown; config?: PresetConfig }

import type { PresetConfig } from './presetConfig'

type PresetFile = { name: string; preset: unknown; config?: PresetConfig }

const rawModules = import.meta.glob<{ default: PresetFile }>(
  './presets/*.json',
  { eager: true },
)

const _presetsObj: Record<string, unknown> = {}
const _configObj:  Record<string, PresetConfig> = {}
const _names: string[] = []

for (const mod of Object.values(rawModules)) {
  const entry = (mod.default ?? mod) as PresetFile
  if (entry?.name != null && entry?.preset != null) {
    _presetsObj[entry.name] = entry.preset
    if (entry.config) _configObj[entry.name] = entry.config
    _names.push(entry.name)
  }
}

_names.sort()

export function getMilkdropPresetNames(): string[] {
  return _names
}

export function getMilkdropPresetsObj(): Record<string, unknown> {
  return _presetsObj
}

/** Returns the config schema for a preset by index, or null if none defined. */
export function getPresetConfigSchema(index: number): PresetConfig | null {
  const name = _names[index]
  return name != null ? (_configObj[name] ?? null) : null
}
