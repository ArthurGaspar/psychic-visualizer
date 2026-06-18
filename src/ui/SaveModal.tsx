import { useState } from 'react'
import type { UserConfig } from '../seed/ParamResolver'
import type { Segment } from '../timeline/types'

interface Props {
  seed: number
  config: UserConfig
  visualizerId: string
  segments: Segment[]
  onClose: () => void
}

export function SaveModal({ seed, config, visualizerId, segments, onClose }: Props) {
  const [copied, setCopied] = useState(false)

  const snapshot = {
    seed,
    visualizer: visualizerId,
    config,
    segments,
    created: new Date().toISOString(),
  }

  const json = JSON.stringify(snapshot, null, 2)

  const copy = async () => {
    await navigator.clipboard.writeText(json)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <h2 className="font-semibold text-zinc-200">Save / Replicate</h2>
          <button onClick={onClose} className="text-zinc-600 hover:text-zinc-400 text-xl leading-none">✕</button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-sm text-zinc-500">
            Copy this config. To replicate this visualization exactly, paste it back and load the same audio file.
          </p>

          {/* Seed highlight */}
          <div className="flex items-center gap-3 p-3 bg-zinc-800 rounded-lg">
            <span className="text-xs text-zinc-500 flex-shrink-0">Seed</span>
            <span className="font-mono text-violet-400 text-lg font-bold">{seed}</span>
          </div>

          {/* JSON */}
          <pre className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-xs text-zinc-400 font-mono overflow-auto max-h-56 leading-relaxed">
            {json}
          </pre>

          <button
            onClick={copy}
            className={`
              w-full py-2.5 rounded-lg text-sm font-medium transition-all
              ${copied
                ? 'bg-emerald-700 text-emerald-100'
                : 'bg-violet-700 hover:bg-violet-600 text-white'}
            `}
          >
            {copied ? '✓ Copied!' : 'Copy to clipboard'}
          </button>
        </div>
      </div>
    </div>
  )
}
