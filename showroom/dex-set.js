// Dex DJ set: beat-normalised clips for Clay's rigged Dex (cantina_robot_dex.glb, joints root/torso/head/antenna/armR/foreR/armL/foreL).
// Motion God pass for Owl Cove Tiki Nest. No new meshes, no new draws: clips play on the existing puppet mixer (rigged.js).
//
// Time unit = BEATS. A clip of N beats has duration N; beat-lock with  action.time = mod(beatPos, N).
// Two layers that never touch the same joint, so both run at weight 1 without blending fights:
//   BODY  groove_nod_bounce            torso / head / antenna  (+ root bob <= 1.2 cm, applied in code: rigged.js drops root tracks)
//   ARMS  decks_work_AB, xfader_cut, scratch_build_R, scratch_build_L, crowd_point, request_wave, hands_home   (armR/foreR/armL/foreL)
// Every ARMS clip starts and ends on "home" (right hand on deck A, left hand on deck B), so switching on an 8-beat line is seamless.
// Hand contacts are solved by a small two-bone IK against DEX_TARGETS (booth-local). Booth reshape = new numbers in DEX_TARGETS
// (or dexSet.setTargets({...})), clips are re-baked in ~5 ms. Pure math core (no THREE) so it also runs in node for QA / glb baking.

// ---------------- rig (Clay's bind transforms, parent-local; rest rotations are identity) ----------------
export const DEX_RIG = {
  torso: [0, 0.68, 0], head: [0, 0.5, 0], antenna: [0, 0.22, -0.07],
  shoulder: { R: [-0.25, 0.36, 0], L: [0.25, 0.36, 0] },   // armR / armL in torso space (right arm on -X, Dex faces +Z)
  elbow: { R: [-0.01, -0.27, 0], L: [0.01, -0.27, 0] },     // foreR / foreL in arm space
  eff: { palm: 0.37, tip: 0.425 },                          // effector distance below the elbow along the forearm (-Y): palm centre / fingertips
};

// ---------------- reach targets: booth-local metres (booth faces +Z, deck A on -X = crowd's left = Dex's right hand) ----------------
// Hands sit on the deck surfaces, not the joint pivots. owlcove_dj_booth joints (manifest) are the
// same pivots as the old booth: platterA/B [-0.48/+0.48, 1.07, 0.02], xfader [0, 1.075, 0.15].
// Record top is +0.022 above the platter joint (1.092); the fader cap is +0.011 above its joint (1.086).
const PLATTER_TOP = 0.022, FADER_CAP = 0.011;
export function dexTargetsFromJoints(joints, dex = [0, 0.25, -0.45]) {
  const p = (j, fb) => { const v = j && (j.pos_gltf || j); return Array.isArray(v) && v.length >= 3 ? v : fb; };
  const A = p(joints && joints.platterA, [-0.48, 1.07, 0.02]), B = p(joints && joints.platterB, [0.48, 1.07, 0.02]), X = p(joints && joints.xfader, [0, 1.075, 0.15]);
  return {
    dex: dex.slice(),
    platterA: { c: [A[0], A[1] + PLATTER_TOP, A[2]], r: 0.16 },
    platterB: { c: [B[0], B[1] + PLATTER_TOP, B[2]], r: 0.16 },
    xfader: { c: [X[0], X[1] + FADER_CAP, X[2]], throw: 0.06 },
  };
}
export const DEX_TARGETS = Object.assign(dexTargetsFromJoints({
  platterA: { pos_gltf: [-0.48, 1.07, 0.02] }, platterB: { pos_gltf: [0.48, 1.07, 0.02] }, xfader: { pos_gltf: [0, 1.075, 0.15] },
}), {
  grip: { r: 0.09, dir: [0.33, -0.94] },          // hand spot on the record: radius + XZ direction from the platter centre (deck A; mirrored for B)
  palmClear: 0.035, tipClear: 0.02,               // effector height above the platter top / knob top
  point: [0.44, 1.60, 0.10],                      // crowd_point fingertip (left hand, booth space): up ~30 deg, out ~20 deg, stops above the decks
  wave: [-0.40, 1.72, -0.31],                     // request_wave hand (right hand), beside the head, never reaching toward the crowd
});

