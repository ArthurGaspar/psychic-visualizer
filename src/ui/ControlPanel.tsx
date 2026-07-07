import { useState, useMemo, useRef, useEffect } from 'react'
import { VISUALIZERS } from '../visualizers/registry'
import type { UserConfig } from '../seed/ParamResolver'
import { randomSeed } from '../seed/prng'
import { getMilkdropPresetNames } from '../visualizers/milkdrop/ButterchurnVisualizer'
import { getPresetConfigSchema } from '../visualizers/milkdrop/presetRegistry'
import type { PresetConfigOverrides } from '../visualizers/milkdrop/presetConfig'

interface Props {
  activeId: string
  seed: number
  config: UserConfig
  currentMilkdropPresetIndex: number
  milkdropConfigValues: PresetConfigOverrides
  onVisualizerChange: (id: string) => void
  onSeedChange: (seed: number) => void
  onConfigChange: (config: UserConfig) => void
  onSelectMilkdropPreset: (index: number) => void
  onMilkdropConfigChange: (key: string, value: number) => void
  onMilkdropConfigSet: (values: PresetConfigOverrides) => void
  onSave: () => void
  onClose: () => void
}

function decimals(step: number): number {
  if (step >= 1) return 0
  return Math.ceil(-Math.log10(step))
}

const CATEGORY_LABELS = { legacy: 'Classic', milkdrop: 'Milkdrop', modern: 'Modern' }
type Tab = 'controls' | 'presets'

