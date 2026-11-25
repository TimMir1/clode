import * as T from 'three';
import { RoomEnvironment } from './jsm/environments/RoomEnvironment.js';
import { mergeGeometries } from './jsm/utils/BufferGeometryUtils.js';
import { FilesetResolver, HandLandmarker, ImageSegmenter } from './mp/vision_bundle.mjs';

const PI = Math.PI, $ = (id) => document.getElementById(id);
const rnd = (a, b) => a + Math.random() * (b - a), clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const msg = (t) => { $('msg').textContent = t || ''; };

/* ================= renderer ================= */
const cv = $('c');
const R = new T.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, preserveDrawingBuffer: false });
R.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); R.setSize(innerWidth, innerHeight, false);
R.xr.enabled = true; R.xr.setReferenceSpaceType('local-floor');
const scene = new T.Scene();
const pmrem = new T.PMREMGenerator(R);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
const cam = new T.PerspectiveCamera(50, innerWidth / innerHeight, 0.02, 100);
cam.position.set(0, 0, 3.2); scene.add(cam);
scene.add(new T.HemisphereLight(0xdfefff, 0x203040, 1.2));
const key = new T.DirectionalLight(0xffffff, 1.6); key.position.set(1, 2, 2); scene.add(key);
addEventListener('resize', () => { cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); R.setSize(innerWidth, innerHeight, false); layoutPlanes(); });

/* ================= sardine geometry ================= */
function sardineGeometry() {
  const body = new T.SphereGeometry(0.5, 28, 14); const p = body.attributes.position;
  const cols = [];
  const back = new T.Color(0x24506e), mid = new T.Color(0x9fb4c4), belly = new T.Color(0xf2f6fa);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), r = Math.sqrt(Math.max(1e-6, 0.25 - x * x));
    const cy = y / r, cz = z / r, t = x + 0.5; // 0 tail .. 1 head
    const prof = Math.pow(Math.sin(PI * clamp(Math.pow(t, 0.8), 0, 1)), 0.75);
    p.setXYZ(i, x, cy * 0.105 * prof, cz * 0.058 * prof);
    const c = cy > 0.25 ? back.clone().lerp(mid, clamp(1 - (cy - 0.25) * 1.6, 0, 1)) : mid.clone().lerp(belly, clamp(-cy + 0.25, 0, 1));
    // dark spots along the flank like a real sardine
    if (cy > -0.05 && cy < 0.35 && t > 0.35 && t < 0.8 && Math.abs(Math.sin(t * 40)) > 0.93) c.multiplyScalar(0.45);
    cols.push(c.r, c.g, c.b);
  }
  body.setAttribute('color', new T.Float32BufferAttribute(cols, 3)); body.computeVertexNormals();
  const fin = (pts, col) => {
    const g = new T.BufferGeometry(); const v = []; for (let i = 1; i < pts.length - 1; i++) v.push(...pts[0], ...pts[i], ...pts[i + 1]);
    g.setAttribute('position', new T.Float32BufferAttribute(v, 3)); g.computeVertexNormals();
    const c = []; for (let i = 0; i < v.length / 3; i++) c.push(col.r, col.g, col.b); g.setAttribute('color', new T.Float32BufferAttribute(c, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(new Array((v.length / 3) * 2).fill(0), 2)); return g;
  };
  const fc = new T.Color(0x7d93a6);
  const tail = fin([[-0.47, 0, 0], [-0.66, 0.13, 0], [-0.6, 0.02, 0], [-0.6, -0.02, 0], [-0.66, -0.13, 0]], fc);
  const dors = fin([[0.08, 0.09, 0], [-0.06, 0.16, 0], [-0.13, 0.085, 0]], fc);
  const eyeG = new T.SphereGeometry(0.016, 8, 6); const eyes = [];
  [-1, 1].forEach((s) => { const e = eyeG.clone(); e.translate(0.4, 0.018, s * 0.03); const c = []; for (let i = 0; i < e.attributes.position.count; i++) c.push(0.03, 0.03, 0.04); e.setAttribute('color', new T.Float32BufferAttribute(c, 3)); eyes.push(e.toNonIndexed()); });
  return mergeGeometries([body.toNonIndexed(), tail, dors, ...eyes]);
}
const BASE_GEO = sardineGeometry();
const MAXN = 600;
const uTime = { value: 0 };
function fishMaterial() {
  const m = new T.MeshStandardMaterial({ vertexColors: true, metalness: 0.78, roughness: 0.26, side: T.DoubleSide, envMapIntensity: 1.25 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uTime;
    sh.vertexShader = 'attribute float aPhase; attribute float aSpeed; uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>',
      `#include <begin_vertex>
       float tl = clamp((0.3 - position.x) / 0.95, 0.0, 1.0);
       transformed.z += sin(uTime * aSpeed + aPhase - position.x * 7.0) * 0.075 * tl * tl;`);
  };
  return m;
}
const MAT = fishMaterial();
function makeLayer(order) {
  const g = BASE_GEO.clone();
  g.setAttribute('aPhase', new T.InstancedBufferAttribute(new Float32Array(MAXN), 1));
  g.setAttribute('aSpeed', new T.InstancedBufferAttribute(new Float32Array(MAXN).fill(12), 1));
  const m = new T.InstancedMesh(g, MAT, MAXN); m.instanceMatrix.setUsage(T.DynamicDrawUsage); m.frustumCulled = false; m.renderOrder = order; m.count = 0; scene.add(m); return m;
}
const farLayer = makeLayer(1), nearLayer = makeLayer(3);