// ---------------- tiny quaternion kit ([x,y,z,w]) ----------------
const { sin, cos, PI, sqrt, atan2, acos, max, min, abs } = Math;
const clamp = (x, a, b) => min(b, max(a, x)), frac = x => x - Math.floor(x), mod = (x, n) => ((x % n) + n) % n;
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], scl = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = a => sqrt(dot(a, a)), nrm = a => scl(a, 1 / (len(a) || 1)), lerp3 = (a, b, u) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
export const qmul = (a, b) => [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0], a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
export const qrot = (q, v) => { const u = [q[0], q[1], q[2]], t = scl(cross(u, v), 2); return add(add(v, scl(t, q[3])), cross(u, t)); };
const qconj = q => [-q[0], -q[1], -q[2], q[3]], qaxis = (ax, a) => { const s = sin(a / 2); return [ax[0] * s, ax[1] * s, ax[2] * s, cos(a / 2)]; };
export const qeuler = (x, y, z) => qmul(qmul(qaxis([0, 1, 0], y), qaxis([1, 0, 0], x)), qaxis([0, 0, 1], z)); // order YXZ: yaw, then pitch (+x = nod / lean forward), then roll
function qfromTo(a, b) { const d = dot(a, b); if (d < -0.999999) { const ax = nrm(abs(a[0]) < 0.9 ? cross(a, [1, 0, 0]) : cross(a, [0, 1, 0])); return [ax[0], ax[1], ax[2], 0]; }
  const c = cross(a, b), q = [c[0], c[1], c[2], 1 + d], l = sqrt(q[0] ** 2 + q[1] ** 2 + q[2] ** 2 + q[3] ** 2); return q.map(v => v / l); }

// ---------------- curve kit (all C1: zero velocity at every key, no snaps) ----------------
const smooth = u => { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); }, smoother = u => { u = clamp(u, 0, 1); return u * u * u * (u * (u * 6 - 15) + 10); };
// nod envelope over one beat: 1 ON the beat (head down / knees dipped), slow 0.7-beat rise, 0.3-beat drop into the next beat
export const nodW = ph => { ph = frac(ph); return ph < 0.7 ? 0.5 + 0.5 * cos(PI * ph / 0.7) : 0.5 - 0.5 * cos(PI * (ph - 0.7) / 0.3); };
// ramp window: 0 at t0/t1, 1 inside, eased over `r` beats
const win = (b, t0, t1, r = 0.5) => smooth((b - t0) / r) * smooth((t1 - b) / r);
// stepped values: v[k] at t0 + k*dt, eased between neighbours over `tr` beats (tr = dt gives a continuous S-curve chain)
function steps(b, t0, dt, v, tr = dt) { const x = (b - t0) / dt; if (x <= 0) return v[0]; const k = Math.floor(x); if (k >= v.length - 1) return v[v.length - 1];
  const u = smooth((x - k) * dt / tr); return v[k] + (v[k + 1] - v[k]) * u; }

// ---------------- BODY: groove (4 beats) ----------------
export const GROOVE = { beats: 4, nod: 0.10, nodBase: 0.04, lean: 0.035, leanBeat: 0.02, sway: 0.025, twist: 0.03, look: 0.06, tilt: 0.035, bob: 0.012, antLag: 0.2 };
export function groovePose(b, G = GROOVE) { const ph = frac(b);
  return {
    torso: qeuler(G.lean + G.leanBeat * nodW(ph - 0.06), G.twist * cos(PI * b / 2), G.sway * sin(PI * b)), // max lean 0.055 rad (3.2 deg)
    head: qeuler(G.nodBase + G.nod * nodW(ph), G.look * sin(PI * b / 2), G.tilt * sin(PI * b + 0.6)),
    antenna: qeuler(-0.22 * (nodW(ph - G.antLag) - 0.4), 0, -0.16 * sin(PI * (b - 0.3))),         // lags the head + sway: springy tip
    bob: -G.bob * nodW(ph),                                                                            // root Y offset (m), dips on the beat
  }; }

