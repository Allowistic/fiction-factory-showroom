// Cove LED scenes for loft-xr. Motion God. Pure, renderer-agnostic.
// Strip: WS2812B FCOB 180 px/m, one continuous perimeter loop (index 0 = entry corner, runs clockwise).
// Usage: const fx = CoveScenes.create(pixelCount); each frame: fx.render(sceneId, tSeconds, out /*Float32Array N*3, 0..1 linear*/, {audioLevel})
// Jules: push `out` into an InstancedMesh color attribute or a 1xN DataTexture on the cove emissive. Run at 60fps; it's cheap.
// FCOB has no visible dots, so every scene is smooth gradients, never single-pixel sparkle.
(function (g) {
  const TAU = Math.PI * 2;
  const clamp = (x) => Math.min(1, Math.max(0, x));
  const mix = (a, b, t) => a + (b - a) * t;
  const ss = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };
  const hex = (h) => [1, 3, 5].map((k) => Math.pow(parseInt(h.slice(k, k + 2), 16) / 255, 2.2)); // sRGB -> linear
  const lerp3 = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
  function ramp(stops, x) { // stops: [[pos, rgb], ...] sorted
    x = clamp(x);
    for (let i = 1; i < stops.length; i++) if (x <= stops[i][0]) {
      const [p0, c0] = stops[i - 1], [p1, c1] = stops[i];
      return lerp3(c0, c1, ss(0, 1, (x - p0) / (p1 - p0 || 1)));
    }
    return stops[stops.length - 1][1];
  }
  // cheap smooth 1D noise (sum of sines, loops seamlessly around the perimeter)
  const sn = (u, t, s) => 0.5 + 0.5 * (Math.sin(TAU * (u * 2 + t * 0.07 * s)) * 0.5 + Math.sin(TAU * (u * 5 - t * 0.11 * s) + 1.7) * 0.3 + Math.sin(TAU * (u * 9 + t * 0.05 * s) + 4.1) * 0.2);

  const WARM = kelvin(2700);
  function kelvin(k) { // approx blackbody, linear rgb
    const t = k / 100; let r, gg, b;
    r = t <= 66 ? 255 : 329.7 * Math.pow(t - 60, -0.1332);
    gg = t <= 66 ? 99.47 * Math.log(t) - 161.1 : 288.1 * Math.pow(t - 60, -0.0755);
    b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5 * Math.log(t - 10) - 305;
    return [r, gg, b].map((v) => Math.pow(clamp(v / 255), 2.2));
  }

  // Each scene: params (tweakable), and fn(u 0..1 along loop, t sec, p, ctx) -> [r,g,b] linear
  const SCENES = {
    ambient: { // the default. Barely-alive warm bounce; you should only notice it if you stare.
      params: { kelvin: 2700, level: 0.55, breathe: 0.04, period: 9 },
      fn: (u, t, p) => {
        const c = kelvin(p.kelvin);
        const b = p.level * (1 - p.breathe + p.breathe * (0.5 + 0.5 * Math.sin(TAU * (t / p.period - u * 0.5))));
        return c.map((v) => v * b);
      },
    },
    aurora: { // two slow curtains drift opposite ways around the loop; teal/green with violet edges.
      params: { level: 0.7, speed: 1, colors: ['#0b3d3a', '#19c39a', '#5fe0b0', '#6a4cc7'] },
      fn: (u, t, p) => {
        const s = p.colors.map(hex);
        const a = sn(u, t, p.speed), b = sn(1 - u + 0.31, t * 0.8, p.speed);
        const curtain = ss(0.35, 0.9, a * 0.6 + b * 0.4);
        const c = ramp([[0, s[0]], [0.45, s[1]], [0.8, s[2]], [1, s[3]]], curtain);
        return c.map((v) => v * p.level * (0.25 + 0.75 * curtain));
      },
    },
    beat: { // pulse from the make wall outward both directions. ctx.audioLevel (0..1) or fixed bpm fallback.
      params: { bpm: 118, origin: 0.5, hue: '#ff5a36', base: 0.08, travel: 0.6, decay: 0.35 },
      fn: (u, t, p, ctx) => {
        const beatT = (t * p.bpm) / 60, ph = beatT % 1;
        const env = ctx.audioLevel != null ? ctx.audioLevel : Math.exp(-ph / p.decay * 4);
        let d = Math.abs(u - p.origin); d = Math.min(d, 1 - d) * 2; // 0 at origin, 1 opposite
        const front = ph * p.travel * 2, ring = Math.exp(-Math.pow((d - front) / 0.08, 2));
        const k = p.base + (1 - p.base) * clamp(env * (0.35 + 0.65 * ring) * (1 - d * 0.5));
        return hex(p.hue).map((v) => v * k);
      },
    },
    sunset: { // ~10 min cycle: gold -> amber -> rose -> dusk violet -> holds low. Window wall stays hottest.
      params: { duration: 600, window: 0.25, level: 0.75, loop: false },
      fn: (u, t, p) => {
        const x = p.loop ? (t / p.duration) % 1 : clamp(t / p.duration);
        let d = Math.abs(u - p.window); d = Math.min(d, 1 - d) * 2;
        const sky = ramp([[0, hex('#ffc46b')], [0.35, hex('#ff8a3d')], [0.6, hex('#e8506a')], [0.85, hex('#5b3a8a')], [1, hex('#241a3a')]], clamp(x + d * 0.18));
        const k = p.level * mix(1, 0.25, ss(0.6, 1, x)) * (1 - d * 0.35);
        return sky.map((v) => v * k);
      },
    },
    factory: { // Fiction Factory signature: a slow "scanline" travels the loop like a machine head printing a layer,
               // leaving a warm wake that cools back to ambient. One pass per `pass` seconds, then a beat of rest.
               // COLORS ARE PLACEHOLDERS until Vincent/Nova set Fiction Factory brand colors.
      params: { pass: 14, rest: 3, head: '#ffffff', wake: '#ff7a2f', cool: 0.2, wakeLen: 0.18, level: 0.85 },
      fn: (u, t, p) => {
        const cyc = p.pass + p.rest, ct = t % cyc, x = ct / p.pass;
        const base = WARM.map((v) => v * p.cool);
        if (x > 1) return base;
        const pos = ss(0, 1, x); // eased: slow start, slow park
        const behind = (pos - u + 1) % 1; // distance behind the head
        const head = Math.exp(-Math.pow(behind / 0.006, 2)) + (behind > 0.99 ? Math.exp(-Math.pow((1 - behind) / 0.006, 2)) : 0);
        const wake = behind < p.wakeLen && u <= pos ? Math.pow(1 - behind / p.wakeLen, 2) : 0;
        const c = lerp3(base, hex(p.wake).map((v) => v * p.level), wake);
        return lerp3(c, hex(p.head).map((v) => v * p.level), clamp(head));
      },
    },
    focus: { // work mode: neutral 4000K, flat, bench section a touch brighter. No motion at all.
      params: { kelvin: 4000, level: 0.8, bench: [0.45, 0.6], boost: 0.15 },
      fn: (u, t, p) => {
        const k = p.level + p.boost * ss(p.bench[0] - 0.03, p.bench[0], u) * (1 - ss(p.bench[1], p.bench[1] + 0.03, u));
        return kelvin(p.kelvin).map((v) => v * k);
      },
    },
  };

  function create(N) {
    let cur = 'ambient', prev = null, xfadeStart = 0, XF = 2.5; // scene changes crossfade 2.5s, smoothstep
    const params = {}; for (const k in SCENES) params[k] = { ...SCENES[k].params };
    return {
      scenes: Object.keys(SCENES), params,
      setScene(id, t) { if (id !== cur && SCENES[id]) { prev = cur; cur = id; xfadeStart = t; } },
      render(t, out, ctx = {}) {
        const w = prev ? ss(0, 1, (t - xfadeStart) / XF) : 1; if (w >= 1) prev = null;
        for (let i = 0; i < N; i++) {
          const u = i / N; let c = SCENES[cur].fn(u, t, params[cur], ctx);
          if (prev) c = lerp3(SCENES[prev].fn(u, t, params[prev], ctx), c, w);
          out[i * 3] = c[0]; out[i * 3 + 1] = c[1]; out[i * 3 + 2] = c[2];
        }
        return out;
      },
    };
  }
  const api = { create, SCENES, kelvin };
  if (typeof module !== 'undefined') module.exports = api; else g.CoveScenes = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
