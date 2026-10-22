# Teleporter beam: QA notes for Penny

Penny, please put the Star Trek transporter beam on the cantina teleporter through a desktop/browser QA pass before draft PR #2 is merged. The main open question is performance: the only measurement so far came from a machine with no GPU, so we do not yet know what the beam really costs on real hardware. Please report what you find (and any fixes) on this branch or as PR comments. Do not merge or deploy.

- **PR:** [fiction-factory-showroom #2](https://github.com/Allowistic/fiction-factory-showroom/pull/2) (draft), branch `feature/hangar-integration` (built on PR #1 `feature/cantina-teleporter-beam-fx`)
- **Code:** `showroom/beam.js` (beam mesh, shader, sound), `showroom/portal.js` (dwell, jump, beam timing), `showroom/showroom.js` (white-out fade, HUD, leave)
- **Hangar:** now hosted in this repo at `/hangar/`, built from land-yacht-hangar branch `fix/penny-v10` ([land-yacht-hangar PR #2](https://github.com/Allowistic/land-yacht-hangar/pull/2)). The arrival beam (`#beamin`) comes from that build (`src/beam.js` and `src/beamin.js`). That branch also carries the phone joystick update.
- **Written:** 2026-10-21, by Miles, at Vincent's request

## What we know about performance

The one test so far was a headless browser with software rendering (no GPU). It ran at about 3.2 FPS with the beam on, against 5.2 to 5.9 FPS with it off, so roughly half.

That number only says the beam is not free. It is **not** a GPU measurement and it is **not** a Quest result. It does not predict a 50% drop on a desktop GPU, a phone or a Quest. Please treat it as a reason to measure, not as a finding.

## Why it might be heavy

- **Fill rate and overdraw:** the beam is one ShaderMaterial mesh: two open cylinders (outer r 0.5 m, inner r 0.31 m, 2.35 m tall) plus a floor disc and a ceiling disc. It is transparent, additive, `DoubleSide`, `depthWrite: false`. By design your eye sits inside the column, so when it is lit it covers most of the screen and several layers shade the same pixels.
- **Fragment cost:** each column fragment runs two sparkle layers (hash, smoothstep, sin) plus streaks, haze and exp terms. The geometry is tiny; the cost is per pixel.
- **VR multiplier:** in a headset it renders twice (one view per eye) at 72 to 90 Hz, so the same fill cost hits harder there.
- **Audio:** while lit, the shimmer/hum runs 7 oscillators with 7 LFOs, a looping band-passed noise source and a hum oscillator. It builds them on first light (including a 2 s noise buffer filled on the main thread) and tears them down after about 1 s of silence.
- **What should be free:** the mesh is hidden whenever its level is 0, so it should cost 0 draws until someone stands on the pad. Please confirm that.

## What to check

### Performance (desktop browser with a real GPU)

1. Baseline: load `showroom/?beam=0`, go to the cantina, and record frame time and draw calls (`LOFT.drawCalls`, `LOFT.renderer.info`) standing near the pad and standing on it.
2. Beam on: repeat with the default URL, then `?beam=0.5` and `?beam=1.5`. Compare frame time over the 1.5 s dwell and the 1.7 s beam-out against the baseline.
3. Worst case: camera inside the column, full window and small window. If the cost scales with window size, it is fill rate.
4. Confirm the beam adds 0 draws when idle and exactly +1 draw while lit.
5. Look for a hitch on the first light (shader compile, audio node build) versus later ones.
6. Note that `LOFT.portal.beam.set()` is overwritten every frame by `portal.update()`. For a steady measurement, use a local-only tweak or profile the jump window.

### Behaviour

- Standing on the pad: the ring fills over 1.5 s, the beam shimmers up to about half, then rises to full on the jump. Stepping off cancels and the beam goes out.
- Clicking or tapping the arch from across the room: the beam centres on you, not the pad.
- Standing next to the pad (not on it) does nothing. The trigger radius is 0.42 m from the pad centre (`PORTAL.r` in portal.js); re-arming needs you to step 0.3 m beyond that.
- `?beam=0`: the old plain pink fade, no beam, no sound, and no `#beamin` added to the destination URL.
- Reduced motion (OS setting, `prefers-reduced-motion: reduce`): sparkles, streaks and the sweep slow right down. Brightness and the white-out still happen; flag it if you think that is too much.
- Sound: silent until the page has had a tap, click or key, then plays only while the beam is lit.
- Back button from the hangar: you stay put and the pad does not fire again until you step off.
- Departure URL: with the beam on it ends in `#beamin`. When k ≠ 1 the destination is `../hangar/?beam=<k>#beamin` (the level, up to 2 decimals); at the default (`k = 1`) it is `../hangar/#beamin` with no beam query. The hangar is hosted in this repo at `/hangar/`, so check the arrival beam there.

## Optimizations to try if it is heavy

Please measure before and after each one and keep the look as close as you can.

- Drop the inner shell, or draw only the faces you can see (back faces from inside, front faces from outside) instead of `DoubleSide`.
- Run one sparkle layer instead of two, or skip the second layer in `?low` and XR.
- Cap the level or intensity in XR and `?low`.
- Shrink what is shaded: skip fragments whose contribution is near zero, or lower the precision where it does not show.
- Pre-build the audio graph (or the noise buffer) once, ahead of the first jump, if the first light hitches.

## Desktop QA versus headset QA

This pass is desktop/browser only, and it can catch regressions and measure relative cost. It cannot say how the beam feels or performs on a Quest. Before relying on it in VR, someone still needs to try it on the headset: the 1.3 s XR beam-out, the session ending afterwards, the frame rate during the beam, and comfort with the column around your head.
