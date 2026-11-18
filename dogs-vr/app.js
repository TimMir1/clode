import * as T from 'three';
import { GLTFLoader } from './jsm/loaders/GLTFLoader.js';

const PI = Math.PI;
const $ = (id) => document.getElementById(id);
const msgEl = $('msg'), heardEl = $('heard'), sideEl = $('side');
const rnd = (a, b) => a + Math.random() * (b - a);
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const angD = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const store = {
  get(k, d) { try { const v = localStorage.getItem('dogs_' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('dogs_' + k, JSON.stringify(v)); } catch (e) {} },
};

/* ================= renderer / scene ================= */
const cv = $('c');
const R = new T.WebGLRenderer({ canvas: cv, antialias: true, alpha: true });
R.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
R.setSize(innerWidth, innerHeight, false);
R.shadowMap.enabled = true; R.shadowMap.type = T.PCFSoftShadowMap;
R.xr.enabled = true; R.xr.setReferenceSpaceType('local-floor');
const scene = new T.Scene();
const cam = new T.PerspectiveCamera(62, innerWidth / innerHeight, 0.05, 60);
cam.position.set(0, 1.5, 0.6); cam.lookAt(0, 0.4, -2);
scene.add(cam);
addEventListener('resize', () => { cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); R.setSize(innerWidth, innerHeight, false); });

scene.add(new T.HemisphereLight(0xfff8ee, 0x6f6152, 1.9));
const sun = new T.DirectionalLight(0xffffff, 2.4);
sun.position.set(1.5, 4, 2); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 0.5, far: 12 });
sun.shadow.bias = -0.0005; sun.shadow.radius = 4;
scene.add(sun, sun.target);
const shadowFloor = new T.Mesh(new T.PlaneGeometry(14, 14), new T.ShadowMaterial({ opacity: 0.32 }));
shadowFloor.rotation.x = -PI / 2; shadowFloor.receiveShadow = true; scene.add(shadowFloor);

const room = new T.Group(); scene.add(room);
{
  const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d');
  g.fillStyle = '#c9a57c'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 8; i++) {
    g.fillStyle = i % 2 ? '#c19d72' : '#cfab82'; g.fillRect(0, i * 64, 512, 64);
    g.fillStyle = 'rgba(80,50,20,.25)'; g.fillRect(0, i * 64, 512, 2); g.fillRect((i * 137) % 512, i * 64, 2, 64);
    for (let j = 0; j < 30; j++) { g.fillStyle = 'rgba(90,60,30,.07)'; g.fillRect(rnd(0, 512), i * 64 + rnd(4, 60), rnd(30, 140), 1.5); }
  }
  const tx = new T.CanvasTexture(c); tx.wrapS = tx.wrapT = T.RepeatWrapping; tx.repeat.set(7, 7); tx.colorSpace = T.SRGBColorSpace;
  const f = new T.Mesh(new T.CircleGeometry(9, 64), new T.MeshStandardMaterial({ map: tx, roughness: 0.85 }));
  f.rotation.x = -PI / 2; f.position.y = -0.002; f.receiveShadow = true; room.add(f);
  const wall = new T.Mesh(new T.CylinderGeometry(9, 9, 4, 64, 1, true), new T.MeshStandardMaterial({ color: 0xeee6da, side: T.BackSide, roughness: 1 }));
  wall.position.y = 2; room.add(wall);
  const rug = new T.Mesh(new T.CircleGeometry(1.3, 48), new T.MeshStandardMaterial({ color: 0x6b8fb8, roughness: 1 }));
  rug.rotation.x = -PI / 2; rug.position.set(-0.3, 0.001, -1.7); rug.receiveShadow = true; room.add(rug);
}
let arMode = false;
function setMode(ar) { arMode = ar; room.visible = !ar; shadowFloor.visible = ar; scene.background = ar ? null : new T.Color(0xdfe9f2); }
setMode(false);

/* ================= doghouse (будка) ================= */
const house = new T.Group();
{
  const wood = new T.MeshStandardMaterial({ color: 0xb5763f, roughness: 0.8 });
  const roofM = new T.MeshStandardMaterial({ color: 0x8c2f24, roughness: 0.7 });
  const dark = new T.MeshStandardMaterial({ color: 0x1d130c, roughness: 1 });
  const add = (geo, m, x, y, z, rz) => { const o = new T.Mesh(geo, m); o.position.set(x, y, z); if (rz) o.rotation.z = rz; o.castShadow = o.receiveShadow = true; house.add(o); return o; };
  add(new T.BoxGeometry(0.8, 0.55, 0.7), wood, 0, 0.275, 0);
  const gable = new T.Shape(); gable.moveTo(-0.4, 0); gable.lineTo(0.4, 0); gable.lineTo(0, 0.32); gable.closePath();
  const gg = new T.ExtrudeGeometry(gable, { depth: 0.7, bevelEnabled: false }); gg.translate(0, 0, -0.35);
  add(gg, wood, 0, 0.55, 0);
  add(new T.BoxGeometry(0.56, 0.035, 0.82), roofM, -0.21, 0.72, 0, 0.67);
  add(new T.BoxGeometry(0.56, 0.035, 0.82), roofM, 0.21, 0.72, 0, -0.67);
  const door = new T.Shape(); door.moveTo(-0.16, 0); door.lineTo(0.16, 0); door.lineTo(0.16, 0.26); door.absarc(0, 0.26, 0.16, 0, PI, false); door.closePath();
  const d = new T.Mesh(new T.ShapeGeometry(door), dark); d.position.set(0, 0.002, 0.352); house.add(d);
  const c = document.createElement('canvas'); c.width = 256; c.height = 64; const g = c.getContext('2d');
  g.fillStyle = '#f3e3c3'; g.fillRect(0, 0, 256, 64); g.fillStyle = '#5a3418'; g.font = '700 38px system-ui'; g.textAlign = 'center'; g.fillText('Бобик и Шарик', 128, 45);
  const pt = new T.CanvasTexture(c); pt.colorSpace = T.SRGBColorSpace;
  const plate = new T.Mesh(new T.PlaneGeometry(0.34, 0.085), new T.MeshStandardMaterial({ map: pt })); plate.position.set(0, 0.68, 0.356); house.add(plate);
  const bowl = add(new T.CylinderGeometry(0.09, 0.07, 0.05, 24), new T.MeshStandardMaterial({ color: 0x2f7dd0, roughness: 0.4 }), 0.55, 0.025, 0.3);
}
house.position.set(1.55, 0, -2.0);
house.rotation.y = Math.atan2(-1.55, 2.0);
scene.add(house);
function houseFrame() {
  const a = new T.Vector3(1, 0, 0).applyQuaternion(house.quaternion), n = new T.Vector3(0, 0, 1).applyQuaternion(house.quaternion);
  return { c: house.position, a, n };
}

/* ================= audio / speech out ================= */
const listener = new T.AudioListener(); cam.add(listener);
let barkBuf = [];
function makeBark(p) {
  const ctx = listener.context, sr = ctx.sampleRate, n = (sr * 0.3) | 0, b = ctx.createBuffer(1, n, sr), d = b.getChannelData(0);
  let ph = 0, lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr, f = p * (1.3 - t * 2.4) * (1 + 0.04 * Math.sin(t * 90));
    const env = t < 0.012 ? t / 0.012 : Math.exp(-(t - 0.012) * 13);
    ph += (2 * PI * f) / sr;
    const s = Math.sin(ph) + 0.7 * Math.sin(2 * ph + 0.4) + 0.45 * Math.sin(3 * ph + 1) + 0.25 * Math.sin(5 * ph) + (Math.random() * 2 - 1) * 0.5;
    lp += (s - lp) * 0.35; d[i] = lp * env * 0.32;
  }
  return b;
}
function audioInit() { try { listener.context.resume(); if (!barkBuf.length) barkBuf = [makeBark(560), makeBark(420)]; } catch (e) {} }
let speakingUntil = 0;
function speak(t) {
  speakingUntil = performance.now() + 900 + t.length * 75;
  try { const u = new SpeechSynthesisUtterance(t); u.lang = 'ru-RU'; u.rate = 1.05; u.onend = () => { speakingUntil = performance.now() + 400; }; speechSynthesis.cancel(); speechSynthesis.speak(u); } catch (e) {}
}

/* ================= text helpers ================= */
function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function wrap(g, text, maxW) {
  const out = [];
  String(text).split('\n').forEach((par) => {
    let line = '';
    par.split(' ').forEach((w) => { const t = line ? line + ' ' + w : w; if (g.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t; });
    out.push(line);
  });
  return out;
}
function textTex(txt, bg, fg, fs) {
  const c = document.createElement('canvas'); let g = c.getContext('2d'); fs = fs || 56;
  const font = '700 ' + fs + 'px system-ui,Roboto,sans-serif'; g.font = font;
  const w = Math.ceil(g.measureText(txt).width) + 60, h = fs + 60; c.width = w; c.height = h + 24; g = c.getContext('2d'); g.font = font;
  if (bg) { g.fillStyle = bg; rr(g, 4, 4, w - 8, h - 8, 34); g.fill(); g.beginPath(); g.moveTo(w / 2 - 18, h - 6); g.lineTo(w / 2, h + 20); g.lineTo(w / 2 + 18, h - 6); g.fill(); }
  g.fillStyle = fg || '#222'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, w / 2, h / 2);
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return { t, w: c.width, h: c.height };
}
const fxs = [];
function floatFx(txt, pos, col) {
  const tt = textTex(txt, null, col || '#e33', 64);
  const s = new T.Sprite(new T.SpriteMaterial({ map: tt.t, transparent: true, depthWrite: false }));
  s.scale.set((tt.w / tt.h) * 0.12, 0.12, 1); s.position.copy(pos); scene.add(s); fxs.push({ s, t: 0, life: 1.6 });
}
const viewer = new T.Vector3();
function viewerPos() { (R.xr.isPresenting ? R.xr.getCamera() : cam).getWorldPosition(viewer); return viewer; }
function viewerFwd() {
  const q = new T.Quaternion(); (R.xr.isPresenting ? R.xr.getCamera() : cam).getWorldQuaternion(q);
  const f = new T.Vector3(0, 0, -1).applyQuaternion(q); f.y = 0; if (f.lengthSq() < 1e-4) f.set(0, 0, -1); return f.normalize();
}

/* ================= dogs ================= */
const loader = new GLTFLoader();
const CLIPMAP = {
  idle: ['idle'], idle2: ['Idle_2', 'idle'], sniff: ['Idle_2_HeadLow', 'graze'], dig: ['Eating', 'graze'],
  walk: ['walk'], run: ['run'], jump: ['Gallop_Jump'], land: ['Jump_ToIdle'], lie: ['Death'],
  hit: ['Idle_HitReact1'], hit2: ['Idle_HitReact2'], bark: ['Attack'],
};
function retarget(clip, fromRoot, toRoot) {
  const tracks = [];
  clip.tracks.forEach((tr) => {
    const [node, prop] = tr.name.split('.');
    if (prop === 'quaternion') tracks.push(tr.clone());
    else if (prop === 'position') {
      const a = fromRoot.getObjectByName(node), b = toRoot.getObjectByName(node);
      if (!a || !b) return; const la = a.position.length(), lb = b.position.length();
      if (la < 1e-6) return; const k = lb / la, t2 = tr.clone(); t2.values = t2.values.map((v) => v * k); tracks.push(t2);
    }
  });
  return new T.AnimationClip(clip.name, clip.duration, tracks);
}