/* ================= school (boids) ================= */
const S = { n: 300, pos: new Float32Array(MAXN * 3), vel: new Float32Array(MAXN * 3), phase: new Float32Array(MAXN), rad: new Float32Array(MAXN), yoff: new Float32Array(MAXN), panic: new Float32Array(MAXN) };
const P = { center: new T.Vector3(0, 0, 0), radius: 0.8, ySpan: 0.6, size: 0.15, vmin: 0.35, vmax: 0.9, dir: 1, layered: true, splitZ: 0 };
const preds = []; // {p:Vector3, r, s}
function initSchool() {
  for (let i = 0; i < MAXN; i++) {
    const a = rnd(0, PI * 2), r = P.radius * rnd(0.7, 1.3);
    S.pos[i * 3] = P.center.x + Math.cos(a) * r; S.pos[i * 3 + 1] = P.center.y + rnd(-P.ySpan, P.ySpan); S.pos[i * 3 + 2] = P.center.z + Math.sin(a) * r;
    S.vel[i * 3] = -Math.sin(a) * P.vmin * P.dir; S.vel[i * 3 + 1] = 0; S.vel[i * 3 + 2] = Math.cos(a) * P.vmin * P.dir;
    S.phase[i] = rnd(0, 6.28); S.rad[i] = rnd(0.65, 1.35); S.yoff[i] = rnd(-1, 1); S.panic[i] = 0;
  }
}
const grid = new Map();
const mtx = new T.Matrix4(), q = new T.Quaternion(), X = new T.Vector3(1, 0, 0), dv = new T.Vector3(), sc = new T.Vector3(), pv = new T.Vector3();
function stepSchool(dt) {
  const n = S.n, cs = P.size * 1.4, pos = S.pos, vel = S.vel; grid.clear();
  for (let i = 0; i < n; i++) { const k = ((pos[i * 3] / cs) | 0) + ',' + ((pos[i * 3 + 1] / cs) | 0) + ',' + ((pos[i * 3 + 2] / cs) | 0); let a = grid.get(k); if (!a) grid.set(k, (a = [])); a.push(i); }
  const rN = cs, rN2 = rN * rN, sepD = P.size * 0.7, sepD2 = sepD * sepD;
  for (let i = 0; i < n; i++) {
    const ix = i * 3, px = pos[ix], py = pos[ix + 1], pz = pos[ix + 2];
    let ax = 0, ay = 0, az = 0, alx = 0, aly = 0, alz = 0, chx = 0, chy = 0, chz = 0, cnt = 0;
    const gx = (px / cs) | 0, gy = (py / cs) | 0, gz = (pz / cs) | 0;
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) {
      const arr = grid.get((gx + a) + ',' + (gy + b) + ',' + (gz + c)); if (!arr) continue;
      for (let k = 0; k < arr.length && cnt < 10; k++) {
        const j = arr[k]; if (j === i) continue; const jx = j * 3, dx = px - pos[jx], dy = py - pos[jx + 1], dz = pz - pos[jx + 2], d2 = dx * dx + dy * dy + dz * dz;
        if (d2 > rN2) continue; cnt++;
        if (d2 < sepD2) { const f = (sepD2 - d2) / sepD2 * 4; ax += dx * f / sepD; ay += dy * f / sepD; az += dz * f / sepD; }
        alx += vel[jx]; aly += vel[jx + 1]; alz += vel[jx + 2]; chx += pos[jx]; chy += pos[jx + 1]; chz += pos[jx + 2];
      }
    }
    if (cnt) { ax += (alx / cnt - vel[ix]) * 1.2; ay += (aly / cnt - vel[ix + 1]) * 1.2; az += (alz / cnt - vel[ix + 2]) * 1.2; ax += (chx / cnt - px) * 0.8; ay += (chy / cnt - py) * 0.8; az += (chz / cnt - pz) * 0.8; }
    // swirl around the vertical axis through the centre
    const rx = px - P.center.x, rz = pz - P.center.z, hd = Math.hypot(rx, rz) + 1e-5, R0 = P.radius * S.rad[i];
    const tx = (-rz / hd) * P.dir, tz = (rx / hd) * P.dir, want = P.vmin * 1.4;
    ax += (tx * want - vel[ix]) * 0.9; az += (tz * want - vel[ix + 2]) * 0.9;
    ax += (-rx / hd) * (hd - R0) * 2.2; az += (-rz / hd) * (hd - R0) * 2.2;
    ay += (P.center.y + S.yoff[i] * P.ySpan - py) * 1.6 - vel[ix + 1] * 0.8;
    // predators (hands)
    let fear = 0;
    for (const pr of preds) {
      const dx = px - pr.p.x, dy = py - pr.p.y, dz = pz - pr.p.z, d = Math.hypot(dx, dy, dz) + 1e-5;
      if (d < pr.r) { const f = (1 - d / pr.r) * pr.s; ax += (dx / d) * f; ay += (dy / d) * f; az += (dz / d) * f; fear = Math.max(fear, 1 - d / pr.r); }
    }
    S.panic[i] = Math.max(S.panic[i] - dt * 1.2, fear);
    vel[ix] += ax * dt; vel[ix + 1] += ay * dt; vel[ix + 2] += az * dt;
    const sp = Math.hypot(vel[ix], vel[ix + 1], vel[ix + 2]) + 1e-6, vmax = P.vmax * (1 + S.panic[i] * 2.2), s = clamp(sp, P.vmin * 0.6, vmax) / sp;
    vel[ix] *= s; vel[ix + 1] *= s; vel[ix + 2] *= s;
    pos[ix] += vel[ix] * dt; pos[ix + 1] += vel[ix + 1] * dt; pos[ix + 2] += vel[ix + 2] * dt;
  }
  // write instances
  let nf = 0, nn = 0; const pf = farLayer.geometry.attributes.aPhase, pn = nearLayer.geometry.attributes.aPhase, sf = farLayer.geometry.attributes.aSpeed, sn = nearLayer.geometry.attributes.aSpeed;
  for (let i = 0; i < n; i++) {
    const ix = i * 3; dv.set(vel[ix], vel[ix + 1], vel[ix + 2]); const sp = dv.length(); dv.multiplyScalar(1 / (sp + 1e-6));
    q.setFromUnitVectors(X, dv); sc.setScalar(P.size * (0.85 + (i % 7) * 0.04)); pv.set(pos[ix], pos[ix + 1], pos[ix + 2]);
    mtx.compose(pv, q, sc);
    const near = !P.layered || pos[ix + 2] >= P.splitZ, L = near ? nearLayer : farLayer, k = near ? nn++ : nf++;
    L.setMatrixAt(k, mtx); (near ? pn : pf).array[k] = S.phase[i]; (near ? sn : sf).array[k] = 10 + (sp / P.vmax) * 14;
  }
  farLayer.count = nf; nearLayer.count = nn;
  [farLayer, nearLayer].forEach((L) => { L.instanceMatrix.needsUpdate = true; L.geometry.attributes.aPhase.needsUpdate = true; L.geometry.attributes.aSpeed.needsUpdate = true; });
}

