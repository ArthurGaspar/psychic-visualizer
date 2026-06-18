import { BaseVisualizer, type AudioData, type ResolvedParams } from '../BaseVisualizer'
import { createPrng } from '../../seed/prng'

type Theme = 'psychedelic' | 'geometric' | 'minimal' | 'abstract'

function rgbToHue([r, g, b]: [number, number, number]): number {
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  if (max === min) return 0
  const d = max - min
  let h = 0
  if (max === r)      h = ((g - b) / d + (g < b ? 6 : 0)) * 60
  else if (max === g) h = ((b - r) / d + 2) * 60
  else                h = ((r - g) / d + 4) * 60
  return h
}

export class Plenoptic extends BaseVisualizer {
  private canvas!: HTMLCanvasElement
  private ctx!: CanvasRenderingContext2D
  private tunnelZ = 0
  private baseHue = 0
  private seedPatternMode = 0
  private beatPulse = 0

  constructor(private readonly theme: Theme = 'psychedelic') { super() }

  init(container: HTMLDivElement, params: ResolvedParams) {
    this.canvas = document.createElement('canvas')
    this.canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%'
    container.appendChild(this.canvas)
    this.ctx = this.canvas.getContext('2d')!
    const rng = createPrng(params.seed)
    this.baseHue = rng() * 360
    this.seedPatternMode = Math.floor(rng() * 3)
    this.resize(container.clientWidth, container.clientHeight)
  }

  update(audioData: AudioData, params: ResolvedParams, timeMs: number) {
    const { canvas: c, ctx } = this
    const W = c.width, H = c.height
    const cx = W / 2, cy = H / 2
    const t = timeMs / 1000

    if (audioData.beat) this.beatPulse = 1
    this.beatPulse *= 0.9

    const primaryHue = rgbToHue(params.primaryColor)
    this.baseHue += (primaryHue - this.baseHue) * 0.01 + 0.15 * params.animationSpeed

    this.tunnelZ += 0.3 + audioData.bass * 2 + this.beatPulse * 3

    ctx.fillStyle = 'rgba(9,9,11,0.25)'
    ctx.fillRect(0, 0, W, H)

    const freqData = audioData.frequencyData
    const maxR = Math.sqrt(cx * cx + cy * cy) * 1.2

    let patternMode = this.seedPatternMode
    if (this.theme === 'geometric') patternMode = 1
    if (this.theme === 'minimal')   patternMode = 3
    if (this.theme === 'abstract')  patternMode = 2

    const ringCount = this.theme === 'minimal' ? 6 : 32

    for (let i = ringCount; i >= 0; i--) {
      const phase = (i / ringCount + this.tunnelZ * 0.02) % 1
      const radius = (1 - phase) * maxR
      const binIndex = Math.floor((i / ringCount) * freqData.length * 0.5)
      const amp = freqData[binIndex] / 255

      const hue = (this.baseHue + i * (360 / ringCount) + t * 15) % 360
      const sat = 75 + amp * 25
      const lit = 28 + amp * 42 + this.beatPulse * 18

      if (patternMode === 3) {
        ctx.strokeStyle = `hsla(${hue},${sat}%,${lit}%,${0.6 + amp * 0.4})`
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.arc(cx, cy, Math.max(1, radius * (1 + amp * 0.05)), 0, Math.PI * 2)
        ctx.stroke()
      } else if (patternMode === 0) {
        ctx.beginPath()
        ctx.arc(cx, cy, Math.max(1, radius * (1 + amp * 0.1)), 0, Math.PI * 2)
        ctx.strokeStyle = `hsla(${hue},${sat}%,${lit}%,${0.5 + amp * 0.5})`
        ctx.lineWidth = (radius / ringCount) * 1.2
        ctx.stroke()
      } else if (patternMode === 1) {
        const petals = 6
        ctx.beginPath()
        for (let p = 0; p <= petals; p++) {
          const angle = (p / petals) * Math.PI * 2 + t * 0.3
          const r = radius * (1 + amp * 0.25 * Math.sin(p * 3 + t))
          const x = cx + Math.cos(angle) * r
          const y = cy + Math.sin(angle) * r
          p === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
        }
        ctx.strokeStyle = `hsla(${hue},${sat}%,${lit}%,${0.5 + amp * 0.4})`
        ctx.lineWidth = 1.5
        ctx.closePath()
        ctx.stroke()
      } else {
        const bars = 48
        for (let b = 0; b < bars; b++) {
          const angle = (b / bars) * Math.PI * 2
          const bAmp = freqData[Math.floor((b / bars) * freqData.length * 0.5)] / 255
          const innerR = radius * 0.6
          const outerR = radius * (0.6 + bAmp * 0.4)
          ctx.beginPath()
          ctx.moveTo(cx + Math.cos(angle) * innerR, cy + Math.sin(angle) * innerR)
          ctx.lineTo(cx + Math.cos(angle) * outerR, cy + Math.sin(angle) * outerR)
          ctx.strokeStyle = `hsla(${hue + b * 2},${sat}%,${lit}%,0.55)`
          ctx.lineWidth = (Math.PI * 2 * radius) / bars * 0.6
          ctx.stroke()
        }
      }
    }

    if (this.beatPulse > 0.1) {
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 80 + this.beatPulse * 40)
      const [r, g, b] = params.primaryColor
      grad.addColorStop(0, `rgba(${(r*255)|0},${(g*255)|0},${(b*255)|0},${this.beatPulse * 0.8})`)
      grad.addColorStop(1, 'transparent')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, W, H)
    }
  }

  resize(width: number, height: number) {
    this.canvas.width = width
    this.canvas.height = height
  }

  destroy() { this.canvas.remove() }
}
