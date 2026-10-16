// 1970s dressing pass: procedural low-poly props, vertex-coloured + merged (≈3 draw calls total).
// Palette: harvest gold, burnt orange, avocado, chocolate, cream. Units m, room frame (see config.js).
export function buildSeventies(THREE, scene, merge, { shelf, low, D, H }) {
  const C = { gold: 0xd9a227, orange: 0xc4561f, avocado: 0x7a8a3a, choc: 0x4a2c1a, cream: 0xeadfc6, beige: 0xd8c9a6, walnut: 0x5a3a22, teak: 0x9a6534,
    silver: 0xb9bcc0, black: 0x151515, chrome: 0xd0d4d8, green: 0x2f4a2a, rope: 0xd8c39a, terracotta: 0xa9532e };
  const solid = [], glow = [], col = new THREE.Color(), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  function put(list, g, color, x, y, z, rx = 0, ry = 0, rz = 0) {
    g = g.index ? g : g; col.set(color); const n = g.attributes.position.count, c = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b; }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3)); if (g.attributes.uv) g.deleteAttribute('uv');
    m4.compose(new THREE.Vector3(x, y, z), q.setFromEuler(e.set(rx, ry, rz)), new THREE.Vector3(1, 1, 1)); g.applyMatrix4(m4); list.push(g); return g;
  }
  const B = (w, h, d, c, x, y, z, ry = 0, list = solid) => put(list, new THREE.BoxGeometry(w, h, d), c, x, y, z, 0, ry);
  const Cy = (r0, r1, h, c, x, y, z, seg = 12, rx = 0, ry = 0, rz = 0, list = solid) => put(list, new THREE.CylinderGeometry(r0, r1, h, seg), c, x, y, z, rx, ry, rz);
  const S = (r, c, x, y, z, list = solid, seg = 12, half = false) => put(list, new THREE.SphereGeometry(r, seg, half ? 6 : 8, 0, Math.PI * 2, 0, half ? Math.PI / 2 : Math.PI), c, x, y, z);

  // ---- desk (top 0.75, centre x1.2 z0.5, front faces +Z) ----
  const T = 0.75;
  B(0.42, 0.09, 0.3, C.beige, 1.0, T + 0.045, 0.52); B(0.4, 0.02, 0.12, C.choc, 1.0, T + 0.07, 0.62, 0); // home computer + keyboard
  B(0.34, 0.28, 0.3, C.beige, 1.0, T + 0.09 + 0.14, 0.45);                                      // CRT case
  B(0.26, 0.2, 0.01, 0x1f3a2a, 1.0, T + 0.09 + 0.15, 0.6, 0, glow);                              // green phosphor screen
  // spring-arm drafting lamp
  Cy(0.07, 0.08, 0.025, C.gold, 1.78, T + 0.012, 0.3); Cy(0.008, 0.008, 0.42, C.chrome, 1.78, T + 0.22, 0.32, 6, 0.35);
  Cy(0.008, 0.008, 0.38, C.chrome, 1.68, T + 0.52, 0.47, 6, 0, 0, 0.9); put(solid, new THREE.ConeGeometry(0.08, 0.12, 12, 1, true), C.gold, 1.52, T + 0.55, 0.5, 0, 0, 0.6);
  // orange rotary phone
  B(0.2, 0.08, 0.22, C.orange, 0.62, T + 0.04, 0.55); Cy(0.05, 0.05, 0.012, C.cream, 0.62, T + 0.085, 0.58);
  B(0.22, 0.04, 0.05, C.orange, 0.62, T + 0.1, 0.5);
  // ---- hi-fi corner on wall C (x 2.3–3.7) ----
  const hz = D - 0.25;
  B(1.3, 0.5, 0.45, C.teak, 3.0, 0.25 + 0.06, hz); for (const x of [2.4, 3.6]) for (const z of [hz - 0.18, hz + 0.18]) Cy(0.02, 0.015, 0.06, C.choc, x, 0.03, z, 6);
  B(0.44, 0.13, 0.32, C.silver, 2.7, 0.62 + 0.065, hz); B(0.36, 0.035, 0.005, C.gold, 2.7, 0.7, hz - 0.163, 0, glow);       // receiver + dial
  B(0.42, 0.1, 0.34, C.walnut, 3.2, 0.62 + 0.05, hz); Cy(0.15, 0.15, 0.012, C.black, 3.17, 0.73, hz, 20);                  // turntable
  B(0.4, 0.04, 0.36, 0xa9c1c8, 3.2, 0.78, hz);                                                                          // dust cover (opaque tint)
  B(0.36, 0.42, 0.14, C.silver, 3.0, 0.98 + 0.21 + 0.02, D - 0.09);                                                        // reel-to-reel on wall bracket
  for (const dx of [-0.09, 0.09]) Cy(0.085, 0.085, 0.015, C.black, 3.0 + dx, 1.32, D - 0.015, 16, Math.PI / 2);
  for (const x of [2.05, 3.95]) { B(0.32, 0.75, 0.3, C.walnut, x, 0.375, hz); B(0.26, 0.55, 0.01, C.choc, x, 0.42, hz - 0.155); Cy(0.09, 0.09, 0.012, C.gold, x, 0.42, hz - 0.165, 12, Math.PI / 2); }
  // ---- sunburst clock (wall C above hi-fi) ----
  Cy(0.1, 0.1, 0.03, C.gold, 3.0, 1.85, D - 0.02, 16, Math.PI / 2);
  for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; Cy(0.006, 0.006, 0.2, C.gold, 3.0 + Math.cos(a) * 0.2, 1.85 + Math.sin(a) * 0.2, D - 0.02, 4, 0, 0, a - Math.PI / 2); }
  B(0.008, 0.08, 0.004, C.choc, 3.0, 1.88, D - 0.04);
  // ---- macramé hanger + spider plant by the window (wall A, x≈0.3) ----
  for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; Cy(0.004, 0.004, 0.75, C.rope, 0.3 + Math.cos(a) * 0.05, H - 0.5, 0.3 + Math.sin(a) * 0.05, 3, Math.sin(a) * 0.12, 0, -Math.cos(a) * 0.12); }
  Cy(0.1, 0.07, 0.13, C.terracotta, 0.3, H - 0.95, 0.3, 12);
  for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; put(solid, new THREE.ConeGeometry(0.012, 0.3, 3), C.avocado, 0.3 + Math.cos(a) * 0.1, H - 0.95, 0.3 + Math.sin(a) * 0.1, Math.sin(a) * 2.3, 0, -Math.cos(a) * 2.3); }
  // ---- globe pendant over desk ----
  Cy(0.004, 0.004, 0.55, C.black, 1.2, H - 0.27, 0.5, 4); S(0.17, 0xfff1d6, 1.2, H - 0.7, 0.5, glow, 16);
  // ---- pegboard tool wall on the assembly bench back edge (bench centre x3.0 z2.0, 1.2 x 0.6) ----
  B(1.2, 0.75, 0.02, C.gold, 3.0, 0.9 + 0.375 + 0.05, 2.3 - 0.01); for (const x of [2.42, 3.58]) B(0.04, 0.85, 0.04, C.choc, x, 0.9 + 0.42, 2.3 - 0.01);
  for (const [x, y, w, h, c] of [[2.6, 1.45, 0.03, 0.22, C.orange], [2.75, 1.42, 0.04, 0.26, C.choc], [2.95, 1.5, 0.18, 0.04, C.silver], [3.2, 1.35, 0.03, 0.3, C.avocado], [3.4, 1.45, 0.12, 0.12, C.orange], [2.85, 1.15, 0.22, 0.03, C.silver]])
    B(w, h, 0.02, c, x, y, 2.3 - 0.035);
  // ---- shelf extras (shelf-local, +Z = into room): lava lamp + avocado vase + orange ceramic owl ----
  const sh = [], shg = [];
  Cy(0.045, 0.06, 0.08, C.gold, 0.68, 2.2 + 0.04, 0.12, 10, 0, 0, 0, sh); Cy(0.035, 0.055, 0.22, C.orange, 0.68, 2.2 + 0.19, 0.12, 10, 0, 0, 0, shg);
  Cy(0.02, 0.045, 0.05, C.gold, 0.68, 2.2 + 0.325, 0.12, 10, 0, 0, 0, sh);
  Cy(0.04, 0.03, 0.18, C.avocado, -0.7, 1.0 + 0.09, 0.12, 10, 0, 0, 0, sh); S(0.045, C.orange, 0.7, 1.4 + 0.05, 0.12, sh, 10);
  // ---- rug (geometric, orange/brown) + posters ----
  const tex = (draw, w = 256, h = 256) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
  const rugT = tex((g, w, h) => { g.fillStyle = '#4a2c1a'; g.fillRect(0, 0, w, h); const cs = ['#c4561f', '#d9a227', '#eadfc6', '#7a8a3a'];
    for (let r = 0; r < 4; r++) { g.strokeStyle = cs[r]; g.lineWidth = 14; g.strokeRect(18 + r * 26, 18 + r * 26, w - 36 - r * 52, h - 36 - r * 52); } });
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 1.4).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: rugT, roughness: 1 }));
  rug.position.set(1.2, 0.006, 1.25); rug.receiveShadow = true; scene.add(rug);
  const posterT = tex((g, w, h) => { // two generic posters side by side in one texture (no logos)
    g.fillStyle = '#eadfc6'; g.fillRect(0, 0, w, h); const half = w / 2;
    ['#c4561f', '#d9a227', '#7a8a3a', '#4a2c1a'].forEach((c, i) => { g.fillStyle = c; g.fillRect(12, 30 + i * 36, half - 24, 28); }); // stripes
    g.fillStyle = '#d9a227'; g.beginPath(); g.arc(half + half / 2, h * 0.45, 70, 0, Math.PI * 2); g.fill(); // sun
    g.fillStyle = '#c4561f'; g.beginPath(); g.arc(half + half / 2, h * 0.45, 46, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#4a2c1a'; g.fillRect(half + 12, h * 0.68, half - 24, h * 0.28); }, 512, 256);
  const pm = new THREE.MeshStandardMaterial({ map: posterT, roughness: 0.8 });
  const p1 = new THREE.PlaneGeometry(0.5, 0.7); p1.attributes.uv.array.forEach((v, i, a) => { if (i % 2 === 0) a[i] = v * 0.5; });
  const p2 = new THREE.PlaneGeometry(0.5, 0.7); p2.attributes.uv.array.forEach((v, i, a) => { if (i % 2 === 0) a[i] = 0.5 + v * 0.5; });
  p1.rotateY(Math.PI / 2).translate(0.012, 1.55, 1.9); p2.translate(3.9, 1.55, 0.012);
  scene.add(new THREE.Mesh(merge([p1, p2]), pm));

  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55 });
  const gmat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  const a = new THREE.Mesh(merge(solid), mat); a.castShadow = false; a.receiveShadow = true; scene.add(a);
  scene.add(new THREE.Mesh(merge(glow), gmat));
  if (shelf) { const s1 = new THREE.Mesh(merge(sh), mat);  shelf.add(s1, new THREE.Mesh(merge(shg), gmat)); }
  const lava = new THREE.PointLight(0xff7a30, low ? 0 : 0.25, 1.0, 2); lava.position.set(0.68, 2.4, 0.2); if (shelf) shelf.add(lava);
  const tris = [...solid, ...glow, ...sh, ...shg].reduce((t, g) => t + (g.index ? g.index.count : g.attributes.position.count) / 3, 0);
  return { tris: Math.round(tris) };
}
