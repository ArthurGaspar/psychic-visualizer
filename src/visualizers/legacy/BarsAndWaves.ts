import { BaseVisualizer, type AudioData, type ResolvedParams } from '../BaseVisualizer'

type Theme = 'psychedelic' | 'geometric' | 'minimal' | 'abstract'

function css([r, g, b]: [number, number, number]): string {
  return `rgb(${(r * 255) | 0},${(g * 255) | 0},${(b * 255) | 0})`
}

export class BarsAndWaves extends BaseVisualizer {
  private canvas!: HTMLCanvasElement
  private ctx!: CanvasRenderingContext2D
  private beatFlash = 0

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
    this.beatFlash *= 0.85

    ctx.fillStyle = this.theme === 'minimal' ? 'rgba(9,9,11,0.6)' : `rgba(9,9,11,${0.28 + this.beatFlash * 0.15})`
    ctx.fillRect(0, 0, W, H)

    switch (this.theme) {
      case 'geometric': this.drawGeometric(audioData, W, H, params); break
      case 'minimal':   this.drawMinimal(audioData, W, H, params);   break
      case 'abstract':  this.drawAbstract(audioData, W, H, params);  break
      default:          this.drawPsychedelic(audioData, W, H, params)
    }

    if (this.beatFlash > 0.05 && this.theme !== 'minimal') {
      ctx.fillStyle = `rgba(255,255,255,${this.beatFlash * 0.05})`
      ctx.fillRect(0, 0, W, H)
    }
  }

  private drawPsychedelic(audioData: AudioData, W: number, H: number, params: ResolvedParams) {
    const { ctx } = this
    const halfW = W / 2
    const c1 = css(params.primaryColor)
    const c2 = css(params.secondaryColor)
    const freqData = audioData.frequencyData
    const barCount = 64
    const barW = (halfW / barCount) - 1

    for (let i = 0; i < barCount; i++) {
      const bin = Math.floor((i / barCount) * freqData.length * 0.5)
      const barH = (freqData[bin] / 255) * H * 0.9
      const grad = ctx.createLinearGradient(0, H, 0, H - barH)
      grad.addColorStop(0, c1)
      grad.addColorStop(1, c2)
      ctx.fillStyle = grad
      ctx.fillRect(i * (barW + 1), H - barH, barW, barH)
    }

    ctx.strokeStyle = '#ffffff18'
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(halfW, 0); ctx.lineTo(halfW, H); ctx.stroke()

    const timeData = audioData.timeDomainData
    ctx.strokeStyle = c2
    ctx.lineWidth = 2
    ctx.shadowColor = c2
    ctx.shadowBlur = 8
    ctx.beginPath()
    const sw = halfW / timeData.length
    for (let i = 0; i < timeData.length; i++) {
      const y = H / 2 + ((timeData[i] / 128) - 1) * (H / 2 - 20)
      i === 0 ? ctx.moveTo(halfW + i * sw, y) : ctx.lineTo(halfW + i * sw, y)
    }
    ctx.stroke()
    ctx.shadowBlur = 0
  }

  private drawGeometric(audioData: AudioData, W: number, H: number, params: ResolvedParams) {
    const { ctx } = this
    const c1 = css(params.primaryColor)
    const c2 = css(params.secondaryColor)
    const freqData = audioData.frequencyData
    const barCount = 48
    const barW = W / barCount
    const cy = H / 2

    for (let i = 0; i < barCount; i++) {
      const bin = Math.floor((i / barCount) * freqData.length * 0.5)
      const barH = (freqData[bin] / 255) * H * 0.44
      ctx.fillStyle = i % 2 === 0 ? c1 : c2
      ctx.fillRect(i * barW + 1, cy - barH, barW - 2, barH)
      ctx.fillRect(i * barW + 1, cy, barW - 2, barH)
    }

    ctx.strokeStyle = '#ffffff22'
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(W, cy); ctx.stroke()
  }

  private drawMinimal(audioData: AudioData, W: number, H: number, params: ResolvedParams) {
    const { ctx } = this
    const [r, g, b] = params.primaryColor
    const freqData = audioData.frequencyData
    const barCount = 32
    const halfW = W / 2
    const barW = (halfW / barCount) - 2

    ctx.fillStyle = `rgba(${(r * 255) | 0},${(g * 255) | 0},${(b * 255) | 0},0.8)`
    for (let i = 0; i < barCount; i++) {
      const bin = Math.floor((i / barCount) * freqData.length * 0.5)
      const barH = (freqData[bin] / 255) * H * 0.85
      ctx.fillRect(i * (barW + 2), H - barH, barW, barH)
    }

    const timeData = audioData.timeDomainData
    ctx.strokeStyle = `rgba(${(r * 255) | 0},${(g * 255) | 0},${(b * 255) | 0},0.55)`
    ctx.lineWidth = 1
    ctx.beginPath()
    const sw = halfW / timeData.length
    for (let i = 0; i < timeData.length; i++) {
      const y = H / 2 + ((timeData[i] / 128) - 1) * (H / 2 - 20)
      i === 0 ? ctx.moveTo(halfW + i * sw, y) : ctx.lineTo(halfW + i * sw, y)
    }
    ctx.stroke()
  }

  private drawAbstract(audioData: AudioData, W: number, H: number, params: ResolvedParams) {
    const { ctx } = this
    const c1 = css(params.primaryColor)
    const c2 = css(params.secondaryColor)
    const [r, g, b] = params.primaryColor
    const freqData = audioData.frequencyData
    const barCount = 64
    const barW = W / barCount
    const cy = H / 2

    for (let i = 0; i < barCount; i++) {
      const bin = Math.floor((i / barCount) * freqData.length * 0.5)
      const barH = (freqData[bin] / 255) * H * 0.42
      const grad = ctx.createLinearGradient(0, cy - barH, 0, cy + barH)
      grad.addColorStop(0, c2)
      grad.addColorStop(0.5, c1)
      grad.addColorStop(1, c2)
      ctx.fillStyle = grad
      ctx.fillRect(i * barW, cy - barH, barW - 1, barH * 2)
    }

    const timeData = audioData.timeDomainData
    ctx.strokeStyle = `rgba(${(r * 255) | 0},${(g * 255) | 0},${(b * 255) | 0},0.45)`
    ctx.lineWidth = 1.5
    ctx.shadowColor = c1
    ctx.shadowBlur = 4
    ctx.beginPath()
    const sw = W / timeData.length
    for (let i = 0; i < timeData.length; i++) {
      const y = cy + ((timeData[i] / 128) - 1) * (H / 2 - 20)
      i === 0 ? ctx.moveTo(i * sw, y) : ctx.lineTo(i * sw, y)
    }
    ctx.stroke()
    ctx.shadowBlur = 0
  }

  resize(width: number, height: number) {
    this.canvas.width = width
    this.canvas.height = height
  }

  destroy() { this.canvas.remove() }
}
