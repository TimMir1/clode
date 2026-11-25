import * as T from 'three';
import { RoomEnvironment } from './jsm/environments/RoomEnvironment.js';
import { mergeGeometries } from './jsm/utils/BufferGeometryUtils.js';
import { FilesetResolver, HandLandmarker, ImageSegmenter } from './mp/vision_bundle.mjs';
import { drawSide } from './notes.js';

const PI = Math.PI, $ = (id) => document.getElementById(id);
const rnd = (a, b) => a + Math.random() * (b - a), clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerpN = (a, b, t) => a + (b - a) * Math.min(1, t);
let msgT = 0; const msg = (t, sec) => { $('msg').textContent = t || ''; msgT = sec ? performance.now() + sec * 1000 : 0; };

/* ================= renderer ================= */
const cv = $('c');
const R = new T.WebGLRenderer({ canvas: cv, antialias: true, alpha: true });
R.xr.enabled = true; R.xr.setReferenceSpaceType('local-floor');
const scene = new T.Scene();
const pmrem = new T.PMREMGenerator(R);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
const cam = new T.PerspectiveCamera(50, innerWidth / innerHeight, 0.02, 100);
cam.position.set(0, 0, 3.2); scene.add(cam);
scene.add(new T.HemisphereLight(0xdfefff, 0x203040, 1.2));
const key = new T.DirectionalLight(0xffffff, 1.6); key.position.set(1, 2, 2); scene.add(key);

let mode = 'none', quality = 720;
function sizeRenderer() {
  if (mode === 'cam') {
    const w = quality === 1080 ? 1080 : 720, h = Math.round((w * 16) / 9);
    cv.classList.add('studio'); R.setPixelRatio(1); R.setSize(w, h, false); cam.aspect = w / h;
  } else {
    cv.classList.remove('studio'); R.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); R.setSize(innerWidth, innerHeight, false); cam.aspect = innerWidth / innerHeight;
  }
  cam.updateProjectionMatrix(); layoutPlanes();
}
addEventListener('resize', () => { if (!R.xr.isPresenting) sizeRenderer(); });

/* ================= common: two layers (behind / in front of the person) ================= */
function makePair(geo, mat, max, attrs) {
  const mk = (order) => {
    const g = geo.clone();
    attrs.forEach(([name, def]) => g.setAttribute(name, new T.InstancedBufferAttribute(new Float32Array(max).fill(def), 1)));
    const m = new T.InstancedMesh(g, mat, max); m.instanceMatrix.setUsage(T.DynamicDrawUsage); m.frustumCulled = false; m.renderOrder = order; m.count = 0; scene.add(m); return m;
  };
  return [mk(1), mk(3)];
}
const P = { center: new T.Vector3(0, 0, 0), radius: 0.8, ySpan: 0.6, U: 1, layered: true, splitZ: 0, top: 1.5, bottom: -1.5, halfW: 1.5, xr: false };
const preds = [], attractors = [];
const mtx = new T.Matrix4(), qt = new T.Quaternion(), X = new T.Vector3(1, 0, 0), dv = new T.Vector3(), sc = new T.Vector3(), pv = new T.Vector3();
function emit(pair, cnt, z, m, attrs, color) {
  const near = !P.layered || z >= P.splitZ, L = pair[near ? 1 : 0], k = cnt[near ? 1 : 0]++;
  L.setMatrixAt(k, m); for (const n in attrs) L.geometry.attributes[n].array[k] = attrs[n];
  if (color) L.setColorAt(k, color);
}
function flush(pair, cnt) {
  pair.forEach((L, i) => {
    L.count = cnt[i]; L.instanceMatrix.needsUpdate = true; if (L.instanceColor) L.instanceColor.needsUpdate = true;
    for (const n in L.geometry.attributes) if (L.geometry.attributes[n].isInstancedBufferAttribute) L.geometry.attributes[n].needsUpdate = true;
  });
}
const uTime = { value: 0 };

