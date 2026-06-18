const HISTORY_SIZE = 43    // ~1 second at 60fps
const BEAT_THRESHOLD = 1.4 // energy must exceed 1.4× the recent average
const COOLDOWN_MS = 280    // min ms between registered beats

export class BeatDetector {
  private history: number[] = []
  private lastBeatTime = 0
  private beatIntervals: number[] = []
  private bpm = 0

  detect(bassEnergy: number, nowMs: number): boolean {
    this.history.push(bassEnergy)
    if (this.history.length > HISTORY_SIZE) this.history.shift()

    const avg = this.history.reduce((a, b) => a + b, 0) / this.history.length
    const isBeat =
      bassEnergy > BEAT_THRESHOLD * avg &&
      nowMs - this.lastBeatTime > COOLDOWN_MS

    if (isBeat) {
      if (this.lastBeatTime > 0) {
        const interval = nowMs - this.lastBeatTime
        this.beatIntervals.push(interval)
        if (this.beatIntervals.length > 16) this.beatIntervals.shift()
        this.updateBpm()
      }
      this.lastBeatTime = nowMs
    }

    return isBeat
  }

  getBpm(): number {
    return this.bpm
  }

  reset() {
    this.history = []
    this.lastBeatTime = 0
    this.beatIntervals = []
    this.bpm = 0
  }

  private updateBpm() {
    if (this.beatIntervals.length < 4) return
    const sorted = [...this.beatIntervals].sort((a, b) => a - b)
    const median = sorted[Math.floor(sorted.length / 2)]
    this.bpm = Math.round(60000 / median)
  }
}