class Dog {
  constructor(i, gltf, opt, extraClips) {
    this.i = i; this.name = opt.name; this.names = opt.names;
    this.root = new T.Group(); this.model = gltf.scene; this.model.rotation.y = PI / 2; this.root.add(this.model);
    this.model.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
    this.mixer = new T.AnimationMixer(this.model);
    const all = gltf.animations.slice();
    (extraClips || []).forEach((c) => { if (!all.some((a) => a.name.toLowerCase() === c.name.toLowerCase())) all.push(retarget(c, opt.from, this.model)); });
    this.clips = {};
    for (const k in CLIPMAP) {
      const c = CLIPMAP[k].map((n) => all.find((a) => a.name.toLowerCase() === n.toLowerCase())).find(Boolean);
      if (c) this.clips[k] = this.mixer.clipAction(c);
    }
    // scale to real size
    this.clips.idle.play(); this.mixer.update(0.01); this.model.updateMatrixWorld(true);
    const box = new T.Box3().setFromObject(this.model, true), h = box.max.y - box.min.y;
    this.k = opt.height / h; this.model.scale.setScalar(this.k);
    this.model.updateMatrixWorld(true);
    const box2 = new T.Box3().setFromObject(this.model, true); this.model.position.y -= box2.min.y;
    this.walkRef = opt.walkRef; this.runRef = opt.runRef; this.len = opt.len;
    this.tail = ['Tail1', 'Tail2', 'Tail3'].map((n) => this.model.getObjectByName(n)).filter(Boolean);
    this.headBone = this.model.getObjectByName('Head');
    scene.add(this.root);
    this.cur = 'idle'; this.base = 'idle'; this.once = null; this.onceT = 0;
    const s = freeSpot(); this.x = s.x; this.z = s.z; this.elev = 0; this.h = rnd(0, 6); this.hWant = null; this.v = 0; this.path = []; this.spd = 0.5;
    this.t = 0; this.air = null; this.wag = 0.35; this.wagS = 9; this.bub = null; this.bubT = 0; this.carry = null;
    this.snd = new T.PositionalAudio(listener); this.snd.setRefDistance(0.8); this.root.add(this.snd); this.snd.position.y = 0.4;
  }
  play(k, fade = 0.3) {
    if (!this.clips[k]) k = 'idle';
    if (this.cur === k) return;
    const a = this.clips[k], p = this.clips[this.cur];
    a.reset(); a.enabled = true; a.setEffectiveWeight(1);
    const once = ['jump', 'land', 'lie', 'hit', 'hit2', 'bark'].includes(k);
    a.setLoop(once ? T.LoopOnce : T.LoopRepeat, Infinity); a.clampWhenFinished = once;
    a.timeScale = k === 'lie' ? 0.55 : 1;
    if (p) p.crossFadeTo(a, fade, false); a.play();
    this.cur = k;
  }
  oneShot(k, dur) { this.once = k; this.onceT = dur || (this.clips[k] ? this.clips[k].getClip().duration : 1); this.play(k, 0.15); }
  setBase(k) { this.base = k; }
  go(x, z, spd) { this.path = route(this.x, this.z, x, z); this.spd = spd || 0.5; this.air = null; }
  arrived() { return !this.path.length; }
  faceTo(x, z) { if (x && x.x !== undefined) { z = x.z; x = x.x; } this.hWant = Math.atan2(-(z - this.z), x - this.x); }
  faceViewer() { const v = viewerPos(); this.faceTo(v.x, v.z); }
  hop(x, z, dur, hh) { this.air = { x0: this.x, z0: this.z, x1: x, z1: z, T: dur, t: 0, h: hh }; this.path = []; }
  headPt() { const v = new T.Vector3(); (this.headBone || this.root).getWorldPosition(v); if (!this.headBone) v.y += 0.4; return v; }
  say(txt, sec) {
    if (this.bub) { scene.remove(this.bub); this.bub.material.map.dispose(); }
    const tt = textTex(txt, '#ffffff', '#222', 54);
    this.bub = new T.Sprite(new T.SpriteMaterial({ map: tt.t, transparent: true, depthWrite: false }));
    this.bub.scale.set((tt.w / tt.h) * 0.11, 0.11, 1); scene.add(this.bub); this.bubT = sec || 2;
  }
  bark(txt) {
    this.say(txt || 'Гав!', 1.1);
    if (!this.air && !this.path.length) this.oneShot('bark', 0.7);
    try { if (barkBuf.length) { if (this.snd.isPlaying) this.snd.stop(); this.snd.setBuffer(barkBuf[this.i]); this.snd.setPlaybackRate(rnd(0.92, 1.08)); this.snd.play(); } } catch (e) {}
  }
  update(dt) {
    this.t += dt;
    if (this.air) {
      const a = this.air; a.t += dt; const s = clamp(a.t / a.T, 0, 1);
      const nx = lerp(a.x0, a.x1, s), nz = lerp(a.z0, a.z1, s);
      this.v = Math.hypot(nx - this.x, nz - this.z) / Math.max(dt, 0.001); this.x = nx; this.z = nz;
      this.elev = 4 * a.h * s * (1 - s);
      if (Math.hypot(a.x1 - a.x0, a.z1 - a.z0) > 0.02) this.h += clamp(angD(Math.atan2(-(a.z1 - a.z0), a.x1 - a.x0), this.h), -8 * dt, 8 * dt);
      if (s >= 1) { this.air = null; this.elev = 0; this.v = 0; this.oneShot('land', 0.5); }
    } else if (this.path.length) {
      const tg = this.path[0], dx = tg.x - this.x, dz = tg.z - this.z, d = Math.hypot(dx, dz);
      if (d < 0.05) this.path.shift();
      else {
        const want = Math.atan2(-dz, dx), df = angD(want, this.h), tr = (this.spd > 1 ? 6 : 3.5) * dt;
        this.h += clamp(df, -tr, tr); this.hWant = null;
        const tv = this.spd * clamp(1 - Math.abs(df) / 1.5, 0.2, 1) * Math.min(1, (this.path.length > 1 ? 1 : d * 2.2) + 0.25);
        this.v = lerp(this.v, tv, Math.min(1, dt * 4));
        this.x += Math.cos(this.h) * this.v * dt; this.z -= Math.sin(this.h) * this.v * dt;
      }
    } else this.v *= Math.max(0, 1 - dt * 8);
    if (this.hWant !== null && !this.path.length && !this.air) {
      const df = angD(this.hWant, this.h); this.h += clamp(df, -3 * dt, 3 * dt);
      if (Math.abs(df) > 0.25 && this.v < 0.05) this.turning = true; else this.turning = false;
    } else this.turning = false;
    // animation choice
    if (this.once) { this.onceT -= dt; if (this.onceT <= 0) this.once = null; }
    if (this.air) this.play('jump', 0.12);
    else if (this.once) { /* keep */ }
    else if (this.v > 0.06 || this.turning) {
      const run = this.v > this.walkRef * 1.6;
      this.play(run ? 'run' : 'walk', 0.25);
      const a = this.clips[run ? 'run' : 'walk'];
      a.timeScale = clamp(this.turning && this.v < 0.06 ? 0.7 : this.v / (run ? this.runRef : this.walkRef), 0.5, 1.7);
    } else this.play(this.base, 0.4);
    this.mixer.update(dt);
    // procedural tail wag on top of the clip
    if (this.wag > 0.01 && this.cur !== 'lie') this.tail.forEach((b, j) => { b.rotation.y += Math.sin(this.t * this.wagS - j * 0.6) * this.wag * (j ? 0.6 : 1); });
    this.root.position.set(this.x, this.elev, this.z); this.root.rotation.y = this.h;
    if (this.bub) {
      this.bubT -= dt; const hp = this.headPt(); this.bub.position.set(hp.x, hp.y + 0.22, hp.z);
      this.bub.material.opacity = clamp(this.bubT * 3, 0, 1); if (this.bubT < 0) { scene.remove(this.bub); this.bub = null; }
    }
    if (this.carry) {
      const hp = this.headPt(); const f = new T.Vector3(Math.cos(this.h), 0, -Math.sin(this.h));
      this.carry.position.set(hp.x + f.x * 0.12, hp.y - 0.08, hp.z + f.z * 0.12); this.carry.rotation.y = this.h + PI / 2;
    }
  }
}

/* ================= obstacles / routing ================= */
function segX(ax, az, bx, bz, cx, cz, dx, dz) {
  const o = (px, pz, qx, qz, rx, rz) => (qx - px) * (rz - pz) - (qz - pz) * (rx - px);
  return o(ax, az, bx, bz, cx, cz) * o(ax, az, bx, bz, dx, dz) < 0 && o(cx, cz, dx, dz, ax, az) * o(cx, cz, dx, dz, bx, bz) < 0;
}
function route(x0, z0, x1, z1) {
  const f = houseFrame(), hw = 0.75, hd = 0.65;
  const C = (sa, sn) => ({ x: f.c.x + f.a.x * sa + f.n.x * sn, z: f.c.z + f.a.z * sa + f.n.z * sn });
  const corners = [C(-hw, hd), C(hw, hd), C(hw, -hd), C(-hw, -hd)];
  let hit = false;
  for (let i = 0; i < 4; i++) { const p = corners[i], q = corners[(i + 1) % 4]; if (segX(x0, z0, x1, z1, p.x, p.z, q.x, q.z)) hit = true; }
  if (!hit) return [{ x: x1, z: z1 }];
  let best = null;
  corners.forEach((c) => {
    let ok = true;
    for (let i = 0; i < 4; i++) { const p = corners[i], q = corners[(i + 1) % 4]; if (segX(x0, z0, c.x * 0.999 + f.c.x * 0.001, c.z * 0.999 + f.c.z * 0.001, p.x, p.z, q.x, q.z)) ok = false; }
    const d = Math.hypot(c.x - x0, c.z - z0) + Math.hypot(x1 - c.x, z1 - c.z);
    if (ok && (!best || d < best.d)) best = { c, d };
  });
  return best ? [best.c, { x: x1, z: z1 }] : [{ x: x1, z: z1 }];
}
function nearHouse(x, z) { const f = houseFrame(), vx = x - f.c.x, vz = z - f.c.z; return Math.abs(vx * f.a.x + vz * f.a.z) < 0.75 && Math.abs(vx * f.n.x + vz * f.n.z) < 0.7; }
function freeSpot() {
  const v = viewerPos(), fw = viewerFwd(), base = Math.atan2(fw.x, -fw.z);
  for (let k = 0; k < 40; k++) {
    const a = base + rnd(-PI * 0.45, PI * 0.45) + (Math.random() < 0.9 ? 0 : PI), r = rnd(1.0, 3.0);
    const x = v.x + Math.sin(a) * r, z = v.z - Math.cos(a) * r;
    if (!nearHouse(x, z) && Math.hypot(x, z) < 6) return { x, z };
  }
  return { x: 0, z: -1.5 };
}

