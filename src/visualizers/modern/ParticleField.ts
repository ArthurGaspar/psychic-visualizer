import * as THREE from 'three'
import { BaseVisualizer, type AudioData, type ResolvedParams } from '../BaseVisualizer'
import { createPrng } from '../../seed/prng'

export class ParticleField extends BaseVisualizer {
  private canvas!: HTMLCanvasElement
  private renderer!: THREE.WebGLRenderer
  private scene!: THREE.Scene
  private camera!: THREE.PerspectiveCamera
  private points!: THREE.Points
  private positions!: Float32Array
  private velocities!: Float32Array
  private count = 0
  private beatFlash = 0

  init(container: HTMLDivElement, params: ResolvedParams) {
    this.canvas = document.createElement('canvas')
    this.canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%'
    container.appendChild(this.canvas)

    const W = container.clientWidth
    const H = container.clientHeight
    this.canvas.width = W
    this.canvas.height = H

    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true })
    this.renderer.setSize(W, H)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setClearColor(0x09090b, 1)

    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(60, W / H, 0.1, 100)
    this.camera.position.set(0, 0, 6)

    const rng = createPrng(params.seed)
    this.count = params.particleCount
    this.positions = new Float32Array(this.count * 3)
    this.velocities = new Float32Array(this.count * 3)

    for (let i = 0; i < this.count; i++) {
      const r = 1.5 + rng() * 2
      const theta = rng() * Math.PI * 2
      const phi = Math.acos(2 * rng() - 1)
      this.positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta)
      this.positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      this.positions[i * 3 + 2] = r * Math.cos(phi)
      this.velocities[i * 3]     = (rng() - 0.5) * 0.005
      this.velocities[i * 3 + 1] = (rng() - 0.5) * 0.005
      this.velocities[i * 3 + 2] = (rng() - 0.5) * 0.005
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3))

    const [r, g, b] = params.primaryColor
    const mat = new THREE.PointsMaterial({
      color: new THREE.Color(r, g, b),
      size: 0.035,
      transparent: true,
      opacity: 0.85,
      sizeAttenuation: true,
    })

    this.points = new THREE.Points(geo, mat)
    this.scene.add(this.points)
  }

  update(audioData: AudioData, params: ResolvedParams, _timeMs: number) {
    if (audioData.beat) this.beatFlash = 1
    this.beatFlash *= 0.88

    this.points.rotation.y += 0.0015 + audioData.mid * 0.008
    this.points.rotation.x += 0.0008 + audioData.bass * 0.004

    const targetRadius = 1.8 + audioData.bass * 2 + this.beatFlash * 1.5

    if (audioData.beat) {
      for (let i = 0; i < this.count; i++) {
        const x = this.positions[i * 3]
        const y = this.positions[i * 3 + 1]
        const z = this.positions[i * 3 + 2]
        const d = Math.sqrt(x * x + y * y + z * z) || 1
        this.velocities[i * 3]     += (x / d) * 0.12
        this.velocities[i * 3 + 1] += (y / d) * 0.12
        this.velocities[i * 3 + 2] += (z / d) * 0.12
      }
    }

    for (let i = 0; i < this.count; i++) {
      this.positions[i * 3]     += this.velocities[i * 3]
      this.positions[i * 3 + 1] += this.velocities[i * 3 + 1]
      this.positions[i * 3 + 2] += this.velocities[i * 3 + 2]

      this.velocities[i * 3]     *= 0.95
      this.velocities[i * 3 + 1] *= 0.95
      this.velocities[i * 3 + 2] *= 0.95

      // Attract back to sphere surface
      const x = this.positions[i * 3]
      const y = this.positions[i * 3 + 1]
      const z = this.positions[i * 3 + 2]
      const d = Math.sqrt(x * x + y * y + z * z) || 1
      const force = (targetRadius - d) * 0.0015
      this.velocities[i * 3]     += (x / d) * force
      this.velocities[i * 3 + 1] += (y / d) * force
      this.velocities[i * 3 + 2] += (z / d) * force
    }

    ;(this.points.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true

    const mat = this.points.material as THREE.PointsMaterial
    const [r, g, b] = params.primaryColor
    mat.color.setRGB(
      Math.min(1, r + audioData.treble * 0.4),
      Math.min(1, g + audioData.mid * 0.2),
      Math.min(1, b + this.beatFlash * 0.3),
    )
    mat.opacity = 0.7 + audioData.volume * 0.3 + this.beatFlash * 0.1

    this.renderer.render(this.scene, this.camera)
  }

  resize(width: number, height: number) {
    this.canvas.width = width
    this.canvas.height = height
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(width, height)
  }

  destroy() {
    this.renderer.dispose()
    this.canvas.remove()
  }
}
