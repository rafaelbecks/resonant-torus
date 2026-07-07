# Resonant Organism

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

1. Pick **torus**, **torus knot**, or a **minimal surface** (Costa, Chen–Gackstätter, López–Ros)
2. Tune extent, segments, and shape-specific parameters (folders appear only for the active shape)
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


## License

MIT
