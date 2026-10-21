// Clay's rigged cantina models (manifest `rigged[]`, room "cantina_rigged"): Tapper (bartender), Dex and the DJ booth.
// Never frozen or merged into the static cantina set. Instead the three GLBs + the guestbook book are re-packed into ONE SkinnedMesh
// (one shared skeleton, one MeshBasicMaterial, one 2048 runtime atlas) per LOD, so the cantina pays 1 draw for all of them (the placeholder batch
// paid the same 1). The booth's `dj-screen` quad is handed to dj.js and stays its own draw (live canvas), exactly like the placeholder screen.
// Clips play on the untouched GLB scenes ("puppets", never rendered) through an AnimationMixer; each frame the joint rotations are copied
// onto the batch bones. Root tracks are dropped: placement / facing (turn toward the player) stay in code.
//
// Atlas (2048, flipY false): [0,0] guestbook canvas 1024x768 (copied again whenever gb.tex changes) + a white block for the glows,
// [1024,0] Tapper atlas, [0,1024] Dex atlas, [1024,1024] booth atlas. Each Clay atlas is 1024; at 512 the atlas could be 1024x1536,
// which saves GPU memory (about 21 MB -> 7 MB with mips) but no draws.
export const RIG_JOINTS = { bartender: ['root', 'torso', 'head', 'antenna', 'armR', 'foreR', 'armL', 'foreL'], dex: ['root', 'torso', 'head', 'antenna', 'armR', 'foreR', 'armL', 'foreL'], booth: ['booth', 'platterA', 'platterB', 'xfader'] };
const KEY = { bartender: /robot_bartender/, dex: /robot_dex/, booth: /dj_booth/ };
const CELL = { bartender: [1024, 0], dex: [0, 1024], booth: [1024, 1024] }, A = 2048, WHITE = [32 / A, 832 / A];