/* ================= phone camera mode ================= */
const video = $('v');
let mode = 'none', facing = 'user', stream = null, mirror = true;
const vidTex = new T.VideoTexture(video); vidTex.colorSpace = T.SRGBColorSpace;
const maskCv = document.createElement('canvas'), maskCtx = maskCv.getContext('2d', { willReadFrequently: true }); maskCv.width = 160; maskCv.height = 160;
const maskTex = new T.CanvasTexture(maskCv);
const planeGeo = new T.PlaneGeometry(1, 1);
const bgPlane = new T.Mesh(planeGeo, new T.MeshBasicMaterial({ map: vidTex, depthWrite: false, depthTest: false }));
bgPlane.renderOrder = 0;
const personPlane = new T.Mesh(planeGeo, new T.MeshBasicMaterial({ map: vidTex, alphaMap: maskTex, transparent: true, depthWrite: false, depthTest: false }));
personPlane.renderOrder = 2;
let plane = { w: 1, h: 1 };
function layoutPlanes() {
  if (mode !== 'cam' || !video.videoWidth) return;
  const vh = 2 * cam.position.z * Math.tan((cam.fov * PI) / 360), vw = vh * cam.aspect, va = video.videoWidth / video.videoHeight;
  if (va > cam.aspect) plane = { w: vh * va, h: vh }; else plane = { w: vw, h: vw / va };
  [bgPlane, personPlane].forEach((m) => m.scale.set(plane.w, plane.h, 1));
  maskCv.width = 160; maskCv.height = Math.round(160 / va);
  [vidTex, maskTex].forEach((t) => { t.wrapS = T.ClampToEdgeWrapping; t.repeat.x = mirror ? -1 : 1; t.offset.x = mirror ? 1 : 0; t.needsUpdate = true; });
  P.radius = Math.min(0.95, plane.w * 0.36); P.ySpan = Math.min(0.75, plane.h * 0.22); P.size = Math.max(0.1, plane.h * 0.05);
}
function imgToWorld(u, v, z) { return new T.Vector3((mirror ? 0.5 - u : u - 0.5) * plane.w, (0.5 - v) * plane.h, z || 0); }
let seg = null, hands = null, handPts = [], handT = 0, hasPerson = false;
const center = new T.Vector3(0, -0.1, 0);
let maskImg = null;
function onMask(m) {
  const w = maskCv.width, h = maskCv.height, mw = m.width, mh = m.height, f = m.getAsFloat32Array();
  if (!maskImg || maskImg.width !== w || maskImg.height !== h) maskImg = maskCtx.createImageData(w, h);
  const a = maskImg.data; let sx = 0, sy = 0, sn = 0, top = h;
  for (let y = 0; y < h; y++) { const my = ((y + 0.5) * mh / h) | 0; for (let x = 0; x < w; x++) {
    const v = f[my * mw + (((x + 0.5) * mw / w) | 0)] * 255, k = (y * w + x) * 4;
    a[k] = a[k + 1] = a[k + 2] = v; a[k + 3] = 255;
    if (v > 128) { sx += x; sy += y; sn++; if (y < top) top = y; } } }
  maskCtx.putImageData(maskImg, 0, 0); maskTex.needsUpdate = true;
  hasPerson = sn > w * h * 0.03;
  if (hasPerson) { const c = imgToWorld(sx / sn / w, (sy / sn / h) * 0.6 + (top / h) * 0.4, 0); center.lerp(c, 0.15); }
}
function onHands(list) {
  handPts = []; handT = performance.now();
  (list || []).forEach((lm) => [0, 4, 8, 9, 12, 16, 20].forEach((j) => handPts.push(imgToWorld(lm[j].x, lm[j].y, 0.35))));
}
async function initML() {
  let fs;
  try { fs = await FilesetResolver.forVisionTasks(new URL('mp/wasm', location.href).href); } catch (e) { console.error('fileset', e); msg('Нейросети не загрузились: ' + e.message); return; }
  for (const delegate of ['GPU', 'CPU']) {
    try { seg = await ImageSegmenter.createFromOptions(fs, { baseOptions: { modelAssetPath: 'models/selfie_segmenter.tflite', delegate }, runningMode: 'VIDEO', outputConfidenceMasks: true, outputCategoryMask: false }); break; } catch (e) { console.error('seg ' + delegate, e); seg = null; }
  }
  for (const delegate of ['GPU', 'CPU']) {
    try { hands = await HandLandmarker.createFromOptions(fs, { baseOptions: { modelAssetPath: 'models/hand_landmarker.task', delegate }, runningMode: 'VIDEO', numHands: 2 }); break; } catch (e) { console.error('hands ' + delegate, e); hands = null; }
  }
  if (!seg) msg('Вырезание человека не запустилось — рыбы будут поверх видео');
}
let frameNo = 0, lastTs = 0;
function mlTick() {
  if (mode !== 'cam' || video.readyState < 2) return;
  let ts = performance.now(); if (ts <= lastTs) ts = lastTs + 1; lastTs = ts;
  try { if (seg) seg.segmentForVideo(video, ts, (r) => { if (r.confidenceMasks && r.confidenceMasks[0]) onMask(r.confidenceMasks[0]); }); } catch (e) { console.error(e); }
  try { if (hands && frameNo++ % 2 === 0) onHands(hands.detectForVideo(video, ts).landmarks); } catch (e) { console.error(e); }
}
async function startCamera() {
  $('start').style.display = 'none'; $('bar').style.display = 'flex'; msg('Включаю камеру…');
  try {
    if (stream) stream.getTracks().forEach((t) => t.stop());
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
    video.srcObject = stream; await video.play();
  } catch (e) { msg('Нет доступа к камере: ' + e.message); return; }
  mirror = facing === 'user'; mode = 'cam'; P.layered = true; P.splitZ = 0;
  if (!bgPlane.parent) { scene.add(bgPlane); scene.add(personPlane); }
  cam.position.set(0, 0, 3.2); cam.lookAt(0, 0, 0); layoutPlanes(); P.center.copy(center);
  if (!seg) { msg('⏳ Загружаю нейросети (один раз)…'); await initML(); }
  initSchool(); msg(hasPerson ? '' : 'Встань в кадр и помаши руками 👋');
  setTimeout(() => msg(''), 5000);
}
$('bCam').onclick = startCamera;
$('bFlip').onclick = () => { facing = facing === 'user' ? 'environment' : 'user'; startCamera(); };
$('bMore').onclick = () => { S.n = S.n >= 500 ? 150 : S.n + 150; $('bMore').textContent = '🐟 ' + S.n; };

