// Cantina guestbook: pluggable store + open-book prop (1 draw, CanvasTexture) + HTML modal (desktop/phone) + XR read view.
import { ROOM_LABELS } from './layout.js';
import { DJ_CONFIG } from './dj-config.js';
// Notes are ALWAYS rendered as text (textContent / canvas fillText), never as HTML.
export const GB_LIMITS = { name: 40, message: 280 };

// ---- sanitising: strip control/zero-width/bidi chars, collapse whitespace, clamp length (counted in graphemes) ----
// G1: a ZWJ (U+200D) is kept only between two emoji (sequences like 👩🏽‍🚀, 👨‍👩‍👧‍👦); every other zero-width / bidi char is stripped. Limits count graphemes.
const _seg = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;
export function graphemes(s) { s = String(s ?? ''); return _seg ? Array.from(_seg.segment(s), x => x.segment) : Array.from(s); }
export const graphemeLength = s => graphemes(s).length;
export function clampGraphemes(s, max) { const g = graphemes(s); return g.length > max ? g.slice(0, max).join('') : String(s ?? ''); }
export function cleanText(s, max) {
  const t = String(s ?? '').normalize('NFC').replace(/(?<!\p{Extended_Pictographic}[\uFE0F\u{1F3FB}-\u{1F3FF}]?)\u200d|\u200d(?!\p{Extended_Pictographic})/gu, '')
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b\u200c\u200e\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g, ' ');
  const g = t.replace(/\s+/g, ' ').trim();
  return clampGraphemes(g, max).trim();
}
export function cleanNote(n) {
  const name = cleanText(n?.name, GB_LIMITS.name), message = cleanText(n?.message, GB_LIMITS.message);
  const t = Date.parse(n?.date); return { name: name || 'Anonymous', message, date: new Date(Number.isFinite(t) ? t : Date.now()).toISOString() };
}

