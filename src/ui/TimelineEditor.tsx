import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Segment } from '../timeline/types'
import type { UserConfig } from '../seed/ParamResolver'
import { VISUALIZERS } from '../visualizers/registry'
import { getMilkdropPresetNames } from '../visualizers/milkdrop/ButterchurnVisualizer'

interface Props {
  segments: Segment[]
  duration: number
  currentTime: number
  globalConfig: UserConfig
  activeVisualizerId: string
  activeMilkdropPresetIndex: number
  onChange: (segments: Segment[]) => void
}

const MIN_DURATION = 1 // seconds

let _idCounter = 1
function newId() { return `seg_${_idCounter++}` }

const CATEGORY_COLORS = {
  legacy:   'bg-sky-600 border-sky-400',
  milkdrop: 'bg-violet-600 border-violet-400',
  modern:   'bg-emerald-600 border-emerald-400',
}

const CATEGORY_COLORS_SELECTED = {
  legacy:   'bg-sky-500 border-sky-300',
  milkdrop: 'bg-violet-500 border-violet-300',
  modern:   'bg-emerald-500 border-emerald-300',
}

function vizLabel(seg: Segment): string {
  const meta = VISUALIZERS.find(v => v.id === seg.visualizerId)
  const name = meta?.name ?? seg.visualizerId
  if (seg.visualizerId === 'milkdrop' && seg.presetIndex !== undefined) {
    const presets = getMilkdropPresetNames()
    const presetName = presets[seg.presetIndex] ?? ''
    const short = presetName.length > 24 ? presetName.slice(0, 22) + '…' : presetName
    return `Milkdrop — ${short}`
  }
  return name
}

function vizCategory(id: string): 'legacy' | 'milkdrop' | 'modern' {
  return VISUALIZERS.find(v => v.id === id)?.category ?? 'legacy'
}