/* ================= effect 1: fish school ================= */
function fishGeometry(pal) {
  const body = new T.SphereGeometry(0.5, 28, 14); const p = body.attributes.position, cols = [];
  const back = new T.Color(pal.back), mid = new T.Color(pal.mid), belly = new T.Color(pal.belly);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), r = Math.sqrt(Math.max(1e-6, 0.25 - x * x)), cy = y / r, cz = z / r, t = x + 0.5;
    const prof = Math.pow(Math.sin(PI * clamp(Math.pow(t, 0.8), 0, 1)), 0.75);
    p.setXYZ(i, x, cy * pal.h * prof, cz * pal.w * prof);
    const c = cy > 0.25 ? back.clone().lerp(mid, clamp(1 - (cy - 0.25) * 1.6, 0, 1)) : mid.clone().lerp(belly, clamp(-cy + 0.25, 0, 1));
    if (pal.spots && cy > -0.05 && cy < 0.35 && t > 0.35 && t < 0.8 && Math.abs(Math.sin(t * 40)) > 0.93) c.multiplyScalar(0.45);
    cols.push(c.r, c.g, c.b);
  }
  body.setAttribute('color', new T.Float32BufferAttribute(cols, 3)); body.computeVertexNormals();
  const fin = (pts, col) => {
    const g = new T.BufferGeometry(), v = []; for (let i = 1; i < pts.length - 1; i++) v.push(...pts[0], ...pts[i], ...pts[i + 1]);
    g.setAttribute('position', new T.Float32BufferAttribute(v, 3)); g.computeVertexNormals();
    const c = []; for (let i = 0; i < v.length / 3; i++) c.push(col.r, col.g, col.b);
    g.setAttribute('color', new T.Float32BufferAttribute(c, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(new Array((v.length / 3) * 2).fill(0), 2)); return g;
  };
  const fc = new T.Color(pal.fin), tl = pal.tail;
  const parts = [body.toNonIndexed(),
    fin([[-0.47, 0, 0], [-0.47 - tl, tl * 0.8, 0], [-0.43 - tl * 0.6, 0.02, 0], [-0.43 - tl * 0.6, -0.02, 0], [-0.47 - tl, -tl * 0.8, 0]], fc),
    fin([[0.08, pal.h * 0.85, 0], [-0.06, pal.h * 1.6, 0], [-0.13, pal.h * 0.8, 0]], fc)];
  [-1, 1].forEach((s) => { const e = new T.SphereGeometry(0.016, 8, 6); e.translate(0.4, 0.018, s * pal.w * 0.55); const c = []; for (let i = 0; i < e.attributes.position.count; i++) c.push(0.03, 0.03, 0.04); e.setAttribute('color', new T.Float32BufferAttribute(c, 3)); parts.push(e.toNonIndexed()); });
  return mergeGeometries(parts);
}
function fishMaterial(metal) {
  const m = new T.MeshStandardMaterial({ vertexColors: true, metalness: metal, roughness: 0.28, side: T.DoubleSide, envMapIntensity: 1.25 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uTime;
    sh.vertexShader = 'attribute float aPhase; attribute float aSpeed; uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>',
      `#include <begin_vertex>
       float tl = clamp((0.3 - position.x) / 0.95, 0.0, 1.0);
       transformed.z += sin(uTime * aSpeed + aPhase - position.x * 7.0) * 0.075 * tl * tl;`);
  };
  return m;
}
class Fish {
  constructor(kind) {
    const gold = kind === 'gold';
    this.max = 600; this.n = gold ? 90 : 300; this.sizeK = gold ? 0.17 : 0.11; this.speedK = gold ? 0.7 : 1;
    const pal = gold ? { back: 0xd9480f, mid: 0xff8c1a, belly: 0xfff1d6, fin: 0xffa94d, h: 0.16, w: 0.075, tail: 0.3, spots: false }
                     : { back: 0x24506e, mid: 0x9fb4c4, belly: 0xf2f6fa, fin: 0x7d93a6, h: 0.105, w: 0.058, tail: 0.19, spots: true };
    this.pair = makePair(fishGeometry(pal), fishMaterial(gold ? 0.35 : 0.78), this.max, [['aPhase', 0], ['aSpeed', 12]]);
    const M = this.max; this.pos = new Float32Array(M * 3); this.vel = new Float32Array(M * 3);
    this.phase = new Float32Array(M); this.rad = new Float32Array(M); this.yoff = new Float32Array(M); this.panic = new Float32Array(M); this.dir = 1; this.grid = new Map();
  }
  reset() {
    const U = P.U;
    for (let i = 0; i < this.max; i++) {
      const a = rnd(0, PI * 2), r = P.radius * rnd(0.7, 1.3);
      this.pos.set([P.center.x + Math.cos(a) * r, P.center.y + rnd(-P.ySpan, P.ySpan), P.center.z + Math.sin(a) * r], i * 3);
      this.vel.set([-Math.sin(a) * 0.3 * U, 0, Math.cos(a) * 0.3 * U], i * 3);
      this.phase[i] = rnd(0, 6.28); this.rad[i] = rnd(0.65, 1.35); this.yoff[i] = rnd(-1, 1); this.panic[i] = 0;
    }
  }
  setVisible(v) { this.pair.forEach((m) => (m.visible = v)); }
  more() { this.n = this.n >= 450 ? 120 : this.n + 150; return this.n; }
  step(dt) {
    const n = this.n, U = P.U, size = this.sizeK * U, cs = size * 1.4, pos = this.pos, vel = this.vel, grid = this.grid;
    const vmin = 0.3 * U * this.speedK, vmax = 0.85 * U * this.speedK; grid.clear();
    for (let i = 0; i < n; i++) { const k = Math.floor(pos[i * 3] / cs) + ',' + Math.floor(pos[i * 3 + 1] / cs) + ',' + Math.floor(pos[i * 3 + 2] / cs); let a = grid.get(k); if (!a) grid.set(k, (a = [])); a.push(i); }
    const rN2 = cs * cs, sepD = size * 0.7, sepD2 = sepD * sepD;
    for (let i = 0; i < n; i++) {
      const ix = i * 3, px = pos[ix], py = pos[ix + 1], pz = pos[ix + 2];
      let ax = 0, ay = 0, az = 0, alx = 0, aly = 0, alz = 0, chx = 0, chy = 0, chz = 0, cnt = 0;
      const gx = Math.floor(px / cs), gy = Math.floor(py / cs), gz = Math.floor(pz / cs);
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) {
        const arr = grid.get(gx + a + ',' + (gy + b) + ',' + (gz + c)); if (!arr) continue;
        for (let k = 0; k < arr.length && cnt < 10; k++) {
          const j = arr[k]; if (j === i) continue; const jx = j * 3, dx = px - pos[jx], dy = py - pos[jx + 1], dz = pz - pos[jx + 2], d2 = dx * dx + dy * dy + dz * dz;
          if (d2 > rN2) continue; cnt++;
          if (d2 < sepD2) { const f = ((sepD2 - d2) / sepD2) * 4; ax += (dx * f) / sepD; ay += (dy * f) / sepD; az += (dz * f) / sepD; }
          alx += vel[jx]; aly += vel[jx + 1]; alz += vel[jx + 2]; chx += pos[jx]; chy += pos[jx + 1]; chz += pos[jx + 2];
        }
      }
      if (cnt) { ax += (alx / cnt - vel[ix]) * 1.2; ay += (aly / cnt - vel[ix + 1]) * 1.2; az += (alz / cnt - vel[ix + 2]) * 1.2; ax += (chx / cnt - px) * 0.8; ay += (chy / cnt - py) * 0.8; az += (chz / cnt - pz) * 0.8; }
      const rx = px - P.center.x, rz = pz - P.center.z, hd = Math.hypot(rx, rz) + 1e-5, R0 = P.radius * this.rad[i];
      const tx = (-rz / hd) * this.dir, tz = (rx / hd) * this.dir, want = vmin * 1.4;
      ax += (tx * want - vel[ix]) * 0.9; az += (tz * want - vel[ix + 2]) * 0.9;
      ax += (-rx / hd) * (hd - R0) * 2.2; az += (-rz / hd) * (hd - R0) * 2.2;
      ay += (P.center.y + this.yoff[i] * P.ySpan - py) * 1.6 - vel[ix + 1] * 0.8;
      let fear = 0;
      for (const pr of preds) {
        const dx = px - pr.p.x, dy = py - pr.p.y, dz = pz - pr.p.z, d = Math.hypot(dx, dy, dz) + 1e-5, r = pr.r * U;
        if (d < r) { const f = (1 - d / r) * pr.s * U; ax += (dx / d) * f; ay += (dy / d) * f; az += (dz / d) * f; fear = Math.max(fear, 1 - d / r); }
      }
      this.panic[i] = Math.max(this.panic[i] - dt * 1.2, fear);
      vel[ix] += ax * dt; vel[ix + 1] += ay * dt; vel[ix + 2] += az * dt;
      const sp = Math.hypot(vel[ix], vel[ix + 1], vel[ix + 2]) + 1e-6, s = clamp(sp, vmin * 0.6, vmax * (1 + this.panic[i] * 2.2)) / sp;
      vel[ix] *= s; vel[ix + 1] *= s; vel[ix + 2] *= s;
      pos[ix] += vel[ix] * dt; pos[ix + 1] += vel[ix + 1] * dt; pos[ix + 2] += vel[ix + 2] * dt;
    }
    if (Math.random() < 0.0015) this.dir *= -1;
    const cnt = [0, 0];
    for (let i = 0; i < n; i++) {
      const ix = i * 3; dv.set(vel[ix], vel[ix + 1], vel[ix + 2]); const sp = dv.length(); dv.multiplyScalar(1 / (sp + 1e-6));
      qt.setFromUnitVectors(X, dv); sc.setScalar(size * (0.85 + (i % 7) * 0.04)); pv.set(pos[ix], pos[ix + 1], pos[ix + 2]); mtx.compose(pv, qt, sc);
      emit(this.pair, cnt, pos[ix + 2], mtx, { aPhase: this.phase[i], aSpeed: 10 + (sp / vmax) * 14 });
    }
    flush(this.pair, cnt);
  }
}

