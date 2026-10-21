# Showroom XR

Live on GitHub Pages: https://allowistic.github.io/fiction-factory-showroom/showroom/ (repo: https://github.com/Allowistic/fiction-factory-showroom). Open it in the Quest Browser for VR.
Imagined virtual showroom from Mira's `../SHOWROOM_SPEC.md`. Open `showroom/index.html`. The old loft is untouched at `../` (`showroom/?loft` redirects there).

- `layout.js`: all design sizes, the cove polygon, plinths, `SPAWNS` (5), `GROUP_SPOTS`, `MAX_USERS = 5`. Origin = arrival, +Z forward; facing +Z, the viewer's left is +X.
- `state.js`: the single shared state (scene, preset, brightness, solid, chip, pins, labels, isHost). It holds no pose. `apply(patch, 'remote')` filters to light/panel keys only, so remote or state messages can never move the local camera. Camera moves only via local `setView`, `spawnRig` and Look around.
- `showroom.js`: room, cove (N = round(perimeter × 180) = 7560), Motion God's `../lighting/cove-scenes.js` (unmodified), scene window shader + window light, pin spots, builds wall (`../assets/builds-opt`, LOD on desktop, lod1 in low), plinths, pit, nook, both panels, gyro fallback, perf system.
- `props.js`: procedural 70s props (vertex-coloured, batched).

