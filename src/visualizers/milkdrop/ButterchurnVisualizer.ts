import { BaseVisualizer, type AudioData, type ResolvedParams } from '../BaseVisualizer'
import butterchurnImport from 'butterchurn'
import type { MilkdropVisualizer } from 'butterchurn'
import { getMilkdropPresetNames, getMilkdropPresetsObj, getPresetConfigSchema } from './presetRegistry'
import type { PresetConfigOverrides } from './presetConfig'

function formatValue(value: number, step: number): string {
  const dec = Math.max(0, Math.ceil(-Math.log10(step)))
  return parseFloat(value.toFixed(dec)).toString()
}

// Vite's CJS interop may deliver the module as {__esModule:true, default:Class}
// rather than the class itself — unwrap either form.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const butterchurn: typeof butterchurnImport = (butterchurnImport as any).default ?? butterchurnImport

export { getMilkdropPresetNames }

export class ButterchurnVisualizer extends BaseVisualizer {
  private canvas!: HTMLCanvasElement
  private milkdrop: MilkdropVisualizer | null = null
  private currentPresetIndex = 0
  private configOverrides: PresetConfigOverrides = {}
  private rafId = 0

  private pendingContext: AudioContext | null = null
  private pendingSourceNode: AudioNode | null = null

  /** Called by VisualizerCanvas before init() so Butterchurn gets audio. */
  setAudioContext(ctx: AudioContext, sourceNode: AudioNode) {
    this.pendingContext = ctx
    this.pendingSourceNode = sourceNode
    if (this.milkdrop) {
      try { this.milkdrop.connectAudio(sourceNode) } catch (e) {
        console.error('[Butterchurn] connectAudio failed:', e)
      }
    }
  }

  init(container: HTMLDivElement, params: ResolvedParams) {
    this.canvas = document.createElement('canvas')
    this.canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%'
    container.appendChild(this.canvas)

    const W = Math.max(container.clientWidth, 16)
    const H = Math.max(container.clientHeight, 16)
    this.canvas.width = W
    this.canvas.height = H

    const ctx = this.pendingContext ?? new AudioContext()
    if (!this.pendingContext) this.pendingContext = ctx

    try {
      this.milkdrop = butterchurn.createVisualizer(ctx, this.canvas, { width: W, height: H })
    } catch (e) {
      console.error('[Butterchurn] createVisualizer failed:', e)
      return
    }

    if (this.pendingSourceNode) {
      try { this.milkdrop.connectAudio(this.pendingSourceNode) } catch (e) {
        console.error('[Butterchurn] connectAudio failed:', e)
      }
    }

    const names = getMilkdropPresetNames()
    if (names.length > 0) {
      const startIdx = Math.floor((params.paletteIndex / 8) * names.length) % names.length
      this._tryLoadPreset(startIdx, 0)
    }

    const loop = () => {
      this.rafId = requestAnimationFrame(loop)
      try { this.milkdrop?.render() } catch (_) {}
    }
    this.rafId = requestAnimationFrame(loop)
  }

  private _tryLoadPreset(index: number, transitionTime: number): boolean {
    if (!this.milkdrop) return false
    const obj   = getMilkdropPresetsObj()
    const names = getMilkdropPresetNames()
    const raw   = obj[names[index]] as Record<string, unknown>

    if (Object.keys(this.configOverrides).length === 0) {
      try {
        this.milkdrop.loadPreset(raw as object, transitionTime)
        this.currentPresetIndex = index
        return true
      } catch {
        console.warn(`[Butterchurn] preset "${names[index]}" failed to load`)
        return false
      }
    }

    const schema = getPresetConfigSchema(index)
    const baseValOverrides: Record<string, number> = {}
    let frameEqs = (raw.frame_eqs_str as string) ?? ''
    let pixelEqs = (raw.pixel_eqs_str as string) ?? ''
    let warpStr  = (raw.warp as string) ?? ''
    let compStr  = (raw.comp as string) ?? ''

    for (const [key, value] of Object.entries(this.configOverrides)) {
      const param = schema?.[key]
      const tier = param?.tier ?? 'easy'
      if (tier === 'easy') {
        baseValOverrides[key] = value
      } else if ((tier === 'medium' || tier === 'hard') && param?.replace && param?.target) {
        const formatted = formatValue(value, param.step)
        // GLSL has no implicit int→float conversion — shader literals need a decimal point
        const glsl = formatted.includes('.') ? formatted : formatted + '.0'
        if      (param.target === 'frame_eqs_str') frameEqs = frameEqs.replaceAll(param.replace, formatted)
        else if (param.target === 'pixel_eqs_str') pixelEqs = pixelEqs.replaceAll(param.replace, formatted)
        else if (param.target === 'warp')          warpStr  = warpStr.replaceAll(param.replace, glsl)
        else if (param.target === 'comp')          compStr  = compStr.replaceAll(param.replace, glsl)
      }
    }

    const preset: Record<string, unknown> = {
      ...raw,
      baseVals: { ...(raw.baseVals as Record<string, unknown>), ...baseValOverrides },
      frame_eqs_str: frameEqs,
      pixel_eqs_str: pixelEqs,
      warp: warpStr,
      comp: compStr,
    }

    try {
      this.milkdrop.loadPreset(preset as object, transitionTime)
      this.currentPresetIndex = index
      return true
    } catch {
      console.warn(`[Butterchurn] preset "${names[index]}" failed to load`)
      return false
    }
  }

  /** Jump to a specific preset by index, optionally with config overrides. */
  selectPreset(index: number, transitionTime = 2.7, configOverrides: PresetConfigOverrides = {}) {
    const names = getMilkdropPresetNames()
    if (index < 0 || index >= names.length) return
    this.configOverrides = configOverrides
    this._tryLoadPreset(index, transitionTime)
  }

  /** Apply new config overrides to the currently active preset (reloads instantly). */
  applyConfig(overrides: PresetConfigOverrides) {
    this.configOverrides = overrides
    this._tryLoadPreset(this.currentPresetIndex, 0)
  }

  /** Advance to the next preset, skipping any that fail to compile. */
  nextPreset(transitionTime = 2.7) {
    const names = getMilkdropPresetNames()
    if (!this.milkdrop || names.length === 0) return
    this.configOverrides = {}
    for (let attempt = 0; attempt < names.length; attempt++) {
      const idx = (this.currentPresetIndex + 1 + attempt) % names.length
      if (this._tryLoadPreset(idx, transitionTime)) return
    }
  }

  getPresetName(): string {
    return getMilkdropPresetNames()[this.currentPresetIndex] ?? ''
  }

  getPresetIndex(): number {
    return this.currentPresetIndex
  }

  // update() is a no-op — Butterchurn drives itself via its own RAF loop.
  update(_audioData: AudioData, _params: ResolvedParams, _timeMs: number) {}

  resize(width: number, height: number) {
    if (width < 1 || height < 1) return
    this.canvas.width = width
    this.canvas.height = height
    try { this.milkdrop?.setRendererSize(width, height) } catch (_) {}
  }

  destroy() {
    cancelAnimationFrame(this.rafId)
    // Don't touch audio graph here — any explicit disconnect can sever the main audio path.
    this.canvas.remove()
    this.milkdrop = null
  }
}