/* ================= effect 2: money rain ================= */
const DENS = [10, 50, 100, 500, 1000, 5000];
function moneyAtlas() {
  const tw = 1024, th = 444, c = document.createElement('canvas'); c.width = tw; c.height = th * 6; const g = c.getContext('2d');
  DENS.forEach((d, i) => g.drawImage(drawSide(d, false), 0, (5 - i) * th, tw, th));
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; return t;
}
class Money {
  constructor() {
    this.max = 220; this.n = 110;
    const geo = new T.PlaneGeometry(1, 0.434, 10, 2), p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin((p.getX(i) + 0.5) * PI) * 0.035);
    geo.computeVertexNormals();
    const mat = new T.MeshStandardMaterial({ map: moneyAtlas(), side: T.DoubleSide, roughness: 0.75, metalness: 0 });
    mat.onBeforeCompile = (sh) => {
      sh.vertexShader = 'attribute float aTile;\n' + sh.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\n vMapUv.y = (vMapUv.y + aTile) / 6.0;');
    };
    this.pair = makePair(geo, mat, this.max, [['aTile', 0]]);
    this.it = []; for (let i = 0; i < this.max; i++) this.it.push({ p: new T.Vector3(), v: new T.Vector3(), q: new T.Quaternion(), ax: new T.Vector3(), w: 0, tile: 0, ph: 0, landed: false, landT: 0 });
  }
  spawn(o, anywhere) {
    const U = P.U;
    if (P.xr) { const a = rnd(0, PI * 2), r = rnd(0.2, 1.6); o.p.set(P.center.x + Math.cos(a) * r, anywhere ? rnd(0.3, 2.4) : rnd(2.2, 2.8), P.center.z + Math.sin(a) * r); }
    else o.p.set(rnd(-P.halfW, P.halfW) * 1.1, anywhere ? rnd(P.bottom, P.top) : P.top + rnd(0.1, 0.8) * U, rnd(-0.9, 0.9) * U);
    o.v.set(0, -rnd(0.1, 0.3) * U, 0); o.q.setFromEuler(new T.Euler(rnd(-1, 1), rnd(0, 6.28), rnd(-1, 1)));
    o.ax.set(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).normalize(); o.w = rnd(1.5, 4); o.tile = Math.floor(rnd(0, 6)); o.ph = rnd(0, 6.28); o.landed = false;
  }
  reset() { this.it.forEach((o) => this.spawn(o, true)); }
  setVisible(v) { this.pair.forEach((m) => (m.visible = v)); }
  more() { this.n = this.n >= 200 ? 60 : this.n + 50; return this.n; }
  step(dt) {
    const U = P.U, size = 0.24 * U, cnt = [0, 0], t = uTime.value, dq = new T.Quaternion();
    for (let i = 0; i < this.n; i++) {
      const o = this.it[i];
      if (!o.landed) {
        o.v.y = Math.max(o.v.y - 0.6 * U * dt, -0.32 * U);
        o.v.x += Math.sin(t * 1.6 + o.ph) * 0.5 * U * dt; o.v.z += Math.cos(t * 1.3 + o.ph) * 0.3 * U * dt;
        o.v.x *= 1 - dt * 0.8; o.v.z *= 1 - dt * 0.8;
        for (const pr of preds) {
          const d = o.p.distanceTo(pr.p), r = pr.r * U * 0.9;
          if (d < r) { dv.subVectors(o.p, pr.p).normalize().multiplyScalar((1 - d / r) * pr.s * U * 0.6 * dt * 6); dv.y = Math.abs(dv.y) + 0.4 * U * (1 - d / r) * dt * 6; o.v.add(dv); o.w = Math.min(o.w + 6 * dt, 9); }
        }
        o.p.addScaledVector(o.v, dt);
        dq.setFromAxisAngle(o.ax, o.w * dt); o.q.premultiply(dq); o.w = lerpN(o.w, 2.5, dt * 0.5);
        const fy = 0.003 + (i % 20) * 0.0004;
        if (P.xr && o.p.y <= fy) { o.p.y = fy; o.landed = true; o.q.setFromEuler(new T.Euler(-PI / 2, 0, rnd(0, 6.28))); o.landT = t; }
        if (!P.xr && o.p.y < P.bottom - 0.3 * U) this.spawn(o);
      } else if (t - o.landT > 25) this.spawn(o);
      sc.setScalar(size); mtx.compose(o.p, o.q, sc);
      emit(this.pair, cnt, o.p.z, mtx, { aTile: o.tile });
    }
    flush(this.pair, cnt);
  }
}

