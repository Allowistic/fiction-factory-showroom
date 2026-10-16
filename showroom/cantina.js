// Cantina + dogleg passage (Mira SHOWROOM_SPEC cantina section). Procedural shell; Clay's pieces load from builds-opt when present.
import { DOOR, PASSAGE, CANTINA, HALL } from './layout.js';
import { PAL, vcBuilder } from './props.js';

function canvasTex(THREE, w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
// round airlock arch: brass half-torus + jambs + spandrel infill (rect minus semicircle) in the wall plane. Local frame: wall plane z=0, normal +Z.
export function airlock(THREE, B, spandrelGeos, x, z, ry, w = 1.2, h = 2.2) {
  const r = w / 2, spring = h - r, m = new THREE.Matrix4().makeRotationY(ry).setPosition(x, 0, z);
  const s0 = B.solid.length, g0 = B.glow.length;
  B.put(B.solid, new THREE.TorusGeometry(r + 0.04, 0.05, 6, 20, Math.PI), PAL.brass, 0, spring, 0);
  for (const sx of [-1, 1]) { B.box(0.1, spring, 0.14, PAL.brass, sx * (r + 0.04), spring / 2, 0); B.box(0.03, spring - 0.1, 0.02, 0x2fd6c4, sx * (r - 0.02), spring / 2, 0.06, 0, B.glow); } // teal seal light
  for (const g of B.solid.slice(s0)) g.applyMatrix4(m); for (const g of B.glow.slice(g0)) g.applyMatrix4(m);
  const sh = new THREE.Shape(); sh.moveTo(-r, spring); sh.lineTo(-r, h); sh.lineTo(r, h); sh.lineTo(r, spring); sh.absarc(0, spring, r, 0, Math.PI, false);
  for (const side of [1, -1]) { const g = new THREE.ShapeGeometry(sh, 8); if (side < 0) g.rotateY(Math.PI); g.translate(0, 0, side * 0.002); g.applyMatrix4(m); spandrelGeos.push(g); }
}
const wallQuad = (THREE, x0, z0, x1, z1, y0, y1) => { const len = Math.hypot(x1 - x0, z1 - z0), g = new THREE.PlaneGeometry(len, y1 - y0);
  const dx = (x1 - x0) / len, dz = (z1 - z0) / len; g.rotateY(Math.atan2(-dz, dx)); g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); return g; }; // normal = left of a->b

export function buildPassage(THREE, merge, M) {
  const grp = new THREE.Group(); grp.name = 'passage'; const B = vcBuilder(THREE), H = PASSAGE.H, w2 = PASSAGE.w / 2, [tx, tz] = PASSAGE.turn, [ex] = PASSAGE.exit, z0 = HALL.z1;
  const walls = [], floors = [];
  // leg A (+Z) and leg B (+X); walls listed so their normals face inward
  walls.push(wallQuad(THREE, tx - w2, tz + w2, tx - w2, z0, 0, H));          // A west (x=2.45), normal +X
  walls.push(wallQuad(THREE, tx + w2, z0, tx + w2, tz - w2, 0, H));          // A east up to the turn, normal -X
  walls.push(wallQuad(THREE, ex, tz + w2, tx - w2, tz + w2, 0, H));          // far wall z=12.6, normal -Z
  walls.push(wallQuad(THREE, tx + w2, tz - w2, ex, tz - w2, 0, H));          // B south wall z=11.4, normal +Z
  floors.push(new THREE.PlaneGeometry(PASSAGE.w, tz + w2 - z0).rotateX(-Math.PI / 2).translate(tx, 0.001, (z0 + tz + w2) / 2));
  floors.push(new THREE.PlaneGeometry(ex - (tx + w2), PASSAGE.w).rotateX(-Math.PI / 2).translate((tx + w2 + ex) / 2, 0.001, tz));
  const ceil = floors.map(f => f.clone().rotateX(Math.PI).translate(0, H, 0));
  grp.add(new THREE.Mesh(merge(walls), M.pwall), new THREE.Mesh(merge(floors), M.deck), new THREE.Mesh(merge(ceil), M.pwall));
  // dim amber floor strip along both sides + one glowing panel at the turn
  B.box(0.02, 0.02, tz + w2 - z0, PAL.gold, tx - w2 + 0.03, 0.04, (z0 + tz + w2) / 2, 0, B.glow); B.box(0.02, 0.02, tz - w2 - z0, PAL.gold, tx + w2 - 0.03, 0.04, (z0 + tz - w2) / 2, 0, B.glow);
  B.box(ex - tx + w2, 0.02, 0.02, PAL.gold, (tx - w2 + ex) / 2, 0.04, tz + w2 - 0.03, 0, B.glow); B.box(ex - tx - w2, 0.02, 0.02, PAL.gold, (tx + w2 + ex) / 2, 0.04, tz - w2 + 0.03, 0, B.glow);
  B.box(0.55, 0.8, 0.02, 0xe8a24a, tx, 1.45, tz + w2 - 0.012, 0, B.glow); B.box(0.65, 0.9, 0.03, PAL.brass, tx, 1.45, tz + w2 - 0.03);
  const sp = []; airlock(THREE, B, sp, DOOR.x, z0, 0); // hall-end arch (the cantina-end arch belongs to the cantina wall)
  grp.add(new THREE.Mesh(merge(sp), M.pwall));
  grp.add(new THREE.Mesh(merge(B.solid), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.3 })));
  grp.add(new THREE.Mesh(merge(B.glow), new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false })));
  const L = new THREE.PointLight(0xffa860, 1.2, 3.2, 1.6); L.position.set(tx, 1.4, tz); grp.add(L);
  return grp;
}