// ---------------- ARMS: hand paths ----------------
const POLE = { deck: { R: [-0.6, -0.5, -0.6], L: [0.6, -0.5, -0.6] }, fader: { R: [-0.45, -0.85, -0.25], L: [0.45, -0.85, -0.25] }, up: { R: [-0.6, -0.8, 0.05], L: [0.6, -0.8, 0.05] } };
function anchors(T) { const g = nrm([T.grip.dir[0], 0, T.grip.dir[1]]), gB = [-g[0], 0, g[2]];
  const deck = (P, d) => add(P.c, [d[0] * T.grip.r, T.palmClear, d[2] * T.grip.r]), tan = d => nrm([-d[2], 0, d[0]]); // record tangent at the grip
  return {
    A: { p: deck(T.platterA, g), eff: 'palm', pole: 'deck', tan: tan(g) }, B: { p: deck(T.platterB, gB), eff: 'palm', pole: 'deck', tan: scl(tan(gB), -1) },
    X: { p: add(T.xfader.c, [0, T.tipClear, -0.005]), eff: 'tip', pole: 'fader' },
    P: { p: T.point.slice(), eff: 'tip', pole: 'up' }, W: { p: T.wave.slice(), eff: 'tip', pole: 'up' } }; }
// a path = list of phases; hold(t0,t1,anchor,off) keeps the anchor + an offset that is 0 at both ends; move(t0,t1,a,b,lift) eases between anchors in an arc
const hold = (t0, t1, a, off = null, fader = null) => ({ k: 'hold', t0, t1, a, off, fader });
const move = (t0, t1, a, b, lift = 0.07, back = 0.04) => ({ k: 'move', t0, t1, a, b, lift, back });
function evalPath(path, b, AN, side) { let ph = path.find(q => b >= q.t0 && b <= q.t1) || path[path.length - 1]; const pole = n => POLE[n][side];
  if (ph.k === 'hold') { const A = AN[ph.a], o = ph.off ? ph.off(b, A) : [0, 0, 0]; return { p: add(A.p, o), eff: DEX_RIG.eff[A.eff], pole: pole(A.pole), fader: ph.fader ? ph.fader(b) : null }; }
  const A = AN[ph.a], B = AN[ph.b], u = smoother((b - ph.t0) / (ph.t1 - ph.t0)), arc = sin(PI * u);
  return { p: add(lerp3(A.p, B.p, u), [0, ph.lift * arc, -ph.back * arc]), eff: DEX_RIG.eff[A.eff] + (DEX_RIG.eff[B.eff] - DEX_RIG.eff[A.eff]) * u, pole: nrm(lerp3(pole(A.pole), pole(B.pole), u)), fader: null }; }
// offsets
const jog = (amp, t0, t1) => (b, A) => scl(A.tan, amp * sin(4 * PI * (b - t0) / (t1 - t0)) * win(b, t0, t1, (t1 - t0) / 4));       // riding / nudging the record
const along = (A, s) => scl(A.tan, s);
const SCR8 = [0, 0.022, -0.022, 0.022, -0.022, 0.045, 0.045, -0.02, 0.03, -0.03, 0.022, -0.022, 0.045, -0.02, 0.03, -0.03, 0];       // 16 eighths: baby x4, tear, drag, chirps ... back to 0
const scratchOff = (b, A) => along(A, steps(b, 0, 0.5, SCR8));
const scratchDir = b => { const k = clamp(Math.floor(b / 0.5), 0, 15); return SCR8[k + 1] > SCR8[k] ? 1 : 0; };                         // forward stroke -> fader open
const CUT = [1, 0, 1, 1, 0, 1, 0, 1];                                                                                                    // transformer-ish 8ths
export const faderOf = { // knob offset along booth X (m) while a hand holds the knob
  xfader_cut: (T, s) => b => s * T.xfader.throw * 0.55 * (1 - steps(b, 1.5, 0.5, Array.from({ length: 11 }, (_, k) => CUT[k % 8]), 0.12)) * win(b, 1.5, 6.5, 0.5),
  scratch: (T, s) => b => s * T.xfader.throw * 0.5 * (1 - steps(b - 0.06, 0, 0.5, Array.from({ length: 17 }, (_, k) => scratchDir(k * 0.5)), 0.1)) * win(b, 1.5, 6.5, 0.5),
  slide: (T, s, t0, t1) => b => s * T.xfader.throw * 0.5 * smooth((b - t0) / (t1 - t0)) * win(b, t0, t1, 0.3),
};
const faderHold = (t0, t1, f) => hold(t0, t1, 'X', b => [f(b), 0, 0], f);

