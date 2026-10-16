# Showroom XR (v1, unpublished)
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
