import { BeatDetector } from './BeatDetector'

export interface AudioData {
  frequencyData: Uint8Array
  timeDomainData: Uint8Array
  volume: number
  bass: number
  mid: number
  treble: number
  beat: boolean
  bpm: number
}

const FFT_SIZE = 2048

export class AudioAnalyzer {
  private analyserNode: AnalyserNode
  private frequencyData: Uint8Array
  private timeDomainData: Uint8Array
  private beatDetector: BeatDetector

  constructor(audioContext: AudioContext) {
    this.analyserNode = audioContext.createAnalyser()
    this.analyserNode.fftSize = FFT_SIZE
    this.analyserNode.smoothingTimeConstant = 0.8
    const binCount = this.analyserNode.frequencyBinCount
    this.frequencyData = new Uint8Array(new ArrayBuffer(binCount))
    this.timeDomainData = new Uint8Array(new ArrayBuffer(binCount))
    this.beatDetector = new BeatDetector()
  }

  getNode(): AnalyserNode {
    return this.analyserNode
  }

  reset() {
    this.beatDetector.reset()
  }

  getData(nowMs: number): AudioData {
    // The TS dom lib requires Uint8Array<ArrayBuffer> for these methods.
    // Our Uint8Array is backed by a plain ArrayBuffer — the cast is safe.
    this.analyserNode.getByteFrequencyData(this.frequencyData as Uint8Array<ArrayBuffer>)
    this.analyserNode.getByteTimeDomainData(this.timeDomainData as Uint8Array<ArrayBuffer>)

    const binCount = this.frequencyData.length
    // Frequency bands for a typical 44100Hz / 2048 FFT (~43Hz per bin)
    const bassEnd = Math.floor(binCount * 0.05)  // 0–~220Hz
    const midEnd  = Math.floor(binCount * 0.36)  // ~220–~3096Hz

    const bass   = bandAverage(this.frequencyData, 0,       bassEnd)  / 255
    const mid    = bandAverage(this.frequencyData, bassEnd, midEnd)   / 255
    const treble = bandAverage(this.frequencyData, midEnd,  binCount) / 255

    let sumSq = 0
    for (let i = 0; i < this.timeDomainData.length; i++) {
      const s = (this.timeDomainData[i] - 128) / 128
      sumSq += s * s
    }
    const volume = Math.sqrt(sumSq / this.timeDomainData.length)

    return {
      frequencyData: this.frequencyData,
      timeDomainData: this.timeDomainData,
      volume,
      bass,
      mid,
      treble,
      beat: this.beatDetector.detect(bass, nowMs),
      bpm: this.beatDetector.getBpm(),
    }
  }
}

function bandAverage(data: Uint8Array, start: number, end: number): number {
  let sum = 0
  for (let i = start; i < end; i++) sum += data[i]
  return sum / (end - start)
}