// clip table: beats, loop, per-hand paths, head look (procedural offset, [pitch, yaw, roll] rad, applied after the mixer)
export function clipDefs(T = DEX_TARGETS) {
  const fd = faderOf, defs = {
    hands_home: { beats: 4, loop: true, R: [hold(0, 4, 'A', jog(0.012, 0, 4))], L: [hold(0, 4, 'B', jog(0.012, 0, 4))], look: () => [0.03, 0, 0] },
    decks_work_AB: { beats: 8, loop: true,
      L: [move(0, 1.5, 'B', 'X'), faderHold(1.5, 2.5, fd.slide(T, 1, 1.5, 2.5)), move(2.5, 4, 'X', 'B'), hold(4, 8, 'B', jog(0.018, 4, 8))],
      R: [hold(0, 4, 'A', jog(0.018, 0, 4)), move(4, 5.5, 'A', 'X'), faderHold(5.5, 6.5, fd.slide(T, -1, 5.5, 6.5)), move(6.5, 8, 'X', 'A')],
      look: b => [0.06, 0.10 * sin(2 * PI * b / 8), 0] },
    xfader_cut: { beats: 8, loop: true,
      L: [move(0, 1.5, 'B', 'X'), faderHold(1.5, 6.5, fd.xfader_cut(T, 1)), move(6.5, 8, 'X', 'B')],
      R: [hold(0, 8, 'A', (b, A) => along(A, 0.015 * sin(PI * b * 2) * win(b, 0, 8, 1)))],
      look: b => [0.08 * win(b, 0, 8, 1.5), 0.05 * win(b, 0, 8, 1.5), 0] },
    scratch_build_R: { beats: 8, loop: true,
      R: [hold(0, 8, 'A', scratchOff)],
      L: [move(0, 1.5, 'B', 'X'), faderHold(1.5, 6.5, fd.scratch(T, 1)), move(6.5, 8, 'X', 'B')],
      look: b => [0.12 * win(b, 0, 8, 1), -0.22 * win(b, 0, 8, 1), 0] },
    crowd_point: { beats: 8, loop: false,
      R: [hold(0, 8, 'A', jog(0.012, 0, 8))],
      L: [move(0, 2, 'B', 'P', 0.04, 0), hold(2, 6, 'P', b => [-0.06 * sin(PI * (b - 2) / 4) ** 2, 0.02 * (nodW(b) - 0.5) * win(b, 2, 6, 0.5), 0]), move(6, 8, 'P', 'B', 0.04, 0)],
      look: b => [-0.05 * win(b, 0.5, 7.5, 1.5), 0.22 * win(b, 0.5, 7.5, 1.5), 0] },
    request_wave: { beats: 8, loop: false,
      R: [move(0, 2, 'A', 'W', 0.03, 0), hold(2, 6, 'W', b => [0.055 * sin(2 * PI * (b - 2)) * win(b, 2, 6, 0.75), 0.012 * sin(4 * PI * (b - 2)) * win(b, 2, 6, 0.75), 0]), move(6, 8, 'W', 'A', 0.03, 0)],
      L: [hold(0, 8, 'B', jog(0.012, 0, 8))],
      look: b => [-0.06 * win(b, 0.5, 7.5, 1.5), -0.06 * win(b, 0.5, 7.5, 1.5), 0.08 * win(b, 0.5, 7.5, 1.5)] },
  };
  defs.scratch_build_L = mirrorDef(defs.scratch_build_R, T); // left hand scratches deck B, right hand cuts
  return defs; }
