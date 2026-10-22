// Robot bartender: procedural low-poly, brass + amber, teal eyes, ONE SkinnedMesh (1 draw), rigid-skinned to 8 bones, no shadows.
// Idle sway; when the player comes within ~7 m in the cantina it turns to them, waves 3x, then beckons ("come here"). Re-arms only after the player leaves the ~7 m trigger zone (no timer).
// Robots + DJ booth hardware: procedural placeholders in ONE SkinnedMesh (1 draw for the bartender, Dex, the booth counter, platters and crossfader).
// Rigid skinning; each robot / the booth has its own root bone, so placement = root bone transform. No shadows.
// Clay is modelling the real bartender, Dex and the booth: the behaviour code below only drives the pivots named in ROBOT_MANIFEST
// (head, arm, forearm, torso, platters ...), so a GLB whose nodes carry those names can replace the placeholder (see pivotsFromGLTF).
export const ROBOT_MANIFEST = {
  bartender: { root: 'root', torso: 'torso', head: 'head', arm: 'armR', forearm: 'foreR', armL: 'armL', forearmL: 'foreL', antenna: 'antenna' },
  dex: { root: 'root', torso: 'torso', head: 'head', arm: 'armR', forearm: 'foreR', armL: 'armL', forearmL: 'foreL', antenna: 'antenna' },
  booth: { root: 'booth', platters: ['platterA', 'platterB'], crossfader: 'xfader' },
};
// Find the manifest pivots in a loaded GLTF scene (for Clay's models). Returns the same pivot map the placeholders provide.
export function pivotsFromGLTF(root, manifest) { const out = {}; for (const [k, v] of Object.entries(manifest)) out[k] = Array.isArray(v) ? v.map(n => root.getObjectByName(n)) : root.getObjectByName(v); return out; }

