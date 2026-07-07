# SuperCollider audio engine

Exciter-driven **chamber network** (tube bore + waveguide links) driven by the browser `acoustic_model` JSON.

**No quarks** — models arrive via OSC from the Node bridge.

Optional: [sc3-plugins](https://github.com/supercollider/sc3-plugins) for `MembraneHexagon` (membrane mode).

## Quick start

```bash
npm run bridge    # terminal 1
npm start         # terminal 2 → http://localhost:9990
```

1. Open SuperCollider IDE
2. Evaluate **`ResonantTorus.scd`** (whole file — loads libs via `~rtStartup`)
3. Tools → **External bridge** → connect + auto send
4. Analyze / morph shapes in the browser

OSC: `/resonant_torus/model` on UDP **57124** (bridge WS **57120**).

Test without browser: `npm run bridge:test`

## Signal flow

```
Browser ──ws:57120──► bridge ──OSC/57124──► SuperCollider
```

```
[Exciter] → chambers (tube resonators) → master bus
              ↑ links (delay + BPF) ──────┘   (feedforward only, no ring feedback)
         partials / noise beds ──────────────► rt_master → out
```

**Defaults:** pink exciter, tube chamber mode, partials/noise mix 0.  
**Output:** Soundflower (fallback BlackHole) — change in GUI → Apply, or `~rtRebootAudio.value`.

## Browser ↔ SC

| Browser | Payload |
|---------|---------|
| Pitch multiplier (Tools → Acoustics) | scales `freq` / chamber freqs |
| Chamber toggles (network view) | `chambers[].gate` (0/1) |
| Analyze shape | full rebuild; toggles reset |
| Pitch-only rebuild | topology kept, gates preserved |

Engine clamps heavy shapes: **max 8 chambers**, freqs **40–1200 Hz**, capped link coupling.

## GUI

Exciter: **pink** / dust / noise  
Chamber mode: **tube** / modal / waveguide / membrane / multimodal  
Mix sliders: chambers / partials / noise bed

## Layout

| File | Role |
|------|------|
| `ResonantTorus.scd` | Entry: `~rtStartup`, `~rtCleanup` |
| `lib/RTAudio.scd` | Output device (Soundflower / BlackHole) |
| `lib/RTDefs.scd` | SynthDefs (exciter, chamber, link, master) |
| `lib/RTEngine.scd` | JSON parse, graph build, model clamp |
| `lib/RTOSC.scd` | OSC + coalesced updates |
| `lib/RTGui.scd` | Live controls |

## Commands

```supercollider
~rtShowGui.value;
~rtPrintOutputDevices.value;
~rtRebootAudio.value;
~rtCleanup.value;
```

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| No sound on eval | Re-eval full `ResonantTorus.scd` (not individual lib files) |
| GUI missing | `~rtShowGui.value` |
| Browser updates ignored | Bridge running? Connect enabled? Post shows `RT OSC recv` |
| Audio stops, no post error | scsynth died — re-eval `ResonantTorus.scd`; check `RT: scsynth exited` |
| Torus knot silent / crash | Engine caps topology; try fewer chambers in browser or lower pitch mult |
| Clicks / CoreAudio hang | Quit SC; `killall coreaudiod` if macOS audio stuck |
| UDP port in use | `~rtCleanup.value` or restart SC IDE |

## Payload (`data.superCollider`)

| Field | Maps to |
|-------|---------|
| `freq` | f0, exciter pitch |
| `partials` | `[[harmonic, amp, detune_cents], …]` |
| `chambers[]` | `{ id, freq, amp, decay, thickness, drift, gate, … }` |
| `routes[]` | `{ from, to, coupling, delayMs, throat }` |
| `noise` | noise bed level |
