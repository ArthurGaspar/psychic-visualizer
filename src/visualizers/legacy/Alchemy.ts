import { BaseVisualizer, type AudioData, type ResolvedParams } from '../BaseVisualizer'
import { createPrng } from '../../seed/prng'

type Theme = 'psychedelic' | 'geometric' | 'minimal' | 'abstract'

interface Particle {
  x: number; y: number
  vx: number; vy: number
  life: number; maxLife: number
  size: number
  hue: number
}

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

export class Alchemy extends BaseVisualizer {
  private canvas!: HTMLCanvasElement
  private ctx!: CanvasRenderingContext2D
  private particles: Particle[] = []
  private hueOffset = 0
  private hueShift = 0
  private spawnAccum = 0

  constructor(private readonly theme: Theme = 'psychedelic') { super() }

  init(container: HTMLDivElement, params: ResolvedParams) {
    this.canvas = document.createElement('canvas')
    this.canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%'
    container.appendChild(this.canvas)
    this.ctx = this.canvas.getContext('2d')!
    const rng = createPrng(params.seed)
    this.hueOffset = rng() * 360
    this.hueShift  = rng() * 2 - 1
    this.resize(container.clientWidth, container.clientHeight)
  }

  update(audioData: AudioData, params: ResolvedParams, _timeMs: number) {
    const { canvas: c, ctx } = this
    const W = c.width, H = c.height
    const cx = W / 2, cy = H / 2

    const primaryHue = rgbToHue(params.primaryColor)
    const blendedHue = this.hueOffset + (primaryHue - this.hueOffset) * 0.15

    const alphaFade = this.theme === 'minimal' ? 0.25 : 0.18
    ctx.fillStyle = `rgba(9,9,11,${alphaFade})`
    ctx.fillRect(0, 0, W, H)

    this.hueOffset += this.hueShift * 0.25 + audioData.mid * 0.6

    const maxParticles = this.theme === 'minimal' ? Math.floor(params.particleCount * 0.2)
                       : this.theme === 'geometric' ? Math.floor(params.particleCount * 0.5)
                       : params.particleCount

    const rate = this.theme === 'minimal' ? 0.5 + audioData.volume * 2 : 2 + audioData.volume * 8
    this.spawnAccum += rate

    if (audioData.beat) {
      const burst = this.theme === 'minimal' ? 10 : 60
      for (let i = 0; i < burst; i++) {
        const angle = Math.random() * Math.PI * 2
        const speed = 2 + Math.random() * 5 + audioData.bass * (this.theme === 'minimal' ? 3 : 8)
        this.spawn(cx, cy, Math.cos(angle) * speed, Math.sin(angle) * speed, blendedHue, true)
      }
      this.spawnAccum = 0
    }

    if (this.theme === 'geometric') {
      while (this.spawnAccum >= 1) {
        this.spawnAccum--
        const slots = 6
        const slot = Math.floor(Math.random() * slots)
        const angle = (slot / slots) * Math.PI * 2
        const r = 40 + Math.random() * Math.min(W, H) * 0.2
        const speed = 0.3 + Math.random() * 1.5
        const vx = Math.cos(angle + Math.PI / 2) * speed
        const vy = Math.sin(angle + Math.PI / 2) * speed
        this.spawn(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r, vx, vy, blendedHue, false)
      }
    } else {
      while (this.spawnAccum >= 1) {
        this.spawnAccum--
        const angle = Math.random() * Math.PI * 2
        const r = 20 + Math.random() * Math.min(W, H) * 0.3
        const speed = 0.5 + Math.random() * 2 + audioData.volume * 3
        this.spawn(
          cx + Math.cos(angle) * r, cy + Math.sin(angle) * r,
          (Math.random() - 0.5) * speed, (Math.random() - 0.5) * speed,
          blendedHue, false,
        )
      }
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]
      p.life--
      if (p.life <= 0) { this.particles.splice(i, 1); continue }

      const dx = cx - p.x, dy = cy - p.y
      const dist = Math.sqrt(dx * dx + dy * dy) || 1
      const attraction = this.theme === 'minimal' ? 0.01 : 0.02 + audioData.bass * 0.06
      p.vx += (dx / dist) * attraction + (this.theme === 'abstract' ? Math.sin(p.y * 0.01) * 0.1 : 0)
      p.vy += (dy / dist) * attraction + (this.theme === 'abstract' ? Math.cos(p.x * 0.01) * 0.1 : 0)
      p.vx *= 0.97; p.vy *= 0.97
      p.x += p.vx + (this.theme === 'minimal' ? 0 : audioData.mid * (Math.random() - 0.5) * 1.5)
      p.y += p.vy + (this.theme === 'minimal' ? 0 : audioData.mid * (Math.random() - 0.5) * 1.5)

      const alpha = Math.pow(p.life / p.maxLife, 0.5)
      const sat = this.theme === 'minimal' ? 20 : 90
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.size * (0.5 + audioData.volume * 0.5), 0, Math.PI * 2)
      ctx.fillStyle = `hsla(${p.hue},${sat}%,70%,${alpha})`
      ctx.fill()

      if (alpha > 0.5 && this.theme !== 'minimal') {
        ctx.shadowColor = `hsl(${p.hue},90%,70%)`
        ctx.shadowBlur = 6
        ctx.fill()
        ctx.shadowBlur = 0
      }
    }

    if (this.particles.length > maxParticles) {
      this.particles.splice(0, this.particles.length - maxParticles)
    }
  }

  private spawn(x: number, y: number, vx: number, vy: number, baseHue: number, burst: boolean) {
    const life = burst ? 40 + Math.random() * 60 : 80 + Math.random() * 120
    this.particles.push({
      x, y, vx, vy,
      life, maxLife: life,
      size: burst ? 2 + Math.random() * 3 : 1 + Math.random() * 2,
      hue: (baseHue + Math.random() * 60 - 30 + 360) % 360,
    })
  }

  resize(width: number, height: number) {
    this.canvas.width = width
    this.canvas.height = height
  }

  destroy() { this.canvas.remove() }
}