function mirrorDef(d, T) { const sw = a => ({ A: 'B', B: 'A' }[a] || a), mp = ph => ph.k === 'move' ? { ...ph, a: sw(ph.a), b: sw(ph.b) } : { ...ph, a: sw(ph.a), off: ph.off && (ph.a === 'X' ? (b, A) => scl(ph.off(b, A), -1) : ph.off), fader: ph.fader && (b => -ph.fader(b)) };
  return { ...d, R: d.L.map(mp), L: d.R.map(mp), look: b => { const l = d.look(b); return [l[0], -l[1], -l[2]]; } }; }
// (deck offsets use the anchor's own tangent, so the mirrored scratch strokes run along deck B's record; fader offsets flip sign.)

// ---------------- two-bone IK (shoulder ball + elbow hinge about local X, as Clay's poses use) ----------------
export function solveArm(side, target, torsoPos, qTorso, effLen, pole) {
  const S = add(torsoPos, qrot(qTorso, DEX_RIG.shoulder[side])), dT = qrot(qconj(qTorso), sub(target, S)), u = DEX_RIG.elbow[side], uy = -u[1], b = effLen;
  const u2 = dot(u, u), dMax = sqrt(u2 + b * b + 2 * uy * b), d0 = len(dT), d = clamp(d0, 0.18, dMax * 0.995);
  const phi = -acos(clamp((d * d - u2 - b * b) / (2 * uy * b), -1, 1)); // forward bend (forearm toward +Z)
  const v = add(u, [0, -b * cos(phi), -b * sin(phi)]), n = nrm(dT), q1 = qfromTo(nrm(v), n);
  const e1 = qrot(q1, u), e1p = sub(e1, scl(n, dot(n, e1))), pp = sub(pole, scl(n, dot(n, pole))), psi = atan2(dot(n, cross(e1p, pp)), dot(e1p, pp));
  return { arm: qmul(qaxis(n, psi), q1), fore: qaxis([1, 0, 0], phi), reachK: d0 / dMax, clamped: d0 > dMax * 0.995 }; }
export function fkHand(side, torsoPos, qTorso, qArm, qFore, effLen) { const S = add(torsoPos, qrot(qTorso, DEX_RIG.shoulder[side])), qa = qmul(qTorso, qArm);
  const E = add(S, qrot(qa, DEX_RIG.elbow[side])); return { S, E, H: add(E, qrot(qmul(qa, qFore), [0, -effLen, 0])) }; }

// ---------------- bake: plain data {name, beats, loop, tracks:{joint:{times,values}}, bob, fader, look, qa} ----------------
export const SPB = 24; // samples per beat
export function bakeDexSet(T = DEX_TARGETS, { spb = SPB } = {}) {
  const AN = anchors(T), defs = clipDefs(T), out = {};
  const keysOf = n => Array.from({ length: n * spb + 1 }, (_, k) => k / spb);
  { const t = keysOf(GROOVE.beats), tr = { torso: [], head: [], antenna: [] }, bob = [];
    for (const b of t) { const g = groovePose(b); tr.torso.push(g.torso); tr.head.push(g.head); tr.antenna.push(g.antenna); bob.push(g.bob); }
    out.groove_nod_bounce = { name: 'groove_nod_bounce', layer: 'body', beats: GROOVE.beats, loop: true, tracks: pack(t, tr), bob: { times: t, values: closeLoop(bob) } }; }
  for (const [name, d] of Object.entries(defs)) { const t = keysOf(d.beats), tr = { armR: [], foreR: [], armL: [], foreL: [] }, fader = [], fhand = [], look = [], qa = { maxErr: 0, maxReach: 0, clamped: 0 };
    for (const b of t) { const g = groovePose(mod(b, GROOVE.beats)), tp = [0, DEX_RIG.torso[1], 0], rootP = add(T.dex, [0, g.bob, 0]); let fv = null, fh = null;
      for (const side of ['R', 'L']) { const h = evalPath(d[side], b, AN, side), tgt = sub(h.p, rootP), s = solveArm(side, tgt, tp, g.torso, h.eff, h.pole);
        tr['arm' + side].push(s.arm); tr['fore' + side].push(s.fore); if (h.fader != null) { fv = h.fader; fh = side; }
        const H = fkHand(side, tp, g.torso, s.arm, s.fore, h.eff).H; qa.maxErr = max(qa.maxErr, s.clamped ? 0 : len(sub(H, tgt))); qa.maxReach = max(qa.maxReach, s.reachK); qa.clamped += s.clamped ? 1 : 0; }
      fader.push(fv); fhand.push(fh); look.push(d.look(b)); }
    out[name] = { name, layer: 'arms', beats: d.beats, loop: d.loop, tracks: pack(t, tr), fader: { times: t, values: fader, hand: fhand }, look: { times: t, values: look }, qa }; }
  return out; }