/* ================= effect 3: butterflies ================= */
function wingTexture() {
  const S = 512, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d');
  g.translate(S / 2, S / 2);
  const wing = (s) => {
    g.save(); g.scale(1, s);
    g.beginPath(); g.moveTo(8, 6); g.bezierCurveTo(120, 30, 250, 90, 220, 200); g.bezierCurveTo(190, 245, 70, 230, 8, 60); g.closePath();
    g.moveTo(-6, 6); g.bezierCurveTo(-60, 60, -150, 110, -120, 190); g.bezierCurveTo(-90, 230, -30, 170, -6, 60); g.closePath();
    g.fillStyle = '#fff'; g.fill();
    g.lineWidth = 16; g.strokeStyle = '#151515'; g.stroke();
    g.lineWidth = 4; for (let k = 0; k < 6; k++) { g.beginPath(); g.moveTo(10, 14); g.quadraticCurveTo(60 + k * 18, 80, 90 + k * 25, 120 + k * 16); g.stroke(); }
    g.fillStyle = '#151515'; for (let k = 0; k < 9; k++) { g.beginPath(); g.arc(150 + Math.cos(k * 0.5) * 60, 150 + Math.sin(k * 0.5) * 45, 6, 0, 7); g.fill(); }
    g.fillStyle = '#fff'; for (let k = 0; k < 8; k++) { g.beginPath(); g.arc(165 + Math.cos(k * 0.45) * 55, 165 + Math.sin(k * 0.45) * 40, 4, 0, 7); g.fill(); }
    g.restore();
  };
  g.rotate(-PI / 2); wing(1); wing(-1);
  g.fillStyle = '#1a1a1a'; g.beginPath(); g.ellipse(0, 0, 14, 120, 0, 0, 7); g.fill();
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
}
class Butterflies {
  constructor() {
    this.max = 80; this.n = 34;
    const geo = new T.PlaneGeometry(1, 1, 8, 8); geo.rotateX(-PI / 2); geo.rotateY(PI / 2);
    const mat = new T.MeshStandardMaterial({ map: wingTexture(), side: T.DoubleSide, alphaTest: 0.4, roughness: 0.6, metalness: 0.05 });
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = uTime;
      sh.vertexShader = 'attribute float aPhase; attribute float aFlap; uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>',
        `#include <begin_vertex>
         float s = sign(position.z); float r = abs(position.z);
         float a = 0.25 + sin(uTime * aFlap + aPhase) * (aFlap > 6.0 ? 1.05 : 0.45);
         transformed.y = r * sin(a); transformed.z = s * r * cos(a);`);
    };
    this.pair = makePair(geo, mat, this.max, [['aPhase', 0], ['aFlap', 14]]);
    const cols = [0xff8a1e, 0x2f8cff, 0xffe14d, 0xffffff, 0xff5fa8, 0x37d6c3];
    this.it = []; for (let i = 0; i < this.max; i++) this.it.push({ p: new T.Vector3(), v: new T.Vector3(), tgt: new T.Vector3(), tT: 0, ph: rnd(0, 6.28), col: new T.Color(cols[i % cols.length]), land: -1, sz: rnd(0.8, 1.25) });
  }
  pickTarget(o) {
    const U = P.U;
    if (P.xr) { const a = rnd(0, 6.28), r = rnd(0.4, 1.4); o.tgt.set(P.center.x + Math.cos(a) * r, P.center.y + rnd(-0.5, 0.6), P.center.z + Math.sin(a) * r); }
    else o.tgt.set(P.center.x + rnd(-1, 1) * P.radius * 1.3, P.center.y + rnd(-1, 1) * P.ySpan * 1.5, rnd(-0.8, 0.8) * U);
    o.tT = rnd(1.5, 4);
  }
  reset() { this.it.forEach((o) => { this.pickTarget(o); o.p.copy(o.tgt); o.v.set(0, 0, 0); o.land = -1; }); }
  setVisible(v) { this.pair.forEach((m) => (m.visible = v)); }
  more() { this.n = this.n >= 70 ? 15 : this.n + 18; return this.n; }
  step(dt) {
    const U = P.U, cnt = [0, 0], t = uTime.value, look = new T.Vector3(), taken = new Set();
    attractors.forEach((a, ai) => {
      if (ai > 9) return; let best = -1, bd = 1e9;
      for (let i = 0; i < this.n; i++) { if (taken.has(i)) continue; const d = this.it[i].p.distanceTo(a); if (d < bd) { bd = d; best = i; } }
      if (best >= 0) { taken.add(best); this.it[best].land = ai; }
    });
    for (let i = 0; i < this.n; i++) {
      const o = this.it[i]; if (!taken.has(i)) o.land = -1;
      let tgt = o.tgt, sp = 0.45 * U, flap = 14;
      if (o.land >= 0) { tgt = attractors[o.land]; const d = o.p.distanceTo(tgt); sp = Math.min(0.6 * U, d * 3 + 0.05 * U); if (d < 0.03 * U) flap = 3.2; }
      else { o.tT -= dt; if (o.tT < 0 || o.p.distanceTo(o.tgt) < 0.08 * U) this.pickTarget(o); }
      dv.subVectors(tgt, o.p); const d = dv.length();
      dv.multiplyScalar(sp / (d + 1e-6));
      dv.x += Math.sin(t * 3.1 + o.ph) * 0.25 * U; dv.y += Math.sin(t * 4.3 + o.ph * 2) * 0.3 * U; dv.z += Math.cos(t * 2.7 + o.ph) * 0.2 * U;
      if (o.land >= 0 && d < 0.05 * U) dv.multiplyScalar(0.1);
      o.v.lerp(dv, Math.min(1, dt * 3)); o.p.addScaledVector(o.v, dt);
      if (o.land >= 0 && d < 0.03 * U) o.p.lerp(tgt, Math.min(1, dt * 8));
      look.copy(o.v); look.y *= 0.3; if (look.lengthSq() < 1e-8) look.set(1, 0, 0); look.normalize();
      qt.setFromUnitVectors(X, look); sc.setScalar(0.15 * U * o.sz); mtx.compose(o.p, qt, sc);
      emit(this.pair, cnt, o.p.z, mtx, { aPhase: o.ph, aFlap: flap }, o.col);
    }
    flush(this.pair, cnt);
  }
}

