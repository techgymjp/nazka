import * as THREE from 'three';
import { GLYPHS, drawGlyph } from './glyphs.js';

// ============================================================
//  ナスカの地上絵をスティンガー砲で
// ============================================================
const V3 = THREE.Vector3;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = a => a[(Math.random() * a.length) | 0];
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const easeOut = t => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
const easeInOut = t => { t = clamp(t, 0, 1); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
const DEG = Math.PI / 180;

const IS_TOUCH = matchMedia('(pointer: coarse)').matches;
const PLAY_R = 560;           // 移動できる半径 (m)
const FLAT_R = 700;           // 平坦なパンパの半径
const RISE = 1.6, STAND = 9, FALL = 1.6, COOL = 3.5;

// ---------- ノイズ ----------
function hash(x, y) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  return lerp(lerp(hash(xi, yi), hash(xi + 1, yi), u), lerp(hash(xi, yi + 1), hash(xi + 1, yi + 1), u), v);
}
function fbm(x, y, o = 5) { let s = 0, a = .5, f = 1; for (let i = 0; i < o; i++) { s += a * vnoise(x * f, y * f); f *= 2.03; a *= .5; } return s; }
function terrainH(x, z) {
  const r = Math.hypot(x, z);
  if (r < FLAT_R) return 0;
  const k1 = smooth(FLAT_R, 1050, r), k2 = smooth(1050, 1800, r);
  return k1 * (fbm(x * .004 + 3, z * .004) * 80 - 10) + k2 * Math.pow(fbm(x * .0011 + 9, z * .0011 + 4, 6), 1.6) * 700;
}

// ============================================================
//  レンダラ / シーン
// ============================================================
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, IS_TOUCH ? 1.5 : 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const FOG = new THREE.Color(0xd9c6aa);
scene.fog = new THREE.Fog(FOG, 250, 2600);
const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 9000);
scene.add(camera);

const SUN_DIR = new V3(0.5, 0.6, 0.45).normalize();

