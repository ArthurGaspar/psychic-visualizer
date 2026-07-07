import { useCallback, useEffect, useRef, useState } from 'react'
import { DropZone } from './ui/DropZone'
import { PlaybackControls } from './ui/PlaybackControls'
import { VisualizerCanvas, type VisualizerCanvasHandle } from './ui/VisualizerCanvas'
import { ControlPanel } from './ui/ControlPanel'
import { SaveModal } from './ui/SaveModal'
import { TimelineEditor } from './ui/TimelineEditor'
import { loadAudioFile, type TrackInfo } from './audio/AudioLoader'
import { AudioAnalyzer } from './audio/AudioAnalyzer'
import { randomSeed } from './seed/prng'
import { resolveParams, DEFAULT_CONFIG, type UserConfig } from './seed/ParamResolver'
import type { Segment } from './timeline/types'
import type { PresetConfigOverrides } from './visualizers/milkdrop/presetConfig'

type Mode = 'full-auto' | 'pseudo-auto'

export default function App() {
  const [track, setTrack] = useState<TrackInfo | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [mode, setMode] = useState<Mode>('full-auto')
  const [visualizerId, setVisualizerId] = useState('spectrum')
  const [seed, setSeed] = useState(() => randomSeed())
  const [config, setConfig] = useState<UserConfig>(DEFAULT_CONFIG)
  const [segments, setSegments] = useState<Segment[]>([])
  const [showControls, setShowControls] = useState(true)
  const [showSave, setShowSave] = useState(false)
  const [bpm, setBpm] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [milkdropPresetIndex, setMilkdropPresetIndex] = useState(-1)
  const [milkdropConfigs, setMilkdropConfigs] = useState<Record<number, PresetConfigOverrides>>({})
  const [focusMode, setFocusMode] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const [audioCtxState, setAudioCtxState] = useState<AudioContext | null>(null)
  const [analyzerState, setAnalyzerState] = useState<AudioAnalyzer | null>(null)

  const audioContextRef = useRef<AudioContext | null>(null)
  const analyzerRef = useRef<AudioAnalyzer | null>(null)
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null)
  const startedAtRef = useRef(0)
  const offsetRef = useRef(0)
  const rafRef = useRef(0)
  const vizCanvasRef = useRef<VisualizerCanvasHandle>(null)

  // Fullscreen state sync — also mirrors focus mode
  useEffect(() => {
    const handler = () => {
      const inFs = !!document.fullscreenElement
      setIsFullscreen(inFs)
      if (!inFs) setFocusMode(false)
    }
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {})
      setFocusMode(true)
    } else {
      document.exitFullscreen()
    }
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return
      if (e.key === 'f' || e.key === 'F') setFocusMode(v => !v)
      if (e.key === 'Escape') setFocusMode(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const ensureContext = () => {
    if (!audioContextRef.current) {
      const ctx = new AudioContext()
      const az = new AudioAnalyzer(ctx)
      audioContextRef.current = ctx
      analyzerRef.current = az
      setAudioCtxState(ctx)
      setAnalyzerState(az)
    }
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume()
    }
    return audioContextRef.current
  }

  const stopSource = () => {
    if (sourceNodeRef.current) {
      try { sourceNodeRef.current.stop() } catch {}
      try { sourceNodeRef.current.disconnect() } catch {}
      sourceNodeRef.current = null
    }
  }

  const play = useCallback((offset: number) => {
    if (!track) return
    const ctx = ensureContext()
    stopSource()
    const source = ctx.createBufferSource()
    source.buffer = track.buffer
    const analyserNode = analyzerRef.current!.getNode()
    source.connect(analyserNode)
    analyserNode.connect(ctx.destination)
    source.start(0, offset)
    sourceNodeRef.current = source
    startedAtRef.current = ctx.currentTime
    offsetRef.current = offset
    source.onended = () => {
      if (sourceNodeRef.current === source) {
        setIsPlaying(false)
        setCurrentTime(0)
        offsetRef.current = 0
      }
    }
  }, [track])

  const handlePlayPause = useCallback(() => {
    if (!track) return
    if (isPlaying) {
      const ctx = audioContextRef.current!
      offsetRef.current = Math.min(offsetRef.current + (ctx.currentTime - startedAtRef.current), track.duration)
      stopSource()
      setIsPlaying(false)
    } else {
      play(offsetRef.current)
      setIsPlaying(true)
    }
  }, [isPlaying, track, play])

  const handleSeek = useCallback((time: number) => {
    if (!track) return
    const wasPlaying = isPlaying
    stopSource()
    offsetRef.current = Math.max(0, Math.min(time, track.duration))
    setCurrentTime(offsetRef.current)
    if (wasPlaying) play(offsetRef.current)
  }, [isPlaying, track, play])

  useEffect(() => {
    if (!isPlaying) { cancelAnimationFrame(rafRef.current); return }
    const tick = () => {
      rafRef.current = requestAnimationFrame(tick)
      const ctx = audioContextRef.current
      if (!ctx) return
      setCurrentTime(Math.min(offsetRef.current + (ctx.currentTime - startedAtRef.current), track?.duration ?? 0))
      const data = analyzerRef.current?.getData(performance.now())
      if (data?.bpm) setBpm(data.bpm)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [isPlaying, track])

  const handleFile = async (file: File) => {
    setLoading(true)
    setError(null)
    try {
      stopSource()
      setIsPlaying(false)
      setCurrentTime(0)
      offsetRef.current = 0
      analyzerRef.current?.reset()
      const ctx = ensureContext()
      const info = await loadAudioFile(file, ctx)
      setTrack(info)
      setSegments([])
    } catch (err) {
      setError('Could not decode audio file. Try MP3, WAV, or FLAC.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (visualizerId !== 'milkdrop') { setMilkdropPresetIndex(-1); return }
    const id = setTimeout(() => {
      const idx = vizCanvasRef.current?.getMilkdropPresetIndex() ?? -1
      setMilkdropPresetIndex(idx)
    }, 200)
    return () => clearTimeout(id)
  }, [visualizerId, audioCtxState])

  const params = resolveParams(seed, config, null)

  // Focus mode: full-canvas, hide all chrome — click anywhere to exit
  if (focusMode && track) {
    return (
      <div
        className="flex flex-col h-full bg-zinc-950 text-zinc-200 select-none cursor-none"
        onClick={() => { setFocusMode(false); if (document.fullscreenElement) document.exitFullscreen() }}
      >
        <div className="relative flex-1 overflow-hidden">
          <VisualizerCanvas
            ref={vizCanvasRef}
            visualizerId={visualizerId}
            params={params}
            analyzer={analyzerState}
            audioContext={audioCtxState}
            analyserNode={analyzerState?.getNode() ?? null}
            isPlaying={isPlaying}
            segments={segments}
            mode={mode}
            currentTime={currentTime}
            seed={seed}
            globalConfig={config}
            milkdropPresetIndex={milkdropPresetIndex}
            milkdropConfigValues={milkdropConfigs[milkdropPresetIndex] ?? {}}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-zinc-200 select-none">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 flex-shrink-0 z-20">
        <div className="flex items-center gap-3">
          <h1 className="text-base font-bold tracking-widest text-violet-400 uppercase">Psychic Visualizer</h1>
          <span className="text-zinc-700 text-xs">music visualizer</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Mode toggle */}
          <div className="flex rounded-md overflow-hidden border border-zinc-800 text-xs">
            {(['full-auto', 'pseudo-auto'] as Mode[]).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-3 py-1.5 transition-colors ${
                  mode === m ? 'bg-violet-700 text-white' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
                }`}
              >
                {m === 'full-auto' ? 'Full Auto' : 'Pseudo Auto'}
              </button>
            ))}
          </div>

          {/* Controls toggle */}
          <button
            onClick={() => setShowControls(v => !v)}
            className={`px-3 py-1.5 rounded border text-xs transition-colors ${
              showControls
                ? 'border-violet-600/50 bg-violet-700/20 text-violet-300'
                : 'border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:border-zinc-700'
            }`}
          >
            Controls
          </button>

          {/* Focus mode */}
          <button
            onClick={() => setFocusMode(true)}
            title="Focus mode — hide all UI (F)"
            className="px-3 py-1.5 rounded border border-zinc-800 text-xs text-zinc-500 hover:text-zinc-300 hover:border-zinc-700 transition-colors"
          >
            Focus
          </button>

          {/* Fullscreen */}
          <button
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            className="px-3 py-1.5 rounded border border-zinc-800 text-xs text-zinc-500 hover:text-zinc-300 hover:border-zinc-700 transition-colors font-mono"
          >
            {isFullscreen ? '⊡' : '⊞'}
          </button>
        </div>
      </header>

      {/* Main canvas area */}
      <div className="relative flex-1 overflow-hidden">
        {track ? (
          <VisualizerCanvas
            ref={vizCanvasRef}
            visualizerId={visualizerId}
            params={params}
            analyzer={analyzerState}
            audioContext={audioCtxState}
            analyserNode={analyzerState?.getNode() ?? null}
            isPlaying={isPlaying}
            segments={segments}
            mode={mode}
            currentTime={currentTime}
            seed={seed}
            globalConfig={config}
            milkdropPresetIndex={milkdropPresetIndex}
            milkdropConfigValues={milkdropConfigs[milkdropPresetIndex] ?? {}}
          />
        ) : (
          <DropZone onFile={handleFile} />
        )}

        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/80">
            <div className="text-zinc-400 text-sm animate-pulse">Decoding audio…</div>
          </div>
        )}

        {error && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-red-900/80 text-red-200 text-sm px-4 py-2 rounded-lg">
            {error}
          </div>
        )}

        {showControls && (
          <ControlPanel
            activeId={visualizerId}
            seed={seed}
            config={config}
            currentMilkdropPresetIndex={milkdropPresetIndex}
            milkdropConfigValues={milkdropConfigs[milkdropPresetIndex] ?? {}}
            onVisualizerChange={setVisualizerId}
            onSeedChange={setSeed}
            onConfigChange={setConfig}
            onSelectMilkdropPreset={(idx) => {
              const overrides = milkdropConfigs[idx] ?? {}
              vizCanvasRef.current?.selectMilkdropPreset(idx, overrides)
              setMilkdropPresetIndex(idx)
            }}
            onMilkdropConfigChange={(key, value) => {
              const next = { ...(milkdropConfigs[milkdropPresetIndex] ?? {}), [key]: value }
              setMilkdropConfigs(prev => ({ ...prev, [milkdropPresetIndex]: next }))
              vizCanvasRef.current?.applyMilkdropConfig(next)
            }}
            onMilkdropConfigSet={(values) => {
              setMilkdropConfigs(prev => ({ ...prev, [milkdropPresetIndex]: values }))
              vizCanvasRef.current?.applyMilkdropConfig(values)
            }}
            onSave={() => setShowSave(true)}
            onClose={() => setShowControls(false)}
          />
        )}
      </div>

      {/* Bottom bar */}
      <div className="flex-shrink-0 z-10">
        {mode === 'pseudo-auto' && track && (
          <TimelineEditor
            segments={segments}
            duration={track.duration}
            currentTime={currentTime}
            globalConfig={config}
            activeVisualizerId={visualizerId}
            activeMilkdropPresetIndex={milkdropPresetIndex}
            onChange={setSegments}
          />
        )}

        {track ? (
          <PlaybackControls
            isPlaying={isPlaying}
            currentTime={currentTime}
            duration={track.duration}
            trackName={track.name}
            bpm={bpm}
            onPlayPause={handlePlayPause}
            onSeek={handleSeek}
          />
        ) : (
          <div className="px-4 py-3 border-t border-zinc-800 text-xs text-zinc-700 text-center">
            Drop an audio file to begin
          </div>
        )}
      </div>

      {showSave && (
        <SaveModal
          seed={seed}
          config={config}
          visualizerId={visualizerId}
          segments={segments}
          onClose={() => setShowSave(false)}
        />
      )}
    </div>
  )
}
