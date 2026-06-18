declare module 'butterchurn' {
  export interface MilkdropVisualizer {
    connectAudio(node: AudioNode): void
    loadPreset(preset: object, transitionTime: number): void
    setRendererSize(width: number, height: number): void
    render(): void
  }

  const butterchurn: {
    createVisualizer(
      audioContext: AudioContext,
      canvas: HTMLCanvasElement,
      options: { width: number; height: number; pixelRatio?: number }
    ): MilkdropVisualizer
  }

  export default butterchurn
}

declare module 'butterchurn-presets' {
  const butterchurnPresets: {
    getPresets(): Record<string, object>
  }
  export default butterchurnPresets
}