// 空
{
  const g = new THREE.SphereGeometry(8000, 32, 16);
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { sun: { value: SUN_DIR } },
    vertexShader: `varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); gl_Position.z = gl_Position.w; }`,
    fragmentShader: `varying vec3 vD; uniform vec3 sun;
      void main(){
        float h = max(vD.y, 0.0);
        vec3 zen = vec3(0.24,0.47,0.80), hor = vec3(0.86,0.80,0.71), gnd = vec3(0.80,0.70,0.58);
        vec3 c = mix(hor, zen, pow(h, 0.45));
        if (vD.y < 0.0) c = mix(hor, gnd, min(1.0, -vD.y*6.0));
        float s = max(dot(vD, sun), 0.0);
        c += vec3(1.0,0.85,0.6) * (pow(s, 600.0) * 3.0 + pow(s, 12.0) * 0.25);
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const sky = new THREE.Mesh(g, m); sky.renderOrder = -10; sky.frustumCulled = false;
  scene.add(sky);
  camera.userData.sky = sky;
}

// ライト
const hemi = new THREE.HemisphereLight(0xcfe2ff, 0x9a6a46, 0.9);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1dc, 2.6);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -18, right: 18, top: 18, bottom: -18, near: 1, far: 200 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);

// ---------- テクスチャ生成 ----------
function canvasTex(w, h, fn, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  fn(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); }
  return t;
}
// 砂礫（酸化した赤褐色の小石＝デザートワニス）
const groundDetail = canvasTex(1024, 1024, (c, w, h) => {
  c.fillStyle = '#e9dccb'; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 26000; i++) {
    const x = Math.random() * w, y = Math.random() * h, r = Math.random() < .96 ? rand(.5, 1.8) : rand(2.2, 4);
    const d = rand(0, 1);
    c.fillStyle = d < .55 ? `rgba(${120 + d * 60 | 0},${72 + d * 30 | 0},${50 + d * 20 | 0},${rand(.25, .6)})`
      : d < .8 ? `rgba(80,52,38,${rand(.2, .5)})` : `rgba(255,245,230,${rand(.2, .45)})`;
    c.beginPath(); c.ellipse(x, y, r, r * rand(.6, 1), rand(0, 3), 0, Math.PI * 2); c.fill();
  }
}, 600);

// ============================================================
//  地形
// ============================================================
{
  const SIZE = 6000, SEG = 300;
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position, col = new Float32Array(pos.count * 3);
  const base = new THREE.Color(), tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), y = terrainH(x, z);
    pos.setY(i, y);
    const n = fbm(x * .006, z * .006), n2 = fbm(x * .03 + 7, z * .03);
    base.setRGB(.62 + n * .12, .41 + n * .08, .28 + n * .05);          // 赤褐色の礫砂漠
    tmp.setRGB(.78, .66, .52); base.lerp(tmp, smooth(.55, .8, n2) * .35);   // 明るい砂だまり
    const slope = Math.abs(terrainH(x + 6, z) - y) + Math.abs(terrainH(x, z + 6) - y);
    tmp.setRGB(.50, .33, .24); base.lerp(tmp, smooth(5, 120, y) * .75);      // 赤茶けた岩山
    tmp.setRGB(.33, .24, .20); base.lerp(tmp, smooth(1.5, 6, slope) * .55 * smooth(5, 60, y)); // 急斜面の暗い岩
    tmp.setRGB(.62, .52, .46); base.lerp(tmp, smooth(500, 800, y) * .45);
    col[i * 3] = base.r; col[i * 3 + 1] = base.g; col[i * 3 + 2] = base.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, map: groundDetail, roughness: .97, metalness: 0 });
  const ground = new THREE.Mesh(geo, mat);
  ground.receiveShadow = true;
  scene.add(ground);
}

// 直線と台形（ナスカのライン）
{
  const SZ = 1500;
  const t = canvasTex(2048, 2048, (c, w, h) => {
    c.lineCap = 'round';
    const sc = w / SZ;
    for (let i = 0; i < 26; i++) {
      const x = rand(0, w), y = rand(0, h), a = rand(0, Math.PI), L = rand(400, 2600) * sc;
      c.strokeStyle = `rgba(240,222,196,${rand(.35, .7)})`; c.lineWidth = rand(1.2, 3.2) * sc;
      c.beginPath(); c.moveTo(x - Math.cos(a) * L / 2, y - Math.sin(a) * L / 2); c.lineTo(x + Math.cos(a) * L / 2, y + Math.sin(a) * L / 2); c.stroke();
    }
    for (let i = 0; i < 6; i++) { // 台形
      c.save(); c.translate(rand(0, w), rand(0, h)); c.rotate(rand(0, Math.PI * 2));
      const L = rand(150, 600) * sc, w0 = rand(4, 12) * sc, w1 = rand(18, 50) * sc;
      c.fillStyle = `rgba(232,212,182,${rand(.3, .5)})`;
      c.beginPath(); c.moveTo(0, -w0); c.lineTo(L, -w1); c.lineTo(L, w1); c.lineTo(0, w0); c.closePath(); c.fill();
      c.restore();
    }
    for (let i = 0; i < 4; i++) { // ジグザグ線
      c.strokeStyle = 'rgba(238,220,190,.5)'; c.lineWidth = 1.6 * sc;
      let x = rand(0, w), y = rand(0, h); const a = rand(0, Math.PI * 2), d = rand(20, 40) * sc;
      c.beginPath(); c.moveTo(x, y);
      for (let k = 0; k < 14; k++) { x += Math.cos(a) * d * .5 + Math.cos(a + Math.PI / 2) * (k % 2 ? d : -d); y += Math.sin(a) * d * .5 + Math.sin(a + Math.PI / 2) * (k % 2 ? d : -d); c.lineTo(x, y); }
      c.stroke();
    }
  });
  const m = new THREE.MeshStandardMaterial({ map: t, transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2 });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(SZ, SZ), m);
  mesh.rotation.x = -Math.PI / 2; mesh.position.y = 0.02; mesh.receiveShadow = true;
  scene.add(mesh);
}

// パンアメリカン・ハイウェイ（トカゲの地上絵を横切る）
const HWY_A = new V3(-210, 0, 240), HWY_B = new V3(230, 0, -250);
const HWY_DIR = new V3().subVectors(HWY_B, HWY_A).normalize();
const HWY_N = new V3(-HWY_DIR.z, 0, HWY_DIR.x);
{
  const t = canvasTex(256, 1024, (c, w, h) => {
    c.fillStyle = '#3d3a38'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 9000; i++) { c.fillStyle = `rgba(${rand(40, 110) | 0},${rand(40, 100) | 0},${rand(40, 95) | 0},.5)`; c.fillRect(rand(0, w), rand(0, h), 1.5, 1.5); }
    c.fillStyle = '#e8e2d2'; c.fillRect(12, 0, 6, h); c.fillRect(w - 18, 0, 6, h);
    c.fillStyle = '#e6b53c'; for (let y = 0; y < h; y += 128) c.fillRect(w / 2 - 4, y, 8, 70);
    c.fillStyle = 'rgba(160,120,80,.6)'; c.fillRect(0, 0, 8, h); c.fillRect(w - 8, 0, 8, h);
  });
  t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 1400 / 30);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(8, 1400), new THREE.MeshStandardMaterial({ map: t, roughness: .9, polygonOffset: true, polygonOffsetFactor: -4 }));
  road.rotation.x = -Math.PI / 2;
  road.rotation.z = -Math.atan2(HWY_DIR.x, -HWY_DIR.z);
  road.position.copy(HWY_A).add(HWY_B).multiplyScalar(.5); road.position.y = 0.05;
  road.receiveShadow = true;
  scene.add(road);
}

// ミラドール（観測やぐら）
const MIRADOR = new V3().copy(HWY_A).lerp(HWY_B, .78).addScaledVector(HWY_N, 9);
{
  const steel = new THREE.MeshStandardMaterial({ color: 0x5b5f55, roughness: .6, metalness: .6 });
  const g = new THREE.Group();
  const bar = (x, y, z, sx, sy, sz) => { const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), steel); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; };
  const S = 2.2, Ht = 13;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) bar(sx * S, Ht / 2, sz * S, .18, Ht, .18);
  for (const y of [4.3, 8.6, Ht]) {
    bar(0, y, 0, S * 2 + .4, .12, S * 2 + .4).material = steel;
    for (const s of [-1, 1]) { bar(s * S, y + .55, 0, .06, .06, S * 2); bar(0, y + .55, s * S, S * 2, .06, .06); bar(s * S, y + 1.05, 0, .06, .06, S * 2); bar(0, y + 1.05, s * S, S * 2, .06, .06); }
  }
  for (let i = 0; i < 3; i++) { // 斜めの階段
    const st = bar(0, 2.15 + i * 4.3, 0, .9, .08, 5.6); st.rotation.x = (i % 2 ? 1 : -1) * 0.87;
  }
  for (let y = 1.2; y < Ht; y += 2.1) { const b = bar(0, y, S, S * 2 * 1.4, .07, .07); b.rotation.z = .7; }
  g.position.copy(MIRADOR); g.rotation.y = Math.atan2(HWY_DIR.x, HWY_DIR.z);
  scene.add(g);
}

// 岩・小石（インスタンス）
{
  const geo = new THREE.DodecahedronGeometry(1, 0);
  const mat = new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true });
  const N = 2600, inst = new THREE.InstancedMesh(geo, mat, N);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), c = new THREE.Color();
  for (let i = 0; i < N; i++) {
    const r = Math.sqrt(Math.random()) * 900, a = rand(0, Math.PI * 2), s = Math.pow(Math.random(), 3) * 1.1 + .12;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    q.setFromEuler(e.set(rand(0, 3), rand(0, 3), rand(0, 3)));
    m4.compose(new V3(x, terrainH(x, z) + s * .25, z), q, new V3(s, s * rand(.4, .8), s * rand(.7, 1.2)));
    inst.setMatrixAt(i, m4);
    inst.setColorAt(i, c.setRGB(rand(.28, .45), rand(.17, .26), rand(.12, .18)));
  }
  inst.receiveShadow = true;
  scene.add(inst);
}

// ============================================================
//  パーティクル
// ============================================================
class PSys {
  constructor(max, additive) {
    this.max = max; this.n = 0;
    this.pos = new Float32Array(max * 3); this.col = new Float32Array(max * 3);
    this.alpha = new Float32Array(max); this.size = new Float32Array(max);
    this.vel = new Float32Array(max * 3); this.life = new Float32Array(max); this.maxl = new Float32Array(max);
    this.grow = new Float32Array(max); this.grav = new Float32Array(max); this.a0 = new Float32Array(max); this.drag = new Float32Array(max);
    const g = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(this.pos, 3); this.aCol = new THREE.BufferAttribute(this.col, 3);
    this.aAlpha = new THREE.BufferAttribute(this.alpha, 1); this.aSize = new THREE.BufferAttribute(this.size, 1);
    for (const a of [this.aPos, this.aCol, this.aAlpha, this.aSize]) a.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.aPos); g.setAttribute('pcolor', this.aCol); g.setAttribute('alpha', this.aAlpha); g.setAttribute('size', this.aSize);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { scale: { value: 500 } }, transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      vertexShader: `attribute float size; attribute float alpha; attribute vec3 pcolor; varying float vA; varying vec3 vC; uniform float scale;
        void main(){ vA = alpha; vC = pcolor; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = min(size * scale / -mv.z, 512.0); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying float vA; varying vec3 vC;
        void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; gl_FragColor = vec4(vC, vA * smoothstep(0.5, 0.05, d)); }`,
    });
    this.points = new THREE.Points(g, this.mat); this.points.frustumCulled = false;
    this.points.renderOrder = additive ? 6 : 5;
    scene.add(this.points);
  }
  add(x, y, z, vx, vy, vz, life, size, grow, r, g, b, a, grav = 0, drag = 1) {
    if (this.n >= this.max) return;
    const i = this.n++;
    this.pos.set([x, y, z], i * 3); this.vel.set([vx, vy, vz], i * 3); this.col.set([r, g, b], i * 3);
    this.life[i] = this.maxl[i] = life; this.size[i] = size; this.grow[i] = grow; this.a0[i] = this.alpha[i] = a; this.grav[i] = grav; this.drag[i] = drag;
  }
  copy(d, s) {
    for (const arr of [this.pos, this.vel, this.col]) { arr[d * 3] = arr[s * 3]; arr[d * 3 + 1] = arr[s * 3 + 1]; arr[d * 3 + 2] = arr[s * 3 + 2]; }
    for (const arr of [this.alpha, this.size, this.life, this.maxl, this.grow, this.grav, this.a0, this.drag]) arr[d] = arr[s];
  }
  update(dt) {
    for (let i = 0; i < this.n; i++) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) { this.copy(i, --this.n); i--; continue; }
      const k = Math.max(0, 1 - this.drag[i] * dt);
      this.vel[i * 3] *= k; this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * k - this.grav[i] * dt; this.vel[i * 3 + 2] *= k;
      this.pos[i * 3] += this.vel[i * 3] * dt; this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt; this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.size[i] += this.grow[i] * dt;
      const t = this.life[i] / this.maxl[i];
      this.alpha[i] = this.a0[i] * Math.min(1, t * 1.6) * Math.min(1, (1 - t) * 12 + .1);
    }
    for (const a of [this.aPos, this.aCol, this.aAlpha, this.aSize]) a.needsUpdate = true;
    this.points.geometry.setDrawRange(0, this.n);
  }
}
const smoke = new PSys(6000, false);
const flames = new PSys(3000, true);

function dustBurst(p, n, spread, col = [.74, .6, .46]) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, Math.PI * 2), r = rand(0, spread);
    smoke.add(p.x + Math.cos(a) * r, p.y + rand(0, 1.5), p.z + Math.sin(a) * r, Math.cos(a) * rand(1, 6), rand(1, 5), Math.sin(a) * rand(1, 6),
      rand(2, 4), rand(3, 7), rand(1.5, 4), col[0] * rand(.9, 1.1), col[1] * rand(.9, 1.1), col[2] * rand(.9, 1.1), rand(.25, .5), -0.3, .8);
  }
}
const debrisGeo = new THREE.DodecahedronGeometry(1, 0);
const debrisMats = [0x6b4430, 0x9a6446, 0xb89870, 0x4a2e20].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 1, flatShading: true }));
let debris = [];
function addDebris(p, v, s) {
  const m = new THREE.Mesh(debrisGeo, pick(debrisMats));
  m.position.copy(p); m.scale.set(s, s * rand(.5, 1), s * rand(.6, 1.2)); m.castShadow = true;
  m.rotation.set(rand(0, 3), rand(0, 3), rand(0, 3));
  scene.add(m); debris.push({ m, v, av: new V3(rand(-6, 6), rand(-6, 6), rand(-6, 6)), life: rand(3, 5) });
}
function updateDebris(dt) {
  for (const d of debris) {
    d.life -= dt; d.v.y -= 9.8 * dt; d.m.position.addScaledVector(d.v, dt);
    d.m.rotation.x += d.av.x * dt; d.m.rotation.y += d.av.y * dt;
    const gy = terrainH(d.m.position.x, d.m.position.z) + d.m.scale.y * .5;
    if (d.m.position.y < gy) {
      d.m.position.y = gy;
      if (d.v.y < -4) dustBurst(d.m.position, 1, .5);
      d.v.y *= -.25; d.v.x *= .6; d.v.z *= .6; d.av.multiplyScalar(.5);
    }
    if (d.life < .5) d.m.scale.multiplyScalar(1 - dt * 4);
  }
  debris = debris.filter(d => { if (d.life <= 0) scene.remove(d.m); return d.life > 0; });
}
// 立っている板の縁から土がこぼれ落ちる
function soilFall(g) {
  const x = rand(-.5, .5) * g.size, side = Math.random() < .5;
  const p = g.mesh.localToWorld(side ? new V3((Math.random() < .5 ? -.5 : .5) * g.size * .95, rand(-.4, .5) * g.size, -SLAB_DEPTH / 2) : new V3(x, -g.size / 2 + rand(0, 3), -SLAB_DEPTH / 2));
  for (let i = 0; i < 4; i++) smoke.add(p.x, p.y, p.z, rand(-.5, .5), rand(-2, 0), rand(-.5, .5), rand(1.5, 2.5), rand(.6, 1.4), 1.2, .66, .5, .38, .45, 3, .8);
  if (Math.random() < .4) addDebris(p, new V3(rand(-1, 1), 0, rand(-1, 1)), rand(.15, .4));
}
function explosion(p, big) {
  const s = big ? 1.6 : 1;
  flames.add(p.x, p.y, p.z, 0, 0, 0, .25, 14 * s, 50 * s, 1, .9, .7, 1);
  for (let i = 0; i < 70 * s; i++) {
    const v = new V3().randomDirection().multiplyScalar(rand(8, 45) * s);
    flames.add(p.x, p.y, p.z, v.x, v.y, v.z, rand(.3, .9), rand(.4, 1.4), -.5, 1, rand(.5, .8), rand(.15, .3), 1, 9.8, 1.5);
  }
  for (let i = 0; i < 26 * s; i++) {
    const v = new V3().randomDirection().multiplyScalar(rand(2, 9) * s);
    flames.add(p.x + v.x * .3, p.y + v.y * .3, p.z + v.z * .3, v.x, v.y, v.z, rand(.3, .6), rand(3, 6) * s, 8, 1, rand(.45, .65), .15, .8, 0, 2);
    smoke.add(p.x, p.y, p.z, v.x, v.y + 1.5, v.z, rand(2.5, 5), rand(3, 6) * s, rand(2, 4), rand(.2, .32), rand(.18, .26), rand(.15, .2), .75, -.4, 1.2);
  }
}

// ============================================================
//  兵士（プレイヤー）
// ============================================================
function camoTex(colors, n, rep) {
  return canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = colors[0]; c.fillRect(0, 0, w, h);
    for (let i = 0; i < n; i++) {
      c.fillStyle = pick(colors.slice(1));
      c.beginPath();
      const x = rand(0, w), y = rand(0, h), r = rand(10, 34);
      for (let k = 0; k < 9; k++) { const a = k / 9 * Math.PI * 2, rr = r * rand(.5, 1.2); c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr * .7); }
      c.fill();
    }
    for (let i = 0; i < 4000; i++) { c.fillStyle = `rgba(0,0,0,${rand(0, .08)})`; c.fillRect(rand(0, w), rand(0, h), 1, 1); }
  }, rep);
}
function buildSoldier() {
  const camo = camoTex(['#b8a47e', '#8f7d58', '#6f6045', '#cbb894', '#a08a63'], 60, 2);
  const M = {
    uni: new THREE.MeshStandardMaterial({ map: camo, roughness: .95 }),
    vest: new THREE.MeshStandardMaterial({ color: 0x75603f, roughness: .9 }),
    pouch: new THREE.MeshStandardMaterial({ color: 0x6a5638, roughness: .9 }),
    strap: new THREE.MeshStandardMaterial({ color: 0x4a3d2b, roughness: .8 }),
    boot: new THREE.MeshStandardMaterial({ color: 0x8a6c48, roughness: .85 }),
    sole: new THREE.MeshStandardMaterial({ color: 0x2c2620, roughness: .9 }),
    glove: new THREE.MeshStandardMaterial({ color: 0x5c4a35, roughness: .85 }),
    skin: new THREE.MeshStandardMaterial({ color: 0xb98466, roughness: .7 }),
    helmet: new THREE.MeshStandardMaterial({ map: camoTex(['#a6936c', '#857452', '#6c5e44', '#bba980'], 40, 1), roughness: .85 }),
    lens: new THREE.MeshStandardMaterial({ color: 0x1c1a18, roughness: .15, metalness: .6 }),
    od: new THREE.MeshStandardMaterial({ color: 0x4b5134, roughness: .7, metalness: .15 }),
    odDark: new THREE.MeshStandardMaterial({ color: 0x343826, roughness: .75, metalness: .2 }),
    metal: new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: .45, metalness: .75 }),
    tan: new THREE.MeshStandardMaterial({ color: 0x9c8a62, roughness: .8 }),
  };
  const add = (parent, geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; };
  const box = (p, sx, sy, sz, mat, x, y, z) => add(p, new THREE.BoxGeometry(sx, sy, sz), mat, x, y, z);
  const limb = (p, a, b, r, mat) => {
    const d = new V3().subVectors(b, a), len = d.length();
    const m = add(p, new THREE.CapsuleGeometry(r, Math.max(.01, len), 4, 10), mat);
    m.position.copy(a).add(b).multiplyScalar(.5);
    m.quaternion.setFromUnitVectors(new V3(0, 1, 0), d.normalize());
    return m;
  };

  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);

  // 骨盤・ベルト
  box(body, .34, .2, .22, M.uni, 0, 1.0, 0);
  box(body, .36, .06, .24, M.strap, 0, 1.08, 0);
  box(body, .12, .1, .06, M.pouch, -.12, 1.02, -.13); box(body, .12, .1, .06, M.pouch, .12, 1.02, -.13);
  // 胴体
  const torso = add(body, new THREE.CapsuleGeometry(.17, .28, 4, 12), M.uni, 0, 1.33, 0); torso.scale.set(1, 1, .72);
  // プレートキャリア＋マガジンポーチ
  box(body, .38, .4, .27, M.vest, 0, 1.33, 0);
  for (let i = 0; i < 3; i++) box(body, .1, .13, .07, M.pouch, -.12 + i * .12, 1.24, .16);
  box(body, .3, .08, .05, M.pouch, 0, 1.42, .15);
  box(body, .06, .32, .02, M.strap, -.13, 1.45, .145); box(body, .06, .32, .02, M.strap, .13, 1.45, .145);
  box(body, .1, .12, .06, M.pouch, .2, 1.2, .05);
  // バックパック＋水筒
  box(body, .34, .44, .17, M.tan, 0, 1.32, -.22);
  box(body, .3, .05, .02, M.strap, 0, 1.4, -.31); box(body, .3, .05, .02, M.strap, 0, 1.22, -.31);
  box(body, .3, .12, .14, M.pouch, 0, 1.08, -.22);
  add(body, new THREE.CylinderGeometry(.045, .045, .2, 10), M.odDark, .2, 1.18, -.18);
  // 首
  add(body, new THREE.CylinderGeometry(.055, .06, .1, 10), M.skin, 0, 1.56, .01);
  // 頭
  const head = new THREE.Group(); head.position.set(0, 1.66, .01); body.add(head);
  const face = add(head, new THREE.SphereGeometry(.1, 20, 16), M.skin, 0, 0, 0); face.scale.set(.9, 1.08, 1);
  add(head, new THREE.SphereGeometry(.03, 8, 6), M.skin, 0, -.01, .1);             // 鼻
  const helm = add(head, new THREE.SphereGeometry(.135, 24, 12, 0, Math.PI * 2, 0, Math.PI * .52), M.helmet, 0, .02, -.005);
  helm.scale.set(1, .95, 1.08);
  const rim = add(head, new THREE.TorusGeometry(.13, .012, 6, 28), M.helmet, 0, .0, 0); rim.rotation.x = Math.PI / 2; rim.scale.set(1, 1.1, 1);
  box(head, .05, .05, .03, M.metal, 0, .1, .13);                                    // NVGマウント
  box(head, .2, .05, .05, M.lens, 0, .025, .09);                                    // ゴーグル
  box(head, .24, .02, .02, M.strap, 0, .025, .06);
  for (const s of [-1, 1]) { const ear = add(head, new THREE.CylinderGeometry(.045, .045, .04, 14), M.odDark, s * .12, -.01, 0); ear.rotation.z = Math.PI / 2; }
  box(head, .08, .03, .04, M.tan, 0, .13, -.12);                                    // 後部ストロボ

  // 脚
  const legs = [];
  for (const s of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(s * .1, .98, 0); body.add(hip);
    limb(hip, new V3(0, 0, 0), new V3(0, -.44, .01), .085, M.uni);
    box(hip, .05, .1, .1, M.pouch, s * .1, -.15, 0);                                 // レッグポーチ
    const knee = new THREE.Group(); knee.position.set(0, -.44, .01); hip.add(knee);
    limb(knee, new V3(0, 0, 0), new V3(0, -.4, -.01), .07, M.uni);
    box(knee, .1, .11, .05, M.strap, 0, -.02, .065);                                  // ニーパッド
    const boot = new THREE.Group(); boot.position.set(0, -.44, 0); knee.add(boot);
    box(boot, .11, .14, .26, M.boot, 0, .02, .04);
    box(boot, .12, .035, .28, M.sole, 0, -.065, .04);
    legs.push({ hip, knee, side: s });
  }

  // 照準グループ（右肩でピッチ回転）：スティンガー＋腕
  const aim = new THREE.Group(); aim.position.set(-.17, 1.5, .02); body.add(aim);
  const L = new THREE.Group(); L.position.set(0, .08, 0); aim.add(L);
  const tube = add(L, new THREE.CylinderGeometry(.07, .07, 1.52, 20), M.od, 0, 0, .1); tube.rotation.x = Math.PI / 2;
  const front = add(L, new THREE.CylinderGeometry(.08, .075, .1, 20), M.odDark, 0, 0, .87); front.rotation.x = Math.PI / 2;
  const rear = add(L, new THREE.CylinderGeometry(.09, .085, .14, 20), M.odDark, 0, 0, -.68); rear.rotation.x = Math.PI / 2;
  for (const z of [-.3, .35]) { const band = add(L, new THREE.CylinderGeometry(.074, .074, .03, 20), M.odDark, 0, 0, z); band.rotation.x = Math.PI / 2; }
  // グリップストック
  box(L, .07, .12, .34, M.odDark, -.02, -.12, .05);
  const grip = box(L, .045, .13, .06, M.metal, -.02, -.22, .02); grip.rotation.x = -.35;
  const bcu = add(L, new THREE.CylinderGeometry(.035, .035, .16, 12), M.metal, -.02, -.19, .2); bcu.rotation.x = Math.PI / 2;
  // 照準器（左側）
  box(L, .04, .16, .04, M.metal, .11, .02, .2);
  box(L, .1, .03, .03, M.metal, .07, .1, .2);
  box(L, .03, .05, .05, M.lens, .14, .08, .2);
  // IFFアンテナ（格子）
  const iff = new THREE.Group(); iff.position.set(.12, .0, .55); iff.rotation.y = .25; L.add(iff);
  for (let i = 0; i < 5; i++) { box(iff, .006, .2, .006, M.metal, 0, 0, -.08 + i * .04); box(iff, .006, .006, .17, M.metal, 0, -.1 + i * .05, 0); }
  box(L, .04, .02, .1, M.metal, .08, 0, .55);
  // 肩当て
  box(L, .08, .04, .16, M.strap, 0, -.085, -.05);

  // 腕（照準グループの座標）
  const sR = new V3(0, -.06, 0), eR = new V3(-.1, -.3, .1), hR = new V3(-.03, -.25, .1);
  limb(aim, sR, eR, .062, M.uni); limb(aim, eR, hR, .052, M.uni);
  box(aim, .07, .09, .09, M.glove, hR.x, hR.y + .02, hR.z + .02);
  const sL = new V3(.34, -.06, 0), eL = new V3(.32, -.3, .25), hL = new V3(.07, -.05, .5);
  limb(aim, sL, eL, .062, M.uni); limb(aim, eL, hL, .052, M.uni);
  box(aim, .08, .07, .1, M.glove, hL.x, hL.y, hL.z);
  for (const p of [sR, sL]) add(aim, new THREE.SphereGeometry(.085, 12, 10), M.uni, p.x, p.y + .02, p.z);

  const muzzle = new V3(0, .08, .95), breech = new V3(0, .08, -.78);
  root.traverse(o => { if (o.isMesh) o.receiveShadow = true; });
  return { root, body, head, aim, legs, muzzle, breech };
}
const soldier = buildSoldier();
scene.add(soldier.root);

// ============================================================
//  地上絵ターゲット
// ============================================================
const MASK_N = 64;
const glyphObjs = [];
function placeGlyphs() {
  const placed = [];
  const ok = (p, sz) => {
    if (p.length() < 70 || p.length() > 530) return false;
    if (MIRADOR.distanceTo(p) < 25 + sz / 2) return false;
    const rel = new V3().subVectors(p, HWY_A), along = rel.dot(HWY_DIR), off = Math.abs(rel.dot(HWY_N));
    if (along > -50 && along < 750 && off < sz / 2 + 10) return false;
    return placed.every(q => q.p.distanceTo(p) > (q.sz + sz) / 2 + 22);
  };
  for (const def of GLYPHS) {
    let p;
    if (def.id === 'lizard') p = new V3().copy(HWY_A).addScaledVector(HWY_DIR, 18);
    else if (def.id === 'tree') p = new V3().copy(MIRADOR).addScaledVector(HWY_N, 35).addScaledVector(HWY_DIR, -10);
    else if (def.id === 'hands') p = new V3().copy(MIRADOR).addScaledVector(HWY_N, -40).addScaledVector(HWY_DIR, 12);
    else {
      for (let k = 0; k < 400; k++) {
        const a = rand(0, Math.PI * 2), r = rand(90, 520);
        p = new V3(Math.cos(a) * r, 0, Math.sin(a) * r);
        if (ok(p, def.size)) break;
      }
    }
    placed.push({ p, sz: def.size });
    glyphObjs.push(makeGlyph(def, p));
  }
}
// 地上絵ごと地面がめくれ上がる「土の板」をつくる
const SLAB_DEPTH = 1.4;
const TEX_N = IS_TOUCH ? 512 : 1024;
const slabSideMat = new THREE.MeshStandardMaterial({ map: canvasTex(256, 256, (c, w, h) => {
  // 断面：上は赤黒い礫層、下は黄土色の地層
  const g = c.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#5a3626'); g.addColorStop(.12, '#7b5038'); g.addColorStop(.35, '#a3825c'); g.addColorStop(1, '#8a6a4a');
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 2500; i++) { c.fillStyle = `rgba(${rand(40, 90) | 0},${rand(25, 60) | 0},${rand(15, 40) | 0},${rand(.2, .6)})`; c.fillRect(rand(0, w), rand(0, h), rand(1, 4), rand(1, 3)); }
  for (let i = 0; i < 6; i++) { c.fillStyle = `rgba(60,40,25,${rand(.1, .25)})`; c.fillRect(0, rand(40, h), w, rand(1, 4)); }
}, 1), roughness: 1 });
slabSideMat.map.wrapS = slabSideMat.map.wrapT = THREE.RepeatWrapping;
const slabBackMat = new THREE.MeshStandardMaterial({ color: 0x8a6a4c, roughness: 1, map: slabSideMat.map });
const pitMat = new THREE.MeshBasicMaterial({ color: 0x2e1c12, transparent: true, opacity: .85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -6 });
function earthPattern(c, light) {
  const t = document.createElement('canvas'); t.width = t.height = 128;
  const x = t.getContext('2d');
  if (light) {
    x.fillStyle = '#cdb38e'; x.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 700; i++) { x.fillStyle = Math.random() < .7 ? `rgba(235,220,195,${rand(.3, .8)})` : `rgba(150,110,80,${rand(.3, .6)})`; const r = rand(.4, 1.6); x.fillRect(rand(0, 128), rand(0, 128), r, r); }
  } else {
    x.fillStyle = 'rgba(70,40,28,.75)'; x.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 260; i++) { x.fillStyle = `rgba(${rand(30, 70) | 0},${rand(18, 40) | 0},${rand(12, 28) | 0},.9)`; x.beginPath(); x.ellipse(rand(0, 128), rand(0, 128), rand(1, 3.5), rand(.8, 2.5), rand(0, 3), 0, 7); x.fill(); }
  }
  return c.createPattern(t, 'repeat');
}
function makeGlyph(def, center) {
  const size = def.size, half = size / 2;
  // ぎざぎざの輪郭
  const outline = [], per = 16, ph = rand(0, 100);
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  for (let s = 0; s < 4; s++) {
    const [ax, ay] = corners[s], [bx, by] = corners[(s + 1) % 4];
    for (let i = 0; i < per; i++) {
      const t = i / per, x = lerp(ax, bx, t), y = lerp(ay, by, t);
      const inset = (fbm(ph + s * 7 + t * 3, ph) * .07 + rand(0, .02)) * (i === 0 ? .4 : 1);
      outline.push([x * half * (1 - inset), y * half * (1 - inset)]);
    }
  }
  const shape = new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2(x, y)));
  const geo = new THREE.ExtrudeGeometry(shape, { depth: SLAB_DEPTH, bevelEnabled: false, steps: 1 });
  geo.translate(0, 0, -SLAB_DEPTH);
  // 表面のUVを正規化し、裏面と表面のマテリアルを分ける
  const pos = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    if (Math.abs(pos.getZ(i)) < 1e-4 || Math.abs(pos.getZ(i) + SLAB_DEPTH) < 1e-4) uv.setXY(i, pos.getX(i) / size + .5, pos.getY(i) / size + .5);
    else uv.setXY(i, uv.getX(i) / 8, (pos.getZ(i) + SLAB_DEPTH) / SLAB_DEPTH);
  }
  const caps = geo.groups[0], half2 = caps.count / 2;
  geo.clearGroups();
  geo.addGroup(caps.start, half2, 2);                 // 裏面（z = -depth）
  geo.addGroup(caps.start + half2, half2, 0);         // 表面（z = 0）
  geo.addGroup(caps.start + caps.count, Infinity, 1); // 側面
  geo.computeVertexNormals();

  const N = TEX_N, toPx = (x, y) => [(x / size + .5) * N, (.5 - y / size) * N];
  const tex = canvasTex(N, N, (c) => {
    c.beginPath(); outline.forEach(([x, y], i) => c[i ? 'lineTo' : 'moveTo'](...toPx(x, y))); c.closePath();
    c.save(); c.clip();
    // 赤褐色の礫砂漠（酸化して黒ずんだ小石＝デザートワニス）
    c.fillStyle = '#b07a55'; c.fillRect(0, 0, N, N);
    for (let i = 0; i < 40; i++) {
      const rg = c.createRadialGradient(0, 0, 0, 0, 0, 1);
      rg.addColorStop(0, Math.random() < .5 ? 'rgba(80,45,30,.25)' : 'rgba(190,140,100,.22)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
      c.save(); c.translate(rand(0, N), rand(0, N)); c.scale(rand(.05, .2) * N, rand(.05, .2) * N); c.fillStyle = rg; c.beginPath(); c.arc(0, 0, 1, 0, 7); c.fill(); c.restore();
    }
    const k = N / 1024;
    for (let i = 0; i < 24000 * k * k; i++) {
      const d = Math.random(), r = (Math.random() < .9 ? rand(.6, 2.4) : rand(2.5, 5.5)) * k;
      c.fillStyle = d < .45 ? `rgba(${rand(60, 105) | 0},${rand(32, 58) | 0},${rand(22, 40) | 0},${rand(.45, .85)})`
        : d < .85 ? `rgba(${rand(150, 190) | 0},${rand(95, 125) | 0},${rand(70, 90) | 0},.7)` : `rgba(230,210,180,${rand(.3, .6)})`;
      c.beginPath(); c.ellipse(rand(0, N), rand(0, N), r, r * rand(.6, 1), rand(0, 3), 0, 7); c.fill();
    }
    // 取り除かれた石が積まれた縁 → 明るい溝（地上絵の線）
    drawGlyph(c, def, N, { width: 26 * k, color: earthPattern(c, false), margin: .12 });
    drawGlyph(c, def, N, { width: 15 * k, color: earthPattern(c, true), margin: .12 });
    c.globalAlpha = .35; drawGlyph(c, def, N, { width: 6 * k, color: '#efe2c8', margin: .12 }); c.globalAlpha = 1;
    c.restore();
    // 輪郭付近は割れて影になる
    c.strokeStyle = 'rgba(45,25,15,.55)'; c.lineWidth = 10 * k;
    c.beginPath(); outline.forEach(([x, y], i) => c[i ? 'lineTo' : 'moveTo'](...toPx(x, y))); c.closePath(); c.stroke();
  });
  // 線だけ光らせるためのマスク
  const glowTex = canvasTex(256, 256, (c) => { c.fillStyle = '#000'; c.fillRect(0, 0, 256, 256); drawGlyph(c, def, 256, { width: 4.5, color: '#fff', margin: .12 }); });
  // 当たり判定マスク（板の形）
  const mc = document.createElement('canvas'); mc.width = mc.height = MASK_N;
  const mctx = mc.getContext('2d'); mctx.fillStyle = '#fff';
  mctx.beginPath(); outline.forEach(([x, y], i) => mctx[i ? 'lineTo' : 'moveTo']((x / size + .5) * MASK_N, (.5 - y / size) * MASK_N)); mctx.closePath(); mctx.fill();
  const mask = mctx.getImageData(0, 0, MASK_N, MASK_N).data;

  const mat = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: glowTex, emissive: 0x000000, roughness: .97, polygonOffset: true, polygonOffsetFactor: -2 });
  const pivot = new THREE.Group(); pivot.rotation.order = 'YXZ';
  const mesh = new THREE.Mesh(geo, [mat, slabSideMat, slabBackMat]);
  mesh.position.y = half; mesh.castShadow = true; mesh.receiveShadow = true;
  pivot.add(mesh); scene.add(pivot);
  // めくれ上がった跡の穴
  const pitPivot = new THREE.Group(); pitPivot.rotation.order = 'YXZ'; pitPivot.rotation.x = -Math.PI / 2;
  const pit = new THREE.Mesh(new THREE.ShapeGeometry(shape), pitMat); pit.position.y = half;
  pitPivot.add(pit); pitPivot.visible = false; scene.add(pitPivot);
  const g = { def, center, size, pivot, mesh, mat, pitPivot, outline, mask, state: 'ground', t: 0, k: 0, cool: 0, yaw: rand(0, Math.PI * 2) };
  setYaw(g, g.yaw); setK(g, 0); setLook(g, 'ground');
  return g;
}
// 見た目のモード：ground（地上絵）/ stand（立ち上がり：線がほのかに光る）/ clear（撃破済み：金色）
function setLook(g, mode, f = 1) {
  g.look = mode;
  g.mat.color.setScalar(mode === 'stand' ? 1.5 : .95);
  if (mode === 'stand') { g.mat.emissive.setHex(0xffb060); g.mat.emissiveIntensity = .55 * f; }
  else if (mode === 'clear') { g.mat.emissive.setHex(0xffc040); g.mat.emissiveIntensity = .9; }
  else { g.mat.emissive.setHex(0x000000); g.mat.emissiveIntensity = 0; }
}
function setYaw(g, yaw) {
  g.yaw = yaw; g.pivot.rotation.y = yaw;
  g.pivot.position.set(g.center.x + Math.sin(yaw) * g.size / 2, 0.07, g.center.z + Math.cos(yaw) * g.size / 2);
  g.pitPivot.rotation.y = yaw; g.pitPivot.position.copy(g.pivot.position).setY(0.04);
}
function setK(g, k) { g.k = k; g.pivot.rotation.x = -Math.PI / 2 * (1 - k); g.pitPivot.visible = k > .02; }
const isActive = g => (g.state === 'rising' || g.state === 'standing' || g.state === 'falling') && g.k > .3;
function maskAt(g, x, y) {
  const u = x / g.size + .5, v = y / g.size + .5;
  if (u < 0 || u >= 1 || v < 0 || v >= 1) return false;
  const px = (u * MASK_N) | 0, py = ((1 - v) * MASK_N) | 0;
  return g.mask[(py * MASK_N + px) * 4 + 3] > 40;
}
const _inv = new THREE.Matrix4(), _o = new V3(), _d = new V3();
function rayGlyph(g, origin, dir, maxT = Infinity) {
  _inv.copy(g.mesh.matrixWorld).invert();
  _o.copy(origin).applyMatrix4(_inv); _d.copy(dir).transformDirection(_inv);
  if (Math.abs(_d.z) < 1e-6) return null;
  const t = -_o.z / _d.z;
  if (t < 0 || t > maxT) return null;
  const x = _o.x + _d.x * t, y = _o.y + _d.y * t, h = g.size / 2;
  if (Math.abs(x) > h || Math.abs(y) > h) return null;
  return { t, x, y, line: maskAt(g, x, y) };
}
function glyphTop(g) { return g.mesh.localToWorld(new V3(0, g.size / 2 + 2, 0)); }
function glyphMid(g) { return g.mesh.localToWorld(new V3(0, 0, 0)); }

// ============================================================
//  ゲーム状態
// ============================================================
const player = { pos: new V3(0, 0, 0), yaw: 0, pitch: 8 * DEG, speed: 0, phase: 0, vel: new V3() };
let state = 'title', paused = false;
let elapsed = 0, shots = 0, hits = 0, returns = 0, cleared = 0, lockedShots = 0;
let reload = 0, riseTimer = 2, lockCand = null, lockT = 0, locked = null, lockHit = null;
let missiles = [], enemies = [], enemyTimer = 8, intercepts = 0, deadT = 0;
const RELOAD_T = 1.4;
const order = [];  // 撃破順
const keys = {};
let best = { score: 0, time: 0 };
try { best = JSON.parse(localStorage.getItem('nazka_best') || '{"score":0,"time":0}'); } catch (e) {}

placeGlyphs();

function resetGame() {
  for (const g of glyphObjs) { g.state = 'ground'; g.t = 0; g.cool = rand(0, 2); setLook(g, 'ground'); setK(g, 0); }
  for (const m of missiles) scene.remove(m.obj);
  missiles = []; order.length = 0;
  player.pos.set(0, 0, 0); player.yaw = 0; player.pitch = 8 * DEG; player.speed = 0;
  elapsed = 0; shots = 0; hits = 0; returns = 0; cleared = 0; lockedShots = 0;
  reload = 0; riseTimer = 1.5; lockCand = null; lockT = 0; locked = null;
  for (const e of enemies) scene.remove(e.obj);
  enemies = []; enemyTimer = rand(9, 13); intercepts = 0; deadT = 0;
  soldier.root.rotation.set(0, 0, 0); soldier.root.visible = true;
  document.body.classList.remove('danger');
}

// ============================================================
//  ミサイル
// ============================================================
const missileGeo = (() => {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(.035, .035, 1.4, 10), new THREE.MeshStandardMaterial({ color: 0xd8d4c8, roughness: .5 }));
  body.rotation.x = Math.PI / 2; g.add(body);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(.035, .18, 10), new THREE.MeshStandardMaterial({ color: 0x8a2a1e, roughness: .4 }));
  nose.rotation.x = Math.PI / 2; nose.position.z = .79; g.add(nose);
  for (let i = 0; i < 4; i++) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(.005, .14, .12), new THREE.MeshStandardMaterial({ color: 0x555 }));
    fin.position.z = -.6; fin.rotation.z = i * Math.PI / 2; fin.position.x = Math.sin(i * Math.PI / 2) * .06; fin.position.y = Math.cos(i * Math.PI / 2) * .06;
    g.add(fin);
  }
  const flame = new THREE.Mesh(new THREE.ConeGeometry(.05, .5, 8), new THREE.MeshBasicMaterial({ color: 0xffc070, transparent: true, opacity: .9, blending: THREE.AdditiveBlending, depthWrite: false }));
  flame.rotation.x = -Math.PI / 2; flame.position.z = -.95; flame.visible = false; flame.name = 'flame';
  g.add(flame);
  return g;
})();

function aimRay() {
  const dir = new V3(); camera.getWorldDirection(dir);
  return { origin: camera.position.clone(), dir };
}
function fire() {
  if (state !== 'play' || paused) return;
  if (reload > 0) { sfx.empty(); flashMsg('装填中…'); return; }
  reload = RELOAD_T; shots++;
  soldier.root.updateMatrixWorld(true);
  const mz = soldier.aim.localToWorld(soldier.muzzle.clone());
  const br = soldier.aim.localToWorld(soldier.breech.clone());
  // 照準点
  const { origin, dir } = aimRay();
  let aimPt = origin.clone().addScaledVector(dir, 900);
  let best = Infinity;
  for (const g of glyphObjs) {
    if (!isActive(g)) continue;
    const h = rayGlyph(g, origin, dir);
    if (h && h.t < best) { best = h.t; aimPt = origin.clone().addScaledVector(dir, h.t); }
  }
  const mdir = (best < Infinity ? aimPt : origin.clone().addScaledVector(dir, 40)).sub(mz).normalize();
  const obj = missileGeo.clone(true);
  obj.position.copy(mz); obj.lookAt(mz.clone().add(mdir));
  scene.add(obj);
  const target = locked && isActive(locked) ? { g: locked, local: lockHit.clone() } : null;
  if (target) lockedShots++;
  missiles.push({ obj, pos: mz.clone(), dir: mdir, speed: 30, life: 0, target, smokeAcc: 0, rayO: origin.clone(), rayD: dir.clone() });
  // 発射煙（前後）とバックブラスト
  const back = br.clone().sub(mz).normalize();
  for (let i = 0; i < 40; i++) {
    const v = back.clone().multiplyScalar(rand(6, 22)).add(new V3().randomDirection().multiplyScalar(3));
    smoke.add(br.x, br.y, br.z, v.x, v.y, v.z, rand(1.5, 3.5), rand(.5, 1.2), rand(1.5, 3), .85, .82, .78, .6, -.2, 1.5);
  }
  for (let i = 0; i < 10; i++) {
    const v = mdir.clone().multiplyScalar(rand(2, 8)).add(new V3().randomDirection());
    smoke.add(mz.x, mz.y, mz.z, v.x, v.y, v.z, rand(1, 2), rand(.3, .6), 1.2, .9, .88, .84, .5, -.2, 1.5);
  }
  flames.add(br.x, br.y, br.z, back.x * 4, back.y * 4, back.z * 4, .15, 1.5, 6, 1, .8, .5, .9);
  kick = 1;
  sfx.launch();
}
let kick = 0;

function hitGlyph(g, worldPt) {
  g.state = 'clearing'; g.t = 0; hits++; cleared++;
  order.push(g.def);
  explosion(worldPt, true);
  // 線をなぞるように火花と土煙
  // 板が砕けて土の塊が飛び散る
  const nrm = new V3(0, 0, 1).transformDirection(g.mesh.matrixWorld);
  for (let i = 0; i < 46; i++) {
    const lp = new V3(rand(-.45, .45) * g.size, rand(-.45, .45) * g.size, -rand(0, SLAB_DEPTH));
    const wp = g.mesh.localToWorld(lp);
    const away = wp.clone().sub(worldPt).normalize().multiplyScalar(rand(4, 16)).addScaledVector(nrm, rand(-8, 4));
    away.y += rand(2, 8);
    addDebris(wp, away, rand(.25, g.size / 40));
  }
  for (let i = 0; i < 260; i++) {
    const x = rand(-.5, .5) * g.size, y = rand(-.5, .5) * g.size;
    if (!maskAt(g, x, y)) continue;
    const p = g.mesh.localToWorld(new V3(x, y, 0));
    const v = new V3().randomDirection().multiplyScalar(rand(3, 14));
    flames.add(p.x, p.y, p.z, v.x, v.y, v.z, rand(.6, 1.4), rand(.6, 1.6), -.3, 1, rand(.75, .9), rand(.45, .6), .9, 6, 1);
    smoke.add(p.x, p.y, p.z, v.x * .3, v.y * .3, v.z * .3, rand(2, 4), rand(2, 4), 2, .78, .64, .5, .35, -.3, 1);
  }
  if (locked === g) locked = null;
  if (lockCand === g) { lockCand = null; lockT = 0; }
  showCard(g.def);
  sfx.boom(true); sfx.chime();
  shake = Math.max(shake, .6);
  if (cleared >= glyphObjs.length) setTimeout(finish, 2200);
}

// ============================================================
//  更新
// ============================================================
let shake = 0, time = 0;
const _v = new V3(), _w = new V3();

function update(dt) {
  time += dt;
  smoke.update(dt); flames.update(dt); updateDebris(dt);
  if (state === 'dead') { updateDeath(dt); setSeeker(0); return; }
  if (state !== 'play' || paused) { setSeeker(0); return; }
  elapsed += dt;
  reload = Math.max(0, reload - dt);
  kick = Math.max(0, kick - dt * 4);

  // --- 操作 ---
  const kTurn = (keys.ArrowLeft ? 1 : 0) - (keys.ArrowRight ? 1 : 0);
  const kPitch = (keys.ArrowUp ? 1 : 0) - (keys.ArrowDown ? 1 : 0);
  player.yaw += kTurn * 1.6 * dt;
  player.pitch = clamp(player.pitch + kPitch * .7 * dt, -15 * DEG, 70 * DEG);
  let mx = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0) + joy.x;
  let mz = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0) - joy.y;
  const ml = Math.hypot(mx, mz); if (ml > 1) { mx /= ml; mz /= ml; }
  const sprint = keys.ShiftLeft || keys.ShiftRight || joy.mag > .92;
  const vmax = sprint ? 15 : 8.5;
  const fwd = _v.set(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
  const right = _w.set(Math.cos(player.yaw), 0, -Math.sin(player.yaw));
  const target = new V3().addScaledVector(fwd, mz * vmax).addScaledVector(right, mx * vmax);
  player.vel.lerp(target, Math.min(1, dt * 8));
  player.pos.addScaledVector(player.vel, dt);
  const pr = Math.hypot(player.pos.x, player.pos.z);
  if (pr > PLAY_R) { player.pos.x *= PLAY_R / pr; player.pos.z *= PLAY_R / pr; }
  player.speed = player.vel.length();

  // --- 兵士アニメ ---
  const run = clamp(player.speed / 10, 0, 1);
  player.phase += dt * (player.speed > .3 ? 5 + player.speed * .45 : 0);
  if (player.speed > .3) {
    const step = Math.floor(player.phase / Math.PI);
    if (step !== player.lastStep) { player.lastStep = step; sfx.step(run); if (Math.random() < .6) dustBurst(player.pos, 2, .3, [.7, .56, .42]); }
  }
  const S = soldier;
  S.root.position.copy(player.pos);
  S.root.rotation.y = player.yaw + Math.PI;
  // 移動方向へ脚をひねる
  let legYaw = 0;
  if (player.speed > .5) {
    const lv = new V3().copy(player.vel).applyAxisAngle(new V3(0, 1, 0), -(player.yaw + Math.PI));
    legYaw = Math.atan2(lv.x, lv.z); if (Math.abs(legYaw) > Math.PI / 2) legYaw = legYaw - Math.sign(legYaw) * Math.PI;
    legYaw = clamp(legYaw, -.8, .8);
  }
  for (const L of S.legs) {
    const ph = player.phase + (L.side > 0 ? 0 : Math.PI);
    L.hip.rotation.set(-Math.sin(ph) * .75 * run - .05 * run, legYaw * .6, 0, 'YXZ');
    L.knee.rotation.x = (Math.max(0, Math.sin(ph + 1.6)) * 1.3 + .1) * run;
  }
  S.body.position.y = -Math.abs(Math.sin(player.phase)) * .06 * run - run * .04;
  S.body.rotation.x = run * .12;
  S.aim.rotation.x = -player.pitch - S.body.rotation.x + Math.sin(player.phase * 2) * .02 * run - kick * .15;
  S.head.rotation.x = -player.pitch * .55;
  S.head.rotation.y = 0;

  // --- 地上絵の出現 ---
  riseTimer -= dt;
  const remaining = glyphObjs.filter(g => g.state !== 'cleared' && g.state !== 'clearing').length;
  const activeN = glyphObjs.filter(g => g.state === 'rising' || g.state === 'standing' || g.state === 'falling').length;
  const maxA = Math.min(2 + Math.floor(cleared / 5), 4, remaining);
  if (riseTimer <= 0 || activeN === 0) {
    riseTimer = rand(1.5, 3.2);
    if (activeN < maxA) {
      const cands = glyphObjs.filter(g => g.state === 'ground' && g.cool <= 0 && g.center.distanceTo(player.pos) > g.size * .6 + 8);
      if (cands.length) riseGlyph(pick(cands));
    }
  }
  for (const g of glyphObjs) {
    g.cool -= dt;
    if (g.state === 'rising') {
      g.t += dt; setK(g, easeOut(g.t / RISE));
      if (Math.random() < .6) dustBurst(g.pivot.position, 2, g.size * .4);
      if (g.t >= RISE) { g.state = 'standing'; g.t = 0; }
    } else if (g.state === 'standing') {
      g.t += dt;
      const left = STAND - g.t;
      setK(g, 1 - (left < 2 ? Math.abs(Math.sin(g.t * 9)) * .03 * (2 - left) : 0));
      setLook(g, 'stand', left < 2 ? .2 + .8 * Math.abs(Math.sin(g.t * 6)) : 1);
      if (Math.random() < dt * 6) soilFall(g);
      if (g.t >= STAND) { g.state = 'falling'; g.t = 0; }
    } else if (g.state === 'falling') {
      g.t += dt; setK(g, 1 - easeInOut(g.t / FALL));
      if (g.t >= FALL) {
        g.state = 'ground'; setLook(g, 'ground'); g.cool = COOL; returns++;
        dustBurst(g.center, 30, g.size * .5);
        flashMsg(`取り逃がし：地上絵が地面に戻った（${returns}）`, true);
        sfx.thud();
      }
    } else if (g.state === 'clearing') {
      g.t += dt; setK(g, Math.max(0, g.k - dt * 1.6));
      if (g.k <= 0) { g.state = 'cleared'; setLook(g, 'clear'); dustBurst(g.center, 40, g.size * .5); sfx.thud(); }
    }
  }

  // --- ロックオン ---
  soldier.root.updateMatrixWorld(true);
  for (const g of glyphObjs) g.pivot.updateMatrixWorld(true);
  const ray = aimRay();
  let cand = null, cbest = Infinity, chit = null;
  for (const g of glyphObjs) {
    if (!isActive(g)) continue;
    const h = rayGlyph(g, ray.origin, ray.dir);
    if (h && h.line && h.t < cbest && h.t < 900) { cbest = h.t; cand = g; chit = h; }
  }
  if (cand && cand === lockCand) lockT += dt; else { lockCand = cand; lockT = 0; }
  if (cand && lockT >= .35) { if (locked !== cand) sfx.lock(); locked = cand; lockHit = new V3(chit.x, chit.y, 0); }
  else if (cand && cand === locked) lockHit = new V3(chit.x, chit.y, 0);
  else if (locked && (!isActive(locked) || !rayGlyph(locked, ray.origin, ray.dir))) locked = null;
  setSeeker(locked ? 2 : cand ? 1 : 0);

  // --- ミサイル ---
  for (const m of missiles) {
    m.life += dt;
    const ignited = m.life > .22;
    if (ignited) m.speed = Math.min(300, m.speed + 520 * dt);
    if (!m.target && m.rayD) {
      // ロックなし：照準線（カメラ中央のレイ）に乗り、照準の真上をまっすぐ飛ぶ
      const along = _w.copy(m.pos).sub(m.rayO).dot(m.rayD);
      const want = _w.copy(m.rayO).addScaledVector(m.rayD, along + Math.max(12, m.speed * .25)).sub(m.pos).normalize();
      const ang = m.dir.angleTo(want), maxA = 5 * dt;
      m.dir.lerp(want, ang > 1e-4 ? Math.min(1, maxA / ang) : 1).normalize();
    }
    if (m.target && ignited) {
      if (!isActive(m.target.g)) m.target = null;
      else {
        const tp = m.target.g.mesh.localToWorld(m.target.local.clone());
        const want = tp.sub(m.pos).normalize();
        const ang = m.dir.angleTo(want), maxA = 2.6 * dt;
        m.dir.lerp(want, ang > 1e-4 ? Math.min(1, maxA / ang) : 1).normalize();
      }
    }
    m.dir.normalize();
    const step = m.speed * dt;
    // 当たり判定
    let hitG = null, hitT = Infinity;
    for (const g of glyphObjs) {
      if (!isActive(g)) continue;
      const h = rayGlyph(g, m.pos, m.dir, step);
      if (h && h.t < hitT && (h.line || (m.target && m.target.g === g))) { hitT = h.t; hitG = g; }
    }
    if (hitG) {
      const p = m.pos.clone().addScaledVector(m.dir, hitT);
      m.done = true; hitGlyph(hitG, p);
      continue;
    }
    // 敵ミサイルの迎撃（近接信管）
    const ie = enemies.find(e => !e.done && segDist(m.pos, m.dir, step, e.pos) < 5);
    if (ie) {
      m.done = true; ie.done = true; intercepts++;
      explosion(ie.pos, true); sfx.boom(true); sfx.chime();
      flashMsg('迎撃成功！ ＋800');
      continue;
    }
    m.pos.addScaledVector(m.dir, step);
    m.obj.position.copy(m.pos); m.obj.lookAt(_v.copy(m.pos).add(m.dir));
    const fl = m.obj.getObjectByName('flame'); fl.visible = ignited; fl.scale.setScalar(.8 + Math.random() * .6);
    if (ignited) {
      m.smokeAcc += step;
      while (m.smokeAcc > .6) {
        m.smokeAcc -= .6;
        const back = m.pos.clone().addScaledVector(m.dir, -m.smokeAcc - .8);
        smoke.add(back.x, back.y, back.z, rand(-.3, .3), rand(-.1, .4), rand(-.3, .3), rand(2.5, 4.5), .5, 1.6, .93, .91, .88, .55, -.08, .3);
      }
      flames.add(m.pos.x - m.dir.x, m.pos.y - m.dir.y, m.pos.z - m.dir.z, 0, 0, 0, .06, .7, 0, 1, .7, .35, 1);
    }
    if (m.pos.y < terrainH(m.pos.x, m.pos.z)) {
      m.done = true; explosion(m.pos, false); dustBurst(m.pos, 25, 3); sfx.boom(false);
    } else if (m.life > 6) { m.done = true; explosion(m.pos, false); sfx.boom(false); }
  }
  missiles = missiles.filter(m => { if (m.done) scene.remove(m.obj); return !m.done; });
  updateEnemies(dt);
}

// ============================================================
//  敵ミサイル（立ち上がった地上絵から発射される）
// ============================================================
const enemyGeo = (() => {
  const g = missileGeo.clone(true);
  g.traverse(o => { if (o.isMesh) o.material = o.material.clone(); });
  g.children[0].material.color.setHex(0x3a3a34);
  g.children[1].material.color.setHex(0xd02a1a); g.children[1].material.emissive = new THREE.Color(0x801000);
  const fl = g.getObjectByName('flame'); fl.material.color.setHex(0xff5030); fl.scale.set(1.6, 1.6, 1.6);
  g.scale.setScalar(1.6);
  return g;
})();
function segDist(p, d, len, q) {
  const t = clamp(_v.copy(q).sub(p).dot(d), 0, len);
  return _w.copy(p).addScaledVector(d, t).distanceTo(q);
}
function chestPos() { return new V3(player.pos.x, player.pos.y + 1.3, player.pos.z); }
function launchEnemy(g) {
  const from = g.mesh.localToWorld(new V3(rand(-.2, .2) * g.size, rand(0, .3) * g.size, 1));
  const to = chestPos();
  const dir = to.clone().sub(from).normalize(); dir.y += .35; dir.normalize();
  const obj = enemyGeo.clone(true); obj.position.copy(from); scene.add(obj);
  enemies.push({ obj, pos: from, dir, speed: 38, life: 0, src: g, blind: false, smokeAcc: 0, beep: 0 });
  explosion(from, false);
  for (let i = 0; i < 20; i++) smoke.add(from.x, from.y, from.z, rand(-3, 3), rand(0, 4), rand(-3, 3), rand(1.5, 3), rand(1, 2), 2, .3, .27, .24, .6, -.2, 1);
  sfx.enemyLaunch(from.distanceTo(player.pos));
  flashMsg(`⚠ ${g.def.name}がミサイルを発射！`, true);
}
function updateEnemies(dt) {
  // 発射のタイミング
  enemyTimer -= dt;
  if (enemyTimer <= 0) {
    const shooters = glyphObjs.filter(g => g.state === 'standing' && g.t > 1.5 && g.t < STAND - 1.5 && g.center.distanceTo(player.pos) < 460 && g.center.distanceTo(player.pos) > 45);
    if (shooters.length && enemies.length < 2) {
      launchEnemy(pick(shooters));
      const k = cleared / glyphObjs.length;
      enemyTimer = rand(9, 15) * (1 - k * .45);
    } else enemyTimer = 1;
  }
  let nearest = Infinity, nearestE = null;
  const chest = chestPos();
  for (const e of enemies) {
    e.life += dt;
    e.speed = Math.min(75, e.speed + 30 * dt);
    const toP = chest.clone().sub(e.pos), d = toP.length();
    if (d < 26) e.blind = true;               // 至近距離でシーカーが外れる → 横に走ればかわせる
    if (!e.blind && e.life > .5) {
      const want = toP.normalize(), ang = e.dir.angleTo(want), maxA = 1.1 * dt;
      e.dir.lerp(want, ang > 1e-4 ? Math.min(1, maxA / ang) : 1).normalize();
    }
    const step = e.speed * dt;
    if (segDist(e.pos, e.dir, step, chest) < 1.6) { e.done = true; playerHit(e.pos.clone().addScaledVector(e.dir, _v.copy(chest).sub(e.pos).dot(e.dir))); return; }
    e.pos.addScaledVector(e.dir, step);
    e.obj.position.copy(e.pos); e.obj.lookAt(_v.copy(e.pos).add(e.dir));
    e.obj.getObjectByName('flame').scale.setScalar(1.4 + Math.random() * .8);
    e.smokeAcc += step;
    while (e.smokeAcc > .7) { e.smokeAcc -= .7; const b = e.pos.clone().addScaledVector(e.dir, -1.6 - e.smokeAcc);
      smoke.add(b.x, b.y, b.z, rand(-.3, .3), rand(0, .4), rand(-.3, .3), rand(2.5, 4), .8, 1.8, .42, .38, .34, .6, -.05, .3); }
    flames.add(e.pos.x - e.dir.x * 1.8, e.pos.y - e.dir.y * 1.8, e.pos.z - e.dir.z * 1.8, 0, 0, 0, .08, 1.3, 0, 1, .35, .15, 1);
    if (e.pos.y < terrainH(e.pos.x, e.pos.z)) {
      e.done = true; explosion(e.pos, false); dustBurst(e.pos, 25, 3); sfx.boom(false);
      if (e.pos.distanceTo(player.pos) < 3.5) { playerHit(e.pos.clone()); return; }
    } else if (e.life > 14) { e.done = true; explosion(e.pos, false); sfx.boom(false); }
    if (!e.done && d < nearest) { nearest = d; nearestE = e; }
  }
  enemies = enemies.filter(e => { if (e.done) scene.remove(e.obj); return !e.done; });
  // 警報
  document.body.classList.toggle('danger', !!nearestE);
  el.warn.textContent = nearestE ? `⚠ ミサイル接近 ${nearest.toFixed(0)}m${nearest < 90 ? '　横に走ってかわせ！' : ''}` : '';
  if (nearestE) {
    nearestE.beep -= dt;
    if (nearestE.beep <= 0) { nearestE.beep = clamp(nearest / 260, .07, .6); sfx.alarm(nearest); }
  }
}
function playerHit(p) {
  state = 'dead'; deadT = 0; paused = false;
  explosion(p, true); explosion(player.pos.clone().setY(1), true); dustBurst(player.pos, 40, 4);
  sfx.boom(true); shake = 1.6;
  for (const e of enemies) scene.remove(e.obj);
  enemies = [];
  document.body.classList.remove('danger');
  hudVisible(false);
  if (document.pointerLockElement) document.exitPointerLock();
}
function updateDeath(dt) {
  deadT += dt;
  const k = easeOut(deadT / .7);
  soldier.root.rotation.set(-Math.PI / 2 * k, player.yaw + Math.PI, 0, 'YXZ');
  if (deadT > 2 && deadT - dt <= 2) showGameOver();
}
function showGameOver() {
  cardQ.length = 0; $('card').classList.remove('show');
  const acc = shots ? Math.round(hits / shots * 100) : 0;
  $('goStats').innerHTML = `生存時間 <b>${fmtTime(elapsed)}</b><br>撃ち抜いた地上絵 <b>${cleared} / ${glyphObjs.length}</b>　命中率 <b>${acc}%</b>　迎撃 <b>${intercepts}</b>`;
  fillGallery($('goGallery'), order);
  show('gameover');
}

function riseGlyph(g) {
  const yaw = Math.atan2(player.pos.x - g.center.x, player.pos.z - g.center.z);
  setYaw(g, yaw); setK(g, 0);
  g.state = 'rising'; g.t = 0; setLook(g, 'stand');
  dustBurst(g.center, 40, g.size * .5);
  sfx.rumble(g.center.distanceTo(player.pos));
}

// ============================================================
//  カメラ
// ============================================================
function updateCamera(dt) {
  const f = new V3(-Math.sin(player.yaw) * Math.cos(player.pitch), Math.sin(player.pitch), -Math.cos(player.yaw) * Math.cos(player.pitch));
  const right = new V3(Math.cos(player.yaw), 0, -Math.sin(player.yaw));
  const sh = new V3(player.pos.x, player.pos.y + 1.6, player.pos.z);
  const narrow = camera.aspect < 1;  // 縦画面は兵士が見切れないよう寄せる
  const cp = sh.clone().addScaledVector(f, narrow ? -3.8 : -2.9).addScaledVector(right, narrow ? .5 : 1.05).add(new V3(0, narrow ? .45 : .32, 0));
  const gh = terrainH(cp.x, cp.z) + .35; if (cp.y < gh) cp.y = gh;
  if (state === 'title' || state === 'result') {
    const a = time * .08;
    cp.set(player.pos.x + Math.sin(a) * 7, 2.6, player.pos.z + Math.cos(a) * 7);
    camera.position.copy(cp); camera.lookAt(player.pos.x, 1.3, player.pos.z);
  } else {
    camera.position.copy(cp);
    camera.lookAt(cp.clone().add(f));
  }
  if (shake > 0) { camera.position.add(new V3().randomDirection().multiplyScalar(shake * .15)); shake = Math.max(0, shake - dt * 2); }
  sun.position.copy(player.pos).addScaledVector(SUN_DIR, 80);
  sun.target.position.copy(player.pos);
  camera.userData.sky.position.copy(camera.position);
}

// ============================================================
//  HUD
// ============================================================
const hud = document.getElementById('hud');
const hctx = hud.getContext('2d');
const $ = id => document.getElementById(id);
const el = { time: $('hTime'), count: $('hCount'), acc: $('hAcc'), miss: $('hMiss'), elev: $('hElev'), az: $('hAz'), lock: $('lockTag'), rel: $('reloadBar'), msg: $('msg'), cross: $('cross'), warn: $('warn') };
function fmtTime(t) { const m = Math.floor(t / 60), s = t - m * 60; return `${m}:${s.toFixed(1).padStart(4, '0')}`; }
const DIRS = ['北', '北東', '東', '南東', '南', '南西', '西', '北西'];
function azimuth() { let a = (-player.yaw / DEG) % 360; if (a < 0) a += 360; return a; }

function drawHUD() {
  const W = hud.clientWidth, H = hud.clientHeight;
  hctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  hctx.clearRect(0, 0, W, H);
  if (state !== 'play') return;
  el.time.textContent = fmtTime(elapsed);
  el.count.textContent = `${cleared} / ${glyphObjs.length}`;
  el.acc.textContent = shots ? `${Math.round(hits / shots * 100)}%` : '—';
  el.miss.textContent = returns;
  el.elev.textContent = `${player.pitch >= 0 ? '+' : ''}${(player.pitch / DEG).toFixed(1)}°`;
  const az = azimuth();
  el.az.textContent = `${az.toFixed(0).padStart(3, '0')}° ${DIRS[Math.round(az / 45) % 8]}`;
  el.lock.classList.toggle('on', !!locked); el.lock.classList.toggle('seek', !locked && !!lockCand);
  el.lock.textContent = locked ? `LOCK ON ── ${locked.def.name}` : lockCand ? 'シーカー捕捉中…' : '';
  el.cross.classList.toggle('locked', !!locked); el.cross.classList.toggle('seek', !locked && !!lockCand);
  el.rel.style.width = `${(1 - reload / RELOAD_T) * 100}%`;
  el.rel.parentElement.classList.toggle('ready', reload <= 0);

  // ロック枠
  if (locked) {
    const p = locked.mesh.localToWorld(lockHit.clone()).project(camera);
    if (p.z < 1) {
      const x = (p.x + 1) / 2 * W, y = (1 - p.y) / 2 * H, r = 26;
      hctx.strokeStyle = '#ff3b2f'; hctx.lineWidth = 2;
      hctx.save(); hctx.translate(x, y); hctx.rotate(time * 2);
      hctx.strokeRect(-r / 2, -r / 2, r, r); hctx.restore();
    }
  }
  // 画面外の地上絵を示す矢印
  for (const g of glyphObjs) {
    if (!(g.state === 'rising' || g.state === 'standing')) continue;
    const wp = glyphTop(g); const p = wp.clone().project(camera);
    const behind = p.z > 1;
    let x = p.x, y = p.y;
    if (behind) { x = -x; y = -y; }
    if (!behind && Math.abs(x) < .95 && Math.abs(y) < .9) {
      const sx = (x + 1) / 2 * W, sy = (1 - y) / 2 * H;
      const d = glyphMid(g).distanceTo(player.pos);
      hctx.font = '700 13px system-ui,sans-serif'; hctx.textAlign = 'center'; hctx.textBaseline = 'bottom';
      hctx.fillStyle = 'rgba(0,0,0,.5)'; hctx.fillText(`${d.toFixed(0)}m`, sx + 1, sy - 5);
      hctx.fillStyle = '#ffe2b0'; hctx.fillText(`${d.toFixed(0)}m`, sx, sy - 6);
      continue;
    }
    const a = Math.atan2(-y, x);
    const m = 46, cx = W / 2, cy = H / 2;
    const k = Math.min((cx - m) / Math.abs(Math.cos(a) || 1e-6), (cy - m) / Math.abs(Math.sin(a) || 1e-6));
    const ax = cx + Math.cos(a) * k, ay = cy + Math.sin(a) * k;
    hctx.save(); hctx.translate(ax, ay); hctx.rotate(a);
    const blink = g.state === 'standing' && STAND - g.t < 2 ? (Math.sin(time * 14) > 0 ? 1 : .3) : 1;
    hctx.fillStyle = `rgba(255,190,90,${.9 * blink})`;
    hctx.beginPath(); hctx.moveTo(16, 0); hctx.lineTo(-8, -11); hctx.lineTo(-3, 0); hctx.lineTo(-8, 11); hctx.closePath(); hctx.fill();
    hctx.restore();
  }
  // 敵ミサイルの方向
  for (const e of enemies) {
    const p = e.pos.clone().project(camera), behind = p.z > 1;
    let x = p.x, y = p.y; if (behind) { x = -x; y = -y; }
    const blink = Math.sin(time * 20) > 0 ? 1 : .45;
    if (!behind && Math.abs(x) < .95 && Math.abs(y) < .9) {
      const sx = (x + 1) / 2 * W, sy = (1 - y) / 2 * H;
      hctx.strokeStyle = `rgba(255,50,40,${blink})`; hctx.lineWidth = 2.5;
      hctx.beginPath(); hctx.arc(sx, sy, 16, 0, Math.PI * 2); hctx.stroke();
      hctx.beginPath(); hctx.moveTo(sx - 24, sy); hctx.lineTo(sx - 10, sy); hctx.moveTo(sx + 10, sy); hctx.lineTo(sx + 24, sy); hctx.stroke();
      continue;
    }
    const a = Math.atan2(-y, x), m = 60, cx = W / 2, cy = H / 2;
    const k = Math.min((cx - m) / Math.abs(Math.cos(a) || 1e-6), (cy - m) / Math.abs(Math.sin(a) || 1e-6));
    hctx.save(); hctx.translate(cx + Math.cos(a) * k, cy + Math.sin(a) * k); hctx.rotate(a);
    hctx.fillStyle = `rgba(255,45,35,${blink})`;
    hctx.beginPath(); hctx.moveTo(26, 0); hctx.lineTo(-10, -18); hctx.lineTo(-2, 0); hctx.lineTo(-10, 18); hctx.closePath(); hctx.fill();
    hctx.restore();
  }
  // レーダー
  const R = clamp(Math.min(W, H) * .15, 38, 78), rx = W - R - 12, ry = R + 12 + (W < 600 ? 64 : 0), range = 520;
  hctx.save();
  hctx.fillStyle = 'rgba(20,14,8,.55)'; hctx.strokeStyle = 'rgba(255,230,190,.35)'; hctx.lineWidth = 1;
  hctx.beginPath(); hctx.arc(rx, ry, R, 0, Math.PI * 2); hctx.fill(); hctx.stroke();
  hctx.beginPath(); hctx.arc(rx, ry, R / 2, 0, Math.PI * 2); hctx.stroke();
  hctx.beginPath(); hctx.arc(rx, ry, R, 0, Math.PI * 2); hctx.clip();
  // 視野
  hctx.fillStyle = 'rgba(255,230,190,.12)';
  hctx.beginPath(); hctx.moveTo(rx, ry); hctx.arc(rx, ry, R, -Math.PI / 2 - .55, -Math.PI / 2 + .55); hctx.closePath(); hctx.fill();
  const c = Math.cos(player.yaw), s = Math.sin(player.yaw);
  const toR = (wx, wz) => { const dx = wx - player.pos.x, dz = wz - player.pos.z; const lx = dx * c - dz * s, lz = dx * s + dz * c; return [rx + lx / range * R, ry + lz / range * R]; };
  // ハイウェイ
  hctx.strokeStyle = 'rgba(120,120,120,.8)'; hctx.lineWidth = 2;
  const a1 = toR(HWY_A.x - HWY_DIR.x * 300, HWY_A.z - HWY_DIR.z * 300), a2 = toR(HWY_B.x + HWY_DIR.x * 300, HWY_B.z + HWY_DIR.z * 300);
  hctx.beginPath(); hctx.moveTo(...a1); hctx.lineTo(...a2); hctx.stroke();
  for (const g of glyphObjs) {
    const [x, y] = toR(g.center.x, g.center.z);
    if (g.state === 'cleared' || g.state === 'clearing') { hctx.fillStyle = 'rgba(255,200,90,.55)'; hctx.fillRect(x - 2, y - 2, 4, 4); }
    else if (g.state === 'ground') { hctx.fillStyle = 'rgba(255,240,220,.45)'; hctx.beginPath(); hctx.arc(x, y, 2.2, 0, Math.PI * 2); hctx.fill(); }
    else { const pulse = 4 + Math.sin(time * 8) * 1.5; hctx.fillStyle = g === locked ? '#ff3b2f' : '#ffb347'; hctx.beginPath(); hctx.arc(x, y, pulse, 0, Math.PI * 2); hctx.fill(); }
  }
  for (const e of enemies) { const [x, y] = toR(e.pos.x, e.pos.z); hctx.fillStyle = '#ff2d20'; hctx.fillRect(x - 3, y - 3, 6, 6); }
  hctx.restore();
  hctx.fillStyle = '#fff'; hctx.beginPath(); hctx.moveTo(rx, ry - 5); hctx.lineTo(rx - 4, ry + 4); hctx.lineTo(rx + 4, ry + 4); hctx.fill();
  // 方位N
  const [nx, ny] = (() => { const lx = -s, lz = -c; return [rx + lx * (R - 9), ry + lz * (R - 9)]; })();
  hctx.font = 'bold 11px system-ui,sans-serif'; hctx.textAlign = 'center'; hctx.textBaseline = 'middle'; hctx.fillStyle = '#ff8a6a'; hctx.fillText('N', nx, ny);
}

let msgTimer = 0;
function flashMsg(t, warn) {
  el.msg.textContent = t; el.msg.className = 'show' + (warn ? ' warn' : '');
  clearTimeout(msgTimer); msgTimer = setTimeout(() => el.msg.className = '', 1800);
}

// 撃破カード（地上絵の紹介）
const cardQ = []; let cardBusy = false;
function thumb(def, N = 96, color = '#5a3a1e') {
  const c = document.createElement('canvas'); c.width = c.height = N;
  drawGlyph(c.getContext('2d'), def, N, { width: Math.max(2, N / 40), color, margin: .08 });
  return c;
}
function showCard(def) { cardQ.push(def); if (!cardBusy) nextCard(); }
function nextCard() {
  const def = cardQ.shift(); if (!def) { cardBusy = false; return; }
  cardBusy = true;
  const card = $('card');
  card.querySelector('.thumb').replaceChildren(thumb(def));
  card.querySelector('.name').textContent = def.name;
  card.querySelector('.no').textContent = `撃ち抜いた地上絵 ${cleared}/${glyphObjs.length}`;
  card.querySelector('.desc').textContent = def.desc;
  card.classList.add('show');
  setTimeout(() => { card.classList.remove('show'); setTimeout(nextCard, 350); }, 4200);
}

// ============================================================
//  スコア
// ============================================================
function computeScore() {
  const acc = shots ? hits / shots : 0;
  const parts = [
    ['撃破ボーナス', `${cleared} 体 × 1,000`, cleared * 1000],
    ['タイムボーナス', `${fmtTime(elapsed)}（15分から短縮した秒 × 40）`, Math.max(0, Math.round((900 - elapsed) * 40))],
    ['命中率ボーナス', `${Math.round(acc * 100)}%（${hits}/${shots} 発）`, Math.round(acc * acc * 15000)],
    ['迎撃ボーナス', `敵ミサイル撃墜 ${intercepts} 発 × 800`, intercepts * 800],
    ['取り逃がしペナルティ', `地面に戻った ${returns} 回 × −500`, -returns * 500],
  ];
  const total = Math.max(0, parts.reduce((s, p) => s + p[2], 0));
  const rank = total >= 62000 ? 'S' : total >= 52000 ? 'A' : total >= 42000 ? 'B' : total >= 30000 ? 'C' : 'D';
  return { parts, total, rank, acc };
}
function finish() {
  if (state !== 'play') return;
  state = 'result'; paused = false;
  cardQ.length = 0; $('card').classList.remove('show');
  if (document.pointerLockElement) document.exitPointerLock();
  const r = computeScore();
  const newBest = r.total > (best.score || 0);
  if (newBest) best = { score: r.total, time: elapsed };
  try { localStorage.setItem('nazka_best', JSON.stringify(best)); } catch (e) {}
  $('rTotal').textContent = r.total.toLocaleString();
  $('rRank').textContent = r.rank; $('rRank').className = 'rank r' + r.rank;
  $('rBest').textContent = newBest ? '🏆 自己ベスト更新！' : `自己ベスト ${best.score.toLocaleString()}`;
  $('rTable').innerHTML = r.parts.map(([a, b, c]) => `<tr><th>${a}</th><td>${b}</td><td class="${c < 0 ? 'neg' : ''}">${c > 0 ? '+' : c < 0 ? '−' : '±'}${Math.abs(c).toLocaleString()}</td></tr>`).join('');
  fillGallery($('rGallery'), order);
  show('result');
  hudVisible(false);
}

// ============================================================
//  画面切り替え
// ============================================================
function show(id) { for (const s of ['title', 'howto', 'result', 'pause', 'gallery', 'gameover']) $(s).classList.toggle('hidden', s !== id); }
function hudVisible(v) { document.body.classList.toggle('playing', v); }
function fillGallery(container, list) {
  container.replaceChildren(...list.map((def, i) => {
    const d = document.createElement('div'); d.className = 'gcard';
    d.append(thumb(def, 120));
    const t = document.createElement('div');
    t.innerHTML = `<b>${i + 1}. ${def.name}</b><p>${def.desc}</p>`;
    d.append(t); return d;
  }));
}
function startGame() {
  initAudio();
  resetGame();
  state = 'play'; paused = false;
  show(null); hudVisible(true);
  if (!IS_TOUCH) requestLock();
  flashMsg('地上絵が立ち上がるのを探せ！');
  showHint();
}
$('startBtn').onclick = startGame;
$('howtoStart').onclick = startGame;
$('howtoBtn').onclick = () => show('howto');
$('howtoBack').onclick = () => show('title');
$('retryBtn').onclick = startGame;
$('galleryBtn').onclick = () => { fillGallery($('gList'), GLYPHS); show('gallery'); };
$('galleryBack').onclick = () => show(state === 'result' ? 'result' : 'title');
$('rGalleryAll').onclick = () => { fillGallery($('gList'), GLYPHS); show('gallery'); };
$('titleBtn').onclick = () => { state = 'title'; show('title'); };
$('goRetry').onclick = startGame;
$('goTitle').onclick = () => { resetGame(); state = 'title'; show('title'); };
$('pause').onclick = () => { requestLock(); };

// ============================================================
//  入力
// ============================================================
let noLock = false;
function requestLock() {
  if (IS_TOUCH || noLock) { paused = false; show(null); return; }
  try {
    const p = canvas.requestPointerLock();
    if (p && p.catch) p.catch(() => { noLock = true; paused = false; show(null); });
  } catch (e) { noLock = true; }
}
document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement === canvas) { paused = false; show(null); }
  else if (state === 'play' && !noLock) { paused = true; show('pause'); }
});
document.addEventListener('pointerlockerror', () => { noLock = true; paused = false; show(null); });

const SENS = .0022;
let dragging = false, dragMoved = 0;
canvas.addEventListener('mousedown', e => {
  if (state !== 'play') return;
  initAudio();
  if (document.pointerLockElement === canvas) { if (e.button === 0) fire(); return; }
  dragging = true; dragMoved = 0;
  if (!noLock) requestLock();
});
window.addEventListener('mouseup', () => { if (dragging && dragMoved < 6 && noLock && document.pointerLockElement !== canvas) fire(); dragging = false; });
window.addEventListener('mousemove', e => {
  if (state !== 'play' || paused) return;
  if (document.pointerLockElement === canvas || dragging) {
    player.yaw -= e.movementX * SENS;
    player.pitch = clamp(player.pitch - e.movementY * SENS, -15 * DEG, 70 * DEG);
    dragMoved += Math.abs(e.movementX) + Math.abs(e.movementY);
  }
});
canvas.addEventListener('wheel', e => { if (state === 'play') player.pitch = clamp(player.pitch - Math.sign(e.deltaY) * .5 * DEG, -15 * DEG, 70 * DEG); }, { passive: true });
window.addEventListener('keydown', e => {
  keys[e.code] = true;
  if (e.code === 'Space') { e.preventDefault(); initAudio(); fire(); }
  if (e.code === 'KeyM') toggleMute();
  if (e.code.startsWith('Arrow')) e.preventDefault();
});
window.addEventListener('keyup', e => { keys[e.code] = false; });
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

// タッチ：左＝移動スティック、右＝視点（仰角）ドラッグ、FIREボタン
const joy = { x: 0, y: 0, mag: 0, id: null, ox: 0, oy: 0 };
let lookId = null, lookX = 0, lookY = 0;
const joyEl = $('joy'), knob = $('knob');
canvas.addEventListener('touchstart', e => {
  initAudio();
  for (const t of e.changedTouches) {
    if (t.clientX < innerWidth * .45 && joy.id === null) {
      joy.id = t.identifier; joy.ox = t.clientX; joy.oy = t.clientY;
      joyEl.style.left = `${t.clientX}px`; joyEl.style.top = `${t.clientY}px`; joyEl.classList.add('on');
    } else if (lookId === null) { lookId = t.identifier; lookX = t.clientX; lookY = t.clientY; }
  }
  e.preventDefault();
}, { passive: false });
canvas.addEventListener('touchmove', e => {
  for (const t of e.changedTouches) {
    if (t.identifier === joy.id) {
      let dx = (t.clientX - joy.ox) / 55, dy = (t.clientY - joy.oy) / 55;
      const m = Math.hypot(dx, dy); if (m > 1) { dx /= m; dy /= m; }
      joy.x = dx; joy.y = dy; joy.mag = Math.min(1, m);
      knob.style.transform = `translate(${dx * 40}px,${dy * 40}px)`;
    } else if (t.identifier === lookId) {
      player.yaw -= (t.clientX - lookX) * .005;
      player.pitch = clamp(player.pitch - (t.clientY - lookY) * .004, -15 * DEG, 70 * DEG);
      lookX = t.clientX; lookY = t.clientY;
    }
  }
  e.preventDefault();
}, { passive: false });
const endTouch = e => {
  for (const t of e.changedTouches) {
    if (t.identifier === joy.id) { joy.id = null; joy.x = joy.y = joy.mag = 0; knob.style.transform = ''; joyEl.classList.remove('on'); }
    if (t.identifier === lookId) lookId = null;
  }
};
canvas.addEventListener('touchend', endTouch); canvas.addEventListener('touchcancel', endTouch);
$('fireBtn').addEventListener('touchstart', e => { e.preventDefault(); initAudio(); fire(); }, { passive: false });
$('fireBtn').addEventListener('click', () => fire());
if (IS_TOUCH) document.body.classList.add('touch');
window.addEventListener('touchstart', () => document.body.classList.add('touch'), { once: true, passive: true });
window.addEventListener('pointerdown', () => initAudio(), { once: true });
window.addEventListener('keydown', () => initAudio(), { once: true });

let hintTimer = 0;
function showHint() {
  const h = $('hint'); h.classList.add('show');
  clearTimeout(hintTimer); hintTimer = setTimeout(() => h.classList.remove('show'), 9000);
}

// ============================================================
//  サウンド
// ============================================================
let AC = null, master = null, seekOsc = null, seekGain = null, noiseBuf = null, muted = false;
function initAudio() {
  if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    master = AC.createGain(); master.gain.value = muted ? 0 : .55; master.connect(AC.destination);
    seekOsc = AC.createOscillator(); seekOsc.type = 'square'; seekOsc.frequency.value = 600;
    seekGain = AC.createGain(); seekGain.gain.value = 0;
    const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400;
    seekOsc.connect(lp).connect(seekGain).connect(master); seekOsc.start();
    noiseBuf = AC.createBuffer(1, AC.sampleRate * 2, AC.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    bgmStart();
  } catch (e) { AC = null; }
}
function noise(dur, f0, f1, vol, type = 'lowpass', q = 1, delay = 0) {
  if (!AC) return;
  const t = AC.currentTime + delay, src = AC.createBufferSource(); src.buffer = noiseBuf;
  const f = AC.createBiquadFilter(); f.type = type; f.Q.value = q;
  f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
  const g = AC.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur);
  src.connect(f).connect(g).connect(master); src.start(t); src.stop(t + dur + .05);
}
function tone(freq, dur, vol, type = 'sine', f1, delay = 0) {
  if (!AC) return;
  const t = AC.currentTime + delay, o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur);
  o.connect(g).connect(master); o.start(t); o.stop(t + dur + .05);
}
const sfx = {
  launch() { noise(.15, 900, 200, .7); noise(1.4, 3500, 500, .55, 'bandpass', .7, .2); tone(70, .3, .5, 'sine', 35); },
  boom(big) { noise(big ? 2 : 1.2, 1500, 40, big ? 1 : .7); tone(80, .7, .5, 'sine', 25); },
  empty() { tone(260, .07, .15, 'square'); },
  lock() { tone(1650, .05, .08, 'square'); },
  thud() { noise(.6, 400, 60, .35); },
  rumble(d) { const v = clamp(1 - d / 600, .08, .6); noise(1.6, 220, 60, v); tone(45, 1.4, v * .6, 'sine', 30); },
  step(k) { noise(.06, 900 + k * 400, 300, .05 + .05 * k, 'bandpass', 1.2); },
  enemyLaunch(d) { const v = clamp(1 - d / 700, .15, .7); noise(1.2, 2500, 300, v, 'bandpass', .8); tone(110, .4, v * .5, 'sawtooth', 55); },
  alarm(d) { tone(d < 90 ? 1400 : 1000, .06, .09, 'square'); },
  chime() { [880, 1108, 1318].forEach((f, i) => tone(f, .45, .1, 'triangle', null, .25 + i * .09)); },
};
function setSeeker(mode) {
  if (!AC) return;
  const t = AC.currentTime;
  if (mode === 2) { seekOsc.frequency.setTargetAtTime(1650, t, .02); seekGain.gain.setTargetAtTime(.045, t, .02); }
  else if (mode === 1) { seekOsc.frequency.setTargetAtTime(480 + Math.sin(t * 60) * 60, t, .01); seekGain.gain.setTargetAtTime(Math.sin(t * 50) > 0 ? .04 : .008, t, .005); }
  else seekGain.gain.setTargetAtTime(0, t, .03);
}
// ============================================================
//  BGM：アンデス風（ケーナ・チャランゴ・ボンボ・チャフチャス）を自動生成
// ============================================================
const BGM = { on: false, step: 0, next: 0, bpm: 88, song: null, loops: 0 };
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
const CHORDS = { Am: [57, 60, 64, 69], C: [60, 64, 67, 72], G: [55, 59, 62, 67], Em: [52, 55, 59, 64], E: [52, 56, 59, 64], Dm: [50, 57, 62, 65] };
const PROG = ['Am', 'Am', 'C', 'G', 'Am', 'Dm', 'E', 'Am'];
const SCALE = [64, 67, 69, 72, 74, 76, 79, 81, 84];   // Aマイナー・ペンタトニック
function makeSong() {
  const rhythms = [[4, 2, 2, 4, 4], [2, 2, 4, 2, 2, 4], [6, 2, 4, 4], [4, 4, 2, 2, 4], [3, 1, 4, 4, 4], [8, 4, 4]];
  let idx = 4;
  const phrase = (endOn) => { // 2小節(16ステップ)の旋律
    const out = []; let t = 0;
    for (let b = 0; b < 2; b++) {
      const r = pick(rhythms);
      for (const d of r) {
        idx = clamp(idx + pick([-2, -1, -1, 0, 1, 1, 2]), 0, SCALE.length - 1);
        out.push({ s: t, d, m: SCALE[idx], rest: Math.random() < .1 && t > 0 });
        t += d;
      }
    }
    const last = out[out.length - 1]; last.m = endOn; last.rest = false;
    return out;
  };
  const A = phrase(69), B = phrase(76), C = phrase(72);
  const A2 = A.map(n => ({ ...n })); A2[A2.length - 1].m = 64;
  return [A2, B, C, A]; // 8小節 = 4フレーズ
}
function bgmImpulse(sec) {
  const len = AC.sampleRate * sec, b = AC.createBuffer(2, len, AC.sampleRate);
  for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
  return b;
}
function bgmStart() {
  if (!AC || BGM.on) return;
  BGM.on = true;
  BGM.out = AC.createGain(); BGM.out.gain.value = 0; BGM.out.connect(master);
  BGM.out.gain.setTargetAtTime(.32, AC.currentTime, 1.5);
  BGM.rev = AC.createConvolver(); BGM.rev.buffer = bgmImpulse(2.8);
  const rg = AC.createGain(); rg.gain.value = .45; BGM.rev.connect(rg).connect(BGM.out);
  // 砂漠の風
  const w = AC.createBufferSource(); w.buffer = noiseBuf; w.loop = true;
  const wf = AC.createBiquadFilter(); wf.type = 'bandpass'; wf.frequency.value = 500; wf.Q.value = .6;
  const lfo = AC.createOscillator(), lg = AC.createGain(); lfo.frequency.value = .07; lg.gain.value = 300; lfo.connect(lg).connect(wf.frequency); lfo.start();
  const wg = AC.createGain(); wg.gain.value = .07; w.connect(wf).connect(wg).connect(BGM.out); w.start();
  BGM.song = makeSong(); BGM.step = 0; BGM.next = AC.currentTime + .2;
  setInterval(bgmSched, 25);
}
function bgmSched() {
  if (!AC || AC.state !== 'running') return;
  const st = 60 / BGM.bpm / 4;
  while (BGM.next < AC.currentTime + .15) { bgmStep(BGM.step, BGM.next); BGM.next += st; BGM.step++; }
}
function bgmVoice(t, dur, freq, vol, type, cutoff, dest) {
  const o = AC.createOscillator(), f = AC.createBiquadFilter(), g = AC.createGain();
  o.type = type; o.frequency.value = freq;
  f.type = 'lowpass'; f.frequency.setValueAtTime(cutoff, t); f.frequency.exponentialRampToValueAtTime(Math.max(200, cutoff * .2), t + dur);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .004); g.gain.exponentialRampToValueAtTime(.0005, t + dur);
  o.connect(f).connect(g); g.connect(dest || BGM.out); o.start(t); o.stop(t + dur + .05);
  return g;
}
function charango(t, notes, vol, up) { // 複弦のかき鳴らし
  const ns = up ? [...notes].reverse() : notes;
  ns.forEach((m, i) => {
    const tt = t + i * .014, f = mtof(m + 12);
    const g = bgmVoice(tt, .45, f, vol, 'sawtooth', 3200);
    bgmVoice(tt + .003, .4, f * 1.004, vol * .6, 'sawtooth', 2600);
    if (i === 0) g.connect(BGM.rev);
  });
}
function quena(t, dur, m, vol) {
  const f = mtof(m), o = AC.createOscillator(), o2 = AC.createOscillator(), g = AC.createGain();
  o.type = 'sine'; o2.type = 'triangle'; o.frequency.value = f; o2.frequency.value = f;
  const vib = AC.createOscillator(), vg = AC.createGain(); vib.frequency.value = 5.2; vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(f * .012, t + Math.min(dur, .35));
  vib.connect(vg); vg.connect(o.frequency); vg.connect(o2.frequency);
  const g2 = AC.createGain(); g2.gain.value = .25; o2.connect(g2).connect(g); o.connect(g);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .06); g.gain.setValueAtTime(vol * .85, t + dur * .7); g.gain.linearRampToValueAtTime(0, t + dur + .08);
  g.connect(BGM.out); g.connect(BGM.rev);
  // 息の音
  const n = AC.createBufferSource(); n.buffer = noiseBuf; const nf = AC.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = f * 2; nf.Q.value = 3;
  const ng = AC.createGain(); ng.gain.setValueAtTime(vol * .5, t); ng.gain.exponentialRampToValueAtTime(.001, t + .12);
  n.connect(nf).connect(ng).connect(BGM.out);
  for (const x of [o, o2, vib]) { x.start(t); x.stop(t + dur + .15); }
  n.start(t, rand(0, 1)); n.stop(t + .15);
}
function bombo(t, vol) {
  const o = AC.createOscillator(), g = AC.createGain();
  o.frequency.setValueAtTime(95, t); o.frequency.exponentialRampToValueAtTime(42, t + .25);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + .5);
  o.connect(g).connect(BGM.out); o.start(t); o.stop(t + .55);
  const n = AC.createBufferSource(); n.buffer = noiseBuf; const f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
  const ng = AC.createGain(); ng.gain.setValueAtTime(vol * .35, t); ng.gain.exponentialRampToValueAtTime(.001, t + .08);
  n.connect(f).connect(ng).connect(BGM.out); n.start(t, rand(0, 1)); n.stop(t + .1);
}
function shaker(t, vol) {
  const n = AC.createBufferSource(); n.buffer = noiseBuf; const f = AC.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 6500;
  const g = AC.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .01); g.gain.exponentialRampToValueAtTime(.001, t + .07);
  n.connect(f).connect(g).connect(BGM.out); n.start(t, rand(0, 1)); n.stop(t + .09);
}
function bgmStep(step, t) {
  const s = step % 8, bar = Math.floor(step / 8) % 8;
  if (step > 0 && step % 64 === 0 && ++BGM.loops % 2 === 0) BGM.song = makeSong();
  const full = state === 'play' && !paused;               // プレイ中はバンド全体、それ以外は静かに
  const chord = CHORDS[PROG[bar]];
  if (s === 0) bgmVoice(t, .9, mtof(chord[0] - 12), .22, 'triangle', 900);
  if (s === 4 && full) bgmVoice(t, .6, mtof(chord[0] - 5), .15, 'triangle', 900);
  if (full) {
    if (s === 0 || s === 4) bombo(t, s === 0 ? .55 : .4);
    if (s === 3 || s === 7) bombo(t, .18);
    shaker(t, (s % 2 ? .025 : .045) * (s === 2 || s === 6 ? 1.4 : 1));
    if ([0, 2, 3, 4, 6, 7].includes(s)) charango(t, chord, s === 0 || s === 4 ? .045 : .028, s === 3 || s === 7);
  } else if (s === 0 || s === 4) {
    chord.forEach((m, i) => bgmVoice(t + i * .09, 1.2, mtof(m + 12), .035, 'triangle', 2200).connect(BGM.rev));
  }
  // 旋律：2小節で1フレーズ
  const ph = BGM.song[bar >> 1], local = (bar & 1) * 8 + s;
  for (const n of ph) if (n.s === local && !n.rest) quena(t, n.d * 60 / BGM.bpm / 4 * .95, n.m, full ? .11 : .085);
}

function toggleMute() {
  muted = !muted; if (master) master.gain.value = muted ? 0 : .55;
  $('muteBtn').textContent = muted ? '🔇' : '🔊';
}
$('muteBtn').onclick = e => { e.stopPropagation(); toggleMute(); };

// ============================================================
//  ループ
// ============================================================
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  hud.width = w * devicePixelRatio; hud.height = h * devicePixelRatio;
  const sc = h * renderer.getPixelRatio() / (2 * Math.tan(camera.fov * DEG / 2));
  smoke.mat.uniforms.scale.value = sc; flames.mat.uniforms.scale.value = sc;
}
addEventListener('resize', resize); resize();

let last = performance.now();
function loop(now) {
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  update(dt);
  if (state !== 'play' && state !== 'dead') { // タイトル中：兵士は待機姿勢
    soldier.root.position.copy(player.pos); soldier.root.rotation.y = player.yaw + Math.PI;
    soldier.aim.rotation.x = -(12 * DEG + Math.sin(time * .8) * .03);
  }
  updateCamera(dt);
  renderer.render(scene, camera);
  drawHUD();
  requestAnimationFrame(loop);
}
// タイトル演出：いくつかの地上絵を立たせておく
for (const g of glyphObjs.slice(0, 5)) {
  setYaw(g, Math.atan2(-g.center.x, -g.center.z)); setK(g, 1); setLook(g, 'stand');
}
document.body.classList.add('ready');
requestAnimationFrame(loop);
window.__nazka = { get state() { return state; }, glyphObjs, player, fire, step(sec) { for (let t = 0; t < sec; t += 1 / 30) { update(1 / 30); updateCamera(1 / 30); } }, get missiles() { return missiles; }, get enemies() { return enemies; }, launchEnemy, keys, camera, finish: () => { cleared = glyphObjs.length; finish(); } };