/* ================= effects registry ================= */
const EFFECTS = { sardines: { label: '🐟 Сардины' }, gold: { label: '🐠 Золотые' }, money: { label: '💸 Деньги' }, butterflies: { label: '🦋 Бабочки' } };
let effect = null, effectKey = 'sardines';
function getEffect(k) {
  const e = EFFECTS[k];
  if (!e.obj) e.obj = k === 'money' ? new Money() : k === 'butterflies' ? new Butterflies() : new Fish(k === 'gold' ? 'gold' : 'sardines');
  return e.obj;
}
function setEffect(k) {
  effectKey = k; for (const key in EFFECTS) if (EFFECTS[key].obj) EFFECTS[key].obj.setVisible(key === k);
  effect = getEffect(k); effect.setVisible(true); effect.reset();
  document.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c.dataset.k === k));
}
function buildChips(el) {
  el.innerHTML = '';
  for (const k in EFFECTS) { const b = document.createElement('button'); b.className = 'chip'; b.dataset.k = k; b.textContent = EFFECTS[k].label; b.onclick = () => setEffect(k); el.appendChild(b); }
}
buildChips($('pick')); buildChips($('presets'));

/* ================= phone camera ================= */
const video = $('v');
let facing = 'user', stream = null, mirror = true;
const vidTex = new T.VideoTexture(video); vidTex.colorSpace = T.SRGBColorSpace;
const maskCv = document.createElement('canvas'), maskCtx = maskCv.getContext('2d', { willReadFrequently: true }); maskCv.width = 160; maskCv.height = 160;
const maskTex = new T.CanvasTexture(maskCv);
const planeGeo = new T.PlaneGeometry(1, 1);
const bgPlane = new T.Mesh(planeGeo, new T.MeshBasicMaterial({ map: vidTex, depthWrite: false, depthTest: false })); bgPlane.renderOrder = 0;
const personPlane = new T.Mesh(planeGeo, new T.MeshBasicMaterial({ map: vidTex, alphaMap: maskTex, transparent: true, depthWrite: false, depthTest: false })); personPlane.renderOrder = 2;
let plane = { w: 1, h: 1 }, prevMask = null, maskImg = null;
function layoutPlanes() {
  if (mode !== 'cam' || !video.videoWidth) return;
  const vh = 2 * cam.position.z * Math.tan((cam.fov * PI) / 360), vw = vh * cam.aspect, va = video.videoWidth / video.videoHeight;
  plane = va > cam.aspect ? { w: vh * va, h: vh } : { w: vw, h: vw / va };
  [bgPlane, personPlane].forEach((m) => m.scale.set(plane.w, plane.h, 1));
  maskCv.width = 160; maskCv.height = Math.round(160 / va); prevMask = null;
  [vidTex, maskTex].forEach((t) => { t.wrapS = T.ClampToEdgeWrapping; t.repeat.x = mirror ? -1 : 1; t.offset.x = mirror ? 1 : 0; t.needsUpdate = true; });
  P.U = vh / 1.5; P.radius = Math.min(0.95, vw * 0.36); P.ySpan = vh * 0.2; P.halfW = vw / 2; P.top = vh / 2; P.bottom = -vh / 2;
}
const imgToWorld = (u, v, z) => new T.Vector3((mirror ? 0.5 - u : u - 0.5) * plane.w, (0.5 - v) * plane.h, z || 0);

