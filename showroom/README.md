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