export function ControlPanel({
  activeId, seed, config, currentMilkdropPresetIndex,
  milkdropConfigValues,
  onVisualizerChange, onSeedChange, onConfigChange,
  onSelectMilkdropPreset, onMilkdropConfigChange, onMilkdropConfigSet,
  onSave, onClose,
}: Props) {
  const [tab, setTab] = useState<Tab>('controls')
  const [search, setSearch] = useState('')
  const activeItemRef = useRef<HTMLButtonElement>(null)

  const activeVizMeta = VISUALIZERS.find(v => v.id === activeId)
  const supportsColors = activeVizMeta?.supportsColors ?? true

  const presetConfigSchema = useMemo(
    () => activeId === 'milkdrop' ? getPresetConfigSchema(currentMilkdropPresetIndex) : null,
    [activeId, currentMilkdropPresetIndex],
  )

  // Switch to controls tab when a non-Milkdrop visualizer is selected
  useEffect(() => {
    if (activeId !== 'milkdrop') setTab('controls')
  }, [activeId])

  const grouped = {
    legacy:   VISUALIZERS.filter(v => v.category === 'legacy'),
    milkdrop: VISUALIZERS.filter(v => v.category === 'milkdrop'),
    modern:   VISUALIZERS.filter(v => v.category === 'modern'),
  } as const

  const allPresets = useMemo(() => getMilkdropPresetNames(), [])

  const filteredPresets = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return allPresets.map((name, idx) => ({ name, idx }))
    return allPresets
      .map((name, idx) => ({ name, idx }))
      .filter(({ name }) => name.toLowerCase().includes(q))
  }, [allPresets, search])

  // Scroll active preset into view when switching to presets tab
  useEffect(() => {
    if (tab === 'presets' && !search) {
      activeItemRef.current?.scrollIntoView({ block: 'nearest' })
    }
  }, [tab, search])

  return (
    <div className="absolute right-0 top-0 bottom-0 w-72 bg-zinc-950/95 border-l border-zinc-800 flex flex-col z-10 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 flex-shrink-0">
        <span className="text-sm font-semibold text-zinc-300">Controls</span>
        <button onClick={onClose} className="text-zinc-600 hover:text-zinc-400 transition-colors text-lg leading-none">✕</button>
      </div>

      {/* Tab bar — only shown for Milkdrop */}
      {activeId === 'milkdrop' && (
        <div className="flex border-b border-zinc-800 flex-shrink-0">
          {(['controls', 'presets'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 text-xs font-medium capitalize transition-colors ${
                tab === t
                  ? 'text-violet-300 border-b-2 border-violet-500 -mb-px'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      {/* Presets tab */}
      {tab === 'presets' && activeId === 'milkdrop' && (
        <div className="flex flex-col flex-1 min-h-0">
          <div className="px-3 py-2 border-b border-zinc-800 flex-shrink-0">
            <input
              type="text"
              placeholder="Search presets…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-zinc-800 text-zinc-200 text-xs rounded px-3 py-1.5 border border-zinc-700 outline-none focus:border-violet-500 placeholder:text-zinc-600"
            />
            <p className="text-zinc-600 text-xs mt-1.5 px-0.5">
              {filteredPresets.length} / {allPresets.length} presets
            </p>
          </div>

          {/* Preset list — capped so config panel has room */}
          <div className={`overflow-y-auto py-1 ${presetConfigSchema ? 'max-h-44' : 'flex-1'}`}>
            {filteredPresets.map(({ name, idx }) => {
              const isActive = idx === currentMilkdropPresetIndex
              return (
                <button
                  key={idx}
                  ref={isActive ? activeItemRef : undefined}
                  onClick={() => onSelectMilkdropPreset(idx)}
                  className={`w-full text-left px-3 py-1.5 text-xs transition-colors truncate ${
                    isActive
                      ? 'bg-violet-600/30 text-violet-300'
                      : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                  }`}
                  title={name}
                >
                  {name}
                </button>
              )
            })}
          </div>

          {/* Per-preset config sliders — only shown when the active preset has a config schema */}
          {presetConfigSchema && (() => {
            const entries = Object.entries(presetConfigSchema)
            const easyEntries   = entries.filter(([, p]) => !p.tier || p.tier === 'easy')
            const mediumEntries = entries.filter(([, p]) => p.tier === 'medium')
            const hardEntries   = entries.filter(([, p]) => p.tier === 'hard')

            const randomize = () => {
              const values: PresetConfigOverrides = {}
              for (const [key, p] of entries) {
                const steps = Math.round((p.max - p.min) / p.step)
                const v = p.min + Math.floor(Math.random() * (steps + 1)) * p.step
                values[key] = Number(v.toFixed(decimals(p.step)))
              }
              onMilkdropConfigSet(values)
            }

            const renderParam = (key: string, param: typeof presetConfigSchema[string]) => {
              const value = milkdropConfigValues[key] ?? param.default
              const dec   = decimals(param.step)
              return (
                <div key={key} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-400 font-mono">{key}</span>
                    <span className="text-xs text-zinc-500 font-mono">{value.toFixed(dec)}</span>
                  </div>
                  {param.type === 'select' ? (
                    <select
                      value={value}
                      onChange={e => onMilkdropConfigChange(key, Number(e.target.value))}
                      className="w-full bg-zinc-800 text-zinc-200 text-xs rounded px-2 py-1 border border-zinc-700 outline-none focus:border-violet-500"
                    >
                      {Array.from({ length: param.max - param.min + 1 }, (_, i) => i + param.min).map(v => (
                        <option key={v} value={v}>Mode {v}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="range"
                      min={param.min}
                      max={param.max}
                      step={param.step}
                      value={value}
                      onChange={e => onMilkdropConfigChange(key, Number(e.target.value))}
                      className="w-full accent-violet-500"
                    />
                  )}
                </div>
              )
            }

            return (
              <div className="flex-1 overflow-y-auto border-t border-zinc-800 p-3 space-y-3 min-h-0">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Preset Config</p>
                  <button
                    onClick={randomize}
                    className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 text-sm transition-colors border border-zinc-700 leading-none"
                    title="Randomize all values"
                  >
                    🎲
                  </button>
                </div>
                {easyEntries.length > 0 && (
                  <>
                    <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Base Config</p>
                    {easyEntries.map(([key, param]) => renderParam(key, param))}
                  </>
                )}
                {mediumEntries.length > 0 && (
                  <>
                    <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mt-2">Equation Config</p>
                    {mediumEntries.map(([key, param]) => renderParam(key, param))}
                  </>
                )}
                {hardEntries.length > 0 && (
                  <>
                    <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mt-2">Shader Config</p>
                    {hardEntries.map(([key, param]) => renderParam(key, param))}
                  </>
                )}
              </div>
            )
          })()}
        </div>
      )}

      {/* Controls tab (or non-Milkdrop) */}
      {(tab === 'controls' || activeId !== 'milkdrop') && (
        <>
          <div className="flex-1 overflow-y-auto p-4 space-y-5">
            {/* Visualizer picker */}
            <section>
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Visualizer</h3>
              {(Object.keys(grouped) as (keyof typeof grouped)[]).map(cat => (
                <div key={cat} className="mb-3">
                  <p className="text-xs text-zinc-600 mb-1">{CATEGORY_LABELS[cat]}</p>
                  <div className="space-y-1">
                    {grouped[cat].map(v => (
                      <button
                        key={v.id}
                        onClick={() => {
                          onVisualizerChange(v.id)
                          if (v.id === 'milkdrop') setTab('presets')
                        }}
                        className={`
                          w-full text-left px-3 py-2 rounded text-sm transition-colors
                          ${activeId === v.id
                            ? 'bg-violet-600/30 text-violet-300 border border-violet-600/50'
                            : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 border border-transparent'}
                        `}
                      >
                        <span className="font-medium">{v.name}</span>
                        <span className="block text-xs text-zinc-600 mt-0.5">{v.description}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </section>

            {/* Seed */}
            <section>
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Seed</h3>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={seed}
                  onChange={e => onSeedChange(Number(e.target.value))}
                  className="flex-1 bg-zinc-800 text-zinc-200 text-sm rounded px-3 py-1.5 border border-zinc-700 outline-none focus:border-violet-500 font-mono"
                />
                <button
                  onClick={() => onSeedChange(randomSeed())}
                  className="px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 text-sm transition-colors border border-zinc-700"
                  title="Randomize seed"
                >
                  ⟳
                </button>
              </div>
            </section>

            {/* Colors — hidden for visualizers that manage their own color (e.g. Milkdrop) */}
            {supportsColors && (
              <section>
                <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Colors</h3>
                <div className="space-y-2">
                  <label className="flex items-center justify-between text-xs text-zinc-500">
                    Primary
                    <input
                      type="color"
                      value={config.primaryColor}
                      onChange={e => onConfigChange({ ...config, primaryColor: e.target.value })}
                      className="w-8 h-6 cursor-pointer rounded"
                    />
                  </label>
                  <label className="flex items-center justify-between text-xs text-zinc-500">
                    Secondary
                    <input
                      type="color"
                      value={config.secondaryColor}
                      onChange={e => onConfigChange({ ...config, secondaryColor: e.target.value })}
                      className="w-8 h-6 cursor-pointer rounded"
                    />
                  </label>
                </div>
              </section>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-zinc-800 flex-shrink-0">
            <button
              onClick={onSave}
              className="w-full py-2 rounded bg-violet-700 hover:bg-violet-600 text-white text-sm font-medium transition-colors"
            >
              Save / Share
            </button>
          </div>
        </>
      )}
    </div>
  )
}
