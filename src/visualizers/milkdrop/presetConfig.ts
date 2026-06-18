export interface PresetConfigParam {
  label?: string
  min: number
  max: number
  default: number
  step: number
  type?: 'slider' | 'select'
  tier?: 'easy' | 'medium' | 'hard'
  target?: 'frame_eqs_str' | 'pixel_eqs_str' | 'warp' | 'comp'
  replace?: string
}

export type PresetConfig = Record<string, PresetConfigParam>

/** Values supplied by the user — only keys the user has changed need to be present. */
export type PresetConfigOverrides = Record<string, number>
