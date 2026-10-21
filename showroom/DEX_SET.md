# Dex DJ set (Owl Cove Tiki Nest) by Motion God

These are beat-normalized clips for Clay's rigged Dex. They use the existing rig and booth joints, with **no new meshes and no new draws** (the cantina stays at 24/25).

| File | What it is |
|---|---|
| `showroom/dex-set.js` | Drop-in module. It holds the clip definitions, a two-bone IK baker (pure math, also runs in node), the three.js runtime layer and the cue map. |
| `showroom/dex-set.patch` | **Optional and unapplied** integration for `dj.js` (+13 lines) and `showroom.js` (+2 lines). Apply it with `patch -p1 < showroom/dex-set.patch` from `loft-xr/`. With `rig.dexSet` unset, dj.js runs exactly as before. |
| `assets/builds-opt/cantina_robot_dex_set.glb`, `_set_lod1.glb` | Copies of Clay's glbs with the 8 new clips baked in at the default targets. Clay's 4 clips are kept. These are optional, because the module bakes at runtime. The manifest is not changed. |
| `showroom/qa/dex-set/` | Proof images: `contact-front.png` / `contact-top.png` / `contact-side.png` (every clip at 5 beats), `dex-set-run.mp4` and `dex-set-run-frames.png` (cue-map run: groove, decks, point, build, cut, plus a request wave), `showroom-patched-live.png` (the patched showroom, live). |

## Clips (time unit = beats)

The **BODY** layer covers torso, head and antenna. The **ARMS** layer covers armR/foreR/armL/foreL. The two layers never share a joint, so both run at weight 1.
Every arm clip **starts and ends at home** (right hand on deck A, left hand on deck B). That makes switching on an 8-beat line seamless. The first key equals the last key on every track.

| Clip | Layer | Beats | Loop | What it does |
|---|---|---|---|---|
| `groove_nod_bounce` | body | 4 | yes | The head nod lands on every beat (0.7-beat rise, 0.3-beat drop). The torso bounces with a lean of 0.035 to 0.055 rad (3° max), plus a 2-beat side sway and a 4-beat twist. The antenna lags the head by 0.2 beat. The root bob is 0 to −1.2 cm, dipping on the beat. |
| `hands_home` | arms | 4 | yes | Both hands ride their records with a small nudge. Used when idle or not playing. |
| `decks_work_AB` | arms | 8 | yes | Default. Beats 0 to 4: the L hand goes from B to the crossfader (slide), then back to B, while R rides A. Beats 4 to 8: the mirror (R goes to the fader, L rides B). |
| `xfader_cut` | arms | 8 | yes | The L hand cuts the fader in 8ths (pattern `10110101`, 3.3 cm throw, 0.12-beat eased flicks) while R holds a slow push on A. |
| `scratch_build_R` | arms | 8 | yes | R scratches deck A over 16 eighths: baby ×4, tear, drag, chirps. L works the fader in sync (open on forward strokes). This replaces `scratch_R`, which had no fader hand and was not beat-normalized. |
| `scratch_build_L` | arms | 8 | yes | The exact mirror: L scratches deck B and R cuts. |
| `crowd_point` | arms | 8 | 2-bar one-shot (bar-locked) | The L hand rises over 2 beats to a raised hand toward the crowd (up about 30°, out about 20°, stopping above the decks). It pumps 2 cm on the beat and drifts 6 cm, then returns over 2 beats while R keeps riding A. There are no finger joints, so it reads as a raised "hey" hand rather than an index point. |
| `request_wave` | arms (R only at runtime) | 8 | one-shot | The R hand rises over 2 beats beside the head. It waves 4 times (±5.5 cm, eased) and returns over 2 beats. The left hand keeps doing whatever it was doing. |

A procedural head **look** offset is added on top per clip. It is smoothed at 4/s and looks toward the deck being scratched, toward the point direction, or tilts friendly on the wave.

## Reach targets (booth reshape = new numbers only)

`DEX_TARGETS` in `dex-set.js` is booth-local, in meters. The defaults come from `cantina_dj_booth.glb`:
`dex [0,0.25,-0.45]`, `platterA.c [-0.48,1.092,0.02]`, `platterB.c [0.48,1.092,0.02]`, `xfader.c [0,1.086,0.15]` (throw 0.06), `grip` (hand spot on the record), `palmClear/tipClear`, `point`, `wave`.
When Clay sends the curved-screen booth dims, edit those numbers or call `rig.dexSet.setTargets({ platterA: {...}, xfader: {...} })` at runtime. That re-bakes all clips in about 25 ms.
To bake the glb again: `cd /workspace/dex-set-work && node bake-dex-set.mjs [in.glb] [out.glb] [targets.json]`.

## Suggested cue mapping (implemented in `CUE_MAP` and `createDexSet().update`)

- **Groove underneath, always.** Weight 1 when live. When idle it runs at 0.45 weight on a slow free clock (0.9 beats/s).
- **Arms are picked once per 8-beat slot**, aligned to the downbeat grid (`beat = G.barPos(t) * 4`). Priority order:
  1. **Cut**: within ±1 bar of a `bass_swap` event → `xfader_cut`.
  2. **Build**: inside a transition zone (transition_start/end, the same zones dj.js already uses for `scratch_R`), or for 2 bars after a `scratch` event (scratch-demo) → the scratch clip for the **incoming deck**. Deck A (even tracks) → `scratch_build_R`; deck B (odd tracks) → `scratch_build_L`. Note: the cues have no literal `build` flag, so these events stand in for it.
  3. **Point**: every 12 bars (bars 8, 20, 32, …) → `crowd_point`.
  4. Otherwise → `decks_work_AB`. When not playing → `hands_home`.
- **Wave on request**: `dexSet.request()` (the patch wires it to `pickReq`) plays `request_wave` on the right arm only. It crossfades in and out over about 1 beat and holds its home end frame while fading.
- **Crossfader knob**: while a Dex hand holds it, `dexSet.fader` gives the knob X position and the patch sets `xfader.position.x` from it. Otherwise dj.js's transition slide owns the knob.

## Constraints (measured)

- **Root:** only Y moves, from −1.2 cm to 0 (`root.userData.y0` + bob). X/Z are never touched, so there is no sliding. rigged.js drops root tracks anyway; the bob is applied in code.
- **IK:** 0.00 mm error at every contact key, with no clamped samples. The deepest reach is 96% (fingertips on the crossfader, which is 0.6 m in front of Dex). If the new booth moves the fader closer, that gets easier.
- **Speeds at 124 BPM:** the peak hand speed is 1.2 m/s, on deck↔fader travel, which is mostly lateral. The peak speed toward the crowd (+Z) is 0.55 m/s, and only the point reaches past the deck front, at 0.26 m/s. Peak joint speed over a full simulated 20-minute mix is 286°/s (forearm, mid-travel). Every curve is eased (smoothstep / smootherstep / cosine) with zero velocity at its keys.
- **Seams:** all clips are finite, first key = last key, and verified in node and in three's GLTFLoader. In the full-mix simulation, 0 slot switches landed off an 8-beat line, and there were no velocity spikes across switches or waves.

## Not verified

- Not checked on a Quest 3 in headset. The proofs are headless (SwiftShader) renders plus one desktop-view load of the patched showroom.
- A live build-zone moment in the real showroom: the test server couldn't seek the audio. The cue-map logic was verified in a node simulation over both cue files instead.
- Forearm/hand mesh contact uses estimated effector lengths (palm 0.37 m, tip 0.425 m below the elbow, taken from the mesh bounds). From the top view the hands look like they sit on the records, but small clipping into the platter or knob is possible at some frames.
