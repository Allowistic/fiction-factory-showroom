// Single shared state for light scene + panel (multi-user ready: this object is what a host would broadcast).
// It deliberately holds NO camera/pose data. Local camera moves only via local-only functions in showroom.js
// (spawn/teleport/look), never from applyState(), so a remote or state message can never move the local camera.
import { MAX_USERS } from './layout.js';
export function createState(initial) {
  const s = { scene: 'ambient', preset: 'dusk', brightness: 0.35, solid: null, chip: -1, pins: true, labels: false,
    isHost: true, maxUsers: MAX_USERS, rev: 0, ...initial };
  const subs = new Set();
  const ALLOWED = new Set(['scene', 'preset', 'brightness', 'solid', 'chip', 'pins', 'labels']); // remote-settable keys
  return {
    get: () => s,
    // source: 'local' | 'remote'. Remote patches are filtered to ALLOWED keys (no isHost, no pose, no camera).
    apply(patch, source = 'local') {
      const p = {}; for (const k in patch) if (source === 'local' ? k in s : ALLOWED.has(k)) p[k] = patch[k];
      Object.assign(s, p); s.rev++; subs.forEach(f => f(p, source)); return s;
    },
    subscribe(f) { subs.add(f); return () => subs.delete(f); },
  };
}
