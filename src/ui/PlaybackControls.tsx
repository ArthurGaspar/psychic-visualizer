interface Props {
  isPlaying: boolean
  currentTime: number
  duration: number
  trackName: string
  bpm: number
  onPlayPause: () => void
  onSeek: (time: number) => void
}

function fmt(s: number): string {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

export function PlaybackControls({
  isPlaying, currentTime, duration, trackName, bpm,
  onPlayPause, onSeek,
}: Props) {
  const progress = duration > 0 ? currentTime / duration : 0

  return (
    <div className="flex items-center gap-3 px-4 py-2 border-t border-zinc-800 bg-zinc-950/80 backdrop-blur-sm">
      {/* Play/Pause */}
      <button
        onClick={onPlayPause}
        className="w-9 h-9 flex items-center justify-center rounded-full bg-violet-600 hover:bg-violet-500 transition-colors flex-shrink-0"
      >
        {isPlaying ? (
          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
            <rect x="6" y="4" width="4" height="16" rx="1" />
            <rect x="14" y="4" width="4" height="16" rx="1" />
          </svg>
        ) : (
          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>

      {/* Time */}
      <span className="text-xs text-zinc-500 font-mono w-10 flex-shrink-0">{fmt(currentTime)}</span>

      {/* Seek bar */}
      <div className="flex-1 relative group">
        <div className="relative h-1 bg-zinc-800 rounded-full cursor-pointer"
          onClick={e => {
            const rect = e.currentTarget.getBoundingClientRect()
            onSeek(((e.clientX - rect.left) / rect.width) * duration)
          }}
        >
          <div
            className="absolute inset-y-0 left-0 bg-violet-600 rounded-full transition-none"
            style={{ width: `${progress * 100}%` }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-violet-400 opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ left: `${progress * 100}%` }}
          />
        </div>
      </div>

      {/* Duration */}
      <span className="text-xs text-zinc-500 font-mono w-10 flex-shrink-0 text-right">{fmt(duration)}</span>

      {/* Track name + BPM */}
      <div className="flex items-center gap-2 flex-shrink-0 max-w-48">
        <span className="text-xs text-zinc-400 truncate">{trackName}</span>
        {bpm > 0 && (
          <span className="text-xs text-violet-400/70 font-mono flex-shrink-0">{bpm} BPM</span>
        )}
      </div>
    </div>
  )
}
