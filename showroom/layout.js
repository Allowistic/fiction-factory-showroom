// Showroom layout (Mira SHOWROOM_SPEC.md v1). Design sizes, meters. Origin = arrival point, +Z forward, +Y up.
// Facing +Z, the viewer's LEFT is +X. Hall is an L: 12 x 9 bounding box with the front-right corner notched out.
export const MAX_USERS = 5;
export const HALL = { x0: -8, x1: 4, z0: 1.5, z1: 10.5, H: 4.2, notch: { x0: -8, x1: -4, z0: 1.5, z1: 4.0 } };
export const VEST = { x0: -1.5, x1: 1.5, z0: -1.5, z1: 1.5, H: 2.6, opening: { x0: -1.0, x1: 1.0, h: 2.3 } };
// cove polygon at the ceiling break, index 0 = entry corner, then clockwise seen from above (left wall -> builds wall -> window wall -> notch)
export const COVE = [[4, 1.5], [4, 10.5], [-8, 10.5], [-8, 4], [-4, 4], [-4, 1.5]];
export const BUILDS_WALL = { x0: -2.0, x1: 3.0, z: 10.5, tiers: [0.9, 1.42, 1.94, 2.46], relief: { bottom: 3.0, w: 0.914, h: 0.845 }, depth: 0.32 };
export const GATHER = { x0: -1.5, x1: 2.5, z0: 7.3, z1: 10.3 };
export const PIT = { cx: -5.3, cz: 6.9, size: 4.0, depth: 0.35 };
export const WINDOW = { x: -8, z0: 4.6, z1: 10.0, y0: 0.5, y1: 3.7 };   // Motion God scene wall
export const NOOK = { x0: -3.9, x1: -2.1, z0: 1.8, z1: 3.7 };
export const PLINTHS = [ // clockwise along the left wall, ~2.5 m apart
  { id: 'x1c', name: 'Bambu Lab X1 Carbon + AMS', crew: 'Make crew', year: 2026, x: 3.3, z: 3.2, w: 0.75, d: 0.75, h: 0.9, exhibit: 'x1c' },
  { id: 'cnc', name: 'SainSmart 3018-PRO', crew: 'Make crew', year: 2026, x: 3.3, z: 5.7, w: 0.8, d: 0.7, h: 0.95, exhibit: 'cnc' },
  { id: 'slot1', name: 'Reserved: Fun Again EV', crew: 'Crew', year: 2026, x: 3.3, z: 8.2, w: 0.6, d: 0.6, h: 1.05 },
  { id: 'slot2', name: 'Reserved: ShadyAF lamp', crew: 'Crew', year: 2026, x: 3.0, z: 9.7, w: 0.55, d: 0.55, h: 1.0 },
];
export const SPAWNS = [ // 5 in the vestibule, staggered ~1 m, all facing +Z
  { x: 0, z: 0.2 }, { x: -0.9, z: -0.3 }, { x: 0.9, z: -0.3 }, { x: -0.5, z: -1.0 }, { x: 0.5, z: -1.0 },
].map(p => ({ ...p, yaw: 0 }));
export const GROUP_SPOTS = [
  { id: 'arrival', x: 0, z: 0, cap: 5 }, { id: 'builds', x: 0.5, z: 8.6, cap: 5 }, { id: 'pit', x: PIT.cx, z: PIT.cz, cap: 5, seated: true },
  { id: 'nook', x: -3.0, z: 2.8, cap: 2 }, ...PLINTHS.map(p => ({ id: 'ex-' + p.id, x: p.x - 1.1, z: p.z, cap: 3 })),
];
export function coveSegments() { const segs = []; let s = 0;
  for (let i = 0; i < COVE.length; i++) { const a = COVE[i], b = COVE[(i + 1) % COVE.length], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const dx = (b[0] - a[0]) / len, dz = (b[1] - a[1]) / len; segs.push({ a, b, len, s0: s, dx, dz, n: [-dz, dx] }); s += len; } // n = inward normal (verified below)
  return segs; }
export const covePerimeter = () => coveSegments().reduce((t, s) => t + s.len, 0);