export const ROBOT_PALETTES = {
  bartender: { body: 0xb8873e, dark: 0x2a2522, steel: 0x5d5a56, glow: 0x2fd6c4, plate: 0xd9cdb6 }, // brass + teal
  dex: { body: 0x3c3f47, dark: 0x1c1b20, steel: 0x8a8d94, glow: 0x9a7bff, plate: 0xb5653a },       // graphite + copper + violet
};
export function createRobotBatch(THREE) {
  const list = [], geos = [], roots = [];
  const mkBone = (bones, prefix, name, parent, x, y, z) => { const b = new THREE.Bone(); b.name = prefix + ':' + name; b.position.set(x, y, z); if (parent) bones[parent].add(b); else roots.push(b); bones[name] = b; b.userData.i = list.length; list.push(b); return b; };
  let WHITE = [0.5, 0.5], keepUV = false;
  const part = (bones, geo, b, col, emis = 0, rx = 0, ry = 0, rz = 0, x = 0, y = 0, z = 0) => { // x,y,z in bind (robot) space
    geo = geo.index ? geo.toNonIndexed() : geo; geo.rotateX(rx).rotateY(ry).rotateZ(rz).translate(x, y, z); const n = geo.attributes.position.count; col = new THREE.Color(col);
    const c = new Float32Array(n * 3), si = new Uint16Array(n * 4), sw = new Float32Array(n * 4), em = new Float32Array(n).fill(emis);
    for (let i = 0; i < n; i++) { c.set([col.r, col.g, col.b], i * 3); si[i * 4] = bones[b].userData.i; sw[i * 4] = 1; }
    geo.setAttribute('color', new THREE.BufferAttribute(c, 3)); geo.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4)); geo.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4)); geo.setAttribute('emis', new THREE.BufferAttribute(em, 1));
    if (!keepUV || !geo.attributes.uv) { const uv = new Float32Array(n * 2); for (let i = 0; i < n; i++) { uv[i * 2] = WHITE[0]; uv[i * 2 + 1] = WHITE[1]; } geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); } geos.push(geo); }; // constant uv -> a white texel of the shared map (mip 0: zero derivatives)
  const C = (rt, rb, h, s = 12) => new THREE.CylinderGeometry(rt, rb, h, s), S = (r, w = 10, hh = 8) => new THREE.SphereGeometry(r, w, hh), Bx = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  // ---- one robot (bartender silhouette; Dex adds headphones) ----
  function robot(prefix, palName, { headphones = false } = {}) {
    const P = ROBOT_PALETTES[palName], BRASS = P.body, DARK = P.dark, STEEL = P.steel, TEAL = P.glow, IVORY = P.plate;
    const bones = {}, bone = (name, parent, x, y, z) => mkBone(bones, prefix, name, parent, x, y, z), pt = (...a) => part(bones, ...a);
    // bind pose: robot faces +Z, origin on the floor; right arm on -X
    bone('root', null, 0, 0, 0); bone('torso', 'root', 0, 0.68, 0); bone('head', 'torso', 0, 0.5, 0);
    bone('armR', 'torso', -0.25, 0.36, 0); bone('foreR', 'armR', 0, -0.27, 0); bone('armL', 'torso', 0.25, 0.36, 0); bone('foreL', 'armL', 0, -0.27, 0); bone('antenna', 'head', 0, 0.16, 0);
  // base + column (root): hover plinth with a dim brass under-ring
  pt(C(0.2, 0.24, 0.1, 16), 'root', DARK, 0, 0, 0, 0, 0, 0.05, 0); pt(new THREE.TorusGeometry(0.215, 0.012, 6, 24), 'root', 0x8a6a3a, 0.15, Math.PI / 2, 0, 0, 0, 0.11, 0);
  pt(C(0.07, 0.09, 0.58, 10), 'root', STEEL, 0, 0, 0, 0, 0, 0.39, 0);
  // torso: faceted brass barrel, ivory shirt-front plate, amber chest light, brass shoulders
  pt(C(0.2, 0.17, 0.46, 8), 'torso', BRASS, 0, 0, Math.PI / 8, 0, 0, 0.91, 0); pt(Bx(0.18, 0.26, 0.04), 'torso', IVORY, 0, 0, 0, 0, 0, 0.94, 0.17);
  pt(C(0.025, 0.025, 0.012, 10), 'torso', 0xe8a04a, 1.5, Math.PI / 2, 0, 0, 0, 0.99, 0.195); pt(Bx(0.1, 0.03, 0.02), 'torso', DARK, 0, 0, 0, 0, 0, 1.06, 0.192); // bow tie
  pt(C(0.21, 0.2, 0.04, 8), 'torso', DARK, 0, 0, Math.PI / 8, 0, 0, 1.15, 0);
  for (const sx of [-1, 1]) pt(S(0.06), 'torso', BRASS, 0, 0, 0, 0, sx * 0.25, 1.04, 0);
  // head: brass dome-capped drum, dark visor, teal eyes, antenna
  pt(C(0.025, 0.03, 0.08, 8), 'head', STEEL, 0, 0, 0, 0, 0, 1.21, 0); pt(C(0.13, 0.13, 0.17, 12), 'head', BRASS, 0, 0, 0, 0, 0, 1.33, 0);
  pt(new THREE.SphereGeometry(0.13, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), 'head', BRASS, 0, 0, 0, 0, 0, 1.415, 0);
  pt(Bx(0.2, 0.07, 0.04), 'head', DARK, 0, 0, 0, 0, 0, 1.34, 0.115); for (const sx of [-1, 1]) pt(S(0.018, 8, 6), 'head', TEAL, 2.0, 0, 0, 0, sx * 0.05, 1.345, 0.137);
  pt(C(0.006, 0.006, 0.1, 6), 'antenna', STEEL, 0, 0, 0, 0, 0, 1.59, 0); pt(S(0.02, 8, 6), 'antenna', TEAL, 1.6, 0, 0, 0, 0, 1.645, 0);
  // arms: upper (shoulder bone), forearm + three-finger hand (elbow bone)
  for (const [s, sx] of [['R', -1], ['L', 1]]) { const ax = sx * 0.25;
    pt(C(0.035, 0.03, 0.25, 8), 'arm' + s, STEEL, 0, 0, 0, 0, ax, 1.04 - 0.135, 0); pt(S(0.04, 8, 6), 'fore' + s, BRASS, 0, 0, 0, 0, ax, 0.77, 0);
    pt(C(0.03, 0.026, 0.22, 8), 'fore' + s, BRASS, 0, 0, 0, 0, ax, 0.77 - 0.12, 0); pt(Bx(0.07, 0.05, 0.03), 'fore' + s, DARK, 0, 0, 0, 0, ax, 0.515, 0);
    for (const f of [-1, 0, 1]) pt(Bx(0.015, 0.05, 0.015), 'fore' + s, STEEL, 0, 0, 0, 0, ax + f * 0.022, 0.47, 0); }
    if (headphones) { pt(new THREE.TorusGeometry(0.15, 0.014, 6, 20, Math.PI), 'head', DARK, 0, 0, 0, 0, 0, 1.36, 0); for (const sx of [-1, 1]) pt(C(0.055, 0.055, 0.045, 12), 'head', STEEL, 0, 0, 0, Math.PI / 2, sx * 0.145, 1.33, 0), pt(C(0.03, 0.03, 0.05, 10), 'head', TEAL, 1.4, 0, 0, Math.PI / 2, sx * 0.16, 1.33, 0); }
    return bones; }
  // ---- DJ booth hardware (booth-local: counter faces +Z toward visitors, deck A at -X = visitors' left) ----
  function booth(prefix) {
    const bones = {}, bone = (name, parent, x, y, z) => mkBone(bones, prefix, name, parent, x, y, z), pt = (...a) => part(bones, ...a);
    bone('booth', null, 0, 0, 0); bone('platterA', 'booth', -0.48, 1.07, 0.02); bone('platterB', 'booth', 0.48, 1.07, 0.02); bone('xfader', 'booth', 0, 1.075, 0.15);
    const CH = 0x24211f, TOP = 0x3a3633, BR = 0xb8873e, DK = 0x121114, AL = 0x8f9096, TE = 0x2fd6c4, VI = 0x9a7bff;
    pt(Bx(1.3, 0.25, 0.5), 'booth', 0x1c1a1d, 0, 0, 0, 0, 0, 0.125, -0.5); pt(Bx(1.3, 0.012, 0.012), 'booth', VI, -0.9, 0, 0, 0, 0, 0.24, -0.245); // DJ riser (Dex stands on it) + violet nosing light
    pt(Bx(1.5, 0.96, 0.55), 'booth', CH, 0, 0, 0, 0, 0, 0.48, 0); pt(Bx(1.56, 0.04, 0.6), 'booth', TOP, 0, 0, 0, 0, 0, 0.98, 0); // counter + top
    pt(Bx(1.52, 0.02, 0.012), 'booth', BR, 0.15, 0, 0, 0, 0, 0.9, 0.282); pt(Bx(1.52, 0.012, 0.012), 'booth', 0xe8a04a, -1.3, 0, 0, 0, 0, 0.07, 0.28); // brass rail + amber kick light
    for (const sx of [-1, 1]) pt(Bx(0.02, 0.8, 0.012), 'booth', BR, 0.1, 0, 0, 0, sx * 0.62, 0.48, 0.282); // brass pilasters
    pt(Bx(0.22, 0.12, 0.016), 'booth', TE, -1.6, 0, 0, 0, 0.55, 0.62, 0.283); pt(Bx(0.24, 0.14, 0.01), 'booth', DK, 0, 0, 0, 0, 0.55, 0.62, 0.279); // 'Request a song' button (lit)
    for (const [d, sx] of [['A', -1], ['B', 1]]) { const x = sx * 0.48;
      pt(Bx(0.44, 0.05, 0.4), 'booth', DK, 0, 0, 0, 0, x, 1.025, 0.02); pt(C(0.012, 0.012, 0.03, 8), 'booth', AL, 0, 0, 0, 0, x, 1.065, 0.02); // deck plinth + spindle base
      pt(Bx(0.025, 0.015, 0.2), 'booth', AL, 0, 0, -0.35, 0, x + sx * 0.17, 1.065, -0.02); pt(C(0.022, 0.022, 0.02, 10), 'booth', AL, 0, 0, 0, 0, x + sx * 0.18, 1.065, -0.12); // tonearm + pivot
      pt(C(0.16, 0.16, 0.014, 32), 'platter' + d, 0x15151a, 0, 0, 0, 0, x, 1.065, 0.02); pt(C(0.055, 0.055, 0.016, 20), 'platter' + d, d === 'A' ? 0xb5653a : 0x2a7f78, 0.25, 0, 0, 0, x, 1.066, 0.02); // record + label
      pt(Bx(0.012, 0.017, 0.1), 'platter' + d, 0xd9cdb6, 0.6, 0, 0, 0, x, 1.0665, 0.02 + 0.105); // label stripe so the spin reads
      pt(C(0.012, 0.012, 0.012, 10), 'booth', TE, -1.2, 0, 0, 0, x + sx * 0.17, 1.056, 0.17); } // start/stop light
    pt(Bx(0.3, 0.07, 0.38), 'booth', 0x1d1c21, 0, 0, 0, 0, 0, 1.035, 0.02); // 2-channel mixer
    for (const sx of [-1, 1]) { for (let k = 0; k < 3; k++) pt(C(0.014, 0.014, 0.02, 8), 'booth', AL, 0, 0, 0, 0, sx * 0.065, 1.075, -0.12 + k * 0.06); pt(Bx(0.008, 0.004, 0.1), 'booth', DK, 0, 0, 0, 0, sx * 0.065, 1.071, 0.08); pt(Bx(0.03, 0.016, 0.02), 'booth', AL, 0, 0, 0, 0, sx * 0.065, 1.078, 0.08); } // EQ knobs + channel faders
    for (const sx of [-1, 1]) pt(Bx(0.012, 0.004, 0.11), 'booth', sx < 0 ? 0xb5653a : 0x2a7f78, -1.0, 0, 0, 0, sx * 0.02, 1.071, -0.1); // channel meters
    pt(Bx(0.16, 0.004, 0.012), 'booth', DK, 0, 0, 0, 0, 0, 1.071, 0.15); pt(Bx(0.024, 0.016, 0.03), 'xfader', VI, 0.5, 0, 0, 0, 0, 1.078, 0.15); // horizontal crossfader slot + cap
    return bones; }
  // a textured prop (e.g. the guestbook) riding in the same draw: own static bone; keeps its uv into the shared map
  function prop(prefix, geo, col, emis) { const bones = {}; mkBone(bones, prefix, 'root', null, 0, 0, 0); keepUV = true; part(bones, geo.clone(), 'root', col, emis); keepUV = false; return bones; }
  function setWhiteUV(uv) { WHITE = uv; }
  function finalize({ map = null } = {}) {
    const merged = new THREE.BufferGeometry(); for (const k of ['position', 'normal', 'uv', 'color', 'skinIndex', 'skinWeight', 'emis']) { const a0 = geos[0].attributes[k], n = geos.reduce((t, g) => t + g.attributes[k].array.length, 0), out = new a0.array.constructor(n); let o = 0;
      for (const g of geos) { out.set(g.attributes[k].array, o); o += g.attributes[k].array.length; } merged.setAttribute(k, new THREE.BufferAttribute(out, a0.itemSize)); }
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.55, roughness: 0.38, map }); // ONE material shared by every robot + booth part
    const uPulse = { value: 1 }; mat.userData.uPulse = uPulse; // negative emis = booth trims that pulse on the beat
    mat.onBeforeCompile = sh => { sh.uniforms.uPulse = uPulse; sh.vertexShader = 'attribute float emis;\nvarying float vEmis;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvEmis = emis;');
      sh.fragmentShader = 'uniform float uPulse;\nvarying float vEmis;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * abs(vEmis) * (vEmis < 0.0 ? uPulse : 1.0);'); };
    const mesh = new THREE.SkinnedMesh(merged, mat); mesh.name = 'robots'; for (const r of roots) mesh.add(r); mesh.updateMatrixWorld(true);
    mesh.bind(new THREE.Skeleton(list)); mesh.frustumCulled = false; mesh.castShadow = mesh.receiveShadow = false; mesh.userData.noMerge = true; return mesh; }
  return { robot, booth, prop, setWhiteUV, finalize, get boneCount() { return list.length; } };
}

