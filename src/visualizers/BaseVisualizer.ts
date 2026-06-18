import type { AudioData } from '../audio/AudioAnalyzer'
import type { ResolvedParams } from '../seed/ParamResolver'

export type { AudioData, ResolvedParams }

export abstract class BaseVisualizer {
  // Container div is passed so each visualizer can create its own canvas
  // with the right context (2D vs WebGL) and append it there.
  abstract init(container: HTMLDivElement, params: ResolvedParams): void
  abstract update(audioData: AudioData, params: ResolvedParams, timeMs: number): void
  abstract resize(width: number, height: number): void
  abstract destroy(): void
}
