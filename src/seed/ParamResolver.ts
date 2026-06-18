import { createPrng } from './prng'
import type { Segment } from '../timeline/types'

export interface UserConfig {
  primaryColor: string   // hex
  secondaryColor: string // hex
}

export interface ResolvedParams {
  seed: number
  paletteIndex: number
  patternIndex: number
  animationSpeed: number
  particleCount: number
  primaryColor: [number, number, number]
  secondaryColor: [number, number, number]
}

export const DEFAULT_CONFIG: UserConfig = {
  primaryColor: '#8b5cf6',
  secondaryColor: '#06b6d4',
}

export function resolveParams(
  seed: number,
  config: UserConfig,
  _activeSegment: Segment | null,
): ResolvedParams {
  const rng = createPrng(seed)
  return {
    seed,
    paletteIndex: Math.floor(rng() * 8),
    patternIndex: Math.floor(rng() * 8),
    animationSpeed: 0.5 + rng() * 1.5,
    particleCount: Math.floor(800 + rng() * 3200),
    primaryColor: hexToRgb(config.primaryColor),
    secondaryColor: hexToRgb(config.secondaryColor),
  }
}

export function resolveParamsForSegment(
  seed: number,
  globalConfig: UserConfig,
  segment: Segment | null,
): ResolvedParams {
  const base = resolveParams(seed, globalConfig, null)
  if (!segment) return base
  return {
    ...base,
    primaryColor: segment.primaryColor ? hexToRgb(segment.primaryColor) : base.primaryColor,
    secondaryColor: segment.secondaryColor ? hexToRgb(segment.secondaryColor) : base.secondaryColor,
  }
}

export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16)
  return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]
}

export function rgbToHex(rgb: [number, number, number]): string {
  return '#' + rgb.map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('')
}
