# ⚠️ EPILEPSY WARNING ⚠️

This project contains rapidly flashing lights, intense color patterns, and fast visual transitions.  
It may trigger seizures in individuals with photosensitive epilepsy.  
Viewer discretion is strongly advised.

---

A browser-based music visualizer. Drop in an audio file and watch it come alive.

---

## Features

- **19 built-in visualizers** across three categories — Classic, Milkdrop, and Modern
- **100 Milkdrop presets** with a searchable browser and per-preset configuration sliders
- **Two playback modes**: Full Auto (single visualizer, always on) and Pseudo Auto (timeline-driven transitions between visualizers)
- **Timeline editor** for Pseudo Auto — define segments, assign a visualizer and preset to each, set transition points
- **BPM detection** derived live from the audio stream
- **Seed-based generation** — the same seed always produces the same color palette and visual parameters
- **Focus mode** — hides all UI chrome; click anywhere to exit (`F` to toggle)
- **Fullscreen** — enters fullscreen and focus mode simultaneously
- **Save / Share** — encodes the current seed, visualizer, and config into a shareable state

---

## Visualizers

### Classic (Canvas 2D)

| Name | Description |
|------|-------------|
| Spectrum | Gradient spectrum bars + oscilloscope waveform |
| Spectrum Symmetric | Symmetric bars mirrored from the center axis |
| Spectrum Lite | Sparse minimal bars with a clean waveform |
| Spectrum Wide | Full-width gradient bars with waveform overlay |
| Scope | Glowing oscilloscope with a color trail |
| Scope Radial | Circular waveform radiating from the center |
| Scope Clean | Single thin waveform line, no trails |
| Scope Mirror | Mirrored waveform with frequency magnitude dots |
| Alchemy | Audio-reactive particle system with hue cycling |
| Alchemy Hex | Particles spawned from a hexagonal ring |
| Alchemy Lite | Subtle low-density particle drift |
| Alchemy Flow | Curl-field particle turbulence |
| Plenoptic | Psychedelic tunnel of concentric frequency rings |
| Plenoptic Petal | Hexagonal petal shapes in a depth tunnel |
| Plenoptic Clean | Minimal thin-stroke ring tunnel |
| Plenoptic Radial | Radial bar tunnel driven by frequency data |

### Milkdrop

100 community presets rendered in real time via [Butterchurn](#credits). Includes a searchable preset browser and a three-tier configuration system that lets you tweak individual presets live — from high-level values all the way down to GLSL shader constants.

### Modern (WebGL / Three.js)

| Name | Description |
|------|-------------|
| Particle Field | 3D particle sphere that pulses and explodes with the beat |
| Waveform Sculpture | 3D scrolling spectrogram mesh deformed by frequency data |

---

## Getting Started

```bash
npm install
npm run dev
```

Open `http://localhost:5173`, drop in an MP3, WAV, or FLAC file, and press play.

### Build

```bash
npm run build
```

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `F` | Toggle focus mode |
| `Escape` | Exit focus mode |

---

## Milkdrop Preset Configuration

Each preset can expose its own set of configurable parameters, defined in its JSON file (under `src/visualizers/milkdrop/presets/`) alongside the preset data.

Parameters use a `tier` field to describe how the value is applied at runtime:

```json
"decay":       { "min": 0.0, "max": 1.0, "default": 0.95, "step": 0.001,
                 "tier": "easy" },
"wave_r_freq": { "min": 0.0, "max": 5.0, "default": 1.13, "step": 0.01,
                 "tier": "medium", "target": "frame_eqs_str", "replace": "1.13" },
"comp_zoom":   { "min": 0.0, "max": 1.0, "default": 0.94, "step": 0.01,
                 "tier": "hard", "target": "comp", "replace": "0.94" }
```

| Tier | Mechanism |
|------|-----------|
| `easy` | Merged into `baseVals` before loading the preset |
| `medium` | Literal string replacement inside `frame_eqs_str` or `pixel_eqs_str` |
| `hard` | Literal string replacement inside the GLSL `warp` or `comp` shader |

---

## Stack

- [React 19](https://react.dev) + [TypeScript](https://www.typescriptlang.org)
- [Vite](https://vitejs.dev)
- [Tailwind CSS v4](https://tailwindcss.com)
- [Three.js](https://threejs.org) — modern 3D visualizers
- [Butterchurn](https://github.com/jberg/butterchurn) — Milkdrop rendering
- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API) — audio decoding, analysis, BPM

---

## Credits

### Butterchurn

The Milkdrop engine is powered by **[Butterchurn](https://github.com/jberg/butterchurn)**, a WebGL reimplementation of the Milkdrop visualization engine created by [Jordan Berg](https://github.com/jberg). Butterchurn translates the original DirectX/HLSL preset format into WebGL shaders that run entirely in the browser.

The presets bundled in this project originate from the [butterchurn-presets](https://github.com/jberg/butterchurn-presets) package and were extracted as individual JSON files to enable per-preset configuration. All preset content belongs to their respective authors.

### Milkdrop

**Milkdrop** was originally created by **Ryan Geiss** and released as a visualization plugin for [Winamp](https://www.winamp.com) in 2001. It was one of the first programs to use the GPU for real-time per-pixel audio-reactive effects, and it spawned a large community of preset authors whose work is still in active use today.

Milkdrop 2 (2007) introduced HLSL pixel and vertex shaders, enabling the complex warp, blur, and compositing effects seen in the presets included here. Ryan Geiss later released the source code, which has since powered ports across many platforms — Butterchurn being one of the most complete.

More about the original: [geisswerks.com/about_milkdrop.html](https://www.geisswerks.com/about_milkdrop.html)

---

## License

Source code: MIT.  
Milkdrop presets: owned by their individual authors; distributed here for non-commercial visualization use, consistent with the butterchurn-presets project.