export async function loadRigged(THREE, { loader, base, entries, gb }) {
  const ent = {}; for (const [k, re] of Object.entries(KEY)) ent[k] = entries.find(e => re.test(e.file || '')); if (!ent.bartender || !ent.dex || !ent.booth) throw new Error('rigged: manifest is missing ' + Object.keys(KEY).filter(k => !ent[k]).join(', '));
  const load = f => new Promise((res, rej) => loader.load(base + f + '?v=' + encodeURIComponent(entries.find(e => e.file === f || e.lod1 === f)?.date || ''), g => res(g), undefined, rej));
  const names = Object.keys(KEY), [full, lod] = await Promise.all([Promise.all(names.map(k => load(ent[k].file))), Promise.all(names.map(k => load(ent[k].lod1 || ent[k].file)))]);
  const G = {}, L = {}; names.forEach((k, i) => { G[k] = full[i]; L[k] = lod[i]; });
  // ---- bones: one skeleton for every LOD (copied from the full GLBs' joints; identity rest rotations per Clay) ----
  const list = [], bones = {}, roots = [], warn = [];
  for (const k of names) { bones[k] = {}; const sc = G[k].scene; sc.updateMatrixWorld(true);
    for (const j of RIG_JOINTS[k]) { const src = sc.getObjectByName(j); if (!src) { warn.push(k + ':' + j + ' missing'); continue; } const b = new THREE.Bone(); b.name = k + '_' + j; b.position.copy(src.position);
      if (Math.abs(src.quaternion.w) < 0.9999) warn.push(k + ':' + j + ' rest rotation not identity'); const par = src.parent && bones[k][src.parent.name]; if (par) par.add(b); else roots.push(b); bones[k][j] = b; b.userData.i = list.length; list.push(b); } }
  { const b = new THREE.Bone(); b.name = 'book_root'; roots.push(b); bones.book = { root: b }; b.userData.i = list.length; list.push(b); }
  // ---- atlas ----
  const cv = document.createElement('canvas'); cv.width = cv.height = A; const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 800, 64, 64);
  const mapOf = k => { let t = null; G[k].scene.traverse(m => { if (m.isMesh && m.material?.map && /atlas/.test(m.material.name)) t = m.material.map; }); return t; };
  for (const k of names) { const t = mapOf(k); if (t?.image) g.drawImage(t.image, CELL[k][0], CELL[k][1], 1024, 1024); else warn.push(k + ' atlas missing'); }
  const at = new THREE.CanvasTexture(cv); at.flipY = false; at.colorSpace = THREE.SRGBColorSpace; at.anisotropy = 4;
  let gbVer = -1; const syncBook = () => { if (!gb || gb.tex.version === gbVer) return; gbVer = gb.tex.version; g.clearRect(0, 0, 1024, 768); g.drawImage(gb.tex.image, 0, 0, 1024, 768); at.needsUpdate = true; }; syncBook();
  // ---- geometry: every skinned primitive -> rest-pose positions, uv into the atlas, colour, skin indices into the shared skeleton, emis ----
  let uvOut = 0; const v = new THREE.Vector3(), amber = new THREE.Color('#e8a04a');
  function pack(set) { const geos = []; let tris = 0;
    for (const k of names) { const sc = set[k].scene; sc.updateMatrixWorld(true);
      sc.traverse(m => { if (!m.isSkinnedMesh) return; m.skeleton.update(); const src = m.geometry, n = src.attributes.position.count, mat = m.material, glow = !mat.map, idx = src.index;
        const pos = new Float32Array(n * 3), uv = new Float32Array(n * 2), col = new Float32Array(n * 3), si = new Uint16Array(n * 4), sw = new Float32Array(n * 4), em = new Float32Array(n);
        const c = glow ? (mat.emissive && mat.emissive.getHex() ? mat.emissive.clone() : mat.color.clone()) : new THREE.Color(1, 1, 1), e = glow ? (k === 'booth' ? -1 : 1) : 0, [cx, cy] = CELL[k];
        const map = m.skeleton.bones.map(b => bones[k][b.name]?.userData.i ?? bones[k][RIG_JOINTS[k][0]].userData.i);
        for (let i = 0; i < n; i++) { v.fromBufferAttribute(src.attributes.position, i); m.applyBoneTransform(i, v); v.applyMatrix4(m.matrixWorld); pos.set([v.x, v.y, v.z], i * 3);
          if (glow) { uv[i * 2] = WHITE[0]; uv[i * 2 + 1] = WHITE[1]; } else { let u = src.attributes.uv.getX(i), w = src.attributes.uv.getY(i); if (u < -0.002 || u > 1.002 || w < -0.002 || w > 1.002) uvOut++; u = Math.min(1, Math.max(0, u)); w = Math.min(1, Math.max(0, w)); uv[i * 2] = (cx + u * 1024) / A; uv[i * 2 + 1] = (cy + w * 1024) / A; }
          let cr = c.r, cg = c.g, cb = c.b; if (cg > 1.5 * cr && cb > 1.5 * cr && cg > 0.15 && !(v.y > 1.2)) { cr = amber.r; cg = amber.g; cb = amber.b; } // teal/cyan glows + booth trims -> amber; robot eyes are the clusters above y 1.2
          col.set([cr, cg, cb], i * 3); em[i] = e; for (let q = 0; q < 4; q++) { si[i * 4 + q] = map[src.attributes.skinIndex.getComponent(i, q)]; sw[i * 4 + q] = src.attributes.skinWeight.getComponent(i, q); } }
        let gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); gg.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); gg.setAttribute('color', new THREE.BufferAttribute(col, 3));
        gg.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4)); gg.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4)); gg.setAttribute('emis', new THREE.BufferAttribute(em, 1)); if (idx) gg.setIndex(idx.clone()); gg = gg.index ? gg.toNonIndexed() : gg;
        tris += gg.attributes.position.count / 3; geos.push(gg); }); }
    if (gb) { // the guestbook rides in this draw too (its canvas lives in the atlas cell [0,0])
      let bg = gb.mesh.geometry.clone(); bg = bg.index ? bg.toNonIndexed() : bg; const n = bg.attributes.position.count, uv = new Float32Array(n * 2), col = new Float32Array(n * 3).fill(0.92), si = new Uint16Array(n * 4), sw = new Float32Array(n * 4), em = new Float32Array(n);
      for (let i = 0; i < n; i++) { uv[i * 2] = bg.attributes.uv.getX(i) * 1024 / A; uv[i * 2 + 1] = (1 - bg.attributes.uv.getY(i)) * 768 / A; si[i * 4] = bones.book.root.userData.i; sw[i * 4] = 1; }
      const gg = new THREE.BufferGeometry(); gg.setAttribute('position', bg.attributes.position); gg.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); gg.setAttribute('color', new THREE.BufferAttribute(col, 3)); gg.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4)); gg.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4)); gg.setAttribute('emis', new THREE.BufferAttribute(em, 1)); geos.push(gg); tris += n / 3; }
    const out = new THREE.BufferGeometry(); for (const a of ['position', 'uv', 'color', 'skinIndex', 'skinWeight', 'emis']) { const a0 = geos[0].attributes[a], arr = new a0.array.constructor(geos.reduce((t, x) => t + x.attributes[a].array.length, 0)); let o = 0; for (const x of geos) { arr.set(x.attributes[a].array, o); o += x.attributes[a].array.length; } out.setAttribute(a, new THREE.BufferAttribute(arr, a0.itemSize)); }
    out.userData.tris = Math.round(tris); return out; }
  const uPulse = { value: 1 }, mat = new THREE.MeshBasicMaterial({ map: at, vertexColors: true }); mat.name = 'cantina_rigged_atlas'; mat.userData.uPulse = uPulse;
  mat.onBeforeCompile = sh => { sh.uniforms.uPulse = uPulse; sh.vertexShader = 'attribute float emis;\nvarying float vEmis;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvEmis = emis;');
    sh.fragmentShader = 'uniform float uPulse;\nvarying float vEmis;\n' + sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\nif (vEmis < 0.0) diffuseColor.rgb *= uPulse;'); }; // booth trims pulse on the beat (amber)
  const holder = new THREE.Group(); holder.name = 'rigged-bones'; for (const r of roots) holder.add(r); holder.updateMatrixWorld(true); const skeleton = new THREE.Skeleton(list);
  const mk = (geo, name) => { const m = new THREE.SkinnedMesh(geo, mat); m.name = name; m.frustumCulled = false; m.castShadow = m.receiveShadow = false; m.userData.noMerge = true; m.bind(skeleton, new THREE.Matrix4()); return m; };
  const meshFull = mk(pack(G), 'rigged-robots'), meshLod = mk(pack(L), 'rigged-robots-lod1'); meshFull.add(holder); // bones live under the full mesh; the lod1 mesh shares the same skeleton
  // ---- screen quad for dj.js (booth-local) ----
  let screenGeo = null; G.booth.scene.traverse(m => { const matName = m.material?.name || ''; if (m.isMesh && !m.isSkinnedMesh && (m.name === 'dj-screen' || matName === 'cantina_dj_screen' || matName === 'owlcove_dj_screen')) { m.updateMatrixWorld(true); screenGeo = m.geometry.clone().applyMatrix4(m.matrixWorld); } });
  if (!screenGeo) warn.push('dj-screen missing');
  // ---- clip puppets ----
  const puppets = {}; for (const k of ['bartender', 'dex']) { const sc = G[k].scene, mixer = new THREE.AnimationMixer(sc), actions = {};
    for (const clip of G[k].animations) { const c = clip.clone(); c.tracks = c.tracks.filter(t => t.name.endsWith('.quaternion') && !/^root\./.test(t.name)); actions[c.name] = mixer.clipAction(c); }
    const src = RIG_JOINTS[k].filter(j => j !== 'root').map(j => [sc.getObjectByName(j), bones[k][j]]).filter(([a, b]) => a && b);
    puppets[k] = { mixer, actions, cur: null, play(name, { fade = 0.25, loop = true } = {}) { const a = actions[name]; if (!a || this.cur === a) return a; a.reset(); a.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity); a.clampWhenFinished = !loop; a.enabled = true; a.setEffectiveWeight(1).play(); if (this.cur) this.cur.crossFadeTo(a, fade, false); this.cur = a; return a; },
      update(dt) { mixer.update(dt); for (const [s, b] of src) b.quaternion.copy(s.quaternion); }, duration: n => actions[n]?.getClip().duration || 0 }; }
  const tris = { full: meshFull.geometry.userData.tris, lod1: meshLod.geometry.userData.tris };
  return { meshFull, meshLod, skeleton, bones, puppets, screenGeo, uPulse, atlas: at, syncBook, warn, uvOut, tris, entries: ent,
    info: `rigged: Tapper + Dex + booth + book in 1 draw (${tris.full}/${tris.lod1} tris), screen 1 draw${warn.length ? ' · WARN ' + warn.join('; ') : ''}${uvOut ? ' · ' + uvOut + ' uv clamped' : ''}` };
}
