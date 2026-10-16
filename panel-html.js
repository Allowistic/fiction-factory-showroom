// Desktop/mobile overlay: scene select, brightness, color picker from camera (getUserMedia) or photo.
export function initOverlay(api, info) {
  const el = document.createElement('div'); el.id = 'panel';
  el.innerHTML = `
    <b>Loft cove</b> <small>(PLACEHOLDER room)</small>
    <label>Room light <select id="pr">${api.presets.map(s => `<option>${s}</option>`).join('')}</select></label>
    <label>Cove scene <select id="sc">${api.scenes.map(s => `<option>${s}</option>`).join('')}</select></label>
    <label>Brightness <input id="br" type="range" min="0" max="1.5" step="0.05" value="1"></label>
    <div class="row"><button id="cam">Camera pick</button><label class="btn">Photo pick<input id="ph" type="file" accept="image/*" hidden></label>
    <span id="sw"></span></div>
    <div id="pick" hidden><canvas id="pc"></canvas><div class="row"><small>Tap a pixel</small><button id="pclose">Close</button></div></div>
    <div class="row"><label><input id="tk" type="checkbox"> Task lights</label><label><input id="lb" type="checkbox"> Labels</label></div>
    <details><summary><small>Debug</small></summary><small id="st"></small></details>`;
  document.body.appendChild(el);
  const $ = id => el.querySelector('#' + id);
  $('sc').onchange = e => api.setScene(e.target.value);
  $('br').oninput = e => api.setBrightness(+e.target.value);
  $('pr').onchange = e => { api.setPreset(e.target.value); sync(); };
  $('tk').onchange = e => api.setTask(e.target.checked);
  $('lb').onchange = e => api.setLabels(e.target.checked);
  function sync() { const s = api.state; $('pr').value = s.preset; $('sc').value = s.scene; $('br').value = s.brightness; $('tk').checked = s.task; $('lb').checked = s.labels; }
  setInterval(sync, 1000); // keep in step with XR panel changes
  const pc = $('pc'), ctx = pc.getContext('2d', { willReadFrequently: true });
  let video = null, stream = null, raf = 0;
  function show(src, w, h) { const s = Math.min(1, 320 / w); pc.width = w * s; pc.height = h * s; ctx.drawImage(src, 0, 0, pc.width, pc.height); $('pick').hidden = false; }
  function stopCam() { cancelAnimationFrame(raf); stream?.getTracks().forEach(t => t.stop()); stream = null; video = null; }
  $('cam').onclick = async () => {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      video = document.createElement('video'); video.playsInline = true; video.muted = true; video.srcObject = stream; await video.play();
      const loop = () => { if (!video) return; show(video, video.videoWidth, video.videoHeight); raf = requestAnimationFrame(loop); }; loop();
    } catch (e) { $('st').textContent = 'Camera unavailable: ' + e.message; }
  };
  $('ph').onchange = e => { const f = e.target.files[0]; if (!f) return; stopCam(); const img = new Image(); img.onload = () => show(img, img.naturalWidth, img.naturalHeight); img.src = URL.createObjectURL(f); };
  pc.addEventListener('pointerdown', e => {
    const r = pc.getBoundingClientRect(), x = (e.clientX - r.left) * pc.width / r.width, y = (e.clientY - r.top) * pc.height / r.height;
    const [R, G, B] = ctx.getImageData(x | 0, y | 0, 1, 1).data;
    api.setSolidSRGB(R, G, B); $('sw').style.background = `rgb(${R},${G},${B})`; $('sc').value = 'solid';
  });
  $('pclose').onclick = () => { stopCam(); $('pick').hidden = true; };
  return { status: t => ($('st').textContent = t) };
}
