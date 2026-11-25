// Stylised play-money artwork (original drawing, not a replica) — shared with money-vr
const PI = Math.PI;
const rnd = (a, b) => a + Math.random() * (b - a);
export const NOTES = {
  10:   { w: 0.150, h: 0.065, c1: '#d9b27a', c2: '#a8733e', ink: '#5b3a17', words: 'ДЕСЯТЬ РУБЛЕЙ', city: 'КРАСНОЯРСК', f: 'chapel', b: 'dam' },
  50:   { w: 0.150, h: 0.065, c1: '#b9cfc2', c2: '#5f8f86', ink: '#21433f', words: 'ПЯТЬДЕСЯТ РУБЛЕЙ', city: 'САНКТ-ПЕТЕРБУРГ', f: 'column', b: 'exchange' },
  100:  { w: 0.150, h: 0.065, c1: '#d8c7a6', c2: '#8a7347', ink: '#4a3a1c', words: 'СТО РУБЛЕЙ', city: 'МОСКВА', f: 'theatre', b: 'quadriga' },
  500:  { w: 0.150, h: 0.069, c1: '#cdbfe0', c2: '#7c62a8', ink: '#3b2a5a', words: 'ПЯТЬСОТ РУБЛЕЙ', city: 'АРХАНГЕЛЬСК', f: 'ship', b: 'monastery' },
  1000: { w: 0.157, h: 0.069, c1: '#b8d6d0', c2: '#3f8a86', ink: '#1d4a48', words: 'ОДНА ТЫСЯЧА РУБЛЕЙ', city: 'ЯРОСЛАВЛЬ', f: 'monument', b: 'church' },
  5000: { w: 0.157, h: 0.069, c1: '#f0c7a8', c2: '#c8613a', ink: '#6a2a12', words: 'ПЯТЬ ТЫСЯЧ РУБЛЕЙ', city: 'ХАБАРОВСК', f: 'monument', b: 'bridge' },
};
function landmark(g, kind, x, y, s, col) { // x,y = base centre; s = scale (px)
  g.save(); g.translate(x, y); g.scale(s, s); g.fillStyle = col; g.strokeStyle = col; g.lineWidth = 0.02;
  const rect = (a, b, w, h) => g.fillRect(a, b, w, h);
  if (kind === 'chapel') { rect(-0.25, -0.6, 0.5, 0.6); g.beginPath(); g.moveTo(-0.32, -0.6); g.lineTo(0, -1.25); g.lineTo(0.32, -0.6); g.fill(); rect(-0.02, -1.5, 0.04, 0.28); rect(-0.1, -1.42, 0.2, 0.03);
    g.globalAlpha = 0.5; for (let i = -3; i <= 3; i++) { g.beginPath(); g.arc(i * 0.55 + 0.9, 0, 0.25, PI, 0); g.stroke(); } rect(-0.8, -0.27, 3.2, 0.04); }
  if (kind === 'dam') { g.beginPath(); g.moveTo(-1.6, 0); g.lineTo(-1.4, -0.7); g.lineTo(1.4, -0.7); g.lineTo(1.6, 0); g.fill(); g.globalCompositeOperation = 'destination-out'; for (let i = -6; i <= 6; i++) rect(i * 0.2 - 0.04, -0.6, 0.08, 0.5); g.globalCompositeOperation = 'source-over'; }
  if (kind === 'column') { rect(-0.12, -1.3, 0.24, 1.3); rect(-0.3, -0.12, 0.6, 0.12); rect(-0.22, -1.38, 0.44, 0.1); for (let i = 0; i < 4; i++) { rect(-0.24, -1.1 + i * 0.25, 0.08, 0.08); rect(0.16, -1.15 + i * 0.25, 0.08, 0.08); }
    g.beginPath(); g.arc(0, -1.47, 0.09, 0, 7); g.fill(); g.globalAlpha = 0.5; rect(0.7, -0.5, 1.4, 0.5); rect(1.35, -1.4, 0.06, 0.9); g.beginPath(); g.moveTo(1.3, -0.5); g.lineTo(1.38, -1.0); g.lineTo(1.46, -0.5); g.fill(); }
  if (kind === 'exchange' || kind === 'theatre') { rect(-1.0, -0.12, 2.0, 0.12); for (let i = 0; i < 8; i++) rect(-0.9 + i * 0.255, -0.85, 0.09, 0.75); rect(-1.05, -1.0, 2.1, 0.15); g.beginPath(); g.moveTo(-1.05, -1.0); g.lineTo(0, -1.45); g.lineTo(1.05, -1.0); g.fill();
    if (kind === 'theatre') { rect(-0.18, -1.75, 0.36, 0.3); g.beginPath(); g.arc(0, -1.8, 0.1, 0, 7); g.fill(); } }
  if (kind === 'quadriga') { for (let i = 0; i < 4; i++) { const ox = -0.75 + i * 0.4; g.beginPath(); g.ellipse(ox, -0.55, 0.22, 0.11, -0.2, 0, 7); g.fill(); rect(ox - 0.15, -0.5, 0.04, 0.4); rect(ox + 0.12, -0.5, 0.04, 0.4); g.beginPath(); g.moveTo(ox + 0.15, -0.6); g.lineTo(ox + 0.32, -0.95); g.lineTo(ox + 0.36, -0.8); g.fill(); }
    g.beginPath(); g.arc(0.8, -0.45, 0.25, 0, 7); g.fill(); rect(0.75, -1.3, 0.1, 0.6); }
  if (kind === 'ship') { g.beginPath(); g.moveTo(-0.9, -0.35); g.lineTo(0.9, -0.35); g.lineTo(0.7, 0); g.lineTo(-0.7, 0); g.fill(); rect(-0.03, -1.6, 0.05, 1.25); rect(0.47, -1.3, 0.04, 0.95);
    g.globalAlpha = 0.75; [[-0.5, -1.5, 0.45, 0.45], [-0.45, -0.95, 0.4, 0.5], [0.15, -1.25, 0.35, 0.4], [0.18, -0.8, 0.3, 0.38]].forEach(([a, b, w, h]) => { g.beginPath(); g.moveTo(a, b); g.quadraticCurveTo(a + w * 0.7, b + h * 0.5, a, b + h); g.lineTo(a + w, b + h); g.quadraticCurveTo(a + w * 1.2, b + h * 0.5, a + w, b); g.fill(); }); }
  if (kind === 'monastery') { rect(-1.3, -0.5, 2.6, 0.5); for (let i = -1; i <= 1; i++) { rect(i * 0.8 - 0.15, -1.0, 0.3, 0.5); g.beginPath(); g.moveTo(i * 0.8 - 0.2, -1.0); g.lineTo(i * 0.8, -1.4 - (i ? 0 : 0.2)); g.lineTo(i * 0.8 + 0.2, -1.0); g.fill(); } }
  if (kind === 'monument') { rect(-0.35, -0.5, 0.7, 0.5); rect(-0.25, -0.62, 0.5, 0.12); rect(-0.12, -1.25, 0.24, 0.63); g.beginPath(); g.arc(0, -1.36, 0.11, 0, 7); g.fill(); rect(0.1, -1.2, 0.3, 0.06);
    g.globalAlpha = 0.5; g.beginPath(); g.arc(1.3, -0.2, 0.45, PI, 0); g.fill(); rect(1.24, -1.0, 0.12, 0.4); g.beginPath(); g.arc(1.3, -1.05, 0.12, PI, 0); g.fill(); }
  if (kind === 'church') { rect(-0.7, -0.75, 1.4, 0.75); for (let i = -2; i <= 2; i++) { const hx = i * 0.3, hh = i === 0 ? 1.4 : 1.1; rect(hx - 0.07, -hh, 0.14, hh - 0.75); g.beginPath(); g.ellipse(hx, -hh - 0.05, 0.1, 0.13, 0, 0, 7); g.fill(); rect(hx - 0.01, -hh - 0.35, 0.02, 0.2); }
    rect(0.9, -1.6, 0.25, 1.6); g.beginPath(); g.moveTo(0.85, -1.6); g.lineTo(1.025, -2.0); g.lineTo(1.2, -1.6); g.fill(); }
  if (kind === 'bridge') { rect(-1.8, -0.75, 3.6, 0.06); for (let i = 0; i < 6; i++) { const bx = -1.5 + i * 0.6; g.beginPath(); g.arc(bx, -0.72, 0.3, PI, 0); g.lineWidth = 0.05; g.stroke(); rect(bx - 0.03, -0.72, 0.06, 0.72); } }
  g.restore();
}
function guilloche(g, w, h, col, seed) {
  g.save(); g.strokeStyle = col; g.lineWidth = 1; g.globalAlpha = 0.35;
  for (let k = 0; k < 18; k++) { g.beginPath(); for (let x = 0; x <= w; x += 6) { const y = h * 0.5 + Math.sin(x / (40 + k * 3) + seed + k) * (h * 0.32) * Math.sin(x / 260 + k * 0.4); x ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); }
  g.restore();
}
function rrect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
export function drawSide(den, back) {
  const n = NOTES[den], W = 1024, H = Math.round((W * n.h) / n.w), c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, n.c1); gr.addColorStop(0.55, '#f6efe2'); gr.addColorStop(1, n.c1); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  // paper fibres
  for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.05})`; g.fillRect(Math.random() * W, Math.random() * H, rnd(4, 16), 1); }
  guilloche(g, W, H, n.c2, back ? 2 : 0);
  // frame
  g.strokeStyle = n.c2; g.lineWidth = 10; g.globalAlpha = 0.8; rrect(g, 22, 22, W - 44, H - 44, 18); g.stroke(); g.lineWidth = 3; rrect(g, 40, 40, W - 80, H - 80, 14); g.stroke(); g.globalAlpha = 1;
  // light oval area (left on front, right on back)
  const ox = back ? W - 300 : 300; const og = g.createRadialGradient(ox, H / 2, 10, ox, H / 2, 210); og.addColorStop(0, 'rgba(255,255,255,.85)'); og.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = og; g.beginPath(); g.ellipse(ox, H / 2, 190, H * 0.38, 0, 0, 7); g.fill();
  g.fillStyle = n.c2; g.globalAlpha = 0.35; g.font = `900 ${H * 0.34}px Georgia,serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(den), ox, H / 2 + 8); g.globalAlpha = 1;
  // landmark
  landmark(g, back ? n.b : n.f, back ? W * 0.43 : W * 0.6, H * 0.84, H * 0.42, n.ink);
  // denomination numerals
  g.fillStyle = n.ink; g.textBaseline = 'alphabetic';
  g.font = `900 ${H * 0.2}px Georgia,serif`; g.textAlign = back ? 'left' : 'right'; g.fillText(String(den), back ? 70 : W - 70, H * 0.26);
  g.font = `900 ${H * 0.13}px Georgia,serif`; g.textAlign = back ? 'right' : 'left'; g.fillText(String(den), back ? W - 80 : 80, H - 70);
  // words & city
  g.textAlign = 'center'; g.font = `700 ${H * 0.075}px Georgia,serif`; g.fillText(n.words, back ? W * 0.43 : W * 0.6, H * 0.18);
  g.font = `600 ${H * 0.055}px system-ui,Roboto,sans-serif`; g.fillText(n.city, back ? W * 0.43 : W * 0.6, H * 0.28);
  // play-money band
  g.save(); g.translate(W / 2, H / 2); g.rotate(back ? 0.12 : -0.12);
  g.fillStyle = 'rgba(200,20,20,.78)'; g.fillRect(-W * 0.6, -H * 0.055, W * 1.2, H * 0.11);
  g.fillStyle = '#fff'; g.font = `800 ${H * 0.058}px system-ui,Roboto,sans-serif`; g.textBaseline = 'middle';
  g.fillText('ИГРОВОЙ БИЛЕТ · НЕ ЯВЛЯЕТСЯ ПЛАТЁЖНЫМ СРЕДСТВОМ · ИГРОВОЙ БИЛЕТ', 0, 2); g.restore();
  g.fillStyle = 'rgba(200,20,20,.85)'; g.font = `800 ${H * 0.05}px system-ui`; g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.fillText('VR-РЕКВИЗИТ', back ? W * 0.6 : 80, back ? H - 70 : H * 0.36);
  return c;
}
