// In-world control panel: canvas texture + controller/hand-ray picking (select = trigger or pinch; squeeze = recenter panel).
// Canvas is 1 px = 1 mm: 30 px font -> ~21 mm cap height, buttons >= 48 mm.
export function createXRPanel(THREE, renderer, scene, rig, api) {
  const Wc = 600, Hc = 600, c = document.createElement('canvas'); c.width = Wc; c.height = Hc;
  const g = c.getContext('2d'), tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const group = new THREE.Group();
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(Wc / 1000, Hc / 1000), new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false }));
  group.add(plane); scene.add(group);
  let buttons = [];
  const F = '30px system-ui, sans-serif';
  function head(t, y) { g.fillStyle = '#9a9aa2'; g.font = '24px system-ui, sans-serif'; g.fillText(t, 20, y); }
  function draw() {
    buttons = []; const s = api.state;
    g.fillStyle = 'rgba(18,18,22,0.92)'; g.beginPath(); g.roundRect(0, 0, Wc, Hc, 24); g.fill();
    g.fillStyle = '#eee'; g.font = F; g.fillText('Loft lighting', 20, 44);
    head('ROOM LIGHT', 86);
    api.presets.forEach((p, i) => buttons.push({ x: 20 + i * 190, y: 96, w: 180, h: 56, label: p, on: s.preset === p, act: () => api.setPreset(p) }));
    head('COVE SCENE', 186);
    api.scenes.forEach((sc, i) => buttons.push({ x: 20 + (i % 4) * 142, y: 196 + Math.floor(i / 4) * 64, w: 134, h: 56, label: sc, on: s.scene === sc, act: () => api.setScene(sc) }));
    g.fillStyle = '#eee'; g.font = F; g.fillText(`Cove ${(s.brightness * 100) | 0}%`, 20, 375);
    buttons.push({ x: 380, y: 340, w: 90, h: 56, label: '−', act: () => api.setBrightness(Math.max(0, +(s.brightness - 0.1).toFixed(2))) });
    buttons.push({ x: 490, y: 340, w: 90, h: 56, label: '+', act: () => api.setBrightness(Math.min(1.5, +(s.brightness + 0.1).toFixed(2))) });
    buttons.push({ x: 20, y: 412, w: 275, h: 56, label: `Task lights ${s.task ? 'on' : 'off'}`, on: s.task, act: () => api.setTask(!s.task) });
    buttons.push({ x: 305, y: 412, w: 275, h: 56, label: `Labels ${s.labels ? 'on' : 'off'}`, on: s.labels, act: () => api.setLabels(!s.labels) });
    head('SOLID COLOUR  (camera/photo pick on phone)', 506);
    api.chips.forEach((h, i) => buttons.push({ chip: i, x: 24 + i * 70, y: 522, w: 48, h: 48, color: h,
      act: () => api.setSolidSRGB(parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), i) }));
    for (const b of buttons) {
      if (b.color) {
        g.fillStyle = b.color; g.beginPath(); g.arc(b.x + 24, b.y + 24, 20, 0, 7); g.fill();
        if (s.chip === b.chip && s.scene === 'solid') { g.strokeStyle = '#fff'; g.lineWidth = 3; g.beginPath(); g.arc(b.x + 24, b.y + 24, 25, 0, 7); g.stroke(); }
        continue;
      }
      g.fillStyle = b.on ? '#b77a3c' : '#2c2c34'; g.beginPath(); g.roundRect(b.x, b.y, b.w, b.h, 10); g.fill();
      g.fillStyle = '#fff'; g.font = F; g.textAlign = 'center'; g.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 + 10); g.textAlign = 'left';
    }
    tex.needsUpdate = true;
  }
  draw();
  const ray = new THREE.Raycaster(), m4 = new THREE.Matrix4();
  const api2 = { group, onRecenter: null, update };
  [0, 1].forEach(i => {
    const ctl = renderer.xr.getController(i); rig.add(ctl);
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, -1)]), new THREE.LineBasicMaterial({ color: 0xffffff }));
    line.scale.z = 3; ctl.add(line);
    ctl.addEventListener('select', () => {
      m4.identity().extractRotation(ctl.matrixWorld);
      ray.ray.origin.setFromMatrixPosition(ctl.matrixWorld); ray.ray.direction.set(0, 0, -1).applyMatrix4(m4);
      const hit = ray.intersectObject(plane)[0]; if (!hit) return;
      const px = hit.uv.x * Wc, py = (1 - hit.uv.y) * Hc;
      const b = buttons.find(b => px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h);
      if (b) { b.act(); draw(); }
    });
    ctl.addEventListener('squeeze', () => api2.onRecenter?.());
  });
  let last = '';
  function update() { const s = api.state, k = [s.scene, s.brightness, s.preset, s.task, s.labels, s.chip].join(); if (k !== last) { last = k; draw(); } }
  return api2;
}