let segFast = null, segFine = null, useFine = false, hands = null, handLm = [], handT = 0, hasPerson = false;
const center = new T.Vector3(0, -0.1, 0);
function onMask(m, invert) {
  const w = maskCv.width, h = maskCv.height, mw = m.width, mh = m.height, f = m.getAsFloat32Array();
  if (!maskImg || maskImg.width !== w || maskImg.height !== h) maskImg = maskCtx.createImageData(w, h);
  if (!prevMask || prevMask.length !== w * h) prevMask = new Float32Array(w * h);
  const a = maskImg.data; let sx = 0, sy = 0, sn = 0, top = h;
  for (let y = 0; y < h; y++) { const my = (((y + 0.5) * mh) / h) | 0; for (let x = 0; x < w; x++) {
    let v = f[my * mw + ((((x + 0.5) * mw) / w) | 0)]; if (invert) v = 1 - v;
    const i = y * w + x; v = prevMask[i] = prevMask[i] * 0.35 + v * 0.65; const b = v * 255, k = i * 4;
    a[k] = a[k + 1] = a[k + 2] = b; a[k + 3] = 255;
    if (v > 0.5) { sx += x; sy += y; sn++; if (y < top) top = y; } } }
  maskCtx.putImageData(maskImg, 0, 0); maskTex.needsUpdate = true;
  hasPerson = sn > w * h * 0.03;
  if (hasPerson) center.lerp(imgToWorld(sx / sn / w, (sy / sn / h) * 0.6 + (top / h) * 0.4, 0), 0.15);
}
async function makeSeg(fs, model) {
  for (const delegate of ['GPU', 'CPU']) {
    try { return await ImageSegmenter.createFromOptions(fs, { baseOptions: { modelAssetPath: model, delegate }, runningMode: 'VIDEO', outputConfidenceMasks: true, outputCategoryMask: false }); } catch (e) { console.error('seg', model, delegate, e); }
  }
  return null;
}
let fileset = null;
async function initML() {
  try { fileset = await FilesetResolver.forVisionTasks(new URL('mp/wasm', location.href).href); } catch (e) { msg('Нейросети не загрузились: ' + e.message); return; }
  segFast = await makeSeg(fileset, 'models/selfie_segmenter.tflite');
  for (const delegate of ['GPU', 'CPU']) {
    try { hands = await HandLandmarker.createFromOptions(fileset, { baseOptions: { modelAssetPath: 'models/hand_landmarker.task', delegate }, runningMode: 'VIDEO', numHands: 2 }); break; } catch (e) { console.error('hands', delegate, e); }
  }
  if (!segFast) msg('Вырезание человека не запустилось — эффекты будут поверх видео', 5);
}
let frameNo = 0, lastTs = 0;
function mlTick() {
  if (mode !== 'cam' || video.readyState < 2) return;
  let ts = performance.now(); if (ts <= lastTs) ts = lastTs + 1; lastTs = ts;
  const seg = useFine && segFine ? segFine : segFast;
  try { if (seg) seg.segmentForVideo(video, ts, (r) => { const ms = r.confidenceMasks; if (ms && ms[0]) onMask(ms[0], seg === segFine); }); } catch (e) { console.error(e); }
  try { if (hands && frameNo++ % 2 === 0) { handLm = hands.detectForVideo(video, ts).landmarks || []; handT = performance.now(); } } catch (e) { console.error(e); }
}
async function startCamera() {
  $('start').style.display = 'none'; $('bar').style.display = 'flex'; $('presets').style.display = 'flex'; msg('Включаю камеру…');
  try {
    if (stream) stream.getTracks().forEach((t) => t.stop());
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
    video.srcObject = stream; await video.play();
  } catch (e) { msg('Нет доступа к камере: ' + e.message); return; }
  mirror = facing === 'user'; mode = 'cam'; P.layered = true; P.xr = false; P.splitZ = 0;
  if (!bgPlane.parent) scene.add(bgPlane, personPlane);
  cam.position.set(0, 0, 3.2); cam.lookAt(0, 0, 0); sizeRenderer(); P.center.copy(center);
  if (!fileset) { msg('⏳ Загружаю нейросети (один раз)…'); await initML(); }
  setEffect(effectKey);
  msg(hasPerson ? '' : 'Встань в кадр по пояс и помаши руками 👋', 5);
}
$('bCam').onclick = startCamera;
$('bFlip').onclick = () => { facing = facing === 'user' ? 'environment' : 'user'; startCamera(); };
$('bCut').onclick = async () => {
  useFine = !useFine; $('bCut').innerHTML = '✂<small>' + (useFine ? 'точно' : 'быстро') + '</small>'; $('bCut').classList.toggle('on', useFine);
  if (useFine && !segFine && fileset) { msg('⏳ Загружаю точную вырезку (с волосами)…'); segFine = await makeSeg(fileset, 'models/selfie_multiclass.tflite'); msg(segFine ? 'Точная вырезка включена' : 'Точная вырезка не запустилась', 3); }
};
$('bHD').onclick = () => { quality = quality === 720 ? 1080 : 720; $('bHD').innerHTML = quality + '<small>' + (quality === 1080 ? 'Full HD' : 'HD') + '</small>'; $('bHD').classList.toggle('on', quality === 1080); sizeRenderer(); };
let micOn = true; $('bMic').onclick = () => { micOn = !micOn; $('bMic').classList.toggle('on', micOn); $('bMic').innerHTML = (micOn ? '🎙' : '🔇') + '<small>звук</small>'; };
const DURS = [0, 15, 30, 60]; let durI = 0; $('bDur').onclick = () => { durI = (durI + 1) % DURS.length; $('bDur').innerHTML = '⏱<small>' + (DURS[durI] ? DURS[durI] + ' с' : '∞') + '</small>'; };
let lastTap = 0; cv.addEventListener('pointerdown', () => { const n = performance.now(); if (mode === 'cam' && n - lastTap < 300 && effect) msg('Количество: ' + effect.more(), 1.5); lastTap = n; });

