// Loft config. ALL ROOM NUMBERS ARE PLACEHOLDER until Vincent sends real dims (Caliper checks before final placement).
// Units meters. Origin = loft entry corner. +X along long wall, +Z into room, +Y up (per Mira LAYOUT_SPEC.md).
// Cove run (index 0 at entry corner, "clockwise" order): wall A (z=0, x 0->W) -> wall B (x=W, z 0->D)
//   -> wall C (z=D, x W->0) -> wall D (x=0, z D->0).
export const ROOM = {
  PLACEHOLDER: true,
  width: 6.0,          // PLACEHOLDER  ROOM_W (X)
  depth: 4.0,          // PLACEHOLDER  ROOM_D (Z)
  ceilingHeight: 2.7,  // PLACEHOLDER  CEIL_H
  openings: [          // PLACEHOLDER. wall: A|B|C|D, offset = start along that wall's run direction, m
    { type: 'entry',  wall: 'D', offset: 3.0, width: 0.9, height: 2.0, sill: 0 },
    { type: 'window', wall: 'A', offset: 0.6, width: 1.2, height: 1.2, sill: 0.9 },
  ],
  windowWall: 'A',     // PLACEHOLDER: window wall (design desk side)
  makeWall: 'B',       // PLACEHOLDER: make/bench wall (far end, X1C + 3018)
};

// LED: from /workspace/cove-light/CALIPER_LED_CHANNEL_SPECS.md (S1 + C1). Do not edit without the spec.
export const LED = {
  strip: 'BTF FCOB WS2812B', pixelsPerMeter: 180, pcbWidth_m: 0.010, volts: 5, cut_m: 0.011,
  channel: 'Muzata U1SW HW white', channelOuterW_m: 0.017, channelOuterH_m: 0.008, // provisional, caliper on arrival
  channelSlotW_m: 0.012, channelSlotH_m: 0.006,
  insetFromCorner_m: 0.05,   // PLACEHOLDER: how far the bracket holds the channel off the corner
};

export const BRACKET = {
  spacing_m: 0.3048,                         // 12 in
  file: 'assets/bracket/crest-bracket.glb',  // swap: drop Clay's glb here (or edit name). Missing -> placeholder mesh
  scale: 1,
};

export const QUALITY = { low: new URLSearchParams(location.search).has('low') };
