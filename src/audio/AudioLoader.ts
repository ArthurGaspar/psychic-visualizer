export interface TrackInfo {
  name: string
  duration: number
  buffer: AudioBuffer
}

export async function loadAudioFile(
  file: File,
  audioContext: AudioContext,
): Promise<TrackInfo> {
  const arrayBuffer = await file.arrayBuffer()
  const buffer = await audioContext.decodeAudioData(arrayBuffer)
  return {
    name: file.name.replace(/\.[^/.]+$/, ''),
    duration: buffer.duration,
    buffer,
  }
}