/* ================= recording (9:16, countdown, sound, share) ================= */
let rec = null, chunks = [], recStart = 0, recType = '', lastBlob = null, micStream = null, counting = false;
function pickType(withAudio) {
  const list = withAudio ? ['video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm'] : ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'];
  return list.find((t) => window.MediaRecorder && MediaRecorder.isTypeSupported(t));
}
async function countdown() {
  counting = true; const cd = $('cd'); cd.style.display = 'flex';
  for (const n of ['3', '2', '1']) { cd.textContent = n; await new Promise((r) => setTimeout(r, 800)); }
  cd.style.display = 'none'; counting = false;
}
async function startRec() {
  let audio = null;
  if (micOn) { try { micStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); audio = micStream.getAudioTracks(); } catch (e) { msg('Без звука: микрофон недоступен', 3); } }
  recType = pickType(!!audio); if (!recType) { msg('Запись видео здесь не поддерживается', 4); return; }
  await countdown();
  const vs = cv.captureStream(30), ms = new MediaStream([...vs.getVideoTracks(), ...(audio || [])]);
  chunks = []; rec = new MediaRecorder(ms, { mimeType: recType, videoBitsPerSecond: quality === 1080 ? 12e6 : 7e6 });
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  rec.onstop = () => {
    if (micStream) { micStream.getTracks().forEach((t) => t.stop()); micStream = null; }
    lastBlob = new Blob(chunks, { type: recType }); rec = null; $('bRec').classList.remove('rec'); $('timer').style.display = 'none';
    const pvEl = $('pv'); pvEl.src = URL.createObjectURL(lastBlob); $('sheet').style.display = 'flex'; pvEl.play().catch(() => {});
  };
  rec.start(500); recStart = performance.now(); $('bRec').classList.add('rec'); $('timer').style.display = 'block';
}
$('bRec').onclick = () => { if (counting) return; if (rec) rec.stop(); else startRec(); };
const fileName = () => 'ar-studio-' + new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-') + (recType.includes('mp4') ? '.mp4' : '.webm');
$('bSave').onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(lastBlob); a.download = fileName(); a.click(); msg('Сохранено в «Загрузки»', 3); };
$('bShare').onclick = async () => {
  const f = new File([lastBlob], fileName(), { type: recType.split(';')[0] });
  try { if (navigator.canShare && navigator.canShare({ files: [f] })) await navigator.share({ files: [f], title: 'AR-студия' }); else $('bSave').onclick(); } catch (e) {}
};
$('bClose').onclick = () => { $('sheet').style.display = 'none'; $('pv').pause(); };