// Bartender behaviour on a robot from the batch. bones.root is the placement (cantina-local), mesh = the batch SkinnedMesh.
// rebind(bones, mesh, puppet): swap in Clay's rig (rigged.js). With a puppet the gesture sequence plays his clips
// (idle loop -> turn_to_player -> wave -> beckon -> idle); facing the player stays in code on the root.
export function createBartender(THREE, bones, mesh) {
  // ---- behaviour ----
  const st = { mode: 'idle', t: 0, yaw: 0, homeYaw: 0, armed: true, lastGesture: -1e9, clock: 0, inRangePrev: false, clip: null };
  let group = bones.root, puppet = null; const B0 = { y: 0 };
  const lerp = (a, b, k) => a + (b - a) * k, ease = u => u * u * (3 - 2 * u), angDiff = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
  const _p = new THREE.Vector3();
  // playerWorld: THREE.Vector3 | null (null = not in the cantina); dt seconds
  function update(dt, playerWorld) {
    st.clock += dt; st.t += dt; const T = st.clock, B = bones;
    let inRange = false, targetYaw = st.homeYaw;
    if (playerWorld && mesh.parent) { _p.copy(playerWorld); mesh.worldToLocal(_p); const dx = _p.x - group.position.x, dz = _p.z - group.position.z, d = Math.hypot(dx, dz);
      inRange = d < (st.inRangePrev ? 7.5 : 7); /* 0.5 m hysteresis so standing on the edge doesn't count as leaving */ const y = Math.atan2(dx, dz); const lim = 1.9; targetYaw = st.homeYaw + Math.max(-lim, Math.min(lim, angDiff(st.homeYaw, y))); }
    if (!inRange && st.inRangePrev) st.armed = true; // player left -> re-arm
    // B1: no timer re-arm; one greeting per visit (re-arms only after the player leaves the trigger zone)
    if (inRange && st.armed && st.mode === 'idle') { st.mode = 'turn'; st.t = 0; st.armed = false; st.lastGesture = T; }
    st.inRangePrev = inRange;
    // facing
    const face = st.mode === 'idle' ? (inRange ? targetYaw : st.homeYaw) : targetYaw; st.yaw += angDiff(st.yaw, face) * (1 - Math.exp(-dt * (st.mode === 'idle' ? 1.5 : 5)));
    group.rotation.y = st.yaw;
    if (puppet) { // Clay's clips: durations come from the clips themselves
      const t = st.t, D = n => puppet.duration(n) || 1;
      if (st.mode === 'turn' && t > D('turn_to_player') - 0.15) { st.mode = 'wave'; st.t = 0; }
      else if (st.mode === 'wave' && t > D('wave') - 0.15) { st.mode = 'beckon'; st.t = 0; }
      else if (st.mode === 'beckon' && t > D('beckon') - 0.1) { st.mode = 'idle'; st.t = 0; }
      else if (st.mode === 'lower') { st.mode = 'idle'; st.t = 0; }
      const want = { idle: 'idle', turn: 'turn_to_player', wave: 'wave', beckon: 'beckon' }[st.mode];
      if (st.clip !== want) { puppet.play(want, { loop: want === 'idle', fade: want === 'idle' ? 0.45 : 0.2 }); st.clip = want; }
      puppet.update(dt); B.root.position.y = B0.y; return; }
    // idle sway (always, subtle)
    B.torso.rotation.set(0, Math.sin(T * 0.9) * 0.06, Math.sin(T * 0.6) * 0.025); B.head.rotation.set(Math.sin(T * 0.7) * 0.05, Math.sin(T * 0.5 + 1) * 0.12, 0);
    B.root.position.y = B0.y + Math.sin(T * 1.6) * 0.01; B.antenna.rotation.z = Math.sin(T * 3.1) * 0.15;
    let aR = [0.05, 0, 0.08], fR = [-0.25, 0, 0], aL = [0.05, 0, -0.08], fL = [-0.3, 0, 0]; // rest: arms slightly forward
    const t = st.t;
    if (st.mode === 'turn') { if (t > 0.7) { st.mode = 'wave'; st.t = 0; } }
    else if (st.mode === 'wave') { const u = Math.min(1, t / 0.35), up = ease(u); // raise, 3 waves over 2.4 s, then lower toward the beckon
      aR = [lerp(0.05, 0, up), 0, lerp(0.08, -2.55, up)]; fR = [0, 0, lerp(0, Math.sin((t - 0.35) * Math.PI * 2 / 0.8) * 0.55, Math.min(1, Math.max(0, (t - 0.25) / 0.2)))];
      B.head.rotation.z = Math.sin(t * 2.5) * 0.08; if (t > 0.35 + 2.4) { st.mode = 'beckon'; st.t = 0; } }
    else if (st.mode === 'beckon') { const u = ease(Math.min(1, t / 0.4)); // arm forward, palm up, forearm curls twice ("come here")
      aR = [lerp(0, -1.25, u), 0, lerp(-2.55, -0.15, u)]; const curl = t > 0.4 ? (1 - Math.cos((t - 0.4) * Math.PI * 2 / 0.75)) / 2 : 0; fR = [lerp(0, -0.25 - curl * 1.25, u), 0, 0];
      B.torso.rotation.x = 0.06 * u; B.head.rotation.x = 0.1 * u; if (t > 0.4 + 1.5 + 0.2) { st.mode = 'lower'; st.t = 0; } }
    else if (st.mode === 'lower') { const u = ease(Math.min(1, t / 0.8)); aR = [lerp(-1.25, 0.05, u), 0, lerp(-0.15, 0.08, u)]; fR = [lerp(-0.25, -0.25, u), 0, 0]; if (t > 0.8) { st.mode = 'idle'; st.t = 0; } }
    B.armR.rotation.set(...aR); B.foreR.rotation.set(...fR); B.armL.rotation.set(aL[0] + Math.sin(T * 0.8) * 0.03, aL[1], aL[2]); B.foreL.rotation.set(...fL);
  }
  return { get group() { return group; }, get mesh() { return mesh; }, get bones() { return bones; }, get puppet() { return puppet; }, update, state: st, place(x, y, z) { group.position.set(x, y, z); B0.y = y; }, setHome(yaw) { st.homeYaw = st.yaw = yaw; group.rotation.y = yaw; },
    rebind(b2, m2, p2 = null) { b2.root.position.copy(group.position); b2.root.rotation.copy(group.rotation); bones = b2; mesh = m2; group = b2.root; puppet = p2; st.clip = null; } };
}
