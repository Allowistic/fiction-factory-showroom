# Cantina robots + DJ booth — review packet (Clay, 2026-10-17)
Contact sheet: cantina_robots_preview.png (baked unlit result, Eevee). Per-piece: *_preview_front/3q/pose(.png), dex *_preview_decks, booth *_preview_with_dex / *_with_dex_dj.

| file | tris (lod1) | draws | joints / pivots |
|---|---|---|---|
| cantina_robot_bartender.glb | 3992 (1311) | 2 | root, torso, head, antenna, armR, foreR, armL, foreL |
| cantina_robot_dex.glb | 3188 (1045) | 2 | same names (ROBOT_MANIFEST) |
| cantina_dj_booth.glb | 3374 (1518) | 3 | booth, platterA, platterB, xfader + mesh dj-screen |

- Rig: one skinned mesh per piece, rigid weights, every joint has identity rest rotation (x right, y up, z forward), so the
  angles in showroom/bartender.js and dj.js drive it unchanged. Right arm = -X. Baked optional clips: Tapper idle / turn_to_player / wave (3x) / beckon; Dex idle_nod / scratch_R / hands_on_decks / wave.
- Booth matches Jules's placeholder layout: deck A at -X (visitors' left), platter pivots (±0.48, 1.07, 0.02), xfader (0, 1.075, 0.15), riser 0.25 m, Dex at (0, 0.25, -0.45),
  screen 1.4 x 0.7 at (0, 2.08, -0.66) tipped 0.06 rad, own material cantina_dj_screen (UV 0..1, placeholder jpg).
- Look: cantina materials (aged brass Metal032, gunmetal Metal046B, oxblood Leather037, walnut Wood066), satin/rough, no gloss; teal only as small lights.
  Generic sci-fi: Tapper = barrel torso + lantern head with a visor slit + wrap apron; Dex = leather-jacket shell, dark-glass face, round teal eyes, brass headphones. No Star Wars shapes (no dome astromech, no gold protocol humanoid).
- Questions for Nova: Dex palette (Jules's placeholder used graphite + copper + violet; I kept cantina brass/teal + oxblood); torso silhouettes; teal count.
- Questions for Quinn: proportions behind a 1.05 m bar, hand/platter contact, readability at 4-7 m, lod1 silhouettes, IP check.

## v2 (Nova's look fixes, 16:20 PT)
- Dex: squared flat yoke + shoulder pads, brass belt band at ~60% down (copper buckle = only copper), broad 8-sided chest tapering to a narrow waist, angled lapels (concave V) + brass zip seam, oxblood kept. Headphone rings now brass; breast meter is a baked amber lamp. Teal = eyes + antenna tip.
- Tapper: column r 0.085 -> 0.145 (1.7x) with brass bands, flared brass collar under the waist ball, 3-step base; barrel gets a flat shoulder ledge + brass flange, apron flares A-line below a brass waist band. Chest dot removed: teal = visor only.
- Both: upper arms 1.3x, shoulder balls 1.72x / elbow balls 1.33x of the old arm radius.
- Booth: request plaque = engraved brass; meters, start/stop and riser nosing = baked amber; only teal = kick (cove) light. Screen placeholder bars amber/brass, teal caps on the peaks only. Screen posts = 32 mm-radius brass pipe with floor flange, coupling, elbow fitting and frame flange.
- Joint names, positions, identity rest rotations and rest pose unchanged (checked in the exported GLBs).

## v3 — Nova (Dex column/collar) + Quinn FIX list (2026-10-17)
- **Dex reach:** forearm lengthened 0.08 m (wrist 0.56 → 0.48 m model height); **Dex stays at booth-local z -0.45** (moving to -0.35 would push his base/waist into the counter). dj.js does not need a new position.
  - Deck poses solved by `cantina_src/dex_ik.py` → `cantina_src/dex_poses.json`, baked into the `hands_on_decks`, `scratch_R` and `idle_nod` clips. Values are three.js Euler XYZ radians, so they can go straight into dj.js.
  - hands_on_decks: torso x 0.04; armR (0.1224, 0.2846, -1.0205), foreR x -1.6223; armL (0.1224, -0.2846, 1.0205), foreL x -1.6223.
  - scratch_R: right hand alternates every 0.125 s:
    - R_fwd armR (0.0482, 0.3847, -1.0201), foreR -1.4827
    - R_back armR (0.1956, 0.1847, -1.0051), foreR -1.7529
  - scratch_R: left hand on the xfader:
    - armL (-0.4966, 0.4196, -0.7982), foreL -0.7456
    - left (-0.6702, 0.3182, -0.6948), foreL -0.604
    - right (-0.3988, 0.4699, -0.8531), foreL -0.8514
  - Measured in Blender: the closest hand vertex is 2–6 mm from each platter rim and 0 to a few mm into the platter top. The left fingertip sits on the xfader cap. The only other contact is the base standing on the riser top.
- **Closed shells:** the shoulder pads are closed boxes that stand proud of the yoke. The chest/belt and yoke-seam faces are no longer coplanar, which caused the "tear" and "open top" z-fighting. lod1 now decimates only large islands, so small closed parts stay whole.
  - Non-manifold edges = 0 on lod0 and lod1 for Tapper, Dex and the booth mesh. The screen is an intentional single quad in its frame.
- **Bands:** belt n64, waist n40, collar ring n40, waist ball 28×12.
- **Tapper:** head and visor scaled 1.3× about the neck. Shoulders, joints and pivots are unchanged. The idle clip bends the forearms about 60°, so his hands show above the 1.05 m bar top. The rest pose is unchanged. No mesh overlap with the bar or back bar in any clip; the minimum hand-to-bar gap is 0.12 m (beckon).
- **Heights (rest, measured):** Tapper 1.968 m; Dex 1.48 m model (top at 1.73 m on the 0.25 m riser); booth with screen 2.462 m; bar top 1.05 m.
- **Renders:**
  - `cantina_robot_bartender_review_bar_{rest,wave,beckon}.png`: eye 1.6 m, 2 m from Tapper.
  - `cantina_robots_lod1_silhouettes.png`
  - `cantina_review_{tapper,booth_dex}_{4m,7m}.png`: 60° over 1150 px ≈ Quest 19 px/deg.
  - `cantina_review_dex_{hands_on_decks,scratch}.png`, `*_preview_top.png`, and the `cantina_robots_preview.png` contact sheet.

## v4 (booth only, 2026-10-17)
- DJ screen centre 2.08 -> 2.18 m; brass pipe posts and elbows extended to match (built from SY, nothing floats). Booth/platter/xfader joints unchanged. Height 2.562 m; 3374 tris / lod1 2494, 3 draws, non-manifold 0/0.
- 7 m check (eye 1.6 m): Dex headphone top 1.73 m vs frame bottom 1.80 m, 0.071 m gap, about 9 px clear at Quest-like density (cantina_review_booth_dex_7m.png).
