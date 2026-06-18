import type { BaseVisualizer } from './BaseVisualizer'
import { BarsAndWaves } from './legacy/BarsAndWaves'
import { Scope } from './legacy/Scope'
import { Alchemy } from './legacy/Alchemy'
import { Plenoptic } from './legacy/Plenoptic'
import { ButterchurnVisualizer } from './milkdrop/ButterchurnVisualizer'
import { ParticleField } from './modern/ParticleField'
import { WaveformSculpture } from './modern/WaveformSculpture'

export interface VisualizerMeta {
  id: string
  name: string
  category: 'legacy' | 'milkdrop' | 'modern'
  description: string
  supportsColors: boolean
  create: () => BaseVisualizer
}

export const VISUALIZERS: VisualizerMeta[] = [
  // Classic — Spectrum (BarsAndWaves)
  { id: 'spectrum',           name: 'Spectrum',           category: 'legacy',    supportsColors: true,  description: 'Gradient spectrum bars + oscilloscope waveform',    create: () => new BarsAndWaves('psychedelic') },
  { id: 'spectrum-symmetric', name: 'Spectrum Symmetric', category: 'legacy',    supportsColors: true,  description: 'Symmetric bars mirrored from the center axis',       create: () => new BarsAndWaves('geometric') },
  { id: 'spectrum-lite',      name: 'Spectrum Lite',      category: 'legacy',    supportsColors: true,  description: 'Sparse minimal bars with a clean waveform',          create: () => new BarsAndWaves('minimal') },
  { id: 'spectrum-wide',      name: 'Spectrum Wide',      category: 'legacy',    supportsColors: true,  description: 'Full-width gradient bars with waveform overlay',      create: () => new BarsAndWaves('abstract') },
  // Classic — Scope
  { id: 'scope',              name: 'Scope',              category: 'legacy',    supportsColors: true,  description: 'Glowing oscilloscope with a color trail',             create: () => new Scope('psychedelic') },
  { id: 'scope-radial',       name: 'Scope Radial',       category: 'legacy',    supportsColors: true,  description: 'Circular waveform radiating from the center',         create: () => new Scope('geometric') },
  { id: 'scope-clean',        name: 'Scope Clean',        category: 'legacy',    supportsColors: true,  description: 'Single thin waveform line, no trails',                create: () => new Scope('minimal') },
  { id: 'scope-mirror',       name: 'Scope Mirror',       category: 'legacy',    supportsColors: true,  description: 'Mirrored waveform with frequency magnitude dots',      create: () => new Scope('abstract') },
  // Classic — Alchemy
  { id: 'alchemy',            name: 'Alchemy',            category: 'legacy',    supportsColors: true,  description: 'Audio-reactive particle system with hue cycling',     create: () => new Alchemy('psychedelic') },
  { id: 'alchemy-hex',        name: 'Alchemy Hex',        category: 'legacy',    supportsColors: true,  description: 'Particles spawned from a hexagonal ring',             create: () => new Alchemy('geometric') },
  { id: 'alchemy-lite',       name: 'Alchemy Lite',       category: 'legacy',    supportsColors: true,  description: 'Subtle low-density particle drift',                   create: () => new Alchemy('minimal') },
  { id: 'alchemy-flow',       name: 'Alchemy Flow',       category: 'legacy',    supportsColors: true,  description: 'Curl-field particle turbulence',                      create: () => new Alchemy('abstract') },
  // Classic — Plenoptic
  { id: 'plenoptic',          name: 'Plenoptic',          category: 'legacy',    supportsColors: true,  description: 'Psychedelic tunnel of concentric frequency rings',    create: () => new Plenoptic('psychedelic') },
  { id: 'plenoptic-petal',    name: 'Plenoptic Petal',    category: 'legacy',    supportsColors: true,  description: 'Hexagonal petal shapes in a depth tunnel',            create: () => new Plenoptic('geometric') },
  { id: 'plenoptic-clean',    name: 'Plenoptic Clean',    category: 'legacy',    supportsColors: true,  description: 'Minimal thin-stroke ring tunnel',                     create: () => new Plenoptic('minimal') },
  { id: 'plenoptic-radial',   name: 'Plenoptic Radial',   category: 'legacy',    supportsColors: true,  description: 'Radial bar tunnel driven by frequency data',          create: () => new Plenoptic('abstract') },
  // Milkdrop
  { id: 'milkdrop',           name: 'Milkdrop',           category: 'milkdrop',  supportsColors: false, description: 'Winamp Milkdrop 2 — hundreds of community presets',  create: () => new ButterchurnVisualizer() },
  // Modern
  { id: 'particle-field',     name: 'Particle Field',     category: 'modern',    supportsColors: true,  description: '3D particle sphere that pulses and explodes with the beat', create: () => new ParticleField() },
  { id: 'waveform-sculpture', name: 'Waveform Sculpture', category: 'modern',    supportsColors: true,  description: '3D scrolling spectrogram mesh deformed by frequency data',  create: () => new WaveformSculpture() },
]

export function createVisualizer(id: string): BaseVisualizer {
  const meta = VISUALIZERS.find(v => v.id === id)
  if (!meta) throw new Error(`Unknown visualizer: ${id}`)
  return meta.create()
}