function closeLoop(a) { a[a.length - 1] = a[0]; return a; }
function pack(t, tr) { const o = {}; for (const [j, qs] of Object.entries(tr)) { for (let i = 1; i < qs.length; i++) if (dot4(qs[i], qs[i - 1]) < 0) qs[i] = qs[i].map(v => -v); // hemisphere continuity
    if (dot4(qs[0], qs[qs.length - 1]) < 0) qs[qs.length - 1] = qs[qs.length - 1].map(v => -v); qs[qs.length - 1] = qs[0].slice(); // seamless: last key = first key
    o[j] = { times: Float32Array.from(t), values: Float32Array.from(qs.flat()) }; } return o; }
const dot4 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
const sampleArr = (tl, b) => { const v = tl.values, n = v.length - 1, x = clamp(b, 0, tl.times[n]) * (n / tl.times[n]), i = Math.floor(x); return i >= n ? v[n] : v[i]; };

// ---------------- three.js: clips + runtime layer for dj.js ----------------
export function toThreeClips(THREE, baked) { const clips = {};
  for (const c of Object.values(baked)) clips[c.name] = new THREE.AnimationClip(c.name, c.beats, Object.entries(c.tracks).map(([j, k]) => new THREE.QuaternionKeyframeTrack(j + '.quaternion', k.times, k.values)));
  return clips; }

