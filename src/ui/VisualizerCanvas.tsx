import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import type { BaseVisualizer } from '../visualizers/BaseVisualizer'
import { createVisualizer } from '../visualizers/registry'
import type { AudioAnalyzer } from '../audio/AudioAnalyzer'
import type { ResolvedParams, UserConfig } from '../seed/ParamResolver'
import { resolveParamsForSegment } from '../seed/ParamResolver'
import { SegmentController } from '../timeline/SegmentController'
import type { Segment } from '../timeline/types'
import { ButterchurnVisualizer } from '../visualizers/milkdrop/ButterchurnVisualizer'
import type { PresetConfigOverrides } from '../visualizers/milkdrop/presetConfig'

export interface VisualizerCanvasHandle {
  nextMilkdropPreset: () => void
  selectMilkdropPreset: (index: number, configOverrides?: PresetConfigOverrides) => void
  applyMilkdropConfig: (overrides: PresetConfigOverrides) => void
  getMilkdropPresetName: () => string
  getMilkdropPresetIndex: () => number
}

interface Props {
  visualizerId: string
  params: ResolvedParams
  analyzer: AudioAnalyzer | null
  audioContext: AudioContext | null
  analyserNode: AudioNode | null
  isPlaying: boolean
  segments: Segment[]
  mode: 'full-auto' | 'pseudo-auto'
  currentTime: number
  seed: number
  globalConfig: UserConfig
  milkdropPresetIndex?: number
  milkdropConfigValues?: PresetConfigOverrides
}

interface SlotState {
  viz: BaseVisualizer | null
  segId: string | null
}