URL flags:
- `?low`
- `?testroom` (4 dummy avatars tagged `userData.avatar`, never merged)
- `?brackets=full` (Clay's 1.9k-tri bracket GLB, otherwise a 12-tri proxy)
- `?loft`

`window.LOFT.net = { peers, rtt, poseHz }` is a stats hook (null for now). `LOFT.store`, `LOFT.spawns` and `LOFT.groupSpots` are exposed.

Penny retest fixes:
- B1: the first gyro event aligns to the spawn heading
- B2: only `'denied'` stops Look around
- B3: the merge hides originals and restores them on sessionend
- B4: bracket proxy on desktop
- B5: no shadow pass (0 shadow draws)
- B6: status refreshes on mode change

u-values on the cove strip (index 0 = entry corner (4,1.5), clockwise):
- window wall 0.512–0.640 (mid 0.576)
- builds wall section 0.238–0.357 (mid 0.298)

## Cantina + room culling (Oct 2026)
- `cantina.js` builds the dogleg passage (1.2 m, round 2.2 m airlock arches) and the 8×6.5×3.2 m ribbed cantina, oriented with `CANTINA` in `layout.js` (`toCantinaWorld`).
- Hall, passage and cantina are separate groups. `cull()` shows the room you're in; in the passage it shows the passage plus the room you're facing. The plan view shows everything.
- Clay's pieces: manifest entries matching entertain/ent_center/led_strip/cantina (or `room:"cantina"`) load into the cantina. The ent center sits at local [0,0,6.3] facing the entry, and meshes named `led_strip` follow the current cove scene colour. The rest are labeled placeholders.
- Root `index.html` redirects here; the old loft is `../loft.html` (`?loft` too).
- Clay's cantina files load from the builds-opt manifest: entries with `room:"cantina"` in `builds[]` or `skipped[]`. The GLB URLs are cache-busted by `date`. The placement table (`CANT_PLACE`, mirrored layout) is matched by file name, and unknown files go along the side walls. At load, all baked maps are packed into one 2048 runtime atlas, giving 1 draw plus `led_strip`. lod1 is used in `?low` and XR.

## 2026-10-16 QA fixes (Penny smoke report)
- Control panel starts collapsed (☰ toggle); Camera/Photo pick under "Advanced"; "Spots" renamed "Floor rings".
- "Look around" only on touch devices; VR hint is a small bottom-right chip.
- Cantina TV: clickable iframe warped over the screen (lazy-loaded on first cantina visit); XR shows the baked snapshot.
- Desktop: LED ribbon instead of 7560 instanced pixels (`?pixels` restores them); brighter desktop exposure (XR unchanged).
- VR from the default URL swaps the HOPE board to lod1 as well as the shelf builds.

## Walking (2026-10-16)
- Phones/tablets: stick (bottom-left) to walk, one-finger drag to look (adds to the gyro when "Look around" is on), tap the floor to walk there. Two-finger gestures are ignored. `?orbit` restores orbit controls.
- Desktop: drag to orbit, **WASD / arrow keys** to walk (moves the orbit pivot with you).
- Collision: walkable rects from `layout.js` plus box colliders for plinths, banquette, pit table, nook, builds shelves and the cantina bar/back bar/booth/entertainment center. Eye height follows the floor (smooth step down into the pit).

## VR locomotion (2026-10-17)
- Left stick: smooth move along head yaw (1.4 m/s), same collision/solid props/pit step as touch walking; rig y follows the floor.
- Right stick: 30° snap turn about the head (deadzone 0.6 on, re-arm below 0.3).
- Trigger (hold, aim, release): teleport to a valid floor point or snap to a group-spot ring; teal marker = valid, red ray = invalid. The panel still takes trigger clicks when the ray hits it first.
- Comfort vignette while smooth moving. Draw budget: the marker hides the idle ray, the vignette replaces both rays, so the hall stays at ≤ 60 stereo draws.
- Banquette has a 1.1 m walk-in gap on the hall side (gold threshold strip). Using the stick while inside a prop pushes you to the nearest free point.
- Fix: LOD builds no longer auto-switch to full detail in low/XR (was up to 110 stereo draws near the builds wall).

## VR comfort settings (2026-10-17)
- Panel (HTML "Comfort (VR)" section and the in-VR panel's COMFORT row): Turn = snap 30° (default) / snap 45° / smooth (90°/s); Vignette on (default) / off (also shown while smooth-turning); Move = smooth (default) / teleport only; Swap hands (or `?lefty`). Saved in localStorage `ff-comfort`.
- One controller only: stick forward/back moves, a strong left/right flick (> 0.8) snap-turns, trigger teleports.
- Exiting VR mid-move or mid-aim now clears the vignette, teleport marker and aim state.
- Pit gap marker is a single thin gold threshold line.

## Cantina guestbook (2026-10-17)

- An open book on the bar top (cantina-local 2.02, bar top, 4.35). It shows the latest 6 notes on its CanvasTexture. It costs no draws of its own: it rides in the robots SkinnedMesh, whose shared map is the guestbook canvas (robot vertices sample a white texel at a constant uv).
- **Desktop/phone:** click or tap the book to open the modal (`#gb-modal`). Name is up to 40 chars, message up to 280. Everything is rendered with `textContent` or canvas `fillText`, never as HTML. Esc or a click outside closes it. `?guestbook` opens it on load.
- **VR:** point at the book and pull the trigger, within 3.5 m, to toggle a floating read view (+1 draw while open). The read view shows a "Sign on your phone or computer" URL.
- **Storage:** `GuestbookStore` interface (`guestbook.js`). `LocalGuestbookStore` keeps notes in `localStorage['ff-guestbook']` with a 20 s soft rate limit. It is labelled "Local preview: notes are only saved on this device." `RemoteGuestbookStore({listUrl, addUrl, format:'json'|'csv'})` is a stub for a real backend.

## Teleporter to Land Yacht Hangar (2026-10-19)

- A brass arch with pink seal lights on the cantina's entry wall, left of the door as you walk in (between the door and the bar end), with a "LAND YACHT HANGAR" sign and a glowing floor pad. The arch shows a moving window onto the hangar's dunes: pink dusk, two moons, three dune layers sliding at different speeds.
- **Where it goes:** `PORTAL.url` in `portal.js`, currently https://cd8522d0ff60.cookiejar.lol/ (Land Yacht Hangar's live Cookiejar site). Position, size, pad radius and dwell time are in the same object.
- **Desktop/phone:** stand on the pad for 1.5 s (the ring fills and a "Hold still" chip shows), or click/tap the arch or sign to go straight away. Stepping off cancels. The screen fades, then the page navigates.
- **VR:** step or teleport onto the pad and hold for 1.5 s, or point at the arch and pull the trigger (within 8 m). The VR session ends first, then the page navigates; press Enter VR again on the hangar. Aiming at the arch never starts a floor teleport.
- **Back button:** if the browser restores the page with you on the pad, it waits until you step off before it re-arms.
- **Cost:** the frame rides the cantina's merged solid/glow draws; window + sign + pad are one ShaderMaterial mesh (+1 draw, cantina only, never merged). The pick proxy is an invisible box.
- **Transporter beam QA:** open performance and behaviour checks for the beam (`beam.js`) are in `QA_TELEPORTER_BEAM.md`, addressed to Penny. Not yet measured on a GPU or a Quest.

## Robot bartender (2026-10-17)

- `bartender.js` → `createRobotBatch()`: ONE SkinnedMesh with one shared material and rigid skinning. It holds the bartender (brass/teal), Dex (graphite/copper/violet with headphones), the DJ counter, decks, platters and the crossfader, plus the guestbook. Each robot has its own root bone. No shadows.
- The bartender stands in the aisle at cantina-local (3.0, 0, 3.7) and faces the room. He has no collider, so the aisle stays walkable.
- **Behaviour:** idle sway. When the player is in the cantina within 7 m, he turns, waves 3 times, beckons, then lowers his arm. He re-arms only after the player leaves (7.5 m hysteresis); no timer.
- **Swap for Clay's models:** `ROBOT_MANIFEST` lists the pivot names the behaviour code drives (root, torso, head, arm, forearm, armL, forearmL, antenna; booth: platters[], crossfader). `pivotsFromGLTF(scene, manifest)` returns the same pivot map from a GLB whose nodes use those names.

## Builds shelf: grab / force pull / inspect (2026-10-17)

- **VR:**
  - Grip within 0.25 m of a build grabs it.
  - Pointing the ray at a build shows a 1-draw teal outline box and hides the other ray.
  - Trigger (or grip) while pointing force-pulls it: it eases to the hand over 0.6 s with a slight float and a spin.
  - While held it follows the controller. On release it floats back to its exact shelf slot over 0.8 s.
  - No teleport while aiming at a build, the guestbook or the DJ booth.
- **Desktop/phone:** click or tap a build to pull it to a lit inspect pose in front of the camera. Drag to rotate it. Click away or press Esc to send it back.
- **Low/XR merge:** the build's vertex range in its merged batch is zeroed while held. A 1-draw vertex-colour copy is shown in the hand. Both rays hide while holding. Holding is local only and never written to the shared state.

## DJ booth: Dex (2026-10-17)

- **Placement:** the cantina corner opposite the bar, beside the door, at cantina-local (-3.1, 0, 1.15), facing +x into the room. It has a collider.
  - Deck A is on the visitors' left and deck B on their right, with the 2-channel mixer and a horizontal crossfader in the middle.
  - Dex stands on a riser behind the decks. The wide screen sits behind him.
- **Draws:** the screen and one additive "glow" draw. The glow draw holds Clay's cove fan, the teleport ring, the wash cone and 2 deck spots, with a per-vertex fixture id. Dex, the counter and the platters are in the shared robots draw. The one PointLight is the booth wash: a dim warm work light when idle, show-driven when a show runs.
- **Audio** (`dj-config.js`):
  - `SETS` lists Dex's rendered files in `audio/`. `.ogg` is preferred, with `.mp3` as the fallback. The MP3 offset is **mix time = currentTime − 0.025 s**.
  - `AUDIO_URL` (stream) defaults to `null`. Without cue sidecars, an analyser onset estimate drives the beat.
  - Playback goes through a THREE.PositionalAudio at the booth (linear rolloff, ref 1.5 m, max 18 m). It starts only from a gesture: the panel ▶, a tap or click on the decks or screen, or the VR trigger on the decks.
  - The panel volume slider controls the level.
- **Sync:**
  - `*.cues.json` uses Dex's binary-search beat snippet, re-synced on `seeked` and on jumps over 1 s.
  - The screen shows DEX, LIVE/READY/OFFLINE, the track and artist, local BPM (8-beat window), `bar N of M` (per track), track i/n, and time.
  - It also shows a waveform overview built from `audio/*.peaks.json`: an RMS envelope pre-computed with ffmpeg. Transition zones are shaded teal, the breakdown violet, and there are track ticks and a playhead.
  - The footer carries the exact README credit text.
  - On beats the screen, the booth trims and the antenna pulse, stronger on downbeats.
  - The platters spin at 33⅓ rpm while playing. The crossfader slides across each transition.
  - Dex nods on the beat, with the analyser level scaling the nod.
- **Light show** (`dj.js` `LightShow`): Dex's `.lights.json`, v1 and v2.
  - **Groups:** cove / wash / spot / all.
  - **fx:** color, fade, pulse, chase, sweep, blackout_soft.
  - **rate:** beat = 1 beat, half = half a bar, bar = the downbeat grid, 2bar. The loader turns the rate into timing from `beats[]` / `downbeats[]`.
  - **Safety:** the flash rate is capped at `min(DJ_CONFIG.SAFETY.maxFlashHz, safety.max_strobe_hz)`, 3 Hz. Faster rates are halved until legal. The spots are fixed downlights onto the decks and never aim at visitors or the camera.
  - **v2:** per-fixture `move` cues and `projector_cues` are parsed and ignored for now. Moving heads, projectors and no-go come next pass.
  - **Cove:** CoveScenes has no arbitrary-colour API, so `cove-scenes.js` is untouched. The show overlays the strip output after `fx.render()` while it runs, and tints the cantina cove fan with the cove mean (approximate: it multiplies the fan's teal gradient).
  - **Palette:** one swappable place, `DJ_CONFIG.PALETTE`, for Nova's colours. It overrides the file palette by name.
- **Inputs:** one `ShowInput` interface.
  - `FileShowInput(json, clock)` follows the audio clock, or a free-running clock with a synthetic grid at `json.bpm || 120` when nothing plays.
  - `LiveShowInput(DJ_CONFIG.LIGHTSHOW_WS)` is a stub WebSocket. Each message is a cue in the same shape, `{cues:[...]}`, `{palette}` or `{type:'clock', t}`. It is off by default.
- **Extension hooks (inert):** `show.register(group, fn)` is for future fixtures. A `mover` group keeps pan/tilt/speed/beam. `ProjectorSurface` takes a video or canvas texture. There are no fixtures yet.
- **Panel → "DJ booth (Dex)":** set picker, ▶/■, volume, Load show (file picker or URL, default `shows/demo.lights.json`), ▶/■ show, Live (WS stub), status and credits.
- **Requests:** the lit "Request a song" button on the counter front opens a placeholder form on desktop and phone. On VR it shows a notice on the screen. Nothing is sent or stored (`PlaceholderRequestStore`): "Requests coming soon".
- **Demo show:** `shows/demo.lights.json` is 32 s at 120 BPM in Dex's format, using every fx.

### Lights cue schema (Dex v1, still valid inside v2)

```json
{ "version": 1, "groups": ["cove","wash","spot"], "palette": {"name": "#hex"}, "safety": {"max_strobe_hz": 3.0},
  "bpm": 120,
  "cues": [ { "t": 0.0, "group": "cove|wash|spot|all", "fx": "color|pulse|chase|sweep|fade|blackout_soft",
              "color": "palette name or #hex", "intensity": 0.0, "dur_s": 8.0, "rate": "beat|half|bar|2bar", "dir": "lr|rl|center" } ] }
```

`bpm` is our optional extension for the free-running clock. v2 files add `fixture` / `move` cues and `projector_cues`, which this pass ignores.

### LIGHTS_SPEC v0.2 sec. 6 binding (Hugo)

- **Frames:** `FileShowInput` applies `rooms.<room>.to_scene` to every fixture mount, target, no-go box and occluder (`input.scene`), and negates pan in mirrored rooms.
  - Hall `{translate:[-2,0,1.5]}`: scene = spec + translate, in hall world coordinates.
  - Cantina `{mirror_x:true}`: x_scene = −x_spec, in cantina-local coordinates. Cantina world = `toCantinaWorld(lx, lz) = [5.15 + lz, 12 − lx]`.
  - Files without `to_scene` fall back to these sec. 6.0 values (`DEFAULT_TO_SCENE`, flagged `fromFile:false`). Dex's 16:10 v2 files don't carry it yet.
  - This is data only: nothing renders movers, no-go or occluders this pass.
- **Projector:** entries are read from top-level `projector_cues[]` (`projector`, `surface`, `content {kind, color, pattern, src, tint}`, `intensity`, `dur_s`, `mask`). They are no longer read from `cues[]` with `group:'projector'`/`media`.
  - A registered `ProjectorSurface` (key `surface` or `projector:surface`) gets `setContent()`. Video plays its `src`. Colour and pattern give a flat tint for now, with `mask.intensity` applied. Pattern drawing comes next pass.
  - No surfaces are registered yet.
- **Ceiling at diy_proto_1** (spec [3.3, –, 5.6] → cantina-local (−3.3, 5.6), world (10.75, 15.3)): raycast vault height **2.775 m**. A rib underside sits at 2.65–2.69 m within 0.1–0.2 m. That is below the 3.0 m that sec. 6.1 requires. The vault reaches 3.0 m only at |x| ≲ 2.5.


## 2026-10-17 pass: Dex lights v0.4, Clay's rigged models, v8 QA fixes
- **Lights v0.4:** `rooms.<room>.to_scene` is read from the file (the sec. 6.0 default is only a guard; the status line names the source). Move cues are counted and skipped. `projector_cues` are parsed with `mask` kept as data (`normMask`, intensity ≤ 0.4); there is no projector surface yet. A seek re-syncs the beat index on `seeked` and fires no beats while the element is seeking.
- **Rigged cantina (`rigged.js`):** Clay's Tapper, Dex and DJ booth (manifest `rigged[]`, room `cantina_rigged`) plus the guestbook are re-packed into ONE SkinnedMesh per LOD (2048 runtime atlas, 21 bones). The original GLB scenes are never drawn: they are puppets that run the clips, and their joint rotations are copied to the batch each frame. Their meshes are never frozen or merged. lod1 is used in XR, `?low` and on touch devices. The booth screen uses Clay's `dj-screen` mesh. The placeholders stay if loading fails.
- Tapper stands at cantina-local (3.0, 0, 3.7) to clear the orange porthole at 7 m. Dex is at booth-local (0, 0.25, −0.45). Deck A is on the crowd's left.
- **Bartender:** greets once per visit. He re-arms only after you leave the 7 m zone (7.5 m hysteresis). There is no timer.
- **Guestbook:** limits count graphemes (`Intl.Segmenter`), so ZWJ emoji stay whole. Inputs are 16 px (no iOS zoom).
- **Inspect (desktop/phone):** drag rotates the build and never the view. Joystick and tap-to-walk are blocked while inspecting. Tapping off the build's visible meshes sends it back. A build flying home no longer eats taps.
- **Held builds (XR):** `clampHeld` keeps the held position inside the walkable area (+5 cm) and off the builds shelf.
- **Music:** room gain is `exp(−d/0.9)` over the walking distance out of the cantina door (passage mid ≈ 0.35, hall door ≈ 0.02, hall 0). It is applied on top of the positional falloff.
- **Low/XR merge:** FrontSide plain batches in the cantina and passage merge into the DoubleSide batch (2 fewer objects).