// Suggested cue mapping (DEX_SET.md). ctx per frame: { live, beat (fractional beat index or null), build (bool), buildDeck ('A'|'B'), cut (bool), bpm }
export const CUE_MAP = { groove: 'groove_nod_bounce', base: 'decks_work_AB', idle: 'hands_home', cut: 'xfader_cut', buildA: 'scratch_build_R', buildB: 'scratch_build_L', point: 'crowd_point', pointEveryBars: 12, pointBar: 8, wave: 'request_wave' };
export function createDexSet(THREE, { puppet, bones, targets = DEX_TARGETS, map = CUE_MAP } = {}) {
  const mixer = puppet.mixer; mixer.stopAllAction(); puppet.cur = null; // take over the puppet (Clay's clips stay in the glb, untouched)
  // runtime actions: the groove + every arm clip split per hand ("name:R" = armR/foreR, "name:L" = armL/foreL), so the request wave
  // borrows only the right arm while the left hand keeps working the current clip.
  let T = targets, baked, clips, actions = {}; const w = {}, st = { arm: map.idle, free: 0, wave: -1, look: [0, 0, 0], fader: null, bob: 0, lastSlot: -1, forced: null };
  const qLook = new THREE.Quaternion(), eul = new THREE.Euler(0, 0, 0, 'YXZ'), SIDE = { R: ['armR', 'foreR'], L: ['armL', 'foreL'] };
  function build() { for (const a of Object.values(actions)) { a.stop(); mixer.uncacheAction(a.getClip()); } baked = bakeDexSet(T); clips = toThreeClips(THREE, baked); actions = {};
    const add = (key, clip) => { const a = mixer.clipAction(clip); a.setLoop(THREE.LoopRepeat, Infinity); a.timeScale = 0; a.play(); w[key] = key === map.groove || key.split(':')[0] === st.arm ? 1 : 0; a.setEffectiveWeight(w[key]); actions[key] = a; };
    for (const [n, c] of Object.entries(clips)) { if (baked[n].layer === 'body') { add(n, c); continue; }
      for (const s of ['R', 'L']) add(n + ':' + s, new THREE.AnimationClip(n + ':' + s, c.duration, c.tracks.filter(tk => SIDE[s].includes(tk.name.split('.')[0])))); } }
  build();
  function pick(beat, ctx) { // arm clip for the 8-beat slot that contains `beat` (decided once per slot, so hands are home at every switch)
    if (!ctx.live) return map.idle; if (ctx.cut) return map.cut; if (ctx.build) return ctx.buildDeck === 'B' ? map.buildB : map.buildA; // bass-swap cut beats build
    const bar = Math.floor(beat / 4); return mod(bar, map.pointEveryBars) === map.pointBar ? map.point : map.base; }
  function update(dt, ctx = {}) { const bpm = ctx.bpm || 120, bps = bpm / 60, live = !!ctx.live; st.free += dt * (live ? bps : 0.9); const beat = live && ctx.beat != null ? ctx.beat : st.free;
    const slot = Math.floor(beat / 8); if (slot !== st.lastSlot) { st.arm = pick(slot * 8, ctx); st.lastSlot = slot; } // also re-picks after a seek
    if (st.wave >= 0) { st.wave += dt * bps; if (st.wave >= baked[map.wave].beats) st.wave = -1; }
    const armL = st.forced || st.arm, armR = st.forced || (st.wave >= 0 ? map.wave : st.arm);
    const k = 1 - Math.exp(-dt * bps * 2.5); // ~1-beat crossfade: slot switches are pose-matched (hands home); the wave blends in over its 2-beat raise
    for (const [key, a] of Object.entries(actions)) { const [n, s] = key.split(':'), tgt = !s ? (live ? 1 : 0.45) : n === (s === 'R' ? armR : armL) ? 1 : 0;
      w[key] += (tgt - w[key]) * (!s ? 1 - Math.exp(-dt * 2) : k); if (abs(w[key] - tgt) < 1e-3) w[key] = tgt; a.setEffectiveWeight(w[key]);
      const c = baked[n]; a.time = n === map.wave && !st.forced ? (st.wave >= 0 ? st.wave : c.beats) : mod(beat, c.beats); } // grid-locked; the wave runs its own one-shot clock and holds its (home) end frame while fading
    puppet.update(0); // mixer -> puppet scene -> batch bones (rigged.js copy)
    // procedural extras: head look (weighted by the per-hand weights), root bob, fader hint
    let lk = [0, 0, 0], fd = null, wsum = 0; for (const [n, c] of Object.entries(baked)) { if (c.layer !== 'arms') continue; const wR = w[n + ':R'], wL = w[n + ':L'], wc = n === map.wave ? wR : (wR + wL) / 2; if (wc < 1e-3) continue;
      const tt = actions[n + ':L'].time, l = sampleArr(c.look, n === map.wave ? actions[n + ':R'].time : tt); lk = lk.map((v, i) => v + l[i] * wc); wsum += wc;
      if (n === armL) { const f = sampleArr(c.fader, tt), h = sampleArr({ times: c.fader.times, values: c.fader.hand }, tt); if (f != null && (h === 'L' || armR === armL)) fd = f; } }
    const kl = 1 - Math.exp(-dt * 4); st.look = st.look.map((v, i) => v + ((wsum ? lk[i] / wsum : 0) - v) * kl);
    if (bones?.head) { eul.set(st.look[0], st.look[1], st.look[2], 'YXZ'); bones.head.quaternion.multiply(qLook.setFromEuler(eul)); }
    st.bob = sampleArr(baked[map.groove].bob, mod(beat, 4)) * w[map.groove]; if (bones?.root) bones.root.position.y = (bones.root.userData.y0 ?? T.dex[1]) + st.bob;
    st.fader = fd; st.armR = armR; st.armL = armL; return st; }
  return { update, request() { if (st.wave < 0) st.wave = 0; }, get waving() { return st.wave >= 0; }, get fader() { return st.fader; }, // booth-local knob X while a hand holds it, else null
    get state() { return st; }, force(name) { st.forced = name && baked[name] && baked[name].layer === 'arms' ? name : null; }, // pin an arm clip (QA / previews); force(null) resumes the cue map
    setTargets(t) { T = { ...T, ...t }; build(); }, get targets() { return T; }, get baked() { return baked; }, clips: () => clips, actions: () => actions, duration: n => baked[n]?.beats || 0 }; }