/* ================= Quest: AR / VR ================= */
const xrHands = [R.xr.getHand(0), R.xr.getHand(1)], grips = [R.xr.getControllerGrip(0), R.xr.getControllerGrip(1)];
xrHands.forEach((h) => scene.add(h)); grips.forEach((g) => scene.add(g));
const bursts = [];
[0, 1].forEach((i) => {
  const c = R.xr.getController(i); scene.add(c);
  c.addEventListener('selectstart', () => { const p = new T.Vector3(); const j = xrHands[i].joints && xrHands[i].joints['index-finger-tip']; (j || grips[i]).getWorldPosition(p); bursts.push({ p, t: 0.6 }); });
});
const water = new T.Group(); scene.add(water); water.visible = false;
{
  const floor = new T.Mesh(new T.CircleGeometry(12, 48), new T.MeshStandardMaterial({ color: 0xc8b48a, roughness: 1 })); floor.rotation.x = -PI / 2; water.add(floor);
  for (let i = 0; i < 40; i++) { const r = new T.Mesh(new T.DodecahedronGeometry(rnd(0.08, 0.4)), new T.MeshStandardMaterial({ color: 0x6f6a60, roughness: 1 })); const a = rnd(0, 6.28), d = rnd(2, 9); r.position.set(Math.cos(a) * d, 0, Math.sin(a) * d); water.add(r); }
  for (let i = 0; i < 60; i++) { const h = rnd(0.6, 2.2), w = new T.Mesh(new T.CylinderGeometry(0.01, 0.025, h, 5), new T.MeshStandardMaterial({ color: 0x2f7a3c })); const a = rnd(0, 6.28), d = rnd(1.8, 8); w.position.set(Math.cos(a) * d, h / 2, Math.sin(a) * d); w.rotation.z = rnd(-0.2, 0.2); water.add(w); }
}
const viewerPos = () => { const v = new T.Vector3(); (R.xr.isPresenting ? R.xr.getCamera() : cam).getWorldPosition(v); return v; };
async function enterXR(xrMode) {
  try {
    const s = await navigator.xr.requestSession(xrMode, { requiredFeatures: ['local-floor'], optionalFeatures: ['hand-tracking'] });
    await R.xr.setSession(s);
    mode = 'xr'; P.layered = false; P.xr = true; P.U = 1; P.radius = 0.75; P.ySpan = 0.32; $('start').style.display = 'none';
    if (bgPlane.parent) scene.remove(bgPlane, personPlane);
    const vr = xrMode === 'immersive-vr'; water.visible = vr; scene.background = vr ? new T.Color(0x0e4f6e) : null; scene.fog = vr ? new T.FogExp2(0x0e4f6e, 0.12) : null;
    setTimeout(() => { const v = viewerPos(); P.center.set(v.x, v.y - 0.25, v.z); setEffect(effectKey); }, 300);
    s.addEventListener('end', () => { mode = 'none'; P.xr = false; water.visible = false; scene.fog = null; scene.background = null; $('start').style.display = 'flex'; sizeRenderer(); });
  } catch (e) { msg('Не удалось запустить: ' + e.message, 5); }
}
if (navigator.xr) {
  navigator.xr.isSessionSupported('immersive-ar').then((ok) => { $('bAR').hidden = !ok; $('bAR').onclick = () => enterXR('immersive-ar'); }).catch(() => {});
  navigator.xr.isSessionSupported('immersive-vr').then((ok) => { $('bVR').hidden = !ok; $('bVR').onclick = () => enterXR('immersive-vr'); }).catch(() => {});
}
const TIPS = ['index-finger-tip', 'thumb-tip', 'middle-finger-tip', 'ring-finger-tip', 'pinky-finger-tip'];
function xrInputs() {
  const jp = new T.Vector3();
  xrHands.forEach((h) => {
    if (!h.joints) return;
    ['wrist', 'middle-finger-metacarpal', ...TIPS].forEach((n) => { const j = h.joints[n]; if (!j) return; j.getWorldPosition(jp); if (jp.lengthSq() < 1e-6) return; preds.push({ p: jp.clone(), r: 0.32, s: 9 }); if (TIPS.includes(n)) attractors.push(jp.clone().add(new T.Vector3(0, 0.012, 0))); });
  });
  grips.forEach((g) => { if (!g.visible) return; g.getWorldPosition(jp); if (jp.lengthSq() < 1e-6) return; preds.push({ p: jp.clone(), r: 0.35, s: 9 }); attractors.push(jp.clone().add(new T.Vector3(0, 0.06, 0))); });
}

/* ================= start ================= */
sizeRenderer(); setEffect('sardines');
const clock = new T.Clock();
R.setAnimationLoop(() => {
  const dt = Math.min(0.05, clock.getDelta()); uTime.value += dt;
  preds.length = 0; attractors.length = 0;
  if (mode === 'cam') {
    mlTick();
    if (performance.now() - handT < 400) handLm.forEach((lm) => {
      [0, 4, 8, 9, 12, 16, 20].forEach((j) => preds.push({ p: imgToWorld(lm[j].x, lm[j].y, 0.35), r: 0.55, s: 11 }));
      [8, 4, 12, 16, 20].forEach((j) => attractors.push(imgToWorld(lm[j].x, lm[j].y, 0.35).add(new T.Vector3(0, 0.02 * P.U, 0))));
    });
    P.center.lerp(center, 0.05);
  } else if (mode === 'xr') { xrInputs(); const v = viewerPos(); P.center.lerp(new T.Vector3(v.x, v.y - 0.25, v.z), 0.02); }
  for (let k = bursts.length - 1; k >= 0; k--) { const b = bursts[k]; b.t -= dt; preds.push({ p: b.p, r: 1.1, s: 22 }); if (b.t <= 0) bursts.splice(k, 1); }
  if (effect) effect.step(dt);
  if (rec) { const s = (performance.now() - recStart) / 1000, lim = DURS[durI]; $('timer').textContent = '● ' + Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0') + (lim ? ' / ' + lim + ' с' : ''); if (lim && s >= lim) rec.stop(); }
  if (msgT && performance.now() > msgT) msg('');
  R.render(scene, cam);
});
window.__f = { P, scene, cam, startCamera, center, preds, attractors, setEffect, get effect() { return effect; } };