// ---- store interface ----
// list(): Promise<Note[]> newest first; add({name, message}): Promise<Note>; label: shown in the UI; canWrite: boolean
export class GuestbookStore {
  get label() { return ''; } get canWrite() { return false; }
  async list() { throw new Error('not implemented'); } async add() { throw new Error('not implemented'); }
}
export class LocalGuestbookStore extends GuestbookStore { // local preview: notes stay in this browser only
  constructor(key = 'ff-guestbook') { super(); this.key = key; }
  get label() { return 'Local preview: notes are only saved on this device.'; } get canWrite() { return true; }
  _read() { try { const a = JSON.parse(localStorage.getItem(this.key) || '[]'); return Array.isArray(a) ? a.map(cleanNote).filter(n => n.message) : []; } catch (e) { return []; } }
  async list() { return this._read().sort((a, b) => b.date.localeCompare(a.date)); }
  async add(n) { const note = cleanNote({ ...n, date: new Date().toISOString() }); if (!note.message) throw new Error('Write a short message first.');
    const all = this._read(); const last = all.reduce((m, x) => Math.max(m, Date.parse(x.date)), 0);
    if (Date.now() - last < 20000) throw new Error('Please wait a few seconds before signing again.'); // soft local rate limit
    all.push(note); try { localStorage.setItem(this.key, JSON.stringify(all.slice(-500))); } catch (e) { throw new Error('Could not save on this device.'); } return note; }
}
// Stub for a real backend (e.g. Google Form + published Sheet CSV, or a small serverless endpoint). Not wired to anything yet.
// listUrl: GET -> JSON [{name,message,date}] or CSV (name,message,date); addUrl: POST JSON {name,message}.
export class RemoteGuestbookStore extends GuestbookStore {
  constructor({ listUrl = '', addUrl = '', format = 'json' } = {}) { super(); Object.assign(this, { listUrl, addUrl, format }); }
  get label() { return this.listUrl ? 'Shared guestbook.' : 'Remote guestbook not configured.'; } get canWrite() { return !!this.addUrl; }
  async list() { if (!this.listUrl) return []; const r = await fetch(this.listUrl, { cache: 'no-store' }); if (!r.ok) throw new Error('Guestbook unavailable');
    const rows = this.format === 'csv' ? parseCSV(await r.text()).slice(1).map(([date, name, message]) => ({ date, name, message })) : await r.json();
    return rows.map(cleanNote).filter(n => n.message).sort((a, b) => b.date.localeCompare(a.date)); }
  async add(n) { if (!this.addUrl) throw new Error('Remote guestbook not configured.'); const note = cleanNote(n);
    const r = await fetch(this.addUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: note.name, message: note.message }) });
    if (!r.ok) throw new Error('Could not sign the guestbook'); return note; }
}
function parseCSV(t) { const rows = [[]]; let f = '', q = false; for (let i = 0; i < t.length; i++) { const c = t[i];
  if (q) { if (c === '"') { if (t[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
  else if (c === '"') q = true; else if (c === ',') { rows.at(-1).push(f); f = ''; } else if (c === '\n') { rows.at(-1).push(f); f = ''; rows.push([]); } else if (c !== '\r') f += c; }
  rows.at(-1).push(f); return rows.filter(r => r.length > 1 || r[0]); }

const fmtDate = iso => { const d = new Date(iso); return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); };
function wrap(g, text, maxW) { const words = text.split(' '), lines = []; let line = '';
  for (const w of words) { const t = line ? line + ' ' + w : w; if (g.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; } if (line) lines.push(line); return lines; }

// ---- the book prop: one mesh, one CanvasTexture (pages + cover colour strip) ----
export function createGuestbook(THREE, { store = new LocalGuestbookStore(), signUrl = '' } = {}) {
  const CW = 1024, CH = 768, PAGE_H = 704; const cv = document.createElement('canvas'); cv.width = CW; cv.height = CH; const g = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const W = 0.42, D = 0.29, uvRect = (geo, u0, v0, u1, v1) => { const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), v0 + uv.getY(i) * (v1 - v0)); return geo; };
  const vTop = 1 - 0 / CH, vPage = 1 - PAGE_H / CH; // canvas y 0 = v 1
  const parts = [];
  { const cover = new THREE.BoxGeometry(W + 0.02, 0.018, D + 0.02).toNonIndexed(); uvRect(cover, 0.02, 0.01, 0.88, 0.07); cover.translate(0, 0.009, 0); parts.push(cover); } // leather cover (bottom strip of the canvas)
  for (const side of [-1, 1]) { const p = new THREE.PlaneGeometry(W / 2 - 0.01, D - 0.01).toNonIndexed(); p.rotateX(-Math.PI / 2); p.rotateZ(side * -0.07); // pages tilt up from the spine
    p.translate(side * (W / 4), 0.024 + 0.006, 0); uvRect(p, side < 0 ? 0 : 0.5, vPage, side < 0 ? 0.5 : 1, vTop); parts.push(p);
    const stack = new THREE.BoxGeometry(W / 2 - 0.012, 0.012, D - 0.012).toNonIndexed(); stack.rotateZ(side * -0.07); stack.translate(side * (W / 4), 0.021, 0); uvRect(stack, 0.9, 0.08, 0.95, 0.085); parts.push(stack); } // page block (paper-coloured pixel)
  const geo = parts.reduce((acc, p) => { for (const k of Object.keys(p.attributes)) if (!['position', 'uv', 'normal'].includes(k)) p.deleteAttribute(k); return acc.concat(p); }, []);
  const merged = new THREE.BufferGeometry(); for (const k of ['position', 'normal', 'uv']) { const arrs = geo.map(p => p.attributes[k].array), n = arrs.reduce((a, b) => a + b.length, 0), out = new Float32Array(n); let o = 0; for (const a of arrs) { out.set(a, o); o += a.length; } merged.setAttribute(k, new THREE.BufferAttribute(out, geo[0].attributes[k].itemSize)); }
  const mesh = new THREE.Mesh(merged, new THREE.MeshBasicMaterial({ map: tex, color: 0xd8ccb8 })); mesh.name = 'guestbook'; mesh.userData.noMerge = true; mesh.userData.guestbook = true;
  let notes = [];
  function drawPages() {
    g.fillStyle = '#efe4cf'; g.fillRect(0, 0, CW, PAGE_H); g.fillStyle = '#e4d6bb'; g.fillRect(500, 0, 24, PAGE_H); // paper + gutter shade
    g.fillStyle = '#3a1f14'; g.fillRect(0, PAGE_H, CW, CH - PAGE_H); g.fillStyle = '#efe4cf'; g.fillRect(921, 700, 51, 10); g.fillStyle = '#ffffff'; g.fillRect(976, 712, 48, 56); /* cover strip, page-block texels, white block (robots' constant uv when the book shares the robots draw) */
    g.fillStyle = '#2a211b'; g.textBaseline = 'top';
    g.font = 'italic 44px Georgia, serif'; g.fillText('Guestbook', 40, 40); g.font = '24px Georgia, serif'; g.fillStyle = '#6b5a48'; g.fillText(ROOM_LABELS.cantina, 42, 96);
    g.fillStyle = '#9a7b3a'; g.fillRect(40, 136, 420, 2);
    const list = notes.slice(0, 6), col = [[40, 160, 440, 3], [552, 40, 432, 3]]; let i = 0;
    if (!list.length) { g.fillStyle = '#6b5a48'; g.font = 'italic 28px Georgia, serif'; g.fillText('Be the first to sign.', 40, 180); }
    for (const [x0, y0, w, n] of col) { let y = y0; for (let k = 0; k < n && i < list.length; k++, i++) { const nt = list[i];
      g.fillStyle = '#2a211b'; g.font = 'bold 24px Georgia, serif'; g.fillText(clampGraphemes(nt.name, 40), x0, y); g.fillStyle = '#8a7660'; g.font = '18px Georgia, serif'; g.fillText(fmtDate(nt.date), x0 + w - g.measureText(fmtDate(nt.date)).width, y + 4);
      g.fillStyle = '#3d3128'; g.font = 'italic 22px Georgia, serif'; const ls = wrap(g, nt.message, w).slice(0, 4); if (wrap(g, nt.message, w).length > 4) ls[3] = graphemes(ls[3]).slice(0, -2).join('') + '…';
      ls.forEach((l, j) => g.fillText(l, x0, y + 34 + j * 27)); y += 34 + ls.length * 27 + 22; } }
    g.fillStyle = '#6b5a48'; g.font = '20px system-ui, sans-serif'; g.fillText('Tap the book to read all & sign', 552, PAGE_H - 70); g.font = 'italic 19px Georgia, serif'; g.fillStyle = '#8a7660'; g.fillText('Music credits inside ♪', 552, PAGE_H - 42);
    tex.needsUpdate = true; }
  async function refresh() { try { notes = await store.list(); } catch (e) { notes = []; } drawPages(); readView.redraw(); return notes; }

  // ---- XR read view: a larger floating page above the book (1 draw, only while open) ----
  const readView = (() => { const c2 = document.createElement('canvas'); c2.width = 1024; c2.height = 1280; const g2 = c2.getContext('2d'); const t2 = new THREE.CanvasTexture(c2); t2.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.64, 0.8), new THREE.MeshBasicMaterial({ map: t2, transparent: true, toneMapped: false })); m.visible = false; m.userData.noMerge = true; m.name = 'guestbook-read';
    let page = 'notes';
    function drawCredits() { g2.fillStyle = '#2a211b'; g2.font = 'italic 56px Georgia, serif'; g2.fillText('Music credits', 56, 44); let y = 124;
      for (const c of DJ_CONFIG.MUSIC_CREDITS || []) { g2.fillStyle = '#2a211b'; g2.font = 'bold 28px Georgia, serif'; g2.fillText(c.title, 56, y); y += 36; g2.fillStyle = '#6b5a48'; g2.font = '20px system-ui'; for (const l of wrap(g2, 'Licence: ' + c.license, 912)) { g2.fillText(l, 56, y); y += 25; }
        g2.fillStyle = '#3d3128'; g2.font = 'italic 21px Georgia, serif'; for (const l of wrap(g2, c.short, 912)) { g2.fillText(l, 56, y); y += 26; } y += 6;
        g2.font = '18px system-ui'; for (const ln of c.lines) { for (const [j, l] of wrap(g2, ln, 890).entries()) { g2.fillText((j ? '  ' : '• ') + l, 56, y); y += 22; } } y += 18; }
      g2.fillStyle = '#6b5a48'; g2.font = '24px system-ui'; g2.fillText('Trigger again to close', 56, 1232); }
    function redraw() { g2.fillStyle = 'rgba(239,228,207,0.97)'; g2.beginPath(); g2.roundRect(0, 0, 1024, 1280, 32); g2.fill(); g2.textBaseline = 'top';
      if (page === 'credits') { drawCredits(); t2.needsUpdate = true; return; }
      g2.fillStyle = '#2a211b'; g2.font = 'italic 64px Georgia, serif'; g2.fillText('Guestbook', 56, 48); g2.font = '28px system-ui'; g2.fillStyle = '#6b5a48'; g2.fillText(store.label, 58, 130);
      let y = 190; for (const nt of notes.slice(0, 8)) { g2.fillStyle = '#2a211b'; g2.font = 'bold 34px Georgia, serif'; g2.fillText(nt.name, 56, y); g2.fillStyle = '#8a7660'; g2.font = '26px Georgia, serif'; const ds = fmtDate(nt.date); g2.fillText(ds, 968 - g2.measureText(ds).width, y + 6);
        g2.fillStyle = '#3d3128'; g2.font = 'italic 30px Georgia, serif'; const ls = wrap(g2, nt.message, 912).slice(0, 3); ls.forEach((l, j) => g2.fillText(l, 56, y + 46 + j * 36)); y += 46 + ls.length * 36 + 26; if (y > 1080) break; }
      if (!notes.length) { g2.font = 'italic 36px Georgia, serif'; g2.fillStyle = '#6b5a48'; g2.fillText('No notes yet. Be the first!', 56, 200); }
      g2.fillStyle = '#2a7f78'; g2.fillRect(56, 1120, 912, 3); g2.fillStyle = '#2a211b'; g2.font = '30px system-ui'; g2.fillText('Sign on your phone or computer:', 56, 1140);
      g2.font = 'bold 30px ui-monospace, monospace'; g2.fillText(signUrl.replace(/^https?:\/\//, '').slice(0, 52), 56, 1186); g2.font = '24px system-ui'; g2.fillStyle = '#6b5a48'; g2.fillText('Trigger again for music credits ♪', 56, 1232); t2.needsUpdate = true; }
    // trigger cycle: closed -> notes -> music credits -> closed
    function next() { if (!m.visible) { page = 'notes'; m.visible = true; } else if (page === 'notes') page = 'credits'; else m.visible = false; redraw(); return m.visible; }
    return { mesh: m, redraw, next, get page() { return page; } }; })();

  // ---- HTML modal (desktop / phone) ----
  let modal = null;
  function openModal(openCredits = false) { if (modal) return; modal = document.createElement('div'); modal.id = 'gb-modal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:50;background:rgba(5,4,6,.62);display:flex;align-items:center;justify-content:center;padding:12px';
    const box = document.createElement('div'); box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', 'Guestbook');
    box.style.cssText = 'background:#efe4cf;color:#2a211b;max-width:520px;width:100%;max-height:88vh;overflow:auto;border-radius:12px;padding:18px 18px 14px;font:15px Georgia,serif;box-shadow:0 10px 40px rgba(0,0,0,.5)';
    const h = document.createElement('div'); h.style.cssText = 'display:flex;justify-content:space-between;align-items:baseline';
    const t = document.createElement('div'); t.textContent = 'Guestbook'; t.style.cssText = 'font:italic 30px Georgia,serif';
    const x = document.createElement('button'); x.textContent = '✕'; x.setAttribute('aria-label', 'Close'); x.style.cssText = 'border:0;background:none;font-size:20px;cursor:pointer;color:#2a211b'; x.onclick = closeModal; h.append(t, x);
    const lab = document.createElement('div'); lab.textContent = store.label; lab.style.cssText = 'font:12px system-ui;color:#6b5a48;margin:2px 0 10px';
    const form = document.createElement('form'); form.style.cssText = 'display:flex;flex-direction:column;gap:6px;margin-bottom:12px';
    const nm = document.createElement('input'); nm.maxLength = GB_LIMITS.name * 8; /* hard cap in UTF-16 units; the real limit is graphemes (oninput) */ nm.placeholder = 'Your name'; nm.autocomplete = 'nickname'; nm.id = 'gb-name';
    const msg = document.createElement('textarea'); msg.maxLength = GB_LIMITS.message * 8; msg.rows = 3; msg.placeholder = 'Leave a note for Vincent and the crew'; msg.id = 'gb-msg';
    for (const el of [nm, msg]) el.style.cssText = 'font:16px system-ui;padding:8px;border:1px solid #b9a888;border-radius:6px;background:#fbf6ec;color:#2a211b;resize:vertical';
    const row = document.createElement('div'); row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;gap:8px';
    const cnt = document.createElement('small'); cnt.style.color = '#6b5a48'; const err = document.createElement('small'); err.style.color = '#a3392b';
    const sub = document.createElement('button'); sub.type = 'submit'; sub.textContent = 'Sign'; sub.disabled = !store.canWrite; sub.style.cssText = 'background:#2a7f78;color:#fff;border:0;border-radius:6px;padding:8px 18px;font:15px system-ui;cursor:pointer';
    const lim = (el, max) => { const v = clampGraphemes(el.value, max); if (v !== el.value) el.value = v; }; nm.oninput = () => lim(nm, GB_LIMITS.name);
    const upd = () => { lim(msg, GB_LIMITS.message); cnt.textContent = `${graphemeLength(msg.value)}/${GB_LIMITS.message}`; }; msg.oninput = upd; upd(); row.append(cnt, err, sub); form.append(nm, msg, row);
    const list = document.createElement('div'); list.id = 'gb-list';
    const render = () => { list.replaceChildren(); if (!notes.length) { const e = document.createElement('div'); e.textContent = 'No notes yet. Be the first to sign.'; e.style.cssText = 'font-style:italic;color:#6b5a48'; list.append(e); }
      for (const nt of notes) { const it = document.createElement('div'); it.style.cssText = 'border-top:1px solid #d9caa9;padding:8px 0';
        const a = document.createElement('div'); a.style.cssText = 'display:flex;justify-content:space-between;gap:8px'; const n = document.createElement('b'); n.textContent = nt.name; const d = document.createElement('small'); d.textContent = fmtDate(nt.date); d.style.color = '#8a7660'; a.append(n, d);
        const m = document.createElement('div'); m.textContent = nt.message; m.style.cssText = 'font-style:italic;white-space:pre-wrap;overflow-wrap:anywhere'; it.append(a, m); list.append(it); } };
    form.onsubmit = async e => { e.preventDefault(); err.textContent = ''; sub.disabled = true; try { await store.add({ name: nm.value, message: msg.value }); msg.value = ''; upd(); await refresh(); render(); } catch (ex) { err.textContent = ex.message; } sub.disabled = !store.canWrite; };
    const cr = document.createElement('details'); cr.id = 'gb-credits'; cr.style.cssText = 'border-top:1px solid #b9a888;margin-top:10px;padding-top:8px;font:13px system-ui;color:#3d3128';
    const sm = document.createElement('summary'); sm.textContent = 'Music credits'; sm.style.cssText = 'cursor:pointer;font:italic 18px Georgia,serif;color:#2a211b'; cr.append(sm);
    for (const c of DJ_CONFIG.MUSIC_CREDITS || []) { const hd = document.createElement('div'); hd.textContent = c.title + ' — ' + c.license; hd.style.cssText = 'font-weight:bold;margin-top:8px'; const sh = document.createElement('div'); sh.textContent = c.short; sh.style.cssText = 'font-style:italic;margin:2px 0 4px';
      const ul = document.createElement('ul'); ul.style.cssText = 'margin:0;padding-left:18px;overflow-wrap:anywhere'; for (const ln of c.lines) { const li = document.createElement('li'); for (const [i, part] of ln.split(/(https?:\/\/[^\s)]+)/).entries()) { if (i % 2) { const a = document.createElement('a'); a.href = part; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = part; a.style.cssText = 'font-size:16px;display:inline-block;padding:10px 0;min-height:44px;line-height:24px;color:#7a3b12;text-decoration:underline;overflow-wrap:anywhere'; li.append(a); } else li.append(document.createTextNode(part)); } ul.append(li); } cr.append(hd, sh, ul); }
    if (openCredits) cr.open = true;
    box.append(h, lab, form, list, cr); modal.append(box); modal.addEventListener('pointerdown', e => { if (e.target === modal) closeModal(); }); document.body.append(modal);
    addEventListener('keydown', onKey); render(); refresh().then(render); setTimeout(() => nm.focus(), 0); }
  function onKey(e) { if (e.key === 'Escape') closeModal(); e.stopPropagation(); }
  function closeModal() { modal?.remove(); modal = null; removeEventListener('keydown', onKey); }
  refresh();
  addEventListener('storage', e => { if (e.key === store.key) refresh(); });
  const WHITE_UV = [1000 / CW, 1 - 740 / CH];
  return { mesh, tex, WHITE_UV, readView, openModal, closeModal, refresh, get notes() { return notes; }, store, get modalOpen() { return !!modal; } };
}
