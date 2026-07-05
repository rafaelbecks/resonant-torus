# Resonant Torus

Playground for **morphogenesis** of torus and torus-knot shapes, with shape-based acoustic analysis and external sound-engine integration.

A pure torus is treated as a single harmonic cavity — sine-like, high purity. Noise deformation creates bulges along the ring; each thick lump becomes a **resonance chamber** linked in a serial chain (connection tubes = narrow necks between lumps). The bottom panel shows a Pd-style patch network (`osc~` for one chamber, `reson~` per lump) and maps geometry to synthesis parameters.

## Quick start

```bash
npm install
npm start
```

Open [http://localhost:9990](http://localhost:9990)

## Layout

| Area | Purpose |
|------|---------|
| **Viewer (left)** | Three.js mesh, chamber markers, orbit + WASD walk |
| **Tools (right)** | Tweakpane — morphogenesis, viewer, acoustics, bridge |
| **Acoustics (bottom)** | Chamber network patch, summary metrics, chamber detail |

Drag the **vertical handle** on the tools panel edge to resize width. Drag the **horizontal handle** on the acoustics panel top edge to resize height. The acoustics body scrolls vertically when content overflows.

## Morphogenesis

1. Pick **torus** or **torusknot**, tune extent, tube, segments
2. Enable **Noise deformation** to bulge the surface along vertex normals
3. With **auto analyze** on (Acoustics folder), any Tweakpane morph change re-runs shape analysis after a short debounce
4. Click **Analyze shape** for a manual run
5. **Export GLB + JSON** bakes the current form + parameter snapshot

Exported GLB/JSON pairs can be archived under `glb/` for reuse in other tools.

## Shape analysis

Analysis lives in `src/acoustics/shapeAnalysis.js`:

- Samples the mesh ring (UV.u bins around the torus)
- Measures **outward bulge** vs the base shape along base normals
- Finds lump peaks and splits at thickness valleys
- Pure / uniform torus → **1 chamber**, `osc~`, high purity
- Deformed torus → **N chambers** chained around the ring

Chamber markers appear as colored points inside each bulge. Click a marker or a **reson~** module to select that chamber and fly the camera to it (**Viewer → chamber zoom** adjusts distance).

## Audio engine

The browser **does not synthesize audio** yet — it produces an **acoustic model** (JSON) from geometry. Your job is to pick a receiver and map that model to sound.

### Recommended path: SuperCollider

1. Install the [WebSocket Quark](https://github.com/adamhartley/WebSocket) in SuperCollider
2. Start the relay:

   ```bash
   npm run bridge
   ```

3. Evaluate `supercollider/ResonantTorus.scd` and run `~start.value`
4. In the app: **External bridge → connect** (default `ws://localhost:57120`)
5. Enable **auto send** or click **Send to SuperCollider** after analysis

Traffic:

- Browser → `ws://localhost:57120`
- SuperCollider → `ws://localhost:57121`

The SC patch spawns:

- A **partial stack** from `superCollider.partials` (harmonic bed)
- One **reson~** per chamber (`freq`, `amp`, `decay`, drift from lump geometry)
- **Route delays / coupling** between chained chambers

Key mapping code: `src/acoustics/acousticModel.js` → `toSuperColliderPayload()`.

### Other engines

The same JSON works for any client. Useful fields:

| Field | Meaning |
|-------|---------|
| `synthesis.fundamentalHz` | Body size → base pitch |
| `synthesis.partials` | Harmonic weights + detune |
| `chambers[]` | Per-lump freq, amplitude, decay, purity, drift |
| `network[]` | Serial coupling, throat width, delay between neighbors |
| `timbre.purity` / `modulation` | Global harmonic vs noisy character |
| `noiseMix` | Deformation amount sent to the engine |

**Pd / Max:** mirror the bottom patch — one `osc~` or `reson~` per module, `delread~` / `send~`/`receive~` for chain links.

**Web Audio / Tone.js:** `OscillatorNode` + `BiquadFilterNode` (resonant bandpass) per chamber; `DelayNode` on cross-chamber routes using `delayMs`.

**Rust / C++ / embedded:** consume the WebSocket payload or log `buildAcousticModel()` from a headless script.

### Next steps (audio)

- [ ] Decide primary runtime: SuperCollider, Pd, or in-browser Web Audio
- [ ] Drive chamber params in real time when morph sliders change (bridge already sends on analyze)
- [ ] Optional: continuous morph → throttled re-send (currently send-on-analyze only)
- [ ] Spatial panning from chamber `position` / `ringAngle`

## Payload example

```json
{
  "type": "acoustic_model",
  "shape": "torus",
  "noiseMix": 1,
  "timbre": { "purity": 0.55, "modulation": 0.45, "harmonicStack": "modulated" },
  "synthesis": { "fundamentalHz": 62.5, "partials": [[1, 1, 0], [2, 0.35, 0.01]], "noiseAmount": 0.22 },
  "chambers": [{ "id": 0, "frequency": 58.2, "amplitude": 0.4, "decay": 0.6, "position": [1.2, 0.3, 0] }],
  "network": [{ "from": 0, "to": 1, "coupling": 0.12, "delayMs": 18 }],
  "superCollider": { "cmd": "resonant_torus_update", "freq": 62.5, "partials": [], "chambers": [], "routes": [], "noise": 0.22 }
}
```

## Project structure

```
src/
  app.js                 — boot, analysis scheduling, camera focus
  acoustics/
    shapeAnalysis.js     — lump / chamber detection
    acousticModel.js     — geometry → synthesis + SC payload
    acousticPanel.js     — bottom panel UI
    chamberNetworkView.js — Pd-style patch diagram
    chamberPicker.js     — 3D chamber markers + picking
  morphogenesis/         — procedural torus / knot + noise deform
  scene/                 — Three.js viewer, HDR env, camera focus
  ui/                    — Tweakpane tools, panel resize, loading bars
bridge/server.js         — WebSocket relay to SuperCollider
supercollider/           — example receiver synthdefs
glb/                     — exported morphogenesis bakes (optional archive)
env/                     — HDR environments
```

## Controls

- **Orbit:** drag · **Zoom:** scroll
- **WASD:** walk (Shift+W/S vertical)
- **Chamber select:** click patch module or 3D marker → camera flies to chamber
- **Analyze shape:** manual analysis · **auto analyze:** on Tweakpane parameter change


## License

MIT
