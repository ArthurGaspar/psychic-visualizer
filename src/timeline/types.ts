export interface Segment {
  id: string
  startTime: number
  endTime: number
  visualizerId: string
  presetIndex?: number   // Milkdrop only
  primaryColor?: string  // hex, overrides global
  secondaryColor?: string
}