export const VisualizerCanvas = forwardRef<VisualizerCanvasHandle, Props>(function VisualizerCanvas({
  visualizerId, params, analyzer, audioContext, analyserNode, isPlaying,
  segments, mode, currentTime, seed, globalConfig,
  milkdropPresetIndex, milkdropConfigValues,
}: Props, ref) {
  const containerRef = useRef<HTMLDivElement>(null)

  // Full-auto
  const vizRef = useRef<BaseVisualizer | null>(null)
  const lastIdRef = useRef('')

  // Pseudo-auto two-slot
  const slotA = useRef<SlotState>({ viz: null, segId: null })
  const slotB = useRef<SlotState>({ viz: null, segId: null })
  const primarySlot = useRef<'A' | 'B'>('A')
  const slotADiv = useRef<HTMLDivElement>(null)
  const slotBDiv = useRef<HTMLDivElement>(null)

  const segCtrl = useRef(new SegmentController())
  const rafRef = useRef(0)

  // Always-current refs so RAF closures don't go stale
  const paramsRef = useRef(params)
  paramsRef.current = params
  const seedRef = useRef(seed)
  seedRef.current = seed
  const globalConfigRef = useRef(globalConfig)
  globalConfigRef.current = globalConfig
  const currentTimeRef = useRef(currentTime)
  currentTimeRef.current = currentTime
  const audioContextRef = useRef(audioContext)
  audioContextRef.current = audioContext
  const analyserNodeRef = useRef(analyserNode)
  analyserNodeRef.current = analyserNode

  useImperativeHandle(ref, () => ({
    nextMilkdropPreset: () => {
      const viz = vizRef.current
      if (viz instanceof ButterchurnVisualizer) viz.nextPreset()
    },
    selectMilkdropPreset: (index: number, configOverrides: PresetConfigOverrides = {}) => {
      const viz = vizRef.current
      if (viz instanceof ButterchurnVisualizer) viz.selectPreset(index, 2.7, configOverrides)
    },
    applyMilkdropConfig: (overrides: PresetConfigOverrides) => {
      const viz = vizRef.current
      if (viz instanceof ButterchurnVisualizer) viz.applyConfig(overrides)
    },
    getMilkdropPresetName: () => {
      const viz = vizRef.current
      return viz instanceof ButterchurnVisualizer ? viz.getPresetName() : ''
    },
    getMilkdropPresetIndex: () => {
      const viz = vizRef.current
      return viz instanceof ButterchurnVisualizer ? viz.getPresetIndex() : -1
    },
  }))

  // ── Full-auto: recreate visualizer on id or audio change ───────────────────
  useEffect(() => {
    if (mode !== 'full-auto') return
    const container = containerRef.current
    if (!container || lastIdRef.current === visualizerId) return

    vizRef.current?.destroy()
    const viz = createVisualizer(visualizerId)
    if (viz instanceof ButterchurnVisualizer && audioContext && analyserNode) {
      viz.setAudioContext(audioContext, analyserNode)
    }
    viz.init(container, paramsRef.current)
    if (viz instanceof ButterchurnVisualizer && milkdropPresetIndex != null && milkdropPresetIndex >= 0) {
      viz.selectPreset(milkdropPresetIndex, 0, milkdropConfigValues ?? {})
    }
    vizRef.current = viz
    lastIdRef.current = visualizerId
  }, [mode, visualizerId, audioContext, analyserNode]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Cleanup full-auto viz when switching to pseudo-auto ───────────────────
  useEffect(() => {
    if (mode === 'full-auto') return
    vizRef.current?.destroy()
    vizRef.current = null
    lastIdRef.current = ''
  }, [mode])

  // ── Segment controller sync ────────────────────────────────────────────────
  useEffect(() => {
    segCtrl.current.setSegments(segments)
  }, [segments])

  // ── Full-auto animation loop ───────────────────────────────────────────────
  useEffect(() => {
    if (mode !== 'full-auto') return
    if (!isPlaying || !analyzer) { cancelAnimationFrame(rafRef.current); return }

    const loop = () => {
      rafRef.current = requestAnimationFrame(loop)
      const viz = vizRef.current
      if (!viz) return
      viz.update(analyzer.getData(performance.now()), paramsRef.current, performance.now())
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [mode, isPlaying, analyzer])

  // ── Pseudo-auto main loop ──────────────────────────────────────────────────
  useEffect(() => {
    if (mode !== 'pseudo-auto') {
      cancelAnimationFrame(rafRef.current)
      slotA.current.viz?.destroy(); slotA.current = { viz: null, segId: null }
      slotB.current.viz?.destroy(); slotB.current = { viz: null, segId: null }
      return
    }

    const aDom = slotADiv.current
    const bDom = slotBDiv.current
    if (!aDom || !bDom) return

    const getSlots = () => primarySlot.current === 'A'
      ? { primary: slotA.current, secondary: slotB.current, primaryDom: aDom, secondaryDom: bDom }
      : { primary: slotB.current, secondary: slotA.current, primaryDom: bDom, secondaryDom: aDom }

    const initViz = (slot: SlotState, seg: Segment, dom: HTMLDivElement) => {
      slot.viz?.destroy()
      const viz = createVisualizer(seg.visualizerId)
      const ctx = audioContextRef.current
      const node = analyserNodeRef.current
      if (viz instanceof ButterchurnVisualizer && ctx && node) viz.setAudioContext(ctx, node)
      viz.init(dom, resolveParamsForSegment(seedRef.current, globalConfigRef.current, seg))
      if (viz instanceof ButterchurnVisualizer && seg.presetIndex !== undefined) {
        viz.selectPreset(seg.presetIndex, 0)
      }
      const { width, height } = dom.getBoundingClientRect()
      if (width > 0 && height > 0) viz.resize(width, height)
      slot.viz = viz
      slot.segId = seg.id
    }

    const loop = () => {
      rafRef.current = requestAnimationFrame(loop)
      if (!analyzer) return

      const t = currentTimeRef.current
      const { primary, secondary, transitionProgress } = segCtrl.current.getActiveSections(t)
      const { primary: pSlot, secondary: sSlot, primaryDom: pDom, secondaryDom: sDom } = getSlots()

      // Empty — no segment active
      if (!primary) {
        if (pSlot.viz) { pSlot.viz.destroy(); pSlot.viz = null; pSlot.segId = null }
        if (sSlot.viz) { sSlot.viz.destroy(); sSlot.viz = null; sSlot.segId = null }
        pDom.style.opacity = '0'; sDom.style.opacity = '0'
        return
      }

      const isNativeMilkdrop = primary.visualizerId === 'milkdrop' && secondary?.visualizerId === 'milkdrop'

      // Primary segment changed
      if (pSlot.segId !== primary.id) {
        if (isNativeMilkdrop && pSlot.viz instanceof ButterchurnVisualizer) {
          // Reuse the same Butterchurn instance — just blend to new preset
          const overlapDur = secondary
            ? Math.max(0.5, (Math.min(secondary.endTime, primary.endTime) - primary.startTime))
            : 2.7
          if (primary.presetIndex !== undefined) pSlot.viz.selectPreset(primary.presetIndex, overlapDur)
          pSlot.segId = primary.id
        } else if (secondary && sSlot.segId === primary.id) {
          // Incoming is already in secondary slot — swap
          primarySlot.current = primarySlot.current === 'A' ? 'B' : 'A'
        } else {
          // Init incoming in secondary slot, then swap
          initViz(sSlot, primary, sDom)
          primarySlot.current = primarySlot.current === 'A' ? 'B' : 'A'
        }
      }

      // Re-resolve after potential swap
      const { primary: p2, secondary: s2, primaryDom: p2Dom, secondaryDom: s2Dom } = getSlots()

      // Secondary slot management (skip during native Milkdrop — single instance handles it)
      if (!isNativeMilkdrop) {
        if (secondary && s2.segId !== secondary.id) {
          initViz(s2, secondary, s2Dom)
        } else if (!secondary && s2.viz) {
          s2.viz.destroy(); s2.viz = null; s2.segId = null
        }
      }

      // Opacity
      if (isNativeMilkdrop) {
        p2Dom.style.opacity = '1'; s2Dom.style.opacity = '0'
      } else {
        p2Dom.style.opacity = secondary ? String(transitionProgress) : '1'
        s2Dom.style.opacity = secondary ? String(1 - transitionProgress) : '0'
      }

      // Tick visualizers
      const nowMs = performance.now()
      const audioData = analyzer.getData(nowMs)
      if (p2.viz) p2.viz.update(audioData, resolveParamsForSegment(seedRef.current, globalConfigRef.current, primary), nowMs)
      if (secondary && s2.viz) s2.viz.update(audioData, resolveParamsForSegment(seedRef.current, globalConfigRef.current, secondary), nowMs)
    }

    rafRef.current = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(rafRef.current)
      slotA.current.viz?.destroy(); slotA.current = { viz: null, segId: null }
      slotB.current.viz?.destroy(); slotB.current = { viz: null, segId: null }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, analyzer, segments])

  // ── Resize observer ────────────────────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      if (mode === 'full-auto') {
        vizRef.current?.resize(width, height)
      } else {
        slotA.current.viz?.resize(width, height)
        slotB.current.viz?.resize(width, height)
      }
    })
    ro.observe(container)
    return () => ro.disconnect()
  }, [mode])

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden">
      <div ref={slotADiv} className="absolute inset-0" style={{ opacity: 0, willChange: 'opacity' }} />
      <div ref={slotBDiv} className="absolute inset-0" style={{ opacity: 0, willChange: 'opacity' }} />
    </div>
  )
})
