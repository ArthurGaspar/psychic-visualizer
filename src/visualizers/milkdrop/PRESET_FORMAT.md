# Milkdrop Preset Format

## File structure

Each file in `presets/*.json` has this shape:

```json
{
  "name": "Original preset name",
  "preset": { ... Milkdrop preset data ... },
  "config": { ... optional user-configurable parameters ... }
}
```

---

## How a preset runs — 4 layers per frame

### Layer 1 — `baseVals` (global starting values)

Plain floats read at preset-load time. Every frame, these reset to the stored values *before* the equation layers run. The most directly user-configurable part.

| Parameter | What it does |
|---|---|
| `decay` | How much the previous frame persists. 1.0 = infinite trail, 0.0 = fully cleared each frame |
| `gammaadj` | Overall brightness multiplier |
| `zoom` | Per-frame zoom factor. <1 = zooms out, >1 = zooms in |
| `warp` | Spatial distortion amount |
| `echo_zoom` | Zoom applied to the feedback layer |
| `rot` | Per-frame rotation speed |
| `sx` / `sy` | Per-frame x/y scale |
| `cx` / `cy` | Center point for rotation and scale |
| `wave_mode` | Waveform shape type (integer 0–7) |
| `wave_a` | Waveform opacity/brightness |
| `wave_scale` | Waveform size |
| `wave_smoothing` | How much to smooth the waveform |
| `wave_r/g/b` | Base waveform color (0–1 each; may be shifted by frame equations) |
| `ob_size` / `ob_a` | Outer border size and alpha |
| `ib_size` / `ib_a` | Inner border size and alpha |
| `mv_a` | Motion vector overlay alpha |
| `warpscale` | Scale of the warp effect |

**Important:** if `frame_eqs_str` uses `a.wave_r += ...`, the baseVal acts as a *bias*
that gets added to. Changing it shifts the oscillation center, not the absolute value.

---

### Layer 2 — `frame_eqs_str` (per-frame JavaScript equations)

Runs once per frame after baseVals are loaded. Can read and override any baseVal.

Available variables:
- `a.bass`, `a.mid`, `a.treb` — audio band energies (0–1)
- `a.vol` — overall volume (0–1)
- `a.time` — seconds elapsed
- `a.fps` — current frame rate
- Any key from `baseVals` via `a.<key>`

Example from *Airhandler*:
```javascript
a.wave_r += .5 * Math.sin(1.13 * a.time);
a.wave_g += .5 * Math.sin(1.23 * a.time);
a.wave_b += .5 * Math.sin(1.33 * a.time);
```
Three channels cycle with slightly different frequencies (`1.13`, `1.23`, `1.33`) and
amplitude `0.5` → slow rainbow color shift. These constants are what a "medium" config
slider would expose.

---

### Layer 3 — `pixel_eqs_str` (per-vertex equations)

Runs for every vertex of the render mesh (name is a legacy misnomer — not per pixel).

Additional variables:
- `a.rad` — distance from center, 0 (center) to 1 (edge)
- `a.ang` — angle from center, in radians
- `a.x` / `a.y` — vertex position

Can override `a.zoom`, `a.rot`, `a.sx`, `a.sy`, `a.cx`, `a.cy` *per vertex*, which
creates non-uniform warping (the image bends differently at different positions and radii).

Example from *Airhandler*:
```javascript
a.zoom += .05 * (Math.sin(6*a.ang) + .3*Math.sin(...) - .1*Math.cos(a.rad));
a.rot  += .5  * Math.sin(.5-a.rad) * Math.cos(.02*(.5-a.rad) + a.time);
```

---

### Layer 4 — `warp` and `comp` GLSL shaders

Raw WebGL fragment shaders. Highest visual impact, hardest to configure.

- **`warp`**: Distorts UV coordinates when sampling the previous frame. This is where
  the self-referential feedback loop happens — the image flows into itself. The `0.03`
  multiplier in *Airhandler*'s warp shader controls the feedback strength.