/* ================= recording ================= */
let rec = null, chunks = [];
$('bRec').onclick = () => {
  if (rec) { rec.stop(); return; }
  const types = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'], type = types.find((t) => window.MediaRecorder && MediaRecorder.isTypeSupported(t));
  if (!type) { msg('Запись видео здесь не поддерживается'); return; }
  chunks = []; rec = new MediaRecorder(cv.captureStream(30), { mimeType: type, videoBitsPerSecond: 8e6 });
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  rec.onstop = () => {
    const b = new Blob(chunks, { type }), a = document.createElement('a'); a.href = URL.createObjectURL(b);
    a.download = 'ryby-' + new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-') + (type.includes('mp4') ? '.mp4' : '.webm'); a.click();
    rec = null; $('bRec').textContent = '⏺ Запись'; $('bRec').classList.remove('rec'); msg('Видео сохранено в «Загрузки»');
  };
  rec.start(500); $('bRec').textContent = '⏹ Стоп'; $('bRec').classList.add('rec'); msg('');
};

/* ================= Quest: AR / VR ================= */
const hands3 = [R.xr.getHand(0), R.xr.getHand(1)], grips = [R.xr.getControllerGrip(0), R.xr.getControllerGrip(1)];
hands3.forEach((h) => scene.add(h)); grips.forEach((g) => scene.add(g));
const bursts = [];
[0, 1].forEach((i) => {
  const c = R.xr.getController(i); scene.add(c);
  c.addEventListener('selectstart', () => { const p = new T.Vector3(); (hands3[i].joints && hands3[i].joints['index-finger-tip'] ? hands3[i].joints['index-finger-tip'] : grips[i]).getWorldPosition(p); bursts.push({ p, t: 0.6 }); });
});
const water = new T.Group(); scene.add(water); water.visible = false;
{
  const floor = new T.Mesh(new T.CircleGeometry(12, 48), new T.MeshStandardMaterial({ color: 0xc8b48a, roughness: 1 })); floor.rotation.x = -PI / 2; water.add(floor);
  for (let i = 0; i < 40; i++) { const r = new T.Mesh(new T.DodecahedronGeometry(rnd(0.08, 0.4)), new T.MeshStandardMaterial({ color: 0x6f6a60, roughness: 1 })); const a = rnd(0, 6.28), d = rnd(2, 9); r.position.set(Math.cos(a) * d, 0, Math.sin(a) * d); water.add(r); }
  for (let i = 0; i < 60; i++) { const h = rnd(0.6, 2.2), w = new T.Mesh(new T.CylinderGeometry(0.01, 0.025, h, 5), new T.MeshStandardMaterial({ color: 0x2f7a3c })); const a = rnd(0, 6.28), d = rnd(1.8, 8); w.position.set(Math.cos(a) * d, h / 2, Math.sin(a) * d); w.rotation.z = rnd(-0.2, 0.2); water.add(w); }
}
async function enterXR(xrMode) {
  try {
    const s = await navigator.xr.requestSession(xrMode, { requiredFeatures: ['local-floor'], optionalFeatures: ['hand-tracking'] });
    await R.xr.setSession(s);
    mode = 'xr'; P.layered = false; $('start').style.display = 'none';
    if (bgPlane.parent) { scene.remove(bgPlane); scene.remove(personPlane); }
    P.radius = 0.75; P.ySpan = 0.32; P.size = 0.16; P.vmin = 0.35; P.vmax = 0.8; S.n = 260;
    const vr = xrMode === 'immersive-vr'; water.visible = vr; scene.background = vr ? new T.Color(0x0e4f6e) : null; scene.fog = vr ? new T.FogExp2(0x0e4f6e, 0.12) : null;
    setTimeout(() => { const v = viewerPos(); P.center.set(v.x, v.y - 0.25, v.z); initSchool(); }, 300);
    s.addEventListener('end', () => { mode = 'none'; water.visible = false; scene.fog = null; scene.background = null; $('start').style.display = 'flex'; });
  } catch (e) { msg('Не удалось запустить: ' + e.message); }
}
function viewerPos() { const v = new T.Vector3(); (R.xr.isPresenting ? R.xr.getCamera() : cam).getWorldPosition(v); return v; }
if (navigator.xr) {
  navigator.xr.isSessionSupported('immersive-ar').then((ok) => { $('bAR').hidden = !ok; $('bAR').onclick = () => enterXR('immersive-ar'); }).catch(() => {});
  navigator.xr.isSessionSupported('immersive-vr').then((ok) => { $('bVR').hidden = !ok; $('bVR').onclick = () => enterXR('immersive-vr'); }).catch(() => {});
}
function xrPredators() {
  const jp = new T.Vector3();
  hands3.forEach((h) => { if (!h.joints) return; ['wrist', 'index-finger-tip', 'middle-finger-metacarpal', 'thumb-tip', 'pinky-finger-tip'].forEach((n) => { const j = h.joints[n]; if (j && j.visible !== false && j.matrixWorld) { j.getWorldPosition(jp); if (jp.lengthSq() > 1e-6) preds.push({ p: jp.clone(), r: 0.32, s: 9 }); } }); });
  grips.forEach((g) => { if (g.visible) { g.getWorldPosition(jp); if (jp.lengthSq() > 1e-6) preds.push({ p: jp.clone(), r: 0.35, s: 9 }); } });
}

/* ================= idle preview (start screen) ================= */
initSchool();

/* ================= loop ================= */
const clock = new T.Clock();
R.setAnimationLoop(() => {
  const dt = Math.min(0.05, clock.getDelta()); uTime.value += dt;
  preds.length = 0;
  if (mode === 'cam') {
    mlTick();
    if (performance.now() - handT < 400) handPts.forEach((p) => preds.push({ p, r: P.radius * 0.75, s: 11 }));
    P.center.lerp(center, 0.05);
  } else if (mode === 'xr') {
    xrPredators();
    const v = viewerPos(); P.center.lerp(new T.Vector3(v.x, v.y - 0.25, v.z), 0.02);
  }
  for (let k = bursts.length - 1; k >= 0; k--) { const b = bursts[k]; b.t -= dt; preds.push({ p: b.p, r: 1.1, s: 22 }); if (b.t <= 0) bursts.splice(k, 1); }
  if (Math.random() < 0.002) P.dir *= -1;
  stepSchool(dt);
  R.render(scene, cam);
});
window.__f = { S, P, scene, cam, startCamera, center, preds };