export function buildCantina(THREE, merge, M, opts = {}) {
  const C = CANTINA, grp = new THREE.Group(); grp.name = 'cantina'; grp.position.set(C.origin[0], 0, C.origin[1]); grp.rotation.y = C.ry;
  const B = vcBuilder(THREE), hw = C.W / 2, D = C.D, H = C.H, ch = 0.6;
  // 8-sided room (chamfered corners), local coords; listed counter-clockwise from above so wall normals face inward
  const P = [[hw - ch, 0], [hw, ch], [hw, D - ch], [hw - ch, D], [-hw + ch, D], [-hw, D - ch], [-hw, ch], [-hw + ch, 0]];
  const walls = [], spand = [];
  for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length];
    if (i === P.length - 1) { // entry wall z=0 with the airlock hole (x -0.6..0.6, h 2.2)
      walls.push(wallQuad(THREE, a[0], 0, -0.6, 0, 0, H - 0.6), wallQuad(THREE, -0.6, 0, 0.6, 0, 2.2, H - 0.6), wallQuad(THREE, 0.6, 0, b[0], 0, 0, H - 0.6)); continue; }
    walls.push(wallQuad(THREE, a[0], a[1], b[0], b[1], 0, H - 0.6)); }
  grp.add(new THREE.Mesh(merge(walls), M.cwall));
  airlock(THREE, B, spand, 0, 0, 0); grp.add(new THREE.Mesh(merge(spand), M.cwall));
  // floor + ribbed hull: walls stop at 2.6 m, hull ribs arch up to 3.2 m; dark ceiling skin follows a 3-facet vault
  const shape = new THREE.Shape(P.map(([x, z]) => new THREE.Vector2(x, -z)));
  const fl = new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2); { const p = fl.attributes.position, uv = fl.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / 1.2, p.getZ(i) / 1.2); }
  grp.add(new THREE.Mesh(fl, M.deck));
  const vault = [], yS = H - 0.6, flat = 1.6; // facets: side slopes from (±hw, 2.6) to (±flat, 3.2), flat top
  for (const sx of [-1, 1]) { const len = Math.hypot(hw - flat, 0.6), g = new THREE.PlaneGeometry(len, D); g.rotateX(Math.PI / 2); g.rotateZ(-sx * Math.atan2(0.6, hw - flat)); g.translate(sx * (hw + flat) / 2, yS + 0.3, D / 2); vault.push(g); }
  vault.push(new THREE.PlaneGeometry(flat * 2, D).rotateX(Math.PI / 2).translate(0, H, D / 2));
  { const gs = new THREE.Shape([new THREE.Vector2(-hw, yS), new THREE.Vector2(hw, yS), new THREE.Vector2(flat, H), new THREE.Vector2(-flat, H)]); // gable ends
    vault.push(new THREE.ShapeGeometry(gs), new THREE.ShapeGeometry(gs).rotateY(Math.PI).translate(0, 0, D)); }
  grp.add(new THREE.Mesh(merge(vault.map(g => g.index ? g : g)), M.chull));
  for (let z = C.ribs / 2; z < D; z += C.ribs) { // brass wall ribs + hull ribs with a thin teal under-glow
    for (const sx of [-1, 1]) { B.box(0.08, yS, 0.1, PAL.brass, sx * (hw - 0.04), yS / 2, z); B.put(B.solid, new THREE.BoxGeometry(Math.hypot(hw - flat, 0.6), 0.1, 0.1), PAL.brass, sx * (hw + flat) / 2, yS + 0.27, z, 0, 0, -sx * Math.atan2(0.6, hw - flat)); }
    B.box(flat * 2, 0.1, 0.1, PAL.brass, 0, H - 0.05, z); }
  // recessed upward teal cove (Clay): brass lip along both vault springlines hides the strip; additive gradient fans glow up the ribbed slopes. 2 draws.
  { const cove = [], fan = [];
    for (const sx of [-1, 1]) { const xo = hw - 0.75, yo = yS + 0.6 * (hw - xo) / (hw - flat); // cove sits up the slope (clears the 2.78 m back bar)
      B.box(0.04, 0.14, D - 1.3, PAL.brass, sx * (xo - 0.18), yo - 0.06, D / 2); B.box(0.2, 0.03, D - 1.3, PAL.char, sx * (xo - 0.08), yo - 0.12, D / 2); // lip + tray // lip + tray (strip hidden behind lip)
      const x1 = flat - 0.1, len = Math.hypot(xo - x1, (xo - x1) * 0.6 / (hw - flat)), g = new THREE.PlaneGeometry(len, D - 1.3, 8, 1); g.rotateX(Math.PI / 2); g.rotateZ(-sx * Math.atan2(0.6, hw - flat)); g.translate(sx * (xo + x1) / 2, (yo + H) / 2 - 0.03, D / 2);
      const pa = g.attributes.position; const c = new Float32Array(pa.count * 3); for (let i = 0; i < pa.count; i++) { const t = (Math.abs(pa.getX(i)) - x1) / (xo - x1); const k = Math.pow(Math.max(0, t), 3) * 0.32; c[i * 3] = 0.18 * k; c[i * 3 + 1] = 0.84 * k; c[i * 3 + 2] = 0.77 * k; } // brightest at the lip (outer edge)
      g.setAttribute('color', new THREE.BufferAttribute(c, 3)); g.deleteAttribute('normal'); g.deleteAttribute('uv'); fan.push(g); }
    grp.add(Object.assign(new THREE.Mesh(merge(fan), new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true, toneMapped: false })), { name: 'cantina-cove-glow', renderOrder: 2 })); }
  // ---- placeholders until Clay's files land (labeled) ----
  const ph = opts.placeholders = {}; const S0 = B.solid, G0 = B.glow; B.solid = []; B.glow = []; // placeholders built apart so they can be dropped when Clay's files load
  const bar = []; const [[ax, az], [bx, bz]] = C.barArc, cx = -2.0, cz = 2.6; // quadratic arc bulging into the room
  const q = t => [(1 - t) ** 2 * ax + 2 * (1 - t) * t * cx + t * t * bx, (1 - t) ** 2 * az + 2 * (1 - t) * t * cz + t * t * bz];
  for (let i = 0; i < 6; i++) { const [x0, z0] = q(i / 6), [x1, z1] = q((i + 1) / 6), len = Math.hypot(x1 - x0, z1 - z0) + 0.04, ry = Math.atan2(x1 - x0, z1 - z0);
    bar.push(B.put(B.solid, new THREE.BoxGeometry(0.6, 1.0, len), PAL.rust, (x0 + x1) / 2, 0.5, (z0 + z1) / 2, 0, ry, 0));
    B.put(B.solid, new THREE.BoxGeometry(0.66, 0.05, len), PAL.brass, (x0 + x1) / 2, 1.025, (z0 + z1) / 2, 0, ry, 0);
    B.put(B.glow, new THREE.BoxGeometry(0.02, 0.02, len), 0xffa040, (x0 + x1) / 2 + Math.cos(ry) * 0.31, 0.06, (z0 + z1) / 2 - Math.sin(ry) * 0.31, 0, ry, 0); } // amber underside
  for (let i = 0; i < 4; i++) { const [x, z] = q(0.2 + i * 0.2); B.cyl(0.18, 0.18, 0.06, PAL.rust, x + 0.6, 0.75, z, 12); B.cyl(0.03, 0.03, 0.72, PAL.brass, x + 0.6, 0.36, z, 6); }
  B.box(0.35, 2.0, 3.0, PAL.char, -hw + 0.2, 1.0, 3.2); for (const y of [1.1, 1.5, 1.9]) B.box(0.05, 0.02, 2.8, 0x2fd6c4, -hw + 0.38, y, 3.2, 0, B.glow); // back bar shelves (teal)
  for (let i = 0; i < 7; i++) { const a = -0.3 + i * 0.35; B.put(B.solid, new THREE.BoxGeometry(0.5, 0.85, 0.2), PAL.rust, 2.6 + Math.cos(a) * 1.1, 0.425, 3.6 + Math.sin(a) * 1.1, 0, -a, 0); } // booth arc (open toward ent/stand)
  B.cyl(0.5, 0.5, 0.05, PAL.walnut, 2.6, 0.74, 3.6, 20); B.cyl(0.06, 0.25, 0.72, PAL.char, 2.6, 0.36, 3.6, 10);
  B.cyl(0.004, 0.004, 1.2, PAL.brass, 2.6, H - 0.6, 3.6, 4); B.sph(0.14, 0xffd9a0, 2.6, 1.9, 3.6, B.glow, 12); // booth pendant
  const MIR = new THREE.Matrix4().makeScale(-1, 1, 1); // mirrored: bar on the LEFT as you enter (Mira), booth on the right
  const phS = B.solid.map(g => g.applyMatrix4(MIR)), phG = B.glow.map(g => g.applyMatrix4(MIR)); B.solid = S0; B.glow = G0;
  const phMesh = new THREE.Group(); phMesh.add(new THREE.Mesh(merge(phS), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.15, side: THREE.DoubleSide })), new THREE.Mesh(merge(phG), new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, side: THREE.DoubleSide }))); grp.add(phMesh);
  const solidMesh = new THREE.Mesh(merge(B.solid), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.15 })); grp.add(solidMesh);
  if (B.glow.length) grp.add(new THREE.Mesh(merge(B.glow), new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false })));
  const entPh = new THREE.Mesh(new THREE.BoxGeometry(4.07, 2.2, 0.37).translate(C.ent[0], 1.1, C.ent[2]), new THREE.MeshStandardMaterial({ color: 0x3a2a20, roughness: 0.6 })); grp.add(entPh); // entertainment center placeholder
  // labels (one atlas, one draw)
  const LBL = [['Bar arc (placeholder)', 2.3, 1.35, 3.2], ['Stools x4 (placeholder)', 1.3, 1.05, 2.4], ['Booth + table (placeholder)', -2.6, 1.35, 3.6], ['Entertainment center (placeholder)', 0, 2.5, 6.05]];
  const lt = canvasTex(THREE, 1024, 64 * LBL.length, (g, w) => LBL.forEach(([t], i) => { g.fillStyle = 'rgba(10,30,30,.85)'; g.fillRect(0, i * 64, w, 64); g.fillStyle = '#7ff0e2'; g.font = '34px system-ui'; g.textAlign = 'center'; g.fillText(t, w / 2, i * 64 + 44); }));
  lt.wrapS = lt.wrapT = THREE.ClampToEdgeWrapping;
  const lg = LBL.map(([, x, y, z], i) => { const g = new THREE.PlaneGeometry(1.1, 0.07); const uv = g.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setY(k, 1 - (i + 1 - uv.getY(k)) / LBL.length); g.rotateY(Math.PI); g.translate(x, y, z); return g; }); // face the door (-Z)
  const labels = new THREE.Mesh(merge(lg), new THREE.MeshBasicMaterial({ map: lt, transparent: true, depthWrite: false })); grp.add(labels);
  // teleport target: 2 x 2 m ring in the standing zone
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.95, 1.0, 48).rotateX(-Math.PI / 2).translate(C.stand[0], 0.008, C.stand[1]), new THREE.MeshBasicMaterial({ color: 0x2fd6c4, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  grp.add(ring);
  // light: ~20% ambient, bar underside amber, back-bar teal, entertainment glow, booth pendant
  const hemi = new THREE.HemisphereLight(0x8a8090, 0x4a3420, 0.9); grp.add(hemi);
  const lights = [[0xffa040, 2.2, 3.5, 2.2, 0.35, 3.3], [0x2fd6c4, 1.6, 3.0, 3.4, 1.6, 3.2], [0xffc890, 2.4, 4.0, 0, 1.6, 5.4], [0xffd09a, 1.8, 2.6, -2.6, 1.7, 3.6]]
    .map(([c, I, d, x, y, z]) => { const L = new THREE.PointLight(c, I, d, 1.6); L.position.set(x, y, z); grp.add(L); return L; });
  for (const o of [entPh, phMesh, labels]) o.traverse(m => m.userData.noMerge = true); // never baked into static batches: they get swapped out at runtime
  return { group: grp, solidMesh, labels, ring, hemi, lights, hideEntPlaceholder: () => { entPh.visible = false; entPh.userData.noMerge = true; }, hidePlaceholders: () => { for (const o of [entPh, phMesh, labels]) { o.visible = false; o.traverse(m => m.userData.noMerge = true); } } };
}
