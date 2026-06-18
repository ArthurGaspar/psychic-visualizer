import * as THREE from 'three'
import { BaseVisualizer, type AudioData, type ResolvedParams } from '../BaseVisualizer'

const COLS = 128   // frequency bins displayed
const ROWS = 48    // history frames (waterfall depth)

export class WaveformSculpture extends BaseVisualizer {
  private canvas!: HTMLCanvasElement
  private renderer!: THREE.WebGLRenderer
  private scene!: THREE.Scene
  private camera!: THREE.PerspectiveCamera
  private mesh!: THREE.Mesh
  private geometry!: THREE.PlaneGeometry
  private heightHistory: Float32Array[] = []
  private cameraAngle = 0

  init(container: HTMLDivElement, params: ResolvedParams) {
    this.canvas = document.createElement('canvas')
    this.canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%'
    container.appendChild(this.canvas)

    const W = container.clientWidth
    const H = container.clientHeight
    this.canvas.width = W
    this.canvas.height = H

    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true })
    this.renderer.setSize(W, H)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setClearColor(0x09090b, 1)

    this.scene = new THREE.Scene()
    this.scene.fog = new THREE.Fog(0x09090b, 8, 20)

    this.camera = new THREE.PerspectiveCamera(55, W / H, 0.1, 100)
    this.camera.position.set(0, 4, 8)
    this.camera.lookAt(0, 0, 0)

    // PlaneGeometry: width=COLS segments, depth=ROWS segments
    this.geometry = new THREE.PlaneGeometry(10, 10, COLS - 1, ROWS - 1)
    this.geometry.rotateX(-Math.PI / 2)

    const [r, g, b] = params.primaryColor
    const [r2, g2, b2] = params.secondaryColor

    const material = new THREE.MeshPhongMaterial({
      vertexColors: false,
      color: new THREE.Color(r, g, b),
      emissive: new THREE.Color(r2 * 0.3, g2 * 0.3, b2 * 0.3),
      wireframe: false,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
      shininess: 80,
    })

    this.mesh = new THREE.Mesh(this.geometry, material)
    this.scene.add(this.mesh)

    // Lighting
    const ambient = new THREE.AmbientLight(0x111122, 1.5)
    this.scene.add(ambient)
    const dirLight = new THREE.DirectionalLight(new THREE.Color(r, g, b), 2)
    dirLight.position.set(5, 10, 5)
    this.scene.add(dirLight)
    const fillLight = new THREE.DirectionalLight(new THREE.Color(r2, g2, b2), 1)
    fillLight.position.set(-5, 3, -5)
    this.scene.add(fillLight)

    // Pre-fill history with silence
    for (let i = 0; i < ROWS; i++) {
      this.heightHistory.push(new Float32Array(COLS))
    }
  }

  update(audioData: AudioData, params: ResolvedParams, _timeMs: number) {
    // Shift history: drop oldest, push newest frequency slice
    this.heightHistory.shift()
    const slice = new Float32Array(COLS)
    for (let c = 0; c < COLS; c++) {
      const binIndex = Math.floor((c / COLS) * audioData.frequencyData.length * 0.5)
      slice[c] = (audioData.frequencyData[binIndex] / 255) * 2.5
    }
    this.heightHistory.push(slice)

    // Update vertex Y positions from history
    const pos = this.geometry.attributes.position as THREE.BufferAttribute
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const vertIndex = r * COLS + c
        pos.setY(vertIndex, this.heightHistory[r][c])
      }
    }
    pos.needsUpdate = true
    this.geometry.computeVertexNormals()

    // Slowly orbit camera
    this.cameraAngle += 0.002 + audioData.mid * 0.005
    const camR = 9 + audioData.bass * 1.5
    this.camera.position.set(
      Math.sin(this.cameraAngle) * camR,
      4 + audioData.volume * 2,
      Math.cos(this.cameraAngle) * camR,
    )
    this.camera.lookAt(0, 0.5, 0)

    // Update material color based on audio
    const mat = this.mesh.material as THREE.MeshPhongMaterial
    const [r1, g1, b1] = params.primaryColor
    mat.color.setRGB(
      Math.min(1, r1 + audioData.treble * 0.3),
      Math.min(1, g1 + audioData.mid * 0.1),
      Math.min(1, b1 + audioData.bass * 0.2),
    )
    mat.emissiveIntensity = 0.5 + audioData.volume * 1.5

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
    this.geometry.dispose()
    ;(this.mesh.material as THREE.Material).dispose()
    this.renderer.dispose()
    this.canvas.remove()
  }
}