- **`comp`**: Final composite pass, runs last. Handles color grading, blur, noise, gamma.
  In *Airhandler*: samples at ±3.5 pixel offsets in 4 directions (an edge-enhance + blur
  hybrid), adds noise, then applies `pow(rgb, vec3(0.5, 0.8, 1.0))` — per-channel gamma
  that makes reds brighter and blues slightly darker.

---

## Config schema

The `config` field defines which parameters to expose as UI sliders or selects.
All three tiers are supported: `easy` changes `baseVals`, `medium` patches equation
strings, and `hard` patches GLSL shaders. See the tier descriptions below.

```json
"config": {
  "<baseVals key>": {
    "label": "Display name in UI",
    "min": 0.80,
    "max": 1.00,
    "default": 0.95,
    "step": 0.001,
    "type": "slider"
  },
  "wave_mode": {
    "label": "Wave Shape",
    "min": 0,
    "max": 7,
    "default": 1,
    "step": 1,
    "type": "select"
  }
}
```

| Field | Required | Description |
|---|---|---|
| `label` | yes | Display name shown in the UI |
| `min` | yes | Minimum value |
| `max` | yes | Maximum value |
| `default` | yes | Initial value (should match the preset's actual `baseVals` value) |
| `step` | yes | Slider increment |
| `type` | no | `"slider"` (default) or `"select"` |
| `tier` | no | `"easy"` (default), `"medium"`, or `"hard"` |
| `target` | medium/hard | `frame_eqs_str` / `pixel_eqs_str` for medium; `warp` / `comp` for hard |
| `replace` | medium/hard | Exact numeric literal text to replace in the target string |

---

## Difficulty tiers for per-preset config

### Easy — direct `baseVals` override
Change a float in `baseVals` before calling `butterchurn.loadPreset()`. Any `baseVals`
key that is *not* overridden by `frame_eqs_str` will stick for the whole session.
An additive equation (`+=`) uses the base value as a bias. A direct assignment
(`=`) replaces it entirely; do not expose such a key as an easy control.

### Medium — equation string constant patching
Replace numeric literals inside `frame_eqs_str` or `pixel_eqs_str` strings.
Example: expose the color-cycle speed by replacing `1.13` / `1.23` / `1.33` with a
user-supplied multiplier before loading the preset.

### Hard — GLSL shader templating
Replace numeric literals or add uniform variables inside the `warp` or `comp` GLSL
strings. Requires careful string surgery or a templating approach. Gives access to
blur radius, feedback strength, per-channel gamma, etc.

### Authoring checks

The current renderer uses literal `replaceAll`, not a numeric-token parser. Check
every occurrence: `0.02` also matches the start of `0.025`, for example. Whitespace
can help scope a literal when the original source contains it; several configs in
the Flexi batch deliberately include it in `replace`. Avoid constants whose
matches change unrelated operations or only some components of a color vector.
Replacements run sequentially, so also consider interactions between overrides.

Easy defaults use the stored base value or Butterchurn's fallback when omitted
(for example, border opacity defaults to zero). Other defaults must equal the original numeric values and retain sufficient precision
for the renderer's step-based formatting. Keep divisor minima above zero and
leave buffer indices, loop bounds, and structural shader constants alone.
Nested shape/wave equations and initialization equations are not supported targets.

## Alphabetical configuration progress

Configs are present through `flexi-area-51.json` in filename order. The latest
batch adds 84 controls across these five presets:

- `flexi-alien-fish-pond.json`
- `flexi-amandio-c-organic-random-mashup.json`
- `flexi-amandio-c-organic12-3d-2-milk.json`
- `flexi-amandio-c-piercing-05-kopie-2-kopie.json`
- `flexi-area-51.json`

Continue with `flexi-bouncing-balls-double-mindblob-neon-mix.json` next.
