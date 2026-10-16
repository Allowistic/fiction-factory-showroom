# Loft layout spec (Mira, Studio) — parametric, dims TBD

All positions are fractions of room size so Jules can drop in real numbers.
Units: meters. Origin = loft entry corner (stair/door), +X along the long wall, +Z into the room, +Y up.

## Inputs (fill in)
- ROOM_W (long wall, X), ROOM_D (Z), CEIL_H (Y; note any slope/knee wall height KNEE_H)
- ENTRY position, WINDOW positions/sizes, OUTLET positions (if known)
- Equipment list from Max/Tally (footprints override the placeholders below)

## Workflow (the flow the layout serves)
idea/sketch -> computer/design -> make (print / cut) -> finish/assemble -> display
Rule: dirty/loud work farthest from the entry and the display; clean work and display nearest the light and the entry.

## Zones
1. ENTRY + CLEAR PATH: 0.9 m min aisle running from entry the full length of the loft. Nothing parks in it.
2. DESIGN DESK (clean): near the best window/daylight. Computer, drawing/tilt art surface. ~1.5 x 0.75 m. Faces the window or a side wall, not the machines.
3. MAKE WALL (machines): far end, away from entry. Bambu X1C (placeholder 0.4 x 0.6 x 0.5 m incl. AMS, needs ~0.3 m rear clearance for venting/filament) on a sturdy bench; 3018-PRO CNC (placeholder ~0.4 x 0.4 m) beside it, ideally in an enclosure for dust/noise. Bench height 0.9 m, depth 0.6 m. Dedicated circuit/power strip along this wall. Filament + bit storage on shelves above, at least 0.4 m clear above the X1C.
4. FINISH / ASSEMBLY BENCH: between MAKE and DESIGN. Stand-up bench 0.9-0.95 m, ~1.2 x 0.6 m, task light overhead, parts bins below.
5. DISPLAY SHELF: on the wall seen first from the entry (or the wall the design desk faces). Floating shelves, 0.25-0.3 m deep, 3-4 tiers from ~1.0 m to just under ceiling/knee height. Built pieces live here; keep it away from CNC dust.
6. LED COVE: continuous perimeter strip at the ceiling/wall break (or along the knee wall top under a slope), bounced up off the ceiling. Warm white base (2700-3000K) with RGB option. A second LED run under each display shelf to wash the builds. Task lights over the bench and the machines are separate from the cove.

## Default arrangement (rectangular loft)
- Entry at X=0.
- X 0.00-0.30 ROOM_W: display wall + design desk on the window side.
- X 0.30-0.60 ROOM_W: finish/assembly bench.
- X 0.60-1.00 ROOM_W: make wall (X1C + 3018), storage above.
- The aisle runs along the opposite wall the whole length.
If the loft is square or the window sits at the far end, swap the design desk and the make wall so the desk keeps the daylight, and give the machines their own ventilated corner.

## Flags
- Measurement-critical: once the real dimensions arrive, Caliper checks them before final placement (crew rule).
- The equipment footprints above are placeholders until the Max/Tally list arrives.
