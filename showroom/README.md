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
