import { useRef, useState } from 'react'

interface Props {
  onFile: (file: File) => void
}

export function DropZone({ onFile }: Props) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith('audio/')) onFile(file)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) onFile(file)
  }

  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer select-none"
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={handleChange}
      />

      <div
        className={`
          flex flex-col items-center gap-4 p-12 rounded-2xl border-2 border-dashed transition-all duration-200
          ${dragging
            ? 'border-violet-400 bg-violet-500/10 scale-105'
            : 'border-zinc-700 bg-zinc-900/50 hover:border-violet-500/50 hover:bg-zinc-900'}
        `}
      >
        <svg className={`w-16 h-16 transition-colors ${dragging ? 'text-violet-400' : 'text-zinc-600'}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
        </svg>

        <div className="text-center">
          <p className="text-lg font-medium text-zinc-300">
            {dragging ? 'Drop it!' : 'Drop an audio file'}
          </p>
          <p className="text-sm text-zinc-600 mt-1">or click to browse</p>
          <p className="text-xs text-zinc-700 mt-2">MP3 · WAV · FLAC · OGG · AAC</p>
        </div>
      </div>
    </div>
  )
}