export function TimelineEditor({
  segments, duration, currentTime, globalConfig,
  activeVisualizerId, activeMilkdropPresetIndex,
  onChange,
}: Props) {
  const [selected, setSelected] = useState<string | null>(null)
  const [presetSearch, setPresetSearch] = useState('')
  const trackRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{
    type: 'move' | 'resize-left' | 'resize-right'
    id: string
    startX: number
    origStart: number
    origEnd: number
  } | null>(null)

  const selectedSeg = segments.find(s => s.id === selected) ?? null
  const selectedVizMeta = VISUALIZERS.find(v => v.id === selectedSeg?.visualizerId)
  const segSupportsColors = selectedVizMeta?.supportsColors ?? true

  const allPresets = useMemo(() => getMilkdropPresetNames(), [])
  const filteredPresets = useMemo(() => {
    const q = presetSearch.trim().toLowerCase()
    if (!q) return allPresets.map((name, idx) => ({ name, idx }))
    return allPresets.map((name, idx) => ({ name, idx })).filter(({ name }) => name.toLowerCase().includes(q))
  }, [allPresets, presetSearch])

  const pct = useCallback((t: number) => duration > 0 ? (t / duration) * 100 : 0, [duration])
  const tFromPx = useCallback((px: number) => {
    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect || duration === 0) return 0
    return Math.max(0, Math.min((px - rect.left) / rect.width * duration, duration))
  }, [duration])

  // Overlap zones between segments
  const overlapZones = useMemo(() => {
    const zones: { left: number; width: number }[] = []
    const sorted = [...segments].sort((a, b) => a.startTime - b.startTime)
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i], b = sorted[i + 1]
      if (b.startTime < a.endTime) {
        const overlapStart = b.startTime
        const overlapEnd = Math.min(a.endTime, b.endTime)
        zones.push({ left: pct(overlapStart), width: pct(overlapEnd - overlapStart) })
      }
    }
    return zones
  }, [segments, pct])

  const handleTrackPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    if (duration === 0) return
    const t = tFromPx(e.clientX)

    const hit = segments.find(s => t >= s.startTime && t < s.endTime)
    if (hit) {
      setSelected(hit.id)
      dragRef.current = {
        type: 'move', id: hit.id, startX: e.clientX,
        origStart: hit.startTime, origEnd: hit.endTime,
      }
      ;(e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId)
      return
    }

    // Click empty space → create segment
    const segDuration = Math.min(10, duration - t)
    if (segDuration < MIN_DURATION) return
    const seg: Segment = {
      id: newId(),
      startTime: t,
      endTime: t + segDuration,
      visualizerId: activeVisualizerId,
      presetIndex: activeVisualizerId === 'milkdrop' ? activeMilkdropPresetIndex : undefined,
      primaryColor: globalConfig.primaryColor,
      secondaryColor: globalConfig.secondaryColor,
    }
    const next = [...segments, seg].sort((a, b) => a.startTime - b.startTime)
    onChange(next)
    setSelected(seg.id)
  }

  const handleResizePointerDown = (
    e: React.PointerEvent<HTMLDivElement>,
    id: string,
    type: 'resize-left' | 'resize-right',
  ) => {
    e.stopPropagation()
    const seg = segments.find(s => s.id === id)!
    dragRef.current = { type, id, startX: e.clientX, origStart: seg.startTime, origEnd: seg.endTime }
    ;(e.currentTarget.parentElement!.parentElement! as HTMLDivElement).setPointerCapture(e.pointerId)
  }

  const handleTrackPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag) return
    const dx = e.clientX - drag.startX
    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect) return
    const dtSec = (dx / rect.width) * duration

    onChange(segments.map(s => {
      if (s.id !== drag.id) return s
      if (drag.type === 'move') {
        const len = drag.origEnd - drag.origStart
        const newStart = Math.max(0, Math.min(drag.origStart + dtSec, duration - len))
        return { ...s, startTime: newStart, endTime: newStart + len }
      }
      if (drag.type === 'resize-left') {
        const newStart = Math.max(0, Math.min(drag.origStart + dtSec, drag.origEnd - MIN_DURATION))
        return { ...s, startTime: newStart }
      }
      const newEnd = Math.min(duration, Math.max(drag.origEnd + dtSec, drag.origStart + MIN_DURATION))
      return { ...s, endTime: newEnd }
    }))
  }

  const handleTrackPointerUp = () => { dragRef.current = null }

  const updateSelected = (patch: Partial<Segment>) => {
    onChange(segments.map(s => s.id === selected ? { ...s, ...patch } : s))
  }

  const deleteSelected = () => {
    onChange(segments.filter(s => s.id !== selected))
    setSelected(null)
  }

  useEffect(() => {
    const handler = (e: PointerEvent) => {
      if (trackRef.current && !trackRef.current.closest('.timeline-root')?.contains(e.target as Node)) {
        // don't deselect — editor panel is sibling, keep selection
      }
    }
    window.addEventListener('pointerdown', handler)
    return () => window.removeEventListener('pointerdown', handler)
  }, [])

  return (
    <div className="timeline-root border-t border-zinc-800 bg-zinc-950/90 select-none">
      {/* Track */}
      <div
        ref={trackRef}
        className="relative h-12 mx-4 my-2 rounded overflow-hidden cursor-crosshair"
        style={{
          background: 'repeating-linear-gradient(45deg, #18181b 0px, #18181b 6px, #1c1c1f 6px, #1c1c1f 12px)',
        }}
        onPointerDown={handleTrackPointerDown}
        onPointerMove={handleTrackPointerMove}
        onPointerUp={handleTrackPointerUp}
        onPointerCancel={handleTrackPointerUp}
      >
        {/* Overlap amber zones */}
        {overlapZones.map((z, i) => (
          <div
            key={i}
            className="absolute top-0 bottom-0 bg-amber-500/20 border-x border-amber-500/40 pointer-events-none"
            style={{ left: `${z.left}%`, width: `${z.width}%` }}
          />
        ))}

        {/* Segments */}
        {[...segments].sort((a, b) => a.startTime - b.startTime).map(seg => {
          const cat = vizCategory(seg.visualizerId)
          const isSelected = selected === seg.id
          const colors = isSelected ? CATEGORY_COLORS_SELECTED[cat] : CATEGORY_COLORS[cat]
          return (
            <div
              key={seg.id}
              className={`absolute top-1 bottom-1 rounded border ${colors} ${isSelected ? 'z-10' : 'z-0'} opacity-90 hover:opacity-100 flex items-center`}
              style={{ left: `${pct(seg.startTime)}%`, width: `${pct(seg.endTime - seg.startTime)}%` }}
            >
              <div
                className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/20 rounded-l"
                onPointerDown={e => handleResizePointerDown(e, seg.id, 'resize-left')}
              />
              <span className="text-white text-xs px-2 truncate pointer-events-none flex-1 text-center leading-none">
                {vizLabel(seg)}
              </span>
              <div
                className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/20 rounded-r"
                onPointerDown={e => handleResizePointerDown(e, seg.id, 'resize-right')}
              />
            </div>
          )
        })}

        {/* Playhead */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-red-500/80 pointer-events-none z-20"
          style={{ left: `${pct(currentTime)}%` }}
        />
      </div>

      {/* Segment editor panel */}
      {selectedSeg && (
        <div className="px-4 pb-3 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Visualizer picker */}
            <label className="text-xs text-zinc-500 flex items-center gap-1">
              Visualizer
              <select
                className="bg-zinc-800 text-zinc-200 rounded px-2 py-1 border border-zinc-700 outline-none focus:border-violet-500 text-xs"
                value={selectedSeg.visualizerId}
                onChange={e => updateSelected({
                  visualizerId: e.target.value,
                  presetIndex: e.target.value === 'milkdrop' ? 0 : undefined,
                })}
              >
                {VISUALIZERS.map(v => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </label>

            {/* Color pickers — hidden for visualizers that manage their own color */}
            {segSupportsColors && (
              <>
                <label className="text-xs text-zinc-500 flex items-center gap-1">
                  Primary
                  <input
                    type="color"
                    value={selectedSeg.primaryColor ?? globalConfig.primaryColor}
                    onChange={e => updateSelected({ primaryColor: e.target.value })}
                    className="w-7 h-6 rounded cursor-pointer"
                  />
                </label>

                <label className="text-xs text-zinc-500 flex items-center gap-1">
                  Secondary
                  <input
                    type="color"
                    value={selectedSeg.secondaryColor ?? globalConfig.secondaryColor}
                    onChange={e => updateSelected({ secondaryColor: e.target.value })}
                    className="w-7 h-6 rounded cursor-pointer"
                  />
                </label>
              </>
            )}

            <button
              className="ml-auto text-red-500 hover:text-red-400 text-xs transition-colors"
              onClick={deleteSelected}
            >
              Delete
            </button>
            <button
              className="text-zinc-500 hover:text-zinc-300 text-xs transition-colors"
              onClick={() => setSelected(null)}
            >
              ✕
            </button>
          </div>

          {/* Milkdrop preset picker */}
          {selectedSeg.visualizerId === 'milkdrop' && (
            <div className="flex flex-col gap-1">
              <input
                type="text"
                placeholder="Search presets…"
                value={presetSearch}
                onChange={e => setPresetSearch(e.target.value)}
                className="bg-zinc-800 text-zinc-200 text-xs rounded px-2 py-1 border border-zinc-700 outline-none focus:border-violet-500 placeholder:text-zinc-600 w-full"
              />
              <div className="h-20 overflow-y-auto bg-zinc-900 rounded border border-zinc-800">
                {filteredPresets.map(({ name, idx }) => {
                  const isActive = idx === selectedSeg.presetIndex
                  return (
                    <button
                      key={idx}
                      onClick={() => updateSelected({ presetIndex: idx })}
                      className={`w-full text-left px-2 py-0.5 text-xs truncate transition-colors ${
                        isActive ? 'bg-violet-600/30 text-violet-300' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                      }`}
                      title={name}
                    >
                      {name}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