/* ================= boards (signs that dogs bring) ================= */
const uiMeshes = [];
class Board {
  constructor(title, lines, buttons, opts) {
    opts = opts || {};
    this.wm = opts.w || 0.7; this.ppm = 900; this.title = title; this.lines = lines || []; this.buttons = buttons || []; this.hover = -1;
    this.c = document.createElement('canvas'); this.c.width = this.wm * this.ppm;
    const g = this.c.getContext('2d'); g.font = '500 34px system-ui,Roboto,sans-serif';
    this.wr = []; this.lines.forEach((l) => { if (typeof l === 'object') this.wr.push(l); else wrap(g, l, this.c.width - 80).forEach((x) => this.wr.push(x)); });
    const rowH = 50, h = 110 + this.wr.length * rowH + (this.buttons.length ? Math.ceil(this.buttons.filter((b) => !b.row).length / 2) * 74 + 20 : 10) + 20;
    this.c.height = Math.min(h, 1500);
    this.tex = new T.CanvasTexture(this.c); this.tex.colorSpace = T.SRGBColorSpace;
    this.mesh = new T.Mesh(new T.PlaneGeometry(this.wm, (this.wm * this.c.height) / this.c.width), new T.MeshBasicMaterial({ map: this.tex, transparent: true, depthTest: false }));
    this.mesh.renderOrder = 10; this.mesh.userData.ui = this; this.btnRects = [];
    this.draw();
  }
  draw() {
    const g = this.c.getContext('2d'), w = this.c.width, h = this.c.height; g.clearRect(0, 0, w, h);
    g.fillStyle = 'rgba(24,26,34,.95)'; rr(g, 4, 4, w - 8, h - 8, 36); g.fill();
    g.fillStyle = '#fff'; g.font = '700 42px system-ui,Roboto,sans-serif'; g.textBaseline = 'middle'; g.textAlign = 'left';
    g.fillText(this.title, 36, 58);
    // close button
    this.btnRects = [];
    const cx = w - 86; g.fillStyle = this.hover === -2 ? '#ff8a2a' : 'rgba(255,80,80,.35)'; rr(g, cx, 22, 60, 60, 16); g.fill();
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.fillText('✕', cx + 30, 54); this.btnRects.push({ x: cx, y: 22, w: 60, h: 60, fn: () => closeBoard(this), id: -2 });
    g.textAlign = 'left'; g.font = '500 34px system-ui,Roboto,sans-serif';
    let y = 130;
    this.wr.forEach((l) => {
      if (typeof l === 'object') { // row with button
        g.fillStyle = '#e9ecf5'; g.fillText(l.text, 36, y);
        const bw = 190, bx = w - bw - 30, id = this.btnRects.length;
        g.fillStyle = this.hover === id ? '#ff8a2a' : '#2f7d4f'; rr(g, bx, y - 23, bw, 46, 14); g.fill();
        g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = '600 26px system-ui'; g.fillText(l.btn, bx + bw / 2, y + 1); g.textAlign = 'left'; g.font = '500 34px system-ui,Roboto,sans-serif';
        this.btnRects.push({ x: bx, y: y - 23, w: bw, h: 46, fn: l.fn, id });
      } else { g.fillStyle = '#e9ecf5'; g.fillText(l, 36, y); }
      y += 50;
    });
    y += 10;
    const bw = (w - 90) / 2;
    this.buttons.forEach((b, k) => {
      const id = this.btnRects.length, full = this.buttons.length === 1 || b.full;
      const bx = full ? 30 : 30 + (k % 2) * (bw + 30), by = y + (full ? 0 : Math.floor(k / 2) * 74);
      const ww = full ? w - 60 : bw;
      g.fillStyle = this.hover === id ? '#ff8a2a' : b.col || '#3a6df0'; rr(g, bx, by, ww, 60, 18); g.fill();
      g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = '600 30px system-ui'; g.fillText(b.l, bx + ww / 2, by + 32); g.textAlign = 'left';
      this.btnRects.push({ x: bx, y: by, w: ww, h: 60, fn: b.fn, id });
      if (full) y += 74;
    });
    this.tex.needsUpdate = true;
  }
  hit(uv) { const x = uv.x * this.c.width, y = (1 - uv.y) * this.c.height; return this.btnRects.find((b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h); }
}
let board = null, boardT = 0;
function showBoard(b, near, ttl) {
  closeBoard(); board = b; boardT = ttl || 0;
  const v = viewerPos(), fw = viewerFwd();
  let p = v.clone().addScaledVector(fw, 1.15);
  if (near) { const sx = fw.z, sz = -fw.x; p.x += sx * 0.12; p.z += sz * 0.12; }
  p.y = clamp(v.y - 0.15, 0.7, 1.8);
  b.mesh.position.copy(p); b.mesh.lookAt(v.x, p.y, v.z);
  scene.add(b.mesh); uiMeshes.push(b.mesh); renderSide();
}
function closeBoard(b) {
  if (!board || (b && b !== board)) return;
  scene.remove(board.mesh); uiMeshes.splice(uiMeshes.indexOf(board.mesh), 1); board = null;
}
function carrySign(d, on) {
  if (d.carry) { scene.remove(d.carry); d.carry = null; }
  if (!on) return;
  const m = new T.Mesh(new T.PlaneGeometry(0.14, 0.1), new T.MeshStandardMaterial({ color: 0xfff6e0, side: T.DoubleSide }));
  m.castShadow = true; scene.add(m); d.carry = m;
}

/* ================= behaviour coroutines ================= */
let dogs = [], cur = null, DT = 0.016;
function* wait(s) { let t = 0; while (t < s) { t += DT; yield; } }
function* until(f, mx) { let t = 0; while (!f() && t < (mx || 20)) { t += DT; yield; } }
function* both(a, b, mx) { yield* until(() => a.arrived() && b.arrived(), mx || 14); }
const other = (d) => dogs[1 - d.i];
function idleKind(d) { const k = Math.floor(rnd(0, 4)); d.setBase(['idle', 'sniff', 'idle2', 'dig'][k]); if (k === 2) d.faceViewer(); }
function* wander() {
  const [a, b] = dogs; a.setBase('idle'); b.setBase('idle');
  const s1 = freeSpot(), s2 = freeSpot(); a.go(s1.x, s1.z, rnd(0.45, 0.65)); b.go(s2.x, s2.z, rnd(0.45, 0.65));
  yield* both(a, b); idleKind(a); idleKind(b); yield* wait(rnd(2.5, 5));
}
function* meet(a, b) {
  let mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;
  if (Math.hypot(mx - viewerPos().x, mz - viewerPos().z) < 0.9 || nearHouse(mx, mz)) { const s = freeSpot(); mx = s.x; mz = s.z; }
  const dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1, g = 0.3;
  a.setBase('idle'); b.setBase('idle'); a.go(mx - (dx / l) * g, mz - (dz / l) * g, 0.6); b.go(mx + (dx / l) * g, mz + (dz / l) * g, 0.6);
  yield* both(a, b); a.faceTo(b); b.faceTo(a); yield* wait(0.8);
}
function* lick(a, b) {
  yield* meet(a, b);
  const dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1;
  a.go(b.x - (dx / l) * (a.len * 0.75), b.z - (dz / l) * (a.len * 0.75), 0.25); yield* until(() => a.arrived(), 3); a.faceTo(b);
  a.setBase('sniff'); b.setBase('idle2'); a.wag = b.wag = 0.7; a.wagS = b.wagS = 14;
  for (let i = 0; i < 8; i++) { const h = a.headPt().lerp(b.headPt(), 0.5); h.y += 0.08; floatFx(i % 2 ? '❤️' : '💕', h); yield* wait(0.38); }
  a.setBase('idle'); yield* wait(0.5);
  if (Math.random() < 0.6) { b.setBase('sniff'); for (let i = 0; i < 4; i++) { const h = a.headPt().lerp(b.headPt(), 0.5); h.y += 0.08; floatFx('❤️', h); yield* wait(0.38); } b.setBase('idle'); }
  a.wag = b.wag = 0.35; a.wagS = b.wagS = 9; yield* wait(0.5);
}
function* pounce(a, b) {
  yield* meet(a, b);
  const dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1, ux = dx / l, uz = dz / l;
  a.bark(); a.wag = 0.8; yield* wait(0.8);
  a.hop(b.x - ux * a.len * 0.35, b.z - uz * a.len * 0.35, 0.55, 0.22); yield* wait(0.3);
  b.oneShot('hit', 0.7); b.say('Ай!', 1.2); yield* until(() => !a.air, 2);
  yield* wait(0.6); b.bark('Гав-гав!'); yield* wait(0.4);
  let s = freeSpot(); b.go(s.x, s.z, 1.7); yield* wait(0.3);
  let t = 0;
  while (t < 4) {
    t += DT; if (b.arrived()) { s = freeSpot(); b.go(s.x, s.z, 1.7); }
    if (((t * 10) | 0) % 3 === 0) a.go(b.x - Math.cos(b.h) * 0.45, b.z + Math.sin(b.h) * 0.45, 1.75);
    yield;
  }
  a.path = []; b.path = []; a.faceTo(b); b.faceTo(a); a.wag = 0.6; yield* wait(2);
}
function* nap() {
  const [a, b] = dogs; yield* meet(a, b);
  a.setBase('lie'); b.setBase('lie'); a.wag = b.wag = 0;
  for (let i = 0; i < 7; i++) { yield* wait(0.6); const h = (i % 2 ? a : b).headPt(); h.y += 0.15; floatFx(i % 2 ? 'z' : 'Z', h, '#5a7bd8'); }
  a.setBase('idle'); b.setBase('idle'); a.wag = b.wag = 0.35; yield* wait(1.2);
}
function* hideHouse(a, b) {
  const f = houseFrame(), side = Math.random() < 0.5 ? 1 : -1;
  const hx = f.c.x - f.n.x * 0.75 + f.a.x * side * 0.1, hz = f.c.z - f.n.z * 0.75 + f.a.z * side * 0.1;
  a.go(hx, hz, 1.3); b.setBase('idle2'); b.say('Раз, два, три…', 2.5);
  yield* until(() => a.arrived(), 9); a.faceTo(f.c.x + f.a.x * side, f.c.z + f.a.z * side); a.setBase('idle');
  yield* wait(1.5); b.say('Где ты?', 1.5);
  for (let k = 0; k < 2; k++) {
    const s = freeSpot(); b.setBase('sniff'); b.go(s.x, s.z, 0.55); yield* until(() => b.arrived(), 7); b.faceViewer(); yield* wait(0.8);
    const px = f.c.x - f.n.x * 0.55 + f.a.x * side * 0.62, pz = f.c.z - f.n.z * 0.55 + f.a.z * side * 0.62;
    a.go(px, pz, 0.35); yield* until(() => a.arrived(), 4); a.faceTo(f.c.x + f.a.x * side * 3 + f.n.x, f.c.z + f.a.z * side * 3 + f.n.z); a.wag = 0.8;
    yield* wait(1.3); a.go(hx, hz, 0.5); yield* until(() => a.arrived(), 4);
  }
  b.setBase('sniff'); b.go(f.c.x + f.a.x * side * 0.95 - f.n.x * 0.3, f.c.z + f.a.z * side * 0.95 - f.n.z * 0.3, 0.7); yield* until(() => b.arrived(), 8);
  b.faceTo(a); b.bark('Нашёл!'); yield* wait(0.5);
  const e = freeSpot(); a.go(e.x, e.z, 1.6); yield* wait(0.3); b.go(e.x, e.z, 1.6); yield* until(() => a.arrived(), 6);
  b.path = []; a.faceTo(b); b.faceTo(a); a.wag = 0.35; b.setBase('idle'); yield* wait(1.5);
}
function frontSpot(off) {
  const v = viewerPos(), f = viewerFwd();
  return { x: v.x + f.x * 0.95 + f.z * (off || 0), z: v.z + f.z * 0.95 - f.x * (off || 0) };
}
function* visit() {
  const [a, b] = dogs, s1 = frontSpot(-0.3), s2 = frontSpot(0.3);
  a.go(s1.x, s1.z, 0.7); b.go(s2.x, s2.z, 0.7); yield* both(a, b, 10);
  a.faceViewer(); b.faceViewer(); a.setBase('idle2'); b.setBase('idle2'); a.wag = 0.8; b.wag = 0.7;
  yield* wait(0.8); a.bark(); yield* wait(3); a.wag = b.wag = 0.35;
}
const story = ['wander', 'lick', 'hide', 'wander', 'pounce', 'visit', 'wander', 'nap', 'lick', 'hide', 'pounce'];
let si = 0;
function pick() {
  const a = dogs[Math.random() < 0.5 ? 0 : 1], b = other(a), n = story[si++ % story.length];
  return n === 'wander' ? wander() : n === 'lick' ? lick(a, b) : n === 'pounce' ? pounce(a, b) : n === 'nap' ? nap() : n === 'hide' ? hideHouse(a, b) : visit();
}
function interrupt(g) { dogs.forEach((d) => { d.path = []; d.air = null; d.elev = 0; d.wag = 0.35; d.wagS = 9; d.setBase('idle'); d.once = null; }); cur = g; }

/* ================= useful skills ================= */
// --- Russian number words ---
const NUM = { ноль: 0, один: 1, одну: 1, одна: 1, два: 2, две: 2, три: 3, четыре: 4, пять: 5, шесть: 6, семь: 7, восемь: 8, девять: 9, десять: 10,
  одиннадцать: 11, двенадцать: 12, тринадцать: 13, четырнадцать: 14, пятнадцать: 15, шестнадцать: 16, семнадцать: 17, восемнадцать: 18, девятнадцать: 19,
  двадцать: 20, тридцать: 30, сорок: 40, пятьдесят: 50, шестьдесят: 60, семьдесят: 70, восемьдесят: 80, девяносто: 90, сто: 100, двести: 200, триста: 300 };
function numbersIn(words) { // returns list of {n, i, j}
  const out = []; let i = 0;
  while (i < words.length) {
    const w = words[i];
    if (/^\d+([.,]\d+)?$/.test(w)) { out.push({ n: parseFloat(w.replace(',', '.')), i, j: i }); i++; continue; }
    if (NUM[w] !== undefined) { let n = NUM[w], j = i; while (j + 1 < words.length && NUM[words[j + 1]] !== undefined && NUM[words[j + 1]] < n && NUM[words[j + 1]] < 100) { j++; n += NUM[words[j]]; } out.push({ n, i, j }); i = j + 1; continue; }
    i++;
  }
  return out;
}
function parseDuration(text) { // seconds
  const w = text.split(/\s+/); let sec = 0, found = false;
  if (/полчаса/.test(text)) { sec += 1800; found = true; }
  if (/полтора час/.test(text)) { sec += 5400; found = true; }
  if (/(^|\s)час(а|ов)?(\s|$)/.test(text) && !numbersIn(w).some((n) => /^час/.test(w[n.j + 1] || '')) && !/полчаса|полтора/.test(text)) { sec += 3600; found = true; }
  numbersIn(w).forEach((n) => {
    const u = w[n.j + 1] || '';
    if (/^мин/.test(u)) { sec += n.n * 60; found = true; } else if (/^сек/.test(u)) { sec += n.n; found = true; } else if (/^час/.test(u)) { sec += n.n * 3600; found = true; }
  });
  if (!found && /минут/.test(text)) { sec = 60; found = true; }
  return found ? sec : 0;
}
function fmtDur(s) { const h = Math.floor(s / 3600), m = Math.round((s % 3600) / 60); return (h ? h + ' ч ' : '') + (m ? m + ' мин' : h ? '' : s + ' сек'); }

// --- timers ---
let timers = store.get('timers', []);
function addTimer(sec, label) { timers.push({ at: Date.now() + sec * 1000, label: label || '' }); store.set('timers', timers); renderSide(); }
let breakEvery = store.get('breakEvery', 45), sessionStart = Date.now(), lastBreak = Date.now();

// --- notes & basket ---
let notes = store.get('notes', []), basket = store.get('basket', []);
function saveAll() { store.set('notes', notes); store.set('basket', basket); renderSide(); }
const VV = (q) => 'https://vkusvill.ru/search/?type=products&q=' + encodeURIComponent(q);
function openUrl(u) { try { window.open(u, '_blank'); } catch (e) {} }

// --- dishes: products per 1 person ---
const DISHES = {
  'лагман': [['Говядина', 150, 'г'], ['Лапша для лагмана', 100, 'г'], ['Болгарский перец', 0.5, 'шт'], ['Морковь', 0.5, 'шт'], ['Лук репчатый', 0.5, 'шт'], ['Помидоры', 1, 'шт'], ['Редька зелёная', 50, 'г'], ['Чеснок', 1, 'зуб.'], ['Зелень (кинза, укроп)', 0.25, 'пучок'], ['Масло растительное', 15, 'мл']],
  'плов': [['Баранина или говядина', 150, 'г'], ['Рис девзира или басмати', 100, 'г'], ['Морковь', 1, 'шт'], ['Лук репчатый', 0.5, 'шт'], ['Чеснок', 0.5, 'головка'], ['Зира', 1, 'ч. л.'], ['Масло растительное', 30, 'мл'], ['Нут', 30, 'г']],
  'борщ': [['Говядина на кости', 120, 'г'], ['Свёкла', 0.5, 'шт'], ['Капуста белокочанная', 100, 'г'], ['Картофель', 1, 'шт'], ['Морковь', 0.5, 'шт'], ['Лук репчатый', 0.5, 'шт'], ['Томатная паста', 15, 'г'], ['Сметана', 30, 'г'], ['Чеснок', 1, 'зуб.'], ['Укроп', 0.2, 'пучок']],
  'щи': [['Говядина', 120, 'г'], ['Капуста белокочанная', 150, 'г'], ['Картофель', 1, 'шт'], ['Морковь', 0.5, 'шт'], ['Лук репчатый', 0.5, 'шт'], ['Сметана', 30, 'г'], ['Укроп', 0.2, 'пучок']],
  'солянка': [['Говядина', 80, 'г'], ['Копчёная колбаса', 50, 'г'], ['Сосиски', 1, 'шт'], ['Солёные огурцы', 1, 'шт'], ['Оливки', 20, 'г'], ['Лук репчатый', 0.5, 'шт'], ['Томатная паста', 15, 'г'], ['Лимон', 0.2, 'шт'], ['Сметана', 30, 'г']],
  'рассольник': [['Говядина или курица', 120, 'г'], ['Перловка', 20, 'г'], ['Солёные огурцы', 1, 'шт'], ['Картофель', 1, 'шт'], ['Морковь', 0.5, 'шт'], ['Лук репчатый', 0.5, 'шт'], ['Сметана', 30, 'г']],
  'шурпа': [['Баранина на кости', 200, 'г'], ['Картофель', 1, 'шт'], ['Морковь', 0.5, 'шт'], ['Лук репчатый', 0.5, 'шт'], ['Помидоры', 1, 'шт'], ['Болгарский перец', 0.5, 'шт'], ['Зелень (кинза)', 0.25, 'пучок']],
  'манты': [['Фарш баранина/говядина', 150, 'г'], ['Мука', 120, 'г'], ['Лук репчатый', 1, 'шт'], ['Курдючный жир', 20, 'г'], ['Яйца', 0.3, 'шт'], ['Сметана', 40, 'г']],
  'пельмени': [['Фарш свино-говяжий', 150, 'г'], ['Мука', 120, 'г'], ['Яйца', 0.3, 'шт'], ['Лук репчатый', 0.3, 'шт'], ['Сметана', 40, 'г']],
  'оливье': [['Картофель', 1, 'шт'], ['Морковь', 0.3, 'шт'], ['Яйца', 1, 'шт'], ['Варёная колбаса или курица', 70, 'г'], ['Солёные огурцы', 1, 'шт'], ['Горошек консервированный', 40, 'г'], ['Майонез', 40, 'г']],
  'винегрет': [['Свёкла', 0.5, 'шт'], ['Картофель', 1, 'шт'], ['Морковь', 0.5, 'шт'], ['Солёные огурцы', 1, 'шт'], ['Квашеная капуста', 50, 'г'], ['Горошек консервированный', 30, 'г'], ['Масло растительное', 15, 'мл']],
  'голубцы': [['Фарш', 120, 'г'], ['Капуста белокочанная', 200, 'г'], ['Рис', 30, 'г'], ['Морковь', 0.5, 'шт'], ['Лук репчатый', 0.5, 'шт'], ['Томатная паста', 20, 'г'], ['Сметана', 30, 'г']],
  'котлеты': [['Фарш', 150, 'г'], ['Лук репчатый', 0.3, 'шт'], ['Яйца', 0.3, 'шт'], ['Батон', 30, 'г'], ['Молоко', 30, 'мл'], ['Панировочные сухари', 15, 'г']],
  'макароны по флотски': [['Макароны', 100, 'г'], ['Фарш', 120, 'г'], ['Лук репчатый', 0.5, 'шт'], ['Сливочное масло', 10, 'г']],
  'гречка с мясом': [['Гречка', 80, 'г'], ['Говядина или свинина', 150, 'г'], ['Лук репчатый', 0.5, 'шт'], ['Морковь', 0.5, 'шт']],
  'жаркое': [['Свинина или говядина', 150, 'г'], ['Картофель', 2, 'шт'], ['Морковь', 0.5, 'шт'], ['Лук репчатый', 0.5, 'шт'], ['Чеснок', 1, 'зуб.'], ['Зелень', 0.2, 'пучок']],
  'окрошка': [['Квас или кефир', 300, 'мл'], ['Картофель', 1, 'шт'], ['Огурцы свежие', 1, 'шт'], ['Редис', 3, 'шт'], ['Яйца', 1, 'шт'], ['Варёная колбаса', 70, 'г'], ['Зелёный лук и укроп', 0.25, 'пучок'], ['Сметана', 30, 'г']],
  'уха': [['Рыба (лосось/судак)', 200, 'г'], ['Картофель', 1, 'шт'], ['Морковь', 0.5, 'шт'], ['Лук репчатый', 0.5, 'шт'], ['Укроп', 0.2, 'пучок'], ['Лавровый лист', 1, 'шт']],
  'сырники': [['Творог 5–9%', 120, 'г'], ['Яйца', 0.5, 'шт'], ['Мука', 25, 'г'], ['Сахар', 15, 'г'], ['Сметана', 30, 'г']],
  'блины': [['Молоко', 150, 'мл'], ['Мука', 60, 'г'], ['Яйца', 0.7, 'шт'], ['Сахар', 10, 'г'], ['Масло растительное', 10, 'мл']],
  'омлет': [['Яйца', 3, 'шт'], ['Молоко', 50, 'мл'], ['Сливочное масло', 10, 'г']],
  'цезарь': [['Куриное филе', 120, 'г'], ['Салат романо', 0.5, 'шт'], ['Помидоры черри', 5, 'шт'], ['Пармезан', 20, 'г'], ['Батон для сухариков', 40, 'г'], ['Соус цезарь', 30, 'г']],
  'карбонара': [['Спагетти', 100, 'г'], ['Бекон или гуанчале', 60, 'г'], ['Яйца', 1, 'шт'], ['Пармезан', 25, 'г']],
  'шашлык': [['Свинина (шея) или баранина', 300, 'г'], ['Лук репчатый', 1, 'шт'], ['Уксус или гранатовый сок', 20, 'мл'], ['Лаваш', 0.5, 'шт'], ['Помидоры', 1, 'шт'], ['Огурцы', 1, 'шт']],
  'шаурма': [['Куриное бедро', 150, 'г'], ['Лаваш', 1, 'шт'], ['Капуста', 60, 'г'], ['Огурцы', 0.5, 'шт'], ['Помидоры', 0.5, 'шт'], ['Чесночный соус', 30, 'г']],
  'самса': [['Слоёное тесто', 120, 'г'], ['Баранина или говядина', 100, 'г'], ['Лук репчатый', 0.5, 'шт'], ['Кунжут', 3, 'г']],
  'харчо': [['Говядина на кости', 150, 'г'], ['Рис', 25, 'г'], ['Лук репчатый', 0.5, 'шт'], ['Ткемали', 20, 'г'], ['Грецкие орехи', 15, 'г'], ['Хмели-сунели', 1, 'ч. л.'], ['Кинза', 0.25, 'пучок']],
  'жареная картошка': [['Картофель', 3, 'шт'], ['Лук репчатый', 0.5, 'шт'], ['Масло растительное', 30, 'мл']],
  'пицца': [['Тесто для пиццы', 150, 'г'], ['Моцарелла', 80, 'г'], ['Томатный соус', 40, 'г'], ['Пепперони или ветчина', 60, 'г']],
  'завтрак': [['Яйца', 2, 'шт'], ['Хлеб', 2, 'ломтика'], ['Сыр', 30, 'г'], ['Помидоры', 1, 'шт'], ['Кофе или чай', 1, 'порция']],
};
const DISH_ALIASES = { 'лагмана': 'лагман', 'лагмен': 'лагман', 'плова': 'плов', 'борща': 'борщ', 'щей': 'щи', 'солянки': 'солянка', 'рассольника': 'рассольник', 'шурпы': 'шурпа', 'мантов': 'манты', 'пельменей': 'пельмени', 'оливье': 'оливье', 'винегрета': 'винегрет', 'голубцов': 'голубцы', 'котлет': 'котлеты', 'флотски': 'макароны по флотски', 'гречки': 'гречка с мясом', 'жаркого': 'жаркое', 'окрошки': 'окрошка', 'ухи': 'уха', 'сырников': 'сырники', 'блинов': 'блины', 'омлета': 'омлет', 'цезаря': 'цезарь', 'карбонары': 'карбонара', 'шашлыка': 'шашлык', 'шаурмы': 'шаурма', 'шавермы': 'шаурма', 'самсы': 'самса', 'харчо': 'харчо', 'картошки': 'жареная картошка', 'пиццы': 'пицца', 'завтрака': 'завтрак' };
function lev(a, b) {
  const m = a.length, n = b.length, d = Array.from({ length: m + 1 }, (_, i) => [i]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[m][n];
}
function fuzzyHas(text, key) {
  const s = text.replace(/\s+/g, ''), k = key.replace(/\s+/g, '');
  if (s.includes(k)) return true; if (k.length < 5) return false;
  const L = k.length, tol = L >= 8 ? 2 : 1;
  for (let i = 0; i + L - 1 <= s.length; i++) for (const l of [L - 1, L, L + 1]) { const sub = s.substr(i, l); if (sub.length >= L - 1 && lev(sub, k) <= tol) return true; }
  return false;
}
function findDish(t) {
  for (const k of Object.keys(DISHES)) if (t.includes(k)) return k;
  for (const k of Object.keys(DISH_ALIASES)) if (t.includes(k)) return DISH_ALIASES[k];
  const tail = t.replace(/.*?(?:(?<![а-яa-z0-9])(?=[а-яa-z0-9])|(?<=[а-яa-z0-9])(?![а-яa-z0-9]))(на|для)\s+/, ' ');
  for (const k of Object.keys(DISHES)) if (fuzzyHas(tail, k)) return k;
  for (const k of Object.keys(DISH_ALIASES)) if (fuzzyHas(tail, k)) return DISH_ALIASES[k];
  return null;
}
const PEOPLE = { одного: 1, двоих: 2, двух: 2, троих: 3, трех: 3, четверых: 4, четырех: 4, пятерых: 5, пяти: 5, шестерых: 6, шести: 6, семерых: 7, восьмерых: 8, десятерых: 10, компанию: 6, семью: 4 };
function peopleIn(t) {
  let n = 0; const w = t.split(/\s+/);
  w.forEach((x) => { if (PEOPLE[x]) n = Math.max(n, PEOPLE[x]); });
  numbersIn(w).forEach((x) => { const nx = w[x.j + 1] || ''; if (/^(человек|персон|порци|гост)/.test(nx) || /^(человек|персон)/.test(w[x.j + 2] || '')) n = Math.max(n, x.n); });
  return n || 2;
}
function fmtQty(v, u) {
  if (u === 'г' || u === 'мл') { const r = v >= 1000 ? Math.round(v / 100) / 10 : Math.ceil(v / 50) * 50; return v >= 1000 ? r + (u === 'г' ? ' кг' : ' л') : r + ' ' + u; }
  if (u === 'шт' || u === 'зуб.' || u === 'головка' || u === 'ломтика' || u === 'порция') return Math.max(1, Math.ceil(v)) + ' ' + u;
  if (u === 'пучок') return Math.max(1, Math.ceil(v)) + ' пуч.';
  return Math.ceil(v * 10) / 10 + ' ' + u;
}

// --- web info ---
async function getJSON(u) { const r = await fetch(u); if (!r.ok) throw new Error(r.status); return r.json(); }
const WMO = { 0: 'ясно ☀️', 1: 'в основном ясно 🌤', 2: 'переменная облачность ⛅', 3: 'пасмурно ☁️', 45: 'туман 🌫', 48: 'изморозь 🌫', 51: 'морось 🌦', 53: 'морось 🌦', 55: 'сильная морось 🌧', 61: 'небольшой дождь 🌦', 63: 'дождь 🌧', 65: 'сильный дождь 🌧', 66: 'ледяной дождь 🌧', 67: 'ледяной дождь 🌧', 71: 'небольшой снег 🌨', 73: 'снег 🌨', 75: 'сильный снег ❄️', 77: 'снежная крупа 🌨', 80: 'ливень 🌦', 81: 'ливень 🌧', 82: 'сильный ливень ⛈', 85: 'снегопад 🌨', 86: 'сильный снегопад ❄️', 95: 'гроза ⛈', 96: 'гроза с градом ⛈', 99: 'гроза с градом ⛈' };
async function weather(city) {
  const base = city || 'москва'; const tries = [base];
  if (city) { const s = base.slice(0, -1); tries.push(s + 'а', s, s + 'ь', s + 'ы', s + 'и', base.slice(0, -2) + 'ый'); }
  let g = null;
  for (const q of tries) { const r = await getJSON('https://geocoding-api.open-meteo.com/v1/search?count=1&language=ru&name=' + encodeURIComponent(q)); if (r.results && r.results.length) { g = r.results[0]; break; } }
  if (!g) throw new Error('Не нашёл город «' + city + '»');
  const w = await getJSON(`https://api.open-meteo.com/v1/forecast?latitude=${g.latitude}&longitude=${g.longitude}&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=auto&forecast_days=2&wind_speed_unit=ms`);
  const c = w.current, d = w.daily, t = Math.round(c.temperature_2m), f = Math.round(c.apparent_temperature);
  const lines = [`Сейчас: ${t > 0 ? '+' : ''}${t}°, ощущается ${f > 0 ? '+' : ''}${f}°`, `${WMO[c.weather_code] || ''}`, `Ветер ${Math.round(c.wind_speed_10m)} м/с`,
    `Завтра: ${Math.round(d.temperature_2m_min[1])}…${Math.round(d.temperature_2m_max[1])}°, ${WMO[d.weather_code[1]] || ''}`];
  return { title: '🌤 Погода: ' + g.name, lines, say: `В городе ${g.name} сейчас ${t} градусов, ${(WMO[c.weather_code] || '').replace(/[^\p{L}\s]/gu, '')}` };
}
async function currency(t) {
  const r = await getJSON('https://www.cbr-xml-daily.ru/daily_json.js'); const V = r.Valute;
  let codes = []; if (/доллар/.test(t)) codes.push('USD'); if (/евро/.test(t)) codes.push('EUR'); if (/юан/.test(t)) codes.push('CNY'); if (/сомон|сомони/.test(t)) codes.push('TJS'); if (/тенге/.test(t)) codes.push('KZT'); if (/лир/.test(t)) codes.push('TRY');
  if (!codes.length) codes = ['USD', 'EUR', 'CNY'];
  const lines = codes.filter((c) => V[c]).map((c) => { const v = V[c], one = v.Value / v.Nominal, ch = v.Value - v.Previous; return `${v.Nominal > 1 ? v.Nominal + ' ' : ''}${c}: ${v.Value.toFixed(2)} ₽  ${ch >= 0 ? '▲' : '▼'} ${Math.abs(ch).toFixed(2)}`; });
  const u = V[codes[0]];
  return { title: '💱 Курс ЦБ РФ', lines: lines.concat(['на ' + new Date(r.Date).toLocaleDateString('ru-RU')]), say: `${u.Name}: ${Math.floor(u.Value / u.Nominal)} рублей ${Math.round(((u.Value / u.Nominal) % 1) * 100)} копеек` };
}
async function wiki(q) {
  const s = await getJSON('https://ru.wikipedia.org/w/api.php?action=opensearch&limit=1&namespace=0&format=json&origin=*&search=' + encodeURIComponent(q));
  const title = s[1] && s[1][0]; if (!title) throw new Error('В Википедии не нашлось «' + q + '»');
  const r = await getJSON('https://ru.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(title));
  let ex = (r.extract || '').replace(/\s*\([^)]{0,120}\)/, ''); if (ex.length > 420) ex = ex.slice(0, 420).replace(/\s\S*$/, '') + '…';
  return { title: '📖 ' + title, lines: [ex, 'Источник: Википедия'], say: ex.split(/(?<=\.)\s/).slice(0, 2).join(' ') };
}
async function translate(q) {
  const lat = /[a-z]/i.test(q), pair = lat ? 'en|ru' : 'ru|en';
  const r = await getJSON('https://api.mymemory.translated.net/get?langpair=' + pair + '&q=' + encodeURIComponent(q));
  const tr = r.responseData && r.responseData.translatedText; if (!tr) throw new Error('Перевод не получился');
  return { title: '🔤 Перевод', lines: [q + '  →  ' + tr], say: lat ? tr : q + ' по-английски будет ' + tr, speakEn: !lat ? tr : null };
}

// --- errand: dog runs to the doghouse, comes back with a sign ---
function* errand(d, job) {
  const o = other(d), f = houseFrame();
  d.say('Сейчас! 🐾', 1.4); d.wag = 0.8;
  let res = null, err = null, done = false;
  Promise.resolve().then(job).then((r) => { res = r; }).catch((e) => { err = e; }).finally(() => { done = true; });
  d.go(f.c.x + f.n.x * 0.55, f.c.z + f.n.z * 0.55, 1.7); o.faceTo(f.c.x, f.c.z);
  yield* until(() => d.arrived(), 8); d.faceTo(f.c.x, f.c.z); d.setBase('dig');
  yield* wait(1.2); yield* until(() => done, 10);
  carrySign(d, !err); d.setBase('idle');
  const s = frontSpot(-0.25); d.go(s.x, s.z, 1.6); yield* until(() => d.arrived(), 8);
  d.faceViewer(); d.setBase('idle2'); carrySign(d, false);
  if (err || !res) { d.say('Не получилось 😔', 3); speak(err ? String(err.message || err).replace('TypeError: Failed to fetch', 'Нет интернета') : 'Не получилось'); d.setBase('sniff'); yield* wait(3); return; }
  d.bark(); showBoard(new Board(res.title, res.lines, res.buttons, { w: res.w }), true, res.ttl || 45);
  if (res.say) speak(res.say);
  yield* wait(6);
}
function* buryNote(d, text) {
  const s = freeSpot(); d.go(s.x, s.z, 1.2); d.say('Закопаю! 🦴', 1.5); yield* until(() => d.arrived(), 8);
  d.setBase('dig'); yield* wait(2.2); d.setBase('idle');
  const mound = new T.Mesh(new T.SphereGeometry(0.07, 12, 8, 0, PI * 2, 0, PI / 2), new T.MeshStandardMaterial({ color: 0x6b4a2b, roughness: 1 }));
  mound.scale.y = 0.5; mound.position.set(d.x + Math.cos(d.h) * 0.3, 0, d.z - Math.sin(d.h) * 0.3); mound.receiveShadow = true; scene.add(mound);
  setTimeout(() => scene.remove(mound), 120000);
  d.faceViewer(); d.bark('Запомнил!'); speak('Запомнил: ' + text); yield* wait(2);
}
function* alarm(label) {
  const d = dogs[0], o = dogs[1], s1 = frontSpot(-0.3), s2 = frontSpot(0.3);
  d.go(s1.x, s1.z, 1.8); o.go(s2.x, s2.z, 1.8); yield* both(d, o, 8); d.faceViewer(); o.faceViewer();
  showBoard(new Board('⏰ Время!', [label || 'Таймер сработал'], [{ l: 'Понял, спасибо', fn: () => closeBoard(), full: true }]), false, 60);
  speak(label ? 'Напоминаю: ' + label : 'Время вышло!');
  for (let k = 0; k < 3; k++) { d.bark(); yield* wait(0.5); o.bark(); yield* wait(0.7); }
  yield* wait(3);
}
function* breakTime() {
  const d = dogs[1]; const s = frontSpot(0); d.go(s.x, s.z, 1.2); yield* until(() => d.arrived(), 8); d.faceViewer(); d.bark();
  showBoard(new Board('👀 Перерыв для глаз', ['Ты в очках уже ' + Math.round((Date.now() - sessionStart) / 60000) + ' мин.', 'Посмотри 20 секунд вдаль, поморгай, разомни шею.', 'Сказать «не напоминай про перерыв» — выключу.'], [{ l: 'Хорошо 👍', fn: () => closeBoard(), full: true }]), false, 40);
  speak('Пора дать глазам отдохнуть. Посмотри вдаль двадцать секунд.'); yield* wait(4);
}

function basketBoard() {
  if (!basket.length) return { title: '🧺 Корзина пустая', lines: ['Скажи: «собери продукты на лагман на троих»', 'или «добавь в корзину молоко и хлеб»'], say: 'Корзина пока пустая' };
  const lines = basket.map((it) => ({ text: '• ' + it.name + (it.qty ? ' — ' + it.qty : ''), btn: 'ВкусВилл ↗', fn: () => openUrl(VV(it.name)) }));
  return { title: '🧺 Корзина (' + basket.length + ')', lines, w: 0.8, ttl: 0,
    buttons: [{ l: 'Открыть все во ВкусВилле', fn: openAllVV, col: '#2f7d4f' }, { l: '🗑 Очистить', fn: () => { basket = []; saveAll(); closeBoard(); }, col: 'rgba(255,80,80,.45)' }],
    say: 'В корзине ' + basket.length + ' ' + plural(basket.length, 'продукт', 'продукта', 'продуктов') };
}
function plural(n, a, b, c) { n = Math.abs(n) % 100; const n1 = n % 10; if (n > 10 && n < 20) return c; if (n1 > 1 && n1 < 5) return b; if (n1 === 1) return a; return c; }
function openAllVV() {
  // in VR the browser lets one tab open per click; so leave VR and show the list with links
  const s = R.xr.getSession(); if (s) s.end();
  renderSide(true); basket.forEach((it, k) => setTimeout(() => openUrl(VV(it.name)), k * 250));
}

/* ================= command parser ================= */
let lastTalk = 0, talkDog = 0;
const NAME_RE = [/боб(ик|ика|ику|иком|ке)?(?:(?<![а-яa-z0-9])(?=[а-яa-z0-9])|(?<=[а-яa-z0-9])(?![а-яa-z0-9]))|бобби|бобр?ик/, /шар(ик|ика|ику|иком)(?:(?<![а-яa-z0-9])(?=[а-яa-z0-9])|(?<=[а-яa-z0-9])(?![а-яa-z0-9]))|шарик/];
function normalize(t) { return (' ' + t.toLowerCase().replace(/ё/g, 'е').replace(/[«»"',.!?:;]/g, ' ') + ' ').replace(/\s+/g, ' '); }
function stripName(t) { return t.replace(/(?:(?<![а-яa-z0-9])(?=[а-яa-z0-9])|(?<=[а-яa-z0-9])(?![а-яa-z0-9]))(бобик\w*|шарик\w*|собака|собачка|собачки|песик|пес)(?:(?<![а-яa-z0-9])(?=[а-яa-z0-9])|(?<=[а-яa-z0-9])(?![а-яa-z0-9]))/g, ' ').replace(/\s+/g, ' ').trim(); }
function onHeard(raw, fromVoice) {
  const t = normalize(raw); if (!t.trim()) return;
  let di = -1; if (NAME_RE[0].test(t)) di = 0; else if (NAME_RE[1].test(t)) di = 1; else if (/собак|собач|песик|пес /.test(t)) di = talkDog;
  const active = performance.now() - lastTalk < 20000;
  if (di < 0) { if (!active && fromVoice) return; di = talkDog; }
  talkDog = di; lastTalk = performance.now();
  heardEl.textContent = '🎤 ' + raw; showHud('🎤 ' + raw);
  handle(dogs[di], stripName(t));
}
function handle(d, t) {
  audioInit();
  const o = other(d);
  if (!t) { interrupt((function* () { d.faceViewer(); d.setBase('idle2'); d.wag = 0.9; d.bark('Да? 🐶'); yield* wait(4); })()); return; }
  if (/^(закрой|закрыть|спасибо|хорошо|понял|убери)/.test(t)) { closeBoard(); d.bark('Гав!'); return; }
  if (/(не напоминай|выключи).*(перерыв|отдых)/.test(t)) { breakEvery = 0; store.set('breakEvery', 0); d.say('Не буду 👌', 2); speak('Хорошо, не буду напоминать про перерыв'); return; }
  if (/(напоминай).*(перерыв|отдых)/.test(t)) { breakEvery = 45; store.set('breakEvery', 45); speak('Буду напоминать каждые сорок пять минут'); return; }
  // timers
  if (/таймер|напомни|разбуди|засеки|будильник/.test(t) && !/что я/.test(t)) {
    const sec = parseDuration(t);
    if (!sec) { d.say('На сколько минут?', 3); speak('На сколько минут поставить?'); return; }
    let label = t.replace(/.*?(напомни|таймер|засеки)/, '').replace(/(поставь|на|через|минут\w*|секунд\w*|час\w*|полчаса|полтора|\d+|(?:(?<![а-яa-z0-9])(?=[а-яa-z0-9])|(?<=[а-яa-z0-9])(?![а-яa-z0-9]))(один|одну|два|две|три|четыре|пять|шесть|семь|восемь|девять|десять|\w*надцать|двадцать|тридцать|сорок|пятьдесят|шестьдесят|девяносто|сто)(?:(?<![а-яa-z0-9])(?=[а-яa-z0-9])|(?<=[а-яa-z0-9])(?![а-яa-z0-9])))/g, ' ').replace(/\s+/g, ' ').trim();
    if (/таймер/.test(t) && label.length < 3) label = '';
    addTimer(sec, label);
    interrupt((function* () { d.faceViewer(); d.wag = 0.8; d.bark('⏰ ' + fmtDur(sec)); speak('Поставил на ' + fmtDur(sec).replace('ч', 'часов').replace('мин', 'минут').replace('сек', 'секунд') + (label ? ': ' + label : '')); yield* wait(3); })());
    return;
  }
  if (/погод|температур|холодно|тепло на улице/.test(t)) {
    const m = t.match(/(?:(?<![а-яa-z0-9])(?=[а-яa-z0-9])|(?<=[а-яa-z0-9])(?![а-яa-z0-9]))(?:в|во)\s+([а-я-]+(?:\s+[а-я-]+)?)\s*$/) || t.match(/погод\w*\s+(?:в|во)?\s*([а-я-]+)/);
    let city = m ? m[1].replace(/^(городе|город)\s*/, '').trim() : ''; if (/^(сегодня|завтра|сейчас|на)$/.test(city)) city = '';
    interrupt(errand(d, () => weather(city))); return;
  }
  if (/курс|доллар|евро|юан|валют|сомони|тенге/.test(t)) { interrupt(errand(d, () => currency(t))); return; }
  if (/переведи|перевод|как будет|по английски/.test(t)) {
    const q = t.replace(/.*?(переведи|перевод|как будет)\s*/, '').replace(/(на английский|по английски|на русский|слово)/g, '').trim();
    if (!q) { speak('Что перевести?'); return; }
    interrupt(errand(d, () => translate(q))); return;
  }
  if (/(что такое|кто такой|кто такая|кто такие|что значит|расскажи (про|о)|что за)/.test(t)) {
    const q = t.replace(/.*?(что такое|кто такой|кто такая|кто такие|что значит|расскажи про|расскажи о|что за)\s*/, '').trim();
    if (q) { interrupt(errand(d, () => wiki(q))); return; }
  }
  // notes
  if (/(удали|очисти|сотри).*(заметк|запомн|памят)/.test(t)) { notes = []; saveAll(); d.say('Всё забыл 🙈', 2); speak('Удалил все заметки'); return; }
  if (/(что я (просил|говорил|сказал))|(вспомни)|(покажи|прочитай).*(заметк|записк)|^заметки|мои заметки/.test(t)) {
    interrupt(errand(d, async () => notes.length
      ? { title: '📝 Заметки (' + notes.length + ')', lines: notes.map((n) => '• ' + n.text + '  (' + new Date(n.at).toLocaleDateString('ru-RU') + ')'), say: notes.slice(-3).map((n) => n.text).join('. '), ttl: 0 }
      : { title: '📝 Заметок нет', lines: ['Скажи: «Бобик, запомни купить фрезу»'], say: 'Заметок пока нет' }));
    return;
  }
  if (/^(запомни|запиши|заметка|не забудь)/.test(t) || /(?:(?<![а-яa-z0-9])(?=[а-яa-z0-9])|(?<=[а-яa-z0-9])(?![а-яa-z0-9]))(запомни|запиши)(?:(?<![а-яa-z0-9])(?=[а-яa-z0-9])|(?<=[а-яa-z0-9])(?![а-яa-z0-9]))/.test(t)) {
    const text = t.replace(/.*?(?:(?<![а-яa-z0-9])(?=[а-яa-z0-9])|(?<=[а-яa-z0-9])(?![а-яa-z0-9]))(запомни|запиши|заметка|не забудь)(?:(?<![а-яa-z0-9])(?=[а-яa-z0-9])|(?<=[а-яa-z0-9])(?![а-яa-z0-9]))\s*(что)?\s*/, '').trim();
    if (!text) { speak('Что запомнить?'); return; }
    notes.push({ text, at: Date.now() }); saveAll(); interrupt(buryNote(d, text)); return;
  }
  // basket
  if (/(очисти|удали|освободи).*корзин/.test(t)) { basket = []; saveAll(); d.say('Корзина пустая 🧺', 2); speak('Очистил корзину'); return; }
  if (/(покажи|что в|открой|принеси).*корзин|^корзина/.test(t)) { interrupt(errand(d, async () => basketBoard())); return; }
  if (/(собери|сделай|составь|набери|купи|закажи).*(на|для)\s|продукты (на|для)/.test(t) || findDish(t)) {
    const dish = findDish(t);
    if (dish) {
      const n = peopleIn(t);
      interrupt(errand(d, async () => {
        DISHES[dish].forEach(([name, q, u]) => { const qty = fmtQty(q * n, u), ex = basket.find((b) => b.name === name); if (ex) ex.qty = qty + ' (+)'; else basket.push({ name, qty }); });
        saveAll(); const b = basketBoard(); b.title = '🧺 ' + dish[0].toUpperCase() + dish.slice(1) + ' на ' + n + ' ' + plural(n, 'человека', 'человек', 'человек');
        b.say = 'Собрал продукты на ' + dish + ', на ' + n + '. В корзине ' + basket.length + ' ' + plural(basket.length, 'продукт', 'продукта', 'продуктов'); return b;
      }));
      return;
    }
  }
  if (/(добавь|положи|купи|запиши в корзину)/.test(t)) {
    let rest = t.replace(/.*?(?:(?<![а-яa-z0-9])(?=[а-яa-z0-9])|(?<=[а-яa-z0-9])(?![а-яa-z0-9]))(добавь|положи|купи|запиши)(?:(?<![а-яa-z0-9])(?=[а-яa-z0-9])|(?<=[а-яa-z0-9])(?![а-яa-z0-9]))/, '').replace(/(?:(?<![а-яa-z0-9])(?=[а-яa-z0-9])|(?<=[а-яa-z0-9])(?![а-яa-z0-9]))(в корзину|в список|еще|пожалуйста)(?:(?<![а-яa-z0-9])(?=[а-яa-z0-9])|(?<=[а-яa-z0-9])(?![а-яa-z0-9]))/g, ' ').trim();
    let items = rest.split(/\s+и\s+|,/).map((s) => s.trim()).filter(Boolean);
    if (items.length === 1 && items[0].split(' ').length > 2) items = items[0].split(' ');
    if (!items.length) { speak('Что добавить?'); return; }
    items.forEach((name) => { name = name[0].toUpperCase() + name.slice(1); if (!basket.some((b) => b.name.toLowerCase() === name.toLowerCase())) basket.push({ name, qty: '' }); });
    saveAll();
    interrupt((function* () { d.faceViewer(); d.wag = 0.8; d.bark('🧺 +' + items.length); speak('Добавил: ' + items.join(', ')); yield* wait(3); })());
    return;
  }
  // tricks
  if (/ко мне|сюда|иди ко|подойди|рядом/.test(t)) { interrupt((function* () { const s = frontSpot(d.i ? 0.25 : -0.25); d.go(s.x, s.z, 1.4); yield* until(() => d.arrived(), 8); d.faceViewer(); d.setBase('idle2'); d.wag = 0.9; d.bark(); yield* wait(5); })()); return; }
  if (/лежать|ляг|спать|отдыхай|умри/.test(t)) { interrupt((function* () { d.setBase('lie'); d.wag = 0; d.say('Лежу…', 2); yield* wait(8); d.setBase('idle'); yield* wait(1); })()); return; }
  if (/голос|гавкни|лай|скажи гав/.test(t)) { interrupt((function* () { d.faceViewer(); for (let k = 0; k < 3; k++) { d.bark(); yield* wait(0.75); } })()); return; }
  if (/прыг|подпрыгни|прыжок/.test(t)) { interrupt((function* () { d.faceViewer(); d.oneShot('jump', 0.9); yield* wait(1.4); })()); return; }
  if (/игра|поиграй|гуляй|побегай|бегом/.test(t)) { interrupt(pounce(d, o)); return; }
  if (/прячь|спрячься|прятки/.test(t)) { interrupt(hideHouse(d, o)); return; }
  if (/помощь|что ты умеешь|команды|помоги/.test(t)) {
    showBoard(new Board('🐶 Что мы умеем', ['«Бобик, погода в Москве» · «Шарик, курс доллара»', '«Бобик, поставь таймер на 10 минут»', '«Шарик, напомни через час позвонить маме»', '«Бобик, что такое …» · «Шарик, переведи …»', '«Бобик, запомни …» · «Шарик, что я просил запомнить»', '«Бобик, собери продукты на лагман на троих»', '«Шарик, добавь в корзину молоко и хлеб» · «покажи корзину»', '«ко мне», «лежать», «голос», «прыгай», «играйте», «прячься»']), false, 60);
    return;
  }
  d.say('Не понял 🤔', 2.5); speak('Не понял. Скажи «помощь», и я покажу, что умею.');
}

/* ================= HUD subtitle (follows the head) ================= */
let hud = null, hudT = 0;
function showHud(txt) {
  if (hud) { cam.remove(hud); hud.material.map.dispose(); }
  const tt = textTex(txt.length > 60 ? txt.slice(0, 60) + '…' : txt, 'rgba(20,24,30,.8)', '#9ff0b8', 44);
  hud = new T.Sprite(new T.SpriteMaterial({ map: tt.t, transparent: true, depthTest: false })); hud.renderOrder = 20;
  hud.scale.set((tt.w / tt.h) * 0.05, 0.05, 1); hud.position.set(0, -0.22, -0.8); cam.add(hud); hudT = 4;
}

/* ================= voice (Vosk, offline, free) ================= */
let voiceOn = false;
async function startVoice() {
  const b = $('bMic'); b.disabled = true; audioInit();
  try {
    msgEl.textContent = '🎤 Разреши доступ к микрофону…';
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 } });
    msgEl.textContent = '⏳ Загружаю распознавание речи (40 МБ, один раз)…';
    const urls = [new URL('models/vosk-model-small-ru-0.4.tar.gz', location.href).href, 'https://ccoreilly.github.io/vosk-browser/models/vosk-model-small-ru-0.4.tar.gz'];
    let model = null, lastErr = null;
    for (const u of urls) {
      try { model = await Promise.race([window.Vosk.createModel(u), new Promise((_, rj) => setTimeout(() => rj(new Error('timeout')), 120000))]); if (model) break; } catch (e) { lastErr = e; }
    }
    if (!model) throw lastErr || new Error('model');
    const ctx = listener.context; await ctx.resume();
    const rec = new model.KaldiRecognizer(ctx.sampleRate);
    rec.on('result', (m) => { const tx = m.result && m.result.text; if (tx && performance.now() > speakingUntil) onHeard(tx, true); });
    rec.on('partialresult', (m) => { const p = m.result && m.result.partial; if (p && performance.now() > speakingUntil) heardEl.textContent = '… ' + p; });
    const src = ctx.createMediaStreamSource(stream), proc = ctx.createScriptProcessor(4096, 1, 1);
    proc.onaudioprocess = (e) => { try { rec.acceptWaveform(e.inputBuffer); } catch (er) {} };
    const mute = ctx.createGain(); mute.gain.value = 0; src.connect(proc); proc.connect(mute); mute.connect(ctx.destination);
    voiceOn = true; b.textContent = '🎤 Голос включён'; msgEl.textContent = 'Голос включён. Скажи: «Бобик, помощь» или «Шарик, ко мне».';
  } catch (e) {
    b.disabled = false; b.textContent = '🎤 Включить голос'; msgEl.textContent = 'Голос не включился: ' + (e.message || e) + '. Можно нажать на собаку и набрать команду.';
  }
}
$('bMic').onclick = startVoice;

/* ================= tap menu + keyboard (fallback without voice) ================= */
function tapDog(i) {
  audioInit(); const d = dogs[i]; talkDog = i; lastTalk = performance.now();
  interrupt((function* () { d.path = []; d.faceViewer(); d.setBase('idle2'); d.wag = 0.9; d.wagS = 15; other(d).faceTo(d); const t0 = performance.now(); while (performance.now() - t0 < 25000) yield; })());
  d.say('Привет, чем тебе могу помочь?', 4); speak('Привет, чем тебе могу помочь?');
  const B = (l, cmd) => ({ l, fn: () => { closeBoard(); handle(d, cmd); } });
  showBoard(new Board('🐶 ' + d.name + (voiceOn ? ' — говори, я слушаю 👂' : ''), [], [
    B('🌤 Погода', 'погода'), B('💱 Курс', 'курс доллара'), B('🧺 Корзина', 'покажи корзину'), B('📝 Заметки', 'что я просил запомнить'),
    B('⏰ Таймер 10 мин', 'таймер на 10 минут'), B('🐾 Ко мне', 'ко мне'), B('🎾 Играйте', 'играйте'), B('🙈 Прятки', 'прячься'),
    { l: '⌨ Написать команду', fn: () => showKeyboard(d), full: true, col: '#555a6a' }]), false, 25);
}
const KB = ['йцукенгшщзхъ', 'фывапролджэ', 'ячсмитьбю', '1234567890'];
function showKeyboard(d) {
  let typed = '';
  const kb = new Board('⌨ ', [], [], { w: 0.95 }); kb.buttons = [];
  kb.draw = function () {
    const g = this.c.getContext('2d'), w = this.c.width; this.c.height = 520; g.clearRect(0, 0, w, 520);
    g.fillStyle = 'rgba(24,26,34,.95)'; rr(g, 4, 4, w - 8, 512, 36); g.fill();
    g.fillStyle = '#fff'; g.font = '600 38px system-ui'; g.textBaseline = 'middle'; g.textAlign = 'left'; g.fillText('Команда: ' + (typed || '…') + '▏', 32, 52);
    this.btnRects = []; const kw = (w - 40) / 12; const self = this;
    const btn = (l, x, y, ww, fn, col) => { const id = self.btnRects.length; g.fillStyle = self.hover === id ? '#ff8a2a' : col || 'rgba(255,255,255,.13)'; rr(g, x, y, ww, 56, 12); g.fill(); g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = '600 32px system-ui'; g.fillText(l, x + ww / 2, y + 30); self.btnRects.push({ x, y, w: ww, h: 56, fn, id }); };
    KB.forEach((row, r) => { const off = (w - row.length * kw) / 2; row.split('').forEach((ch, c) => btn(ch, off + c * kw + 3, 100 + r * 64, kw - 6, () => { typed += ch; self.draw(); })); });
    btn('пробел', 30, 100 + 4 * 64, w * 0.34, () => { typed += ' '; self.draw(); });
    btn('⌫', 40 + w * 0.34, 100 + 4 * 64, w * 0.13, () => { typed = typed.slice(0, -1); self.draw(); });
    btn('✕', 50 + w * 0.47, 100 + 4 * 64, w * 0.1, () => closeBoard());
    btn('Выполнить ✓', 60 + w * 0.57, 100 + 4 * 64, w * 0.43 - 90, () => { closeBoard(); if (typed.trim()) handle(d, normalize(typed).trim()); }, '#3a6df0');
    this.tex.needsUpdate = true;
  };
  kb.c.height = 520; kb.mesh.geometry.dispose(); kb.mesh.geometry = new T.PlaneGeometry(kb.wm, (kb.wm * 520) / kb.c.width); kb.draw();
  showBoard(kb, false, 0);
}

/* ================= pointing ================= */
const ray = new T.Raycaster(), ctrls = [];
function hitTest(origin, dir) {
  ray.set(origin, dir); ray.far = 8;
  const hs = ray.intersectObjects(uiMeshes, false);
  if (hs.length) { const u = hs[0].object.userData.ui; return { ui: u, uv: hs[0].uv, d: hs[0].distance }; }
  let best = null;
  dogs.forEach((dg) => { const c = new T.Vector3(dg.x, dg.elev + dg.len * 0.45, dg.z), dd = ray.ray.distanceToPoint(c); if (dd < dg.len * 0.45 && (!best || dd < best.dd)) best = { dog: dg.i, dd, d: c.distanceTo(origin) }; });
  return best;
}
function activate(h) { if (!h) return; audioInit(); if (h.ui) { const b = h.ui.hit(h.uv); if (b) b.fn(); } else if (h.dog !== undefined) tapDog(h.dog); }
for (let ci = 0; ci < 2; ci++) {
  const c = R.xr.getController(ci); scene.add(c);
  const line = new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(0, 0, 0), new T.Vector3(0, 0, -1)]), new T.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 }));
  line.scale.z = 3; c.add(line);
  const dot = new T.Mesh(new T.SphereGeometry(0.008, 10, 8), new T.MeshBasicMaterial({ color: 0xff8a2a })); dot.visible = false; scene.add(dot);
  c.addEventListener('select', () => { const o = new T.Vector3(), q = new T.Quaternion(); c.getWorldPosition(o); c.getWorldQuaternion(q); activate(hitTest(o, new T.Vector3(0, 0, -1).applyQuaternion(q))); });
  ctrls.push({ c, line, dot });
}
function updatePointers() {
  if (!R.xr.isPresenting) return; let hov = null;
  ctrls.forEach((x) => {
    const o = new T.Vector3(), q = new T.Quaternion(); x.c.getWorldPosition(o); x.c.getWorldQuaternion(q);
    const dir = new T.Vector3(0, 0, -1).applyQuaternion(q), h = hitTest(o, dir);
    x.line.scale.z = h ? h.d : 3; x.dot.visible = !!h; if (h) x.dot.position.copy(o).addScaledVector(dir, h.d);
    if (h && h.ui) { const b = h.ui.hit(h.uv); hov = { ui: h.ui, id: b ? b.id : -1 }; }
  });
  if (board) { const id = hov && hov.ui === board ? hov.id : -1; if (board.hover !== id) { board.hover = id; board.draw(); } }
}
cv.addEventListener('pointerdown', (e) => {
  const m = new T.Vector2((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(m, cam);
  activate(hitTest(ray.ray.origin.clone(), ray.ray.direction.clone()));
});

/* ================= 2D side panel (basket, notes, timers) ================= */
function renderSide(force) {
  const parts = [];
  if (basket.length) parts.push('<h3>🧺 Корзина</h3><ul>' + basket.map((b) => `<li>${b.name}${b.qty ? ' — ' + b.qty : ''} · <a href="${VV(b.name)}" target="_blank">ВкусВилл ↗</a></li>`).join('') + '</ul><button id="vvAll">🛒 Открыть все во ВкусВилле</button> <button id="bClr">🗑</button>');
  if (notes.length) parts.push('<h3>📝 Заметки</h3><ul>' + notes.map((n) => `<li>${n.text}</li>`).join('') + '</ul>');
  const tl = timers.filter((x) => x.at > Date.now());
  if (tl.length) parts.push('<h3>⏰ Таймеры</h3><ul>' + tl.map((x) => `<li>${new Date(x.at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })} ${x.label || ''}</li>`).join('') + '</ul>');
  sideEl.innerHTML = parts.join(''); sideEl.style.display = parts.length ? 'block' : 'none';
  const va = $('vvAll'); if (va) va.onclick = () => basket.forEach((it, k) => setTimeout(() => openUrl(VV(it.name)), k * 250));
  const bc = $('bClr'); if (bc) bc.onclick = () => { basket = []; saveAll(); };
}

/* ================= XR session ================= */
async function enter(mode) {
  audioInit();
  try {
    const s = await navigator.xr.requestSession(mode, { requiredFeatures: ['local-floor'], optionalFeatures: ['hand-tracking'] });
    setMode(mode === 'immersive-ar'); await R.xr.setSession(s);
    s.addEventListener('end', () => { setMode(false); renderSide(); });
  } catch (e) { msgEl.textContent = 'Не удалось запустить ' + mode + ': ' + e.message; }
}
if (navigator.xr) {
  navigator.xr.isSessionSupported('immersive-ar').then((ok) => { const b = $('bAR'); b.hidden = !ok; b.onclick = () => enter('immersive-ar'); }).catch(() => {});
  navigator.xr.isSessionSupported('immersive-vr').then((ok) => { const b = $('bVR'); b.hidden = !ok; b.onclick = () => enter('immersive-vr'); }).catch(() => {});
}
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

/* ================= load & loop ================= */
async function init() {
  const [shiba, husky] = await Promise.all([loader.loadAsync('models/shiba-inu.glb'), loader.loadAsync('models/husky.glb')]);
  dogs = [
    new Dog(0, shiba, { name: 'Бобик', height: 0.5, walkRef: 0.55, runRef: 1.7, len: 0.62, from: husky.scene }, husky.animations),
    new Dog(1, husky, { name: 'Шарик', height: 0.66, walkRef: 0.7, runRef: 2.1, len: 0.82 }),
  ];
  msgEl.textContent = voiceOn ? msgEl.textContent : 'Бобик (шиба-ину) и Шарик (хаски). Включи голос и позови собаку по имени.';
  renderSide();
  const clock = new T.Clock(); let tick = 0;
  R.setAnimationLoop(() => {
    const dt = Math.min(0.05, clock.getDelta()); DT = dt;
    try { if (!cur) cur = pick(); const r = cur.next(); if (r.done) cur = null; } catch (e) { console.error(e); cur = null; }
    dogs.forEach((d) => { try { d.update(dt); } catch (e) { console.error(e); } });
    for (let k = fxs.length - 1; k >= 0; k--) { const f = fxs[k]; f.t += dt; f.s.position.y += dt * 0.12; f.s.material.opacity = 1 - f.t / f.life; if (f.t > f.life) { scene.remove(f.s); f.s.material.map.dispose(); fxs.splice(k, 1); } }
    if (board && boardT > 0) { boardT -= dt; if (boardT <= 0) closeBoard(); }
    if (hud) { hudT -= dt; if (hudT < 0) { cam.remove(hud); hud = null; } }
    tick += dt;
    if (tick > 1) {
      tick = 0; const now = Date.now();
      const due = timers.filter((x) => x.at <= now);
      if (due.length) { timers = timers.filter((x) => x.at > now); store.set('timers', timers); renderSide(); interrupt(alarm(due.map((x) => x.label).filter(Boolean).join(', '))); }
      else if (breakEvery && R.xr.isPresenting && now - lastBreak > breakEvery * 60000) { lastBreak = now; interrupt(breakTime()); }
      if (!R.xr.isPresenting) { lastBreak = now; sessionStart = now; }
    }
    updatePointers();
    R.render(scene, cam);
  });
}
init().catch((e) => { msgEl.textContent = 'Ошибка загрузки: ' + e.message; console.error(e); });

window.__t = { get dogs() { return dogs; }, handle: (i, t) => handle(dogs[i], normalize(t).trim()), onHeard, tapDog, cam, interrupt, lick: () => interrupt(lick(dogs[0], dogs[1])), pounce: () => interrupt(pounce(dogs[0], dogs[1])), hide: () => interrupt(hideHouse(dogs[0], dogs[1])), nap: () => interrupt(nap()), parseDuration, peopleIn, numbersIn, findDish };
