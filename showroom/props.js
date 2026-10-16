// Procedural low-poly props, vertex-coloured, batched into one solid + one glow mesh per call site.
export const PAL = { gold: 0xd9a227, orange: 0xc4561f, rust: 0x9a3a1c, avocado: 0x7a8a3a, choc: 0x4a2c1a, cream: 0xeadfc6, beige: 0xd8c9a6,
  walnut: 0x5a3a22, teak: 0x9a6534, silver: 0xb9bcc0, black: 0x151515, chrome: 0xd0d4d8, brass: 0xb08a3e, rope: 0xd8c39a, terracotta: 0xa9532e, char: 0x2a2b2e };
export function vcBuilder(THREE) {
  const solid = [], glow = [], col = new THREE.Color(), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
  function put(list, g, color, x, y, z, rx = 0, ry = 0, rz = 0) {
    col.set(color); const n = g.attributes.position.count, c = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b; }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3)); if (g.attributes.uv) g.deleteAttribute('uv');
    g.applyMatrix4(m4.compose(v.set(x, y, z), q.setFromEuler(e.set(rx, ry, rz)), one)); list.push(g); return g;
  }
  const b = {
    solid, glow, put,
    box: (w, h, d, c, x, y, z, ry = 0, L = solid) => put(L, new THREE.BoxGeometry(w, h, d), c, x, y, z, 0, ry),
    cyl: (r0, r1, h, c, x, y, z, seg = 12, rx = 0, ry = 0, rz = 0, L = solid) => put(L, new THREE.CylinderGeometry(r0, r1, h, seg), c, x, y, z, rx, ry, rz),
    sph: (r, c, x, y, z, L = solid, seg = 12) => put(L, new THREE.SphereGeometry(r, seg, Math.max(6, seg >> 1)), c, x, y, z),
    cone: (r, h, c, x, y, z, seg = 10, rx = 0, ry = 0, rz = 0, L = solid) => put(L, new THREE.ConeGeometry(r, h, seg), c, x, y, z, rx, ry, rz),
    torus: (r, t, c, x, y, z, rx = 0, ry = 0, L = solid) => put(L, new THREE.TorusGeometry(r, t, 6, 20), c, x, y, z, rx, ry, 0),
    // local frame helper: returns a builder whose coordinates are relative to (ox,oz) rotated by ry
    tris: () => [...solid, ...glow].reduce((t, g) => t + (g.index ? g.index.count : g.attributes.position.count) / 3, 0),
  };
  return b;
}
// ---- individual props (world coordinates; ry rotates about the prop origin) ----
function frame(THREE, B, ox, oz, ry, fn) { // run fn with a local builder, then transform its new geometry
  const s0 = B.solid.length, g0 = B.glow.length; fn();
  const m = new THREE.Matrix4().makeRotationY(ry).setPosition(ox, 0, oz);
  for (const g of B.solid.slice(s0)) g.applyMatrix4(m); for (const g of B.glow.slice(g0)) g.applyMatrix4(m);
}
export function hifi(THREE, B, ox, oz, ry) { const P = PAL; frame(THREE, B, ox, oz, ry, () => { // local +Z = front
  B.box(1.3, 0.5, 0.45, P.teak, 0, 0.31, 0); for (const x of [-0.6, 0.6]) for (const z of [-0.18, 0.18]) B.cyl(0.02, 0.015, 0.06, P.choc, x, 0.03, z, 6);
  B.box(0.44, 0.13, 0.32, P.silver, -0.3, 0.625, 0); B.box(0.36, 0.035, 0.005, P.gold, -0.3, 0.64, 0.163, 0, B.glow);
  B.box(0.42, 0.1, 0.34, P.walnut, 0.25, 0.61, 0); B.cyl(0.15, 0.15, 0.012, P.black, 0.22, 0.67, 0, 20);
  B.box(0.36, 0.42, 0.14, P.silver, 0, 1.02, -0.1); for (const dx of [-0.09, 0.09]) B.cyl(0.085, 0.085, 0.015, P.black, dx, 1.12, -0.025, 16, Math.PI / 2);
  for (const x of [-0.85, 0.85]) { B.box(0.32, 0.8, 0.3, P.walnut, x, 0.4, 0); B.box(0.26, 0.6, 0.01, P.choc, x, 0.45, 0.155); B.cyl(0.09, 0.09, 0.012, P.gold, x, 0.45, 0.165, 12, Math.PI / 2); }
}); }
export function loungeChair(THREE, B, ox, oz, ry) { const P = PAL; frame(THREE, B, ox, oz, ry, () => { // Eames-ish: walnut shell + leather cushion + ottoman
  B.cyl(0.03, 0.2, 0.04, P.black, 0, 0.02, 0, 5); B.cyl(0.02, 0.02, 0.3, P.chrome, 0, 0.18, 0, 6);
  B.box(0.75, 0.08, 0.65, P.walnut, 0, 0.36, 0); B.box(0.68, 0.1, 0.58, P.choc, 0, 0.44, 0.02);
  B.box(0.75, 0.6, 0.08, P.walnut, 0, 0.72, -0.33, 0); B.box(0.66, 0.52, 0.08, P.choc, 0, 0.74, -0.27);
  for (const x of [-0.39, 0.39]) B.box(0.06, 0.06, 0.5, P.walnut, x, 0.58, 0);
  B.cyl(0.03, 0.16, 0.03, P.black, 0, 0.015, 0.75, 5); B.box(0.55, 0.12, 0.45, P.choc, 0, 0.32, 0.75); B.cyl(0.02, 0.02, 0.24, P.chrome, 0, 0.14, 0.75, 6);
}); }
export function sunburst(THREE, B, x, y, z, ry) { const P = PAL; frame(THREE, B, x, z, ry, () => {
  B.cyl(0.11, 0.11, 0.03, P.gold, 0, y, 0, 16, Math.PI / 2);
  for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; B.cyl(0.006, 0.006, 0.22, P.brass, Math.cos(a) * 0.22, y + Math.sin(a) * 0.22, 0, 4, 0, 0, a - Math.PI / 2); }
  B.box(0.008, 0.08, 0.004, P.choc, 0, y + 0.03, 0.02);
}); }
export function macrame(THREE, B, x, z, top) { const P = PAL;
  for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; B.cyl(0.004, 0.004, 1.1, P.rope, x + Math.cos(a) * 0.06, top - 0.55, z + Math.sin(a) * 0.06, 3, Math.sin(a) * 0.1, 0, -Math.cos(a) * 0.1); }
  B.cyl(0.12, 0.08, 0.15, P.terracotta, x, top - 1.15, z, 12);
  for (let i = 0; i < 11; i++) { const a = i / 11 * Math.PI * 2; B.cone(0.014, 0.38, P.avocado, x + Math.cos(a) * 0.12, top - 1.15, z + Math.sin(a) * 0.12, 3, Math.sin(a) * 2.3, 0, -Math.cos(a) * 2.3); }
}
export function lavaLamp(THREE, B, x, y, z) { const P = PAL;
  B.cyl(0.045, 0.06, 0.08, P.gold, x, y + 0.04, z, 10); B.cyl(0.035, 0.055, 0.22, P.orange, x, y + 0.19, z, 10, 0, 0, 0, B.glow); B.cyl(0.02, 0.045, 0.05, P.gold, x, y + 0.325, z, 10);
}
export function x1c(THREE, B, x, y, z, ry) { const P = PAL; frame(THREE, B, x, z, ry, () => { // modern: charcoal body, smoked door, AMS on top
  B.box(0.39, 0.457, 0.39, P.char, 0, y + 0.2285, 0); B.box(0.33, 0.36, 0.005, 0x0b0c0e, 0, y + 0.24, 0.196);
  B.box(0.39, 0.21, 0.39, 0x3a3c40, 0, y + 0.457 + 0.105, 0); B.box(0.3, 0.005, 0.3, 0x0b0c0e, 0, y + 0.668, 0);
  B.box(0.33, 0.008, 0.33, P.chrome, 0, y + 0.07, 0); B.box(0.06, 0.02, 0.004, 0x9be7ff, 0.12, y + 0.42, 0.199, 0, B.glow);
}); }
export function prints(THREE, B, x, y, z) { const P = PAL; // a few prints arranged like sculpture
  B.cone(0.06, 0.22, P.orange, x - 0.18, y + 0.11, z + 0.22, 6); B.torus(0.06, 0.02, P.gold, x + 0.05, y + 0.08, z + 0.25, 0, 0.6);
  B.box(0.07, 0.15, 0.07, P.avocado, x + 0.2, y + 0.075, z + 0.2, 0.5); B.sph(0.05, P.cream, x - 0.02, y + 0.05, z + 0.28, B.solid, 8);
}
export function banquette(THREE, B, cx, cz, size, floorY) { const P = PAL; // U around +X, +Z, -Z sides; open toward -X (window). seats 5
  const r = size / 2 - 0.45, h = 0.42, back = 0.75;
  const run = (x0, z0, x1, z1) => { const len = Math.hypot(x1 - x0, z1 - z0), ry = Math.atan2(x1 - x0, z1 - z0), mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
    const nx = Math.cos(ry), nz = -Math.sin(ry); // left normal
    B.put(B.solid, new THREE.BoxGeometry(0.62, h, len), P.rust, mx, floorY + h / 2, mz, 0, ry, 0);
    B.put(B.solid, new THREE.BoxGeometry(0.18, back, len), P.rust, mx - nx * 0.38, floorY + back / 2, mz - nz * 0.38, 0, ry, 0);
    B.put(B.glow, new THREE.BoxGeometry(0.02, 0.025, len - 0.1), P.gold, mx + nx * 0.3, floorY + 0.03, mz + nz * 0.3, 0, ry, 0); };
  run(cx + r, cz + r, cx + r, cz - r);        // back (seats 2-3), faces -X
  run(cx - r * 0.55, cz + r, cx + r - 0.3, cz + r); // side, faces -Z
  run(cx + r - 0.3, cz - r, cx - r * 0.55, cz - r); // side, faces +Z
  B.cyl(0.55, 0.55, 0.06, P.walnut, cx - 0.1, floorY + 0.36, cz, 24); B.cyl(0.35, 0.4, 0.33, P.choc, cx - 0.1, floorY + 0.165, cz, 16); // low walnut table
}
