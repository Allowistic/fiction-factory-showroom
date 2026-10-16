# Loft XR v0 (three.js r170 + WebXR, static, no build step)
Serve the folder over HTTPS and open index.html (Quest 3 browser → Enter VR). `?low` = reduced quality. Local: `python3 -m http.server`.
three.js pinned: jsdelivr three@0.170.0 (importmap in index.html).

## Files
- index.html: importmap, loads lighting/cove-scenes.js (classic script) + main.js
- config.js: **ROOM (PLACEHOLDER dims/openings, windowWall, makeWall)**, LED specs (from CALIPER_LED_CHANNEL_SPECS.md), BRACKET file/spacing
- room.js: walls + perimeter + u ranges (run starts at entry corner, A→B→C→D)
- scenes.js: adapter over Motion God's lighting/cove-scenes.js (unedited) + `solid` override + brightness; aims sunset/beat/focus params at config walls
- main.js: room, per-pixel strip (InstancedMesh, N = round(perimeter × 180)), 1×N DataTexture → additive cove-wash bands, 4 wall fill lights, brackets, shelf, equipment
- panel-xr.js: in-world panel (controller trigger / hand pinch ray). panel-html.js: overlay + camera/photo color pick
- equipment.json, assets/bracket/, assets/builds/, sync-assets.sh, LAYOUT_SPEC.md (Mira), preview.png

## Drop-ins
- Vincent dims → config.js ROOM (width, depth, ceilingHeight, openings[{type,wall,offset,width,height,sill}]). N, brackets, wash all recompute.
- Clay bracket → /workspace/cove-light/bracket/, run `./sync-assets.sh`; name must match BRACKET.file (`assets/bracket/crest-bracket.glb`). Local −Z should point into the corner. Missing → grey placeholder.
- Clay builds → assets/builds/manifest.json: array or {builds:[...]}, entries {name, file} (file relative to assets/builds/). Missing/partial manifest or files → labeled wireframe placeholders. Up to 9 slots.
- Motion God → lighting/cove-scenes.js (picked up automatically; scene list comes from fx.scenes).
- Max/Tally/Mira → equipment.json items {name,w,d,h,position:[x,z],rotationY,elevation?}; set "placeholder": false.

## Still placeholder
Room dims + openings, wall roles, bracket inset (0.05 m), bracket mesh, builds, all equipment, shelf placement (wall D by entry). Channel 17×8 mm is provisional (caliper on arrival).

## v0.2 (Mira + Quinn feedback, 2026-10-15)
- Room light presets sunset / day / night (sun through the window with 1024 shadow map, off in `?low`; sky hemi; cove pulled to 2400K/40% at sunset). Default cove = Motion God `ambient` (kelvin set per preset); RGB scenes still selectable.
- Cove: fascia 125 mm, bottom 100 mm below strip, 150 mm off wall; smooth emissive ceiling wash (0.9 m) from the pixel buffer, soft-clipped; no point lights (ambient tinted by strip average).
- Display shelf: wall C by entry corner, 4 floating tiers (1.0–2.2 m, 0.28 deep), under-shelf LED strips + wall glow + 1 warm point light. 12 Draco builds from manifest; HOPE sign on wall D.
- equipment.json kinds: table (legs) | block | enclosure | wallshelf. Make wall: X1C+AMS on its own stand, 0.3 m rear gap; 3018 in acrylic enclosure on make bench; 2 shelves at 1.80/2.15 (≥0.4 m over X1C).
- Task lights (bench, machines) toggle in both panels. Labels hidden; hover/gaze or Labels toggle. XR panel 0.9 m ahead, 15° below eye (squeeze = recenter), 1 px = 1 mm. Debug line in HTML "Debug" disclosure.
- Screenshots: shot-sunset.png (= preview.png), shot-day.png, shot-night.png, preview-make.png, preview-desk.png.

## Props, 1970s pass and phone fallback (2026-10-15)
- `assets/props/`: CC0/CC-BY GLBs (see `CREDITS.md`). `equipment.json` items take `model: {file, w?, h?, d?, keep?, tint?}`. Each model is fitted to the item's w×h×d. The box stays as a fallback if the GLB fails to load.
- `seventies.js`: procedural 70s dressing, vertex-coloured and merged into about 5 draw calls (walnut paneling on walls A and C, cream elsewhere, butcher-block benches, gold pegboard, hi-fi corner, rug, posters, clock, macramé, lava lamp, globe and orange dome pendants). The cove runs at 2700K, and sunset is the default.
- Brackets and inside corners: Clay's GLBs are drawn as InstancedMesh, falling back to boxes if they fail to load.
- Shelf builds: `assets/builds-opt/manifest.json` is used when present, otherwise `assets/builds/`. When a `lod1` file exists, full mode uses THREE.LOD (full model up close, lod1 beyond 2 m) and `?low` uses lod1 only.
- **Phone fallback:** if immersive-vr isn't supported, a **Look around** button appears. Tapping it asks for motion permission on iOS (from inside the tap), then drives the camera from deviceorientation at the entry, 1.6 m eye height, with screen-orientation correction. Drag to offset yaw, and tap **Back to orbit** to return. The VR button reads "For VR, open this link in the Quest Browser".
