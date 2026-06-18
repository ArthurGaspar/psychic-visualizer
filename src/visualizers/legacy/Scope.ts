import { BaseVisualizer, type AudioData, type ResolvedParams } from '../BaseVisualizer'

type Theme = 'psychedelic' | 'geometric' | 'minimal' | 'abstract'

function css([r, g, b]: [number, number, number]): string {
  return `rgb(${(r * 255) | 0},${(g * 255) | 0},${(b * 255) | 0})`
}

function rgba([r, g, b]: [number, number, number], a: number): string {
  return `rgba(${(r * 255) | 0},${(g * 255) | 0},${(b * 255) | 0},${a})`
}

export class Scope extends BaseVisualizer {
  private canvas!: HTMLCanvasElement
  private ctx!: CanvasRenderingContext2D
  private beatFlash = 0
  private history: Float32Array[] = []
  private readonly TRAIL = 6

  constructor(private readonly theme: Theme = 'psychedelic') { super() }

  init(container: HTMLDivElement, _params: ResolvedParams) {
    this.canvas = document.createElement('canvas')
    this.canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%'
    container.appendChild(this.canvas)
    this.ctx = this.canvas.getContext('2d')!
    this.resize(container.clientWidth, container.clientHeight)
  }

  update(audioData: AudioData, params: ResolvedParams, _timeMs: number) {
    const { canvas: c, ctx } = this
    const W = c.width, H = c.height

    if (audioData.beat) this.beatFlash = 1
    this.beatFlash *= 0.88

    ctx.fillStyle = 'rgba(9,9,11,0.38)'
    ctx.fillRect(0, 0, W, H)

    switch (this.theme) {
      case 'geometric': this.drawRadial(audioData, W, H, params);  break
      case 'minimal':   this.drawClean(audioData, W, H, params);   break
      case 'abstract':  this.drawMirror(audioData, W, H, params);  break
      default:          this.drawTrail(audioData, W, H, params)
    }
  }

  private drawTrail(audioData: AudioData, W: number, H: number, params: ResolvedParams) {
    const { ctx } = this
    const color = css(params.primaryColor)

    const snap = new Float32Array(audioData.timeDomainData.length)
    for (let i = 0; i < snap.length; i++) snap[i] = (audioData.timeDomainData[i] / 128) - 1
    this.history.unshift(snap)
    if (this.history.length > this.TRAIL) this.history.pop()

    for (let t = this.history.length - 1; t >= 0; t--) {
      const alpha = ((this.TRAIL - t) / this.TRAIL) * (0.9 + this.beatFlash * 0.3)
      ctx.strokeStyle = rgba(params.primaryColor, alpha)
      ctx.lineWidth = t === 0 ? 2 + this.beatFlash * 1.5 : 1
      ctx.shadowColor = color
      ctx.shadowBlur = t === 0 ? 12 + this.beatFlash * 8 : 0
      ctx.beginPath()
      const sw = W / this.history[t].length
      for (let i = 0; i < this.history[t].length; i++) {
        const y = H / 2 + this.history[t][i] * (H / 2 - 24)
        i === 0 ? ctx.moveTo(i * sw, y) : ctx.lineTo(i * sw, y)
      }
      ctx.stroke()
    }
    ctx.shadowBlur = 0

    if (this.beatFlash > 0.05) {
      ctx.fillStyle = rgba(params.primaryColor, this.beatFlash * 0.08)
      ctx.fillRect(0, 0, W, H)
    }
  }

  private drawRadial(audioData: AudioData, W: number, H: number, params: ResolvedParams) {
    const { ctx } = this
    const cx = W / 2, cy = H / 2
    const baseR = Math.min(W, H) * 0.18
    const maxR  = Math.min(W, H) * 0.44
    const td = audioData.timeDomainData
    const fd = audioData.frequencyData

    ctx.strokeStyle = css(params.primaryColor)
    ctx.lineWidth = 2
    ctx.shadowColor = css(params.primaryColor)
    ctx.shadowBlur = 10 + this.beatFlash * 8
    ctx.beginPath()
    for (let i = 0; i <= td.length; i++) {
      const angle = (i / td.length) * Math.PI * 2
      const v = (td[i % td.length] / 128) - 1
      const r = baseR + (v + 1) * 0.5 * (maxR - baseR)
      ctx.lineTo(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r)
    }
    ctx.closePath()
    ctx.stroke()
    ctx.shadowBlur = 0

    ctx.strokeStyle = css(params.secondaryColor)
    ctx.lineWidth = 1
    ctx.beginPath()
    const halfBins = Math.floor(fd.length / 2)
    for (let i = 0; i <= halfBins; i++) {
      const angle = (i / halfBins) * Math.PI * 2
      const r = baseR * (0.25 + (fd[i] / 255) * 0.75)
      ctx.lineTo(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r)
    }
    ctx.closePath()
    ctx.stroke()
  }

  private drawClean(audioData: AudioData, W: number, H: number, params: ResolvedParams) {
    const { ctx } = this
    this.history = []
    ctx.strokeStyle = rgba(params.primaryColor, 0.8)
    ctx.lineWidth = 1
    ctx.beginPath()
    const td = audioData.timeDomainData
    const sw = W / td.length
    for (let i = 0; i < td.length; i++) {
      const y = H / 2 + ((td[i] / 128) - 1) * (H / 2 - 30)
      i === 0 ? ctx.moveTo(i * sw, y) : ctx.lineTo(i * sw, y)
    }
    ctx.stroke()
  }

  private drawMirror(audioData: AudioData, W: number, H: number, params: ResolvedParams) {
    const { ctx } = this
    const td = audioData.timeDomainData
    const fd = audioData.frequencyData
    const sw = W / td.length

    ctx.lineWidth = 1.5
    ctx.shadowBlur = 5

    ctx.strokeStyle = css(params.primaryColor)
    ctx.shadowColor = css(params.primaryColor)
    ctx.beginPath()
    for (let i = 0; i < td.length; i++) {
      const y = H / 2 + ((td[i] / 128) - 1) * (H / 2 - 20)
      i === 0 ? ctx.moveTo(i * sw, y) : ctx.lineTo(i * sw, y)
    }
    ctx.stroke()

    ctx.strokeStyle = css(params.secondaryColor)
    ctx.shadowColor = css(params.secondaryColor)
    ctx.beginPath()
    for (let i = 0; i < td.length; i++) {
      const y = H / 2 - ((td[i] / 128) - 1) * (H / 2 - 20)
      i === 0 ? ctx.moveTo(i * sw, y) : ctx.lineTo(i * sw, y)
    }
    ctx.stroke()
    ctx.shadowBlur = 0

    const step = Math.max(1, Math.floor(fd.length / 128))
    ctx.fillStyle = rgba(params.primaryColor, 0.35 + audioData.bass * 0.3)
    for (let i = 0; i < fd.length; i += step) {
      const x = (i / fd.length) * W
      const r = (fd[i] / 255) * 4
      ctx.beginPath()
      ctx.arc(x, H / 2, r, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  resize(width: number, height: number) {
    this.canvas.width = width
    this.canvas.height = height
    this.history = []
  }

  destroy() { this.canvas.remove() }
}
