// =====================================================================
// GIGA-CLASH  render3d.js — Three.js による3D描画
//   cityScene：街（前半戦の舞台、後半戦の巨大戦の背景）
//   intScene ：巨大ロボの機関室 / 大怪獣の体内
// =====================================================================
import * as THREE from 'three';
import { CITY, CELL, GW, GH, ST, ROOM, WALLS, ZONES, ZKEYS, CON, WORLD_W, pilotOf, zoneOff, SLOT_COL, TEAM_COL } from './sim.js';

export const W = 1280, H = 720, EXT_H = 300;
const XS = 0.16, IS = 0.05;
const ex = x => (x - WORLD_W / 2) * XS;
const ix = x => (x - 640) * IS, iz = y => (y - 210) * IS;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = a => a[(Math.random() * a.length) | 0];
const ease = t => t * t * (3 - 2 * t);

const grad = new THREE.DataTexture(new Uint8Array([95, 95, 110, 255, 175, 175, 185, 255, 255, 255, 255, 255]), 3, 1, THREE.RGBAFormat);
grad.minFilter = grad.magFilter = THREE.NearestFilter; grad.needsUpdate = true;
const toon = (color, o = {}) => new THREE.MeshToonMaterial({ color, gradientMap: grad, ...o });
const glow = (color, o = {}) => new THREE.MeshBasicMaterial({ color, ...o });
const G_BOX = new THREE.BoxGeometry(1, 1, 1), G_SPH = new THREE.SphereGeometry(1, 16, 12), G_CYL = new THREE.CylinderGeometry(1, 1, 1, 14), G_CONE = new THREE.ConeGeometry(1, 1, 8), G_ICO = new THREE.IcosahedronGeometry(1, 0), G_DOD = new THREE.DodecahedronGeometry(1, 0);
function mesh(geo, mat, p, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); if (p) p.add(m); return m; }
function grp(p, x = 0, y = 0, z = 0) { const g = new THREE.Group(); g.position.set(x, y, z); if (p) p.add(g); return g; }
function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
function shadowAll(o, cast = true, recv = false) { o.traverse(m => { if (m.isMesh) { m.castShadow = cast; m.receiveShadow = recv; } }); }

// ---------------------------------------------------------------------
// パーティクル
// ---------------------------------------------------------------------
class Particles {
  constructor(scene, max = 500) {
    this.max = max; this.list = [];
    this.mesh = new THREE.InstancedMesh(G_ICO, new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false }), max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.mesh.frustumCulled = false; this.mesh.count = 0;
    this.mesh.setColorAt(0, new THREE.Color(1, 1, 1));
    scene.add(this.mesh); this.d = new THREE.Object3D(); this.c = new THREE.Color();
  }
  add(x, y, z, vx, vy, vz, life, size, col, type = 'dust') { if (this.list.length >= this.max) this.list.shift(); this.list.push({ x, y, z, vx, vy, vz, life, max: life, size, col, type }); }
  burst(x, y, z, n, col, spd, size, type = 'dust', up = 0) { for (let i = 0; i < n; i++) { const a = rnd(0, 6.283), b = rnd(-1, 1), s = rnd(spd * 0.3, spd), c = Math.sqrt(1 - b * b); this.add(x, y, z, Math.cos(a) * c * s, Math.abs(b) * s + up, Math.sin(a) * c * s, rnd(0.3, 0.8), rnd(size * 0.5, size), Array.isArray(col) ? pick(col) : col, type); } }
  update(dt) {
    const L = this.list, d = this.d; let n = 0;
    for (let i = L.length - 1; i >= 0; i--) {
      const p = L[i]; p.life -= dt; if (p.life <= 0) { L.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.type === 'spark') p.vy -= 30 * dt; else if (p.type === 'fire') { p.vy += 4 * dt; p.vx *= 0.96; p.vz *= 0.96; } else { p.vx *= 0.95; p.vy *= 0.95; p.vz *= 0.95; }
      if (p.y < 0.05 && p.type === 'spark') { p.y = 0.05; p.vy *= -0.4; }
    }
    for (const p of L) {
      const a = p.life / p.max, s = p.size * (p.type === 'dust' ? Math.min(1, a * 2.5) * (1.5 - a * 0.5) : a);
      d.position.set(p.x, p.y, p.z); d.scale.setScalar(Math.max(0.001, s)); d.rotation.set(p.x, p.y * 2, 0); d.updateMatrix();
      this.mesh.setMatrixAt(n, d.matrix); this.mesh.setColorAt(n, this.c.set(p.col)); n++;
    }
    this.mesh.count = n; this.mesh.instanceMatrix.needsUpdate = true; if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------
// キャラクター（前半戦のヒーロー・怪人、機体内部の乗組員）
// ---------------------------------------------------------------------
function makeFigure(col, team) {
  const g = new THREE.Group(), u = {};
  u.suit = toon(col); u.body = toon(0xe8ecf5);
  u.torso = mesh(new THREE.CapsuleGeometry(0.52, 0.45, 4, 10), u.body, g, 0, 0.8, 0);
  mesh(G_CYL, u.suit, g, 0, 0.62, 0, 0.56, 0.36, 0.56);
  u.head = grp(g, 0, 1.72, 0);
  mesh(G_SPH, u.suit, u.head, 0, 0, 0, 0.62, 0.6, 0.62);
  mesh(G_BOX, glow(0x161a2c), u.head, 0, -0.02, 0.42, 0.84, 0.3, 0.4);
  mesh(G_BOX, glow(0x7fe8ff), u.head, -0.2, -0.02, 0.63, 0.16, 0.12, 0.04); mesh(G_BOX, glow(0x7fe8ff), u.head, 0.2, -0.02, 0.63, 0.16, 0.12, 0.04);
  if (team === 0) { mesh(G_CYL, toon(0xdddddd), u.head, 0, 0.75, 0, 0.04, 0.4, 0.04); mesh(G_SPH, glow(0xff5a4f), u.head, 0, 0.98, 0, 0.1, 0.1, 0.1); mesh(G_BOX, toon(0xe23b3b), g, 0, 1.2, -0.4, 0.7, 0.16, 0.5); }
  else { for (const s of [-1, 1]) { const h = mesh(G_CONE, toon(0xf2ead8), u.head, s * 0.38, 0.55, 0, 0.14, 0.5, 0.14); h.rotation.z = -s * 0.5; } mesh(G_CONE, u.suit, g, 0, 0.5, -0.7, 0.2, 0.8, 0.2).rotation.x = -1.9; }
  u.hL = mesh(G_SPH, u.body, g, -0.7, 0.85, 0.1, 0.2, 0.2, 0.2); u.hR = mesh(G_SPH, u.body, g, 0.7, 0.85, 0.1, 0.2, 0.2, 0.2);
  u.shadow = mesh(new THREE.CircleGeometry(0.75, 16), glow(0x000000, { transparent: true, opacity: 0.3, depthWrite: false }), g, 0, 0.03, 0); u.shadow.rotation.x = -Math.PI / 2;
  g.userData = u; return g;
}
function poseFigure(f, walk, carrying, punch, dizzy, t) {
  const u = f.userData, b = Math.abs(Math.sin(walk)) * 0.18;
  u.torso.position.y = 0.8 + b; u.head.position.y = 1.72 + b; u.head.rotation.z = dizzy ? Math.sin(t * 14) * 0.3 : 0;
  if (carrying) { u.hL.position.set(-0.55, 2.3, 0); u.hR.position.set(0.55, 2.3, 0); }
  else if (punch > 0) { u.hL.position.set(-0.7, 0.9, 0.1); u.hR.position.set(0.35, 1.1, 1.2); }
  else { const s = Math.sin(walk) * 0.35; u.hL.position.set(-0.7, 0.85 + b, s); u.hR.position.set(0.7, 0.85 + b, -s); }
}
function makeCitizen() {
  const g = new THREE.Group(), u = {};
  u.mat = toon(0xffffff); u.body = mesh(G_CYL, u.mat, g, 0, 0.5, 0, 0.3, 0.75, 0.3);
  u.head = mesh(G_SPH, toon(0xffd9b3), g, 0, 1.15, 0, 0.3, 0.3, 0.3);
  u.hat = mesh(G_CYL, toon(0xffd23f), g, 0, 1.45, 0, 0.34, 0.16, 0.34);
  mesh(new THREE.CircleGeometry(0.4, 12), glow(0x000000, { transparent: true, opacity: 0.25, depthWrite: false }), g, 0, 0.03, 0).rotation.x = -Math.PI / 2;
  g.userData = u; return g;
}
const CIT_COL = [0xffd6a5, 0xcaffbf, 0x9bf6ff, 0xffadad, 0xfdffb6, 0xbdb2ff];

// ---------------------------------------------------------------------
// 巨大ロボ「ギガント・ブレイバー」
// ---------------------------------------------------------------------
function makeRobot() {
  const M = { white: toon(0xf4f6fb), blue: toon(0x2f6fe0), red: toon(0xe23b3b), yellow: toon(0xffd23f), dark: toon(0x242a40), grey: toon(0xc5ccdf) };
  const visor = glow(0x5cffb0), core = glow(0x6ee6ff), root = new THREE.Group(), body = grp(root), Z = { rarm: [], larm: [], head: [], legs: [] }, u = { kind: 0, root, body, M, visor, core, Z };
  mesh(G_BOX, M.dark, body, 0, 13.6, 0, 7.2, 3, 5);
  u.legs = []; u.knees = [];
  for (const s of [-1, 1]) {
    const leg = grp(body, s * 2.7, 13, 0), knee = grp(leg, 0, -6.4, 0);
    Z.legs.push(mesh(G_BOX, M.white, leg, 0, -3.2, 0, 3.6, 6.6, 4), mesh(G_SPH, M.blue, knee, 0, 0, 0.3, 1.7, 1.7, 1.7), mesh(G_BOX, M.white, knee, 0, -3.2, 0, 4.1, 6, 4.5), mesh(G_BOX, M.red, knee, 0, -5.8, 1.3, 4.7, 1.9, 7.4));
    u.legs.push(leg); u.knees.push(knee);
  }
  const torso = u.torso = grp(body, 0, 14.6, 0);
  mesh(G_BOX, M.dark, torso, 0, 1.6, 0, 6, 3.2, 4.4);
  const chest = mesh(G_BOX, M.blue, torso, 0, 6.8, 0, 11.4, 8, 6.6);
  mesh(G_BOX, M.white, torso, 0, 8.4, 3.3, 8.4, 3.4, 0.7);
  for (const s of [-1, 1]) { const v = mesh(G_BOX, M.yellow, torso, s * 1.5, 8.4, 3.75, 0.9, 3.6, 0.4); v.rotation.z = s * 0.5; }
  u.coreM = mesh(G_SPH, core, torso, 0, 4.6, 3.2, 1.5, 1.5, 0.9);
  u.coreGlow = mesh(G_SPH, glow(0x9ff0ff, { transparent: true, opacity: 0.35, depthWrite: false }), torso, 0, 4.6, 3.6, 3, 3, 3); u.coreGlow.visible = false;
  mesh(G_BOX, M.dark, torso, 0, 11.4, 0, 2.6, 1.4, 2.6);
  const head = u.head = grp(torso, 0, 12, 0);
  Z.head.push(mesh(G_BOX, M.white, head, 0, 2.4, 0, 5, 4.7, 5));
  u.visorM = mesh(G_BOX, visor, head, 0, 2.7, 2.45, 4, 1.1, 0.5);
  mesh(G_BOX, M.red, head, 0, 0.7, 2.2, 2.2, 1.2, 1);
  for (const s of [-1, 1]) { const f = mesh(G_BOX, M.yellow, head, s * 1.7, 6.2, 1.9, 0.9, 5.2, 0.6); f.rotation.z = -s * 0.5; }
  mesh(G_BOX, M.yellow, head, 0, 5, 2.2, 1.4, 1.6, 0.8);
  u.arms = []; u.elbows = [];
  for (const s of [-1, 1]) {
    const zl = s < 0 ? Z.rarm : Z.larm;
    zl.push(mesh(G_BOX, M.white, torso, s * 7.7, 8.8, 0, 4.8, 4.2, 5.6));
    mesh(G_BOX, M.red, torso, s * 7.7, 9.4, 2.85, 3.4, 0.9, 0.3);
    const arm = grp(torso, s * 8, 8.2, 0), elbow = grp(arm, 0, -6.4, 0);
    zl.push(mesh(G_BOX, M.grey, arm, 0, -3.2, 0, 3, 6, 3.2), mesh(G_SPH, M.dark, elbow, 0, 0, 0, 1.5, 1.5, 1.5), mesh(G_BOX, M.white, elbow, 0, -2.9, 0, 3.5, 5.4, 3.7), mesh(G_BOX, M.red, elbow, 0, -6.6, 0, 3.9, 3.4, 4.1));
    u.arms.push(arm); u.elbows.push(elbow);
  }
  u.mats = Object.values(M); u.chestY = 19.2; u.mouth = new THREE.Vector3(0, 19.2, 3.5);
  shadowAll(root); u.coreGlow.castShadow = false;
  return u;
}
// ---------------------------------------------------------------------
// 大怪獣「超獣ドグラマグ」
// ---------------------------------------------------------------------
function makeKaiju() {
  const M = { body: toon(0x5b3a8c), dark: toon(0x3a2460), belly: toon(0x9be36d), bone: toon(0xf2ead8) };
  const spike = glow(0x2a9d94), eye = glow(0xffe066), root = new THREE.Group(), body = grp(root), Z = { rarm: [], larm: [], head: [], legs: [] }, u = { kind: 1, root, body, M, Z, spike, eye };
  const torso = u.torso = grp(body, 0, 12.5, 0);
  mesh(G_SPH, M.body, torso, 0, 1, 0, 8.2, 10.8, 8.6);
  mesh(G_SPH, M.belly, torso, 0, 0.2, 4.6, 5.8, 8.6, 4.6);
  u.spikes = [];
  for (let i = 0; i < 6; i++) { const a = i / 5, s = mesh(G_CONE, spike, torso, 0, 10.5 - a * 13, -4.2 - Math.sin(a * 3.1) * 4.6, 1.3 - a * 0.4, 5 - a * 2, 1.3 - a * 0.4); s.rotation.x = -0.9 - a * 0.7; u.spikes.push(s); }
  u.legs = []; u.knees = [];
  for (const s of [-1, 1]) {
    const leg = grp(body, s * 4.6, 8.6, 0.4), knee = grp(leg, 0, -5, 0);
    Z.legs.push(mesh(G_SPH, M.dark, leg, 0, -2.6, 0, 3.6, 5.4, 4.4), mesh(G_BOX, M.dark, knee, 0, -2.4, 1.6, 4.8, 2.4, 7.6));
    for (let i = -1; i <= 1; i++) mesh(G_CONE, M.bone, knee, i * 1.5, -2.8, 5.8, 0.6, 1.8, 0.6).rotation.x = 1.5;
    u.legs.push(leg); u.knees.push(knee);
  }
  u.tail = []; let par = grp(body, 0, 8, -6.4);
  for (let i = 0; i < 6; i++) {
    const r = 3.6 - i * 0.5; u.tail.push(par);
    Z.larm.push(mesh(G_SPH, i % 2 ? M.dark : M.body, par, 0, 0, -r * 0.7, r, r * 0.9, r * 1.3));
    if (i > 1) mesh(G_CONE, spike, par, 0, r * 0.9, -r * 0.6, 0.5, 1.6, 0.5);
    par = grp(par, 0, -0.9, -r * 1.5);
  }
  u.arms = []; u.elbows = [];
  for (const s of [-1, 1]) {
    const arm = grp(torso, s * 6.6, 4.4, 3.4), elbow = grp(arm, 0, -3.8, 0.6), zl = s < 0 ? Z.rarm : [];
    zl.push(mesh(G_SPH, M.dark, arm, 0, -1.8, 0.2, 1.7, 2.9, 1.8), mesh(G_SPH, M.body, elbow, 0, -1.6, 0.4, 1.5, 2.4, 1.6));
    for (let i = -1; i <= 1; i++) zl.push(mesh(G_CONE, M.bone, elbow, i * 0.8, -4, 1, 0.42, 2.4, 0.42)), zl[zl.length - 1].rotation.x = 2.9;
    u.arms.push(arm); u.elbows.push(elbow);
  }
  const head = u.head = grp(torso, 0, 10.6, 3.6);
  Z.head.push(mesh(G_SPH, M.body, head, 0, 0.6, 1.6, 4.6, 3.9, 5), mesh(G_BOX, M.body, head, 0, 0.5, 6, 4.4, 2.5, 5.2));
  const jaw = u.jaw = grp(head, 0, -1.2, 3);
  mesh(G_BOX, M.dark, jaw, 0, -0.5, 2.8, 4, 1.2, 5.8);
  for (let i = 0; i < 5; i++) { mesh(G_CONE, M.bone, jaw, -1.5, 0.5, 1.2 + i, 0.3, 0.9, 0.3); mesh(G_CONE, M.bone, jaw, 1.5, 0.5, 1.2 + i, 0.3, 0.9, 0.3); }
  for (const s of [-1, 1]) { mesh(G_SPH, eye, head, s * 2.6, 1.9, 4.6, 0.9, 0.6, 0.9); const h = mesh(G_CONE, M.bone, head, s * 2.4, 4.2, -0.6, 0.9, 4.4, 0.9); h.rotation.x = -0.7; h.rotation.z = -s * 0.25; }
  u.mouthGlow = mesh(G_SPH, glow(0xff5af0, { transparent: true, opacity: 0.6, depthWrite: false }), head, 0, -0.4, 9, 1, 1, 1); u.mouthGlow.visible = false;
  u.mats = Object.values(M); u.chestY = 22;
  shadowAll(root); u.mouthGlow.castShadow = false;
  return u;
}
const BROKEN = toon(0x55565f);
function poseGiant(u, g, T, G, t, rise) {
  const R = u.root, cine = G && G.sp && G.sp.phase !== 'prep';
  let down = g.downT > 0 ? clamp(Math.min(g.downT, 2.3 - g.downT) * 4, 0, 1) : 0;
  if (g.dead > 0) down = Math.min(1, g.dead * 2);
  let y = 0, zoff = 0;
  if (g.dodgeT > 0) { const p = clamp(1 - g.dodgeT / 1.5, 0, 1), s = Math.sin(p * Math.PI); y = s * 10; zoff = -s * 16; }
  R.position.set(ex(g.x), y - (1 - rise) * 40 - (g.dead > 0 ? Math.min(6, g.dead * 1.2) : 0), zoff);
  R.scale.setScalar(0.4 + 0.6 * rise);
  let yaw = g.face > 0 ? Math.PI / 2 - 0.55 : -Math.PI / 2 + 0.55;
  const stun = g.stunT > 0 || g.sysT > 0, moving = Math.abs(g.vx) > 5;
  const bob = Math.sin(t * 2.6 + u.kind) * 0.25 + (moving ? Math.abs(Math.sin(g.walk)) * 0.5 : 0);
  let ef = 0, eb = 0, lean = 0, spin = 0, guard = g.guarding ? 1 : 0, ch = g.charge || 0;
  if (g.atk) {
    const a = g.atk, d = a.def, p = a.t < d.wind ? -0.3 * (a.t / d.wind) : a.t < d.wind + d.act ? 1 : Math.max(0, 1 - (a.t - d.wind - d.act) / d.rec);
    if (a.type === 'weak') { ef = p; lean = Math.max(0, p) * 0.1; }
    else { eb = p; lean = Math.max(0, p) * 0.18; if (u.kind) spin = a.t < d.wind ? 0 : Math.min(1, (a.t - d.wind) / (d.act + d.rec * 0.6)); }
  }
  R.rotation.y = yaw + (u.kind ? spin * Math.PI * 2 * g.face : 0);
  u.body.rotation.x = -down * 1.45 + lean; u.body.position.y = bob + down * 3; u.body.rotation.z = stun && !down ? Math.sin(t * 6) * 0.05 : 0;
  const sw = moving ? Math.sin(g.walk) : 0;
  u.legs[0].rotation.x = -sw * 0.5; u.legs[1].rotation.x = sw * 0.5; u.knees[0].rotation.x = Math.max(0, sw) * 0.6; u.knees[1].rotation.x = Math.max(0, -sw) * 0.6;
  const A = u.arms, Eb = u.elbows, E1 = Math.max(0, ef), E2 = Math.max(0, eb);
  if (u.kind === 0) {
    u.torso.rotation.y = (E1 - E2) * 0.5 + (ef < 0 ? ef : 0) * 0.6 - (eb < 0 ? eb : 0) * 0.6;
    if (guard) { A[0].rotation.set(-1.9, 0, 0.55); A[1].rotation.set(-1.9, 0, -0.55); Eb[0].rotation.x = Eb[1].rotation.x = -1.7; }
    else if (ch > 0.05) { A[0].rotation.set(-1.45 * ch, 0, 0.25 * ch); A[1].rotation.set(-1.45 * ch, 0, -0.25 * ch); Eb[0].rotation.x = Eb[1].rotation.x = -0.2; }
    else {
      A[0].rotation.set(lerp(-0.25, -1.55, E1) + (ef < 0 ? -ef * 1.2 : 0) * 0.5 + sw * 0.3, 0, 0.12); Eb[0].rotation.x = lerp(-1.3, -0.05, E1);
      A[1].rotation.set(lerp(-0.25, -1.6, E2) + (eb < 0 ? -eb * 1.2 : 0) * 0.5 - sw * 0.3, 0, -0.12); Eb[1].rotation.x = lerp(-1.3, 0, E2);
    }
    u.visorM.material.color.set(stun ? 0xff5a4f : T && zoneOff(T, 'head') ? 0x555544 : 0x5cffb0);
    const cg = 0.55 + Math.sin(t * 5) * 0.2 + ch; u.coreM.material.color.setRGB(0.3 * cg, 0.9 * cg, cg);
    u.coreGlow.visible = ch > 0.1; u.coreGlow.scale.setScalar(2.5 + ch * 3 + Math.sin(t * 30) * 0.4);
  } else {
    u.torso.rotation.x = 0.16 + (guard ? 0.2 : 0) - (ch > 0.05 || cine ? 0.1 : 0);
    if (guard) { A[0].rotation.set(-1.6, 0, 0.5); A[1].rotation.set(-1.6, 0, -0.5); }
    else { A[0].rotation.set(lerp(-0.5, -1.9, E1) + (ef < 0 ? 0.5 : 0), 0, E1 * 0.4); A[1].rotation.set(-0.5 + Math.sin(t * 2) * 0.1, 0, 0); }
    Eb[0].rotation.x = lerp(-0.9, -0.1, E1); Eb[1].rotation.x = -0.9;
    const tw = Math.sin(t * 2 + 1) * 0.12 + (eb < 0 ? eb * 0.8 : 0);
    u.tail.forEach((s, i) => { s.rotation.y = tw * (0.5 + i * 0.25) + Math.sin(t * 3 + i) * 0.04; s.rotation.x = i === 0 ? -0.1 : 0.06 - E2 * 0.05; });
    u.jaw.rotation.x = ch > 0.05 ? 0.5 + Math.sin(t * 22) * 0.05 : 0.08 + Math.sin(t * 2) * 0.05 + E1 * 0.3;
    const sg = clamp(0.25 + g.sp / 220 + ch * 0.8 + (ch > 0.05 ? Math.sin(t * 25) * 0.2 : 0), 0.15, 1.2);
    u.spike.color.setRGB(0.25 * sg, 0.95 * sg, 0.88 * sg);
    u.eye.color.set(stun ? 0xffffff : 0xffe066);
    u.mouthGlow.visible = ch > 0.1; u.mouthGlow.scale.setScalar(1 + ch * 2.4 + Math.sin(t * 30) * 0.3);
  }
  const fl = g.fl > 0 ? 0.85 : 0;
  for (const m of u.mats) m.emissive.setScalar(fl);
  for (const z of ZKEYS) { const off = T && zoneOff(T, z); for (const m of u.Z[z]) { if (!m.userData.mat) m.userData.mat = m.material; m.material = off ? BROKEN : m.userData.mat; } }
  BROKEN.emissive.setScalar(fl);
}

// =====================================================================
// レンダラー本体
// =====================================================================
export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.autoClear = false;
  let pxW = 1, pxH = 1;
  const v3 = new THREE.Vector3();

  // ------------------------------------------------------------ 街
  const city = new THREE.Scene();
  const skyA = canvasTex(4, 256, (c, w, h) => { const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#1b1f4a'); g.addColorStop(0.55, '#c2577a'); g.addColorStop(1, '#ffb071'); c.fillStyle = g; c.fillRect(0, 0, w, h); });
  const skyB = canvasTex(4, 256, (c, w, h) => { const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#2a0b3d'); g.addColorStop(0.55, '#a8326e'); g.addColorStop(1, '#ff8a4c'); c.fillStyle = g; c.fillRect(0, 0, w, h); });
  city.background = skyA; city.fog = new THREE.Fog(0x8a4a72, 140, 360);
  city.add(new THREE.HemisphereLight(0xffe6d6, 0x5a5580, 2.1));
  const sun = new THREE.DirectionalLight(0xfff0dd, 2.0); sun.position.set(-50, 90, 60); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -100, right: 100, top: 70, bottom: -70, near: 10, far: 260 }); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.5; sun.shadow.camera.updateProjectionMatrix();
  city.add(sun); city.add(sun.target);
  mesh(new THREE.CircleGeometry(26, 40), glow(0xffe6aa, { fog: false }), city, 60, 30, -300);
  // 地面
  const PX = 8, groundTex = canvasTex(GW * CELL * PX, GH * CELL * PX, (c, w, h) => {
    c.fillStyle = '#565a70'; c.fillRect(0, 0, w, h);
    for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) { c.fillStyle = CITY.solid[j][i] ? '#8589a3' : ((i + j) % 2 ? '#5a5e76' : '#565a70'); c.fillRect(i * 32, j * 32, 32, 32); }
    const P = (x, z) => [(x + 80) * PX, (z + 48) * PX];
    for (const b of CITY.bases.slice(0, 4)) { const [x, y] = P(b.x - 12, b.z - 8); c.fillStyle = '#9aa1c4'; c.fillRect(x, y, 24 * PX, 16 * PX); c.strokeStyle = '#b4bbdc'; c.lineWidth = 2; for (let k = 0; k <= 24; k += 2) { c.beginPath(); c.moveTo(x + k * PX, y); c.lineTo(x + k * PX, y + 16 * PX); c.stroke(); } for (let k = 0; k <= 16; k += 2) { c.beginPath(); c.moveTo(x, y + k * PX); c.lineTo(x + 24 * PX, y + k * PX); c.stroke(); } }
    c.fillStyle = '#ffd23f'; for (let x = 0; x < w; x += 64) { c.fillRect(x, h / 2 - 2, 36, 4); }
    c.fillStyle = 'rgba(255,255,255,.55)'; for (const cx of [-52, -24, 24, 52]) for (let k = -7; k <= 7; k += 2) { const [x, y] = P(cx, k); c.fillRect(x - 10, y - 5, 20, 9); }
    const [gx, gy] = P(0, 0); c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = 4; c.beginPath(); c.arc(gx, gy, 7 * PX, 0, 7); c.stroke();
  });
  groundTex.anisotropy = 4;
  const ground = mesh(new THREE.PlaneGeometry(GW * CELL, GH * CELL), toon(0xffffff, { map: groundTex }), city); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
  const outer = mesh(new THREE.PlaneGeometry(900, 700), toon(0x2a2b38), city, 0, -0.06, 0); outer.rotation.x = -Math.PI / 2; outer.receiveShadow = true;
  // ビル
  const winTex = [0, 1, 2].map(s => {
    const lit = []; const mk = em => canvasTex(64, 64, (c) => {
      c.fillStyle = em ? '#000' : '#a9abba'; c.fillRect(0, 0, 64, 64); const n = s === 0 ? 4 : s === 1 ? 3 : 5, cw = 64 / n; let k = 0;
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { if (lit[k] === undefined) lit[k] = Math.random() < 0.55; const on = lit[k++]; c.fillStyle = em ? (on ? '#fff' : '#000') : (on ? '#fff3c0' : '#4a4c5e'); c.fillRect(x * cw + cw * 0.2, y * cw + cw * 0.22, cw * 0.6, cw * (s === 2 ? 0.34 : 0.56)); }
    });
    const a = mk(false), b = mk(true); for (const t of [a, b]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; } return [a, b];
  });
  function buildingGeo(w, h, d) {
    const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv;
    for (let f = 0; f < 6; f++) { const fw = f < 2 ? d : w, fh = f === 2 || f === 3 ? 0 : h; for (let v = 0; v < 4; v++) { const i = f * 4 + v; uv.setXY(i, uv.getX(i) * Math.max(1, Math.round(fw / 3.2)), fh ? uv.getY(i) * Math.max(1, Math.round(fh / 3.2)) : 0.01); } }
    return g;
  }
  const buildings = [];
  for (const b of CITY.buildings) {
    const col = new THREE.Color(b.col).multiplyScalar(1.9), side = toon(col, { map: winTex[b.style][0], emissive: 0xffe2a0, emissiveMap: winTex[b.style][1], emissiveIntensity: 0.75 });
    const roofMat = toon(new THREE.Color(b.col).multiplyScalar(1.5));
    const m = new THREE.Mesh(buildingGeo(b.w, b.h, b.d), [side, side, roofMat, roofMat, side, side]);
    const pivot = grp(city, b.x, 0, b.z); m.position.y = b.h / 2; pivot.add(m); m.castShadow = true; m.receiveShadow = true;
    buildings.push({ b, pivot, m, side, roofMat, op: 1, fall: 0, broken: false, front: b.z > 6, seed: Math.random() * 10 });
  }
  const skyline = grp(city);
  for (let i = 0; i < 40; i++) { const w = rnd(8, 18), h = rnd(14, 46); mesh(G_BOX, toon(0x4b3a64), skyline, -200 + i * 10.5 + rnd(-3, 3), h / 2, rnd(-70, -64), w, h, 10); }
  for (let i = 0; i < 16; i++) for (const s of [-1, 1]) { const h = rnd(10, 30); mesh(G_BOX, toon(0x4b3a64), skyline, s * rnd(92, 140), h / 2, rnd(-60, 30), rnd(8, 16), h, rnd(8, 16)); }
  // 拠点
  const baseObjs = CITY.bases.map((b, k) => {
    const g = grp(city, b.x, 0, b.z), o = { g };
    o.ring = mesh(new THREE.RingGeometry(b.r - 0.7, b.r, 48), glow(0xffffff, { transparent: true, opacity: 0.9, depthWrite: false }), g, 0, 0.08, 0); o.ring.rotation.x = -Math.PI / 2;
    o.fill = mesh(new THREE.CircleGeometry(b.r - 0.7, 40), glow(0xffffff, { transparent: true, opacity: 0.12, depthWrite: false }), g, 0, 0.06, 0); o.fill.rotation.x = -Math.PI / 2;
    o.prog = mesh(new THREE.RingGeometry(b.r - 1.9, b.r - 1, 40, 1, 0, 0.01), glow(0xffffff, { transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide }), g, 0, 0.1, 0); o.prog.rotation.x = -Math.PI / 2; o.cap = -1;
    const L = o.land = grp(city, b.x + (k === 4 ? -7 : 0), 0, b.z + (k === 4 ? -11 : -5.4)), wh = toon(0xf1f3fa);
    o.flag = toon(0xbfc4d6);
    if (k === 0) { mesh(G_BOX, wh, L, 0, 3, 0, 9, 6, 3.4); mesh(G_BOX, toon(0xe23b3b), L, 0, 4, 1.75, 0.9, 3, 0.2); mesh(G_BOX, toon(0xe23b3b), L, 0, 4, 1.75, 3, 0.9, 0.2); }
    if (k === 1) { mesh(G_BOX, wh, L, 0, 1.6, 0, 9, 3.2, 3.6); mesh(new THREE.SphereGeometry(2.8, 16, 10, 0, 6.3, 0, 1.6), toon(0x8fd8ff), L, 0, 3.2, 0); mesh(G_CYL, toon(0xdddddd), L, 3.4, 5, 0, 0.12, 4, 0.12); }
    if (k === 2) { for (const s of [-1, 1]) { const t = mesh(new THREE.CylinderGeometry(1.5, 2.3, 6.5, 14), wh, L, s * 2.6, 3.25, 0); t.castShadow = true; } mesh(G_BOX, toon(0xffd23f), L, 0, 1, 1.9, 1.6, 2, 0.3); }
    if (k === 3) { mesh(G_BOX, toon(0xb9774d), L, 0, 2.2, 0, 9.5, 4.4, 3.6); for (const s of [-1, 0, 1]) mesh(G_CYL, toon(0x8a8d99), L, s * 2.8, 6, -0.4, 0.55, 3.6, 0.55); }
    if (k === 4) { mesh(new THREE.CylinderGeometry(0.5, 1.6, 22, 8), toon(0xe23b3b), L, 0, 11, 0); mesh(G_CYL, wh, L, 0, 14, 0, 2.2, 1.6, 2.2); mesh(G_CYL, toon(0xdddddd), L, 0, 25, 0, 0.12, 6, 0.12); mesh(G_SPH, glow(0xff5a4f), L, 0, 28, 0, 0.4, 0.4, 0.4); }
    mesh(G_CYL, toon(0xdddddd), g, k === 4 ? 0 : -6.2, 2.6, k === 4 ? 0 : 5.6, 0.1, 5.2, 0.1); o.flagM = mesh(G_BOX, o.flag, g, (k === 4 ? 0 : -6.2) + 1, 4.6, k === 4 ? 0 : 5.6, 2, 1.2, 0.08);
    shadowAll(L); return o;
  });
  // ゴール（シェルター・ダークゲート）
  const goalObjs = CITY.goals.map((gl, t) => {
    const g = grp(city, gl.x, 0, gl.z), col = t ? 0xc26bff : 0x4fd1ff;
    const ring = mesh(new THREE.RingGeometry(gl.r - 0.6, gl.r, 40), glow(col, { transparent: true, opacity: 0.9, depthWrite: false }), g, 0, 0.09, 0); ring.rotation.x = -Math.PI / 2;
    const fill = mesh(new THREE.CircleGeometry(gl.r - 0.6, 36), glow(col, { transparent: true, opacity: 0.22, depthWrite: false }), g, 0, 0.07, 0); fill.rotation.x = -Math.PI / 2;
    let spin = null;
    if (t === 0) { mesh(new THREE.SphereGeometry(3.4, 18, 10, 0, 6.3, 0, 1.58), toon(0x8fa5c9), g, -1.5, 0, 0); mesh(G_BOX, glow(0x4fd1ff), g, 1.8, 1.2, 0, 0.3, 2.2, 2); }
    else { spin = mesh(new THREE.TorusGeometry(3.4, 0.55, 10, 28), toon(0x6a2fa8), g, 1.2, 4, 0); spin.rotation.y = Math.PI / 2; mesh(new THREE.CircleGeometry(3.1, 24), glow(0x240a3c, { side: THREE.DoubleSide }), g, 1.2, 4, 0).rotation.y = Math.PI / 2; }
    shadowAll(g); ring.castShadow = fill.castShadow = false; return { g, spin };
  });
  // 前半戦のキャラ
  const p1Figs = [], p1Marks = [];
  for (let s = 0; s < 8; s++) { const f = makeFigure(SLOT_COL[s], s < 4 ? 0 : 1); f.scale.setScalar(1.15); city.add(f); shadowAll(f); f.userData.shadow.castShadow = false; p1Figs.push(f); const mk = mesh(new THREE.RingGeometry(1.25, 1.6, 24), glow(0xffc531, { transparent: true, opacity: 0.95, depthWrite: false }), city); mk.rotation.x = -Math.PI / 2; mk.visible = false; p1Marks.push(mk); }
  const citPool = []; for (let i = 0; i < 24; i++) { const c = makeCitizen(); c.visible = false; city.add(c); citPool.push(c); }
  // 巨人
  const giants = [makeRobot(), makeKaiju()]; for (const u of giants) { city.add(u.root); u.root.visible = false; }
  // ミサイル・光線・群衆
  const misPool = []; for (let i = 0; i < 8; i++) { const g = grp(city); g.userData.body = mesh(G_CYL, toon(0xffffff), g, 0, 0, 0, 0.5, 2.6, 0.5); g.userData.body.rotation.z = -Math.PI / 2; g.userData.tip = mesh(G_CONE, toon(0xffffff), g, 1.8, 0, 0, 0.5, 1.1, 0.5); g.userData.tip.rotation.z = -Math.PI / 2; g.userData.blob = mesh(G_SPH, toon(0xffffff), g, 0, 0, 0, 1, 1, 1); g.visible = false; misPool.push(g); }
  const beamGeo = new THREE.CylinderGeometry(1, 1, 1, 14, 1, true); beamGeo.rotateZ(Math.PI / 2);
  const beamIn = mesh(beamGeo, glow(0xffffff, { fog: false }), city), beamOut = mesh(beamGeo, glow(0x6ee6ff, { transparent: true, opacity: 0.45, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }), city); beamIn.visible = beamOut.visible = false;
  const crowd = new THREE.InstancedMesh(G_BOX, toon(0xffffff), 40); crowd.instanceMatrix.setUsage(THREE.DynamicDrawUsage); crowd.frustumCulled = false; city.add(crowd);
  const crowdP = []; for (let i = 0; i < 40; i++) { crowdP.push({ x: rnd(-78, 78), z: rnd(5.5, 7.6), sp: rnd(3, 7), dir: Math.random() < 0.5 ? -1 : 1, ph: rnd(0, 6) }); crowd.setColorAt(i, new THREE.Color(pick(CIT_COL))); }
  const pCity = new Particles(city, 600);
  const camC = new THREE.PerspectiveCamera(40, 16 / 9, 1, 900);
  const camState = { x: 0, z: 0, zoom: 1 };

  // ------------------------------------------------------------ 機体内部
  const intScene = new THREE.Scene(); intScene.background = new THREE.Color(0x0b0d18);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x444466, 1.7); intScene.add(hemi);
  const iSun = new THREE.DirectionalLight(0xffffff, 1.6); iSun.position.set(-10, 30, 16); intScene.add(iSun);
  const camI = new THREE.PerspectiveCamera(33, W / (H - EXT_H), 1, 200); camI.position.set(0, 33, 21); camI.lookAt(0, 0, 2.1);
  const pInt = new Particles(intScene, 400);
  const ITEM_COL = [{ coal: 0x1b1b20, mN: 0xff5a4f, mH: 0x3fa9ff, mS: 0xffd23f }, { coal: 0x6a2fd6, mN: 0x9be36d, mH: 0x3fe0d0, mS: 0xffd23f }];
  function makeItem(team) {
    const g = new THREE.Group(), u = { t: null };
    u.coal = mesh(team ? G_ICO : G_DOD, team ? glow(0x9b5cff) : toon(0x26262c), g, 0, 0, 0, 0.5, 0.5, 0.5);
    if (!team) mesh(G_BOX, glow(0xff8a3c), u.coal, 0.5, 0.3, 0.6, 0.35, 0.35, 0.35);
    u.mis = grp(g); u.mat = toon(0xffffff);
    if (team) mesh(G_SPH, u.mat, u.mis, 0, 0, 0, 0.42, 0.55, 0.42); else { mesh(G_CYL, u.mat, u.mis, 0, 0, 0, 0.26, 1.1, 0.26); mesh(G_CONE, toon(0xffffff), u.mis, 0, 0.8, 0, 0.26, 0.5, 0.26); }
    g.userData = u; return g;
  }
  function setItem(o, team, t) { const u = o.userData; if (u.t === t) return; u.t = t; u.coal.visible = t === 'coal'; u.mis.visible = t !== 'coal'; if (t !== 'coal') u.mat.color.set(ITEM_COL[team][t]); }
  function makeInterior(team) {
    const k = team, root = new THREE.Group(), o = { root, team };
    const C = k ? { floor: '#3b1f3c', line: 'rgba(255,140,200,.10)', wall: 0x7a3460, wall2: 0x9c4a7c, base: 0x55284c, metal: 0x8a4a78, acc: 0xff7ac8, dark: 0x2c1530 }
      : { floor: '#1f2638', line: 'rgba(255,255,255,.06)', wall: 0x3a4560, wall2: 0x56627f, base: 0x2a3148, metal: 0x6a7bb0, acc: 0x7fd6ff, dark: 0x161a2c };
    const ftex = canvasTex(1232, 376, (c, w, h) => {
      c.fillStyle = C.floor; c.fillRect(0, 0, w, h); c.strokeStyle = C.line; c.lineWidth = 2;
      for (let x = 0; x < w; x += 40) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); } for (let y = 0; y < h; y += 40) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
      c.strokeStyle = k ? 'rgba(255,90,160,.22)' : 'rgba(80,200,255,.16)'; c.lineWidth = 12; c.beginPath(); c.moveTo(ST.reactor.x - 24, ST.reactor.y - 22); c.lineTo(ST.seat.x - 24, ST.seat.y + 8); c.lineTo(ST.launcher.x - 24, ST.launcher.y - 22); c.stroke();
      c.setLineDash([10, 8]); c.lineWidth = 2; c.strokeStyle = k ? 'rgba(255,170,220,.3)' : 'rgba(140,170,255,.28)';
      for (const z of ZKEYS) { const Z = ZONES[z]; c.strokeRect(Z.x - 22, Z.y - 20, Z.w - 4, Z.h - 4); }
    });
    const floor = mesh(new THREE.PlaneGeometry(1232 * IS, 376 * IS), toon(0xffffff, { map: ftex }), root, 0, 0, 0); floor.rotation.x = -Math.PI / 2;
    o.zones = {}; for (const z of ZKEYS) { const Z = ZONES[z], m = mesh(new THREE.PlaneGeometry(Z.w * IS - 0.2, Z.h * IS - 0.2), glow(0xff4638, { transparent: true, opacity: 0.2, depthWrite: false }), root, ix(Z.x + Z.w / 2), 0.03, iz(Z.y + Z.h / 2)); m.rotation.x = -Math.PI / 2; m.visible = false; o.zones[z] = m; }
    const wm = toon(C.wall), wm2 = toon(C.wall2), hw = 1232 * IS / 2, hd = 376 * IS / 2;
    mesh(G_BOX, wm, root, 0, 0.9, -hd - 0.3, hw * 2 + 1.2, 1.8, 0.6); mesh(G_BOX, wm, root, 0, 0.35, hd + 0.3, hw * 2 + 1.2, 0.7, 0.6); mesh(G_BOX, wm, root, -hw - 0.3, 0.6, 0, 0.6, 1.2, hd * 2); mesh(G_BOX, wm, root, hw + 0.3, 0.6, 0, 0.6, 1.2, hd * 2);
    for (const w of WALLS) mesh(G_BOX, wm2, root, ix(w.x + w.w / 2), 0.7, iz(w.y + w.h / 2), w.w * IS, 1.4, w.h * IS);
    const S = (key) => grp(root, ix(ST[key].x), 0, iz(ST[key].y)), base = toon(C.base), metal = toon(C.metal), dark = toon(C.dark);
    // 操縦席 / 脳
    let s = S('seat');
    if (!k) { mesh(G_CYL, base, s, 0, 0.2, 0, 1.6, 0.4, 1.6); o.chair = grp(s, 0, 0.4, 0); mesh(G_BOX, metal, o.chair, 0, 0.35, 0, 1.5, 0.5, 1.4); mesh(G_BOX, metal, o.chair, 0, 1.2, 0.65, 1.5, 1.8, 0.3); mesh(G_BOX, dark, s, 0, 0.9, -1.7, 3, 1.4, 0.5); mesh(G_BOX, glow(0x5cffb0), s, 0, 1.1, -1.43, 2.4, 0.8, 0.06); }
    else { o.chair = grp(s, 0, 0, 0); const br = toon(0xff9fc8); for (const [x, y, z, r] of [[-0.7, 0.8, 0, 1], [0.7, 0.8, 0, 1], [0, 0.9, -0.6, 0.95], [0, 0.85, 0.55, 0.9], [-0.5, 1.3, -0.2, 0.7], [0.5, 1.3, 0.2, 0.7]]) mesh(G_SPH, br, o.chair, x, y, z, r, r * 0.85, r); }
    // 交代レバー
    s = S('lever'); mesh(G_BOX, base, s, 0, 0.3, 0, 0.9, 0.6, 0.9); o.lever = grp(s, 0, 0.5, 0); mesh(G_CYL, toon(0xcfd6ff), o.lever, 0, 0.8, 0, 0.09, 1.6, 0.09); mesh(G_SPH, toon(k ? 0xff5af0 : 0xff5a4f), o.lever, 0, 1.7, 0, 0.3, 0.3, 0.3);
    // 動力炉 / 心臓
    s = S('reactor'); o.coreMat = glow(0xffb347);
    if (!k) { mesh(G_CYL, base, s, 0, 1, 0, 2.7, 2, 2.7); mesh(G_CYL, metal, s, 0, 2.05, 0, 2.9, 0.2, 2.9); o.core = mesh(G_SPH, o.coreMat, s, 0, 2.3, 0, 1.7, 1.2, 1.7); for (let a = 0; a < 4; a++) mesh(G_CYL, metal, s, Math.cos(a * 1.57 + 0.8) * 2.3, 1.5, Math.sin(a * 1.57 + 0.8) * 2.3, 0.3, 3, 0.3); }
    else { mesh(G_CYL, base, s, 0, 0.3, 0, 2.7, 0.6, 2.7); o.core = mesh(G_SPH, o.coreMat, s, 0, 2.1, 0, 2, 2, 2); for (let a = 0; a < 3; a++) mesh(G_CYL, toon(0x8a2b4c), s, Math.cos(a * 2.1) * 1.6, 3.2, Math.sin(a * 2.1) * 1.6, 0.4, 2, 0.4).rotation.z = Math.cos(a * 2.1) * 0.5; }
    o.reLight = new THREE.PointLight(0xff8844, 6, 12); o.reLight.position.set(ix(ST.reactor.x), 5, iz(ST.reactor.y)); root.add(o.reLight);
    // 石炭置き場 / ダークマター
    s = S('coal'); mesh(G_BOX, toon(k ? 0x3a1f4a : 0x3b3328), s, 0, 0.4, 0, 3.6, 0.8, 2.8);
    for (let i = 0; i < 10; i++) { const m = mesh(k ? G_ICO : G_DOD, k ? glow(i % 2 ? 0x9b5cff : 0x6a2fd6) : toon(0x222227), s, rnd(-1.3, 1.3), 0.95 + (i % 3) * 0.3, rnd(-1, 1), 0.45, 0.45, 0.45); m.rotation.set(i, i * 2, 0); }
    // 脱出ポッド / 排出口
    s = S('pod'); o.podMat = glow(0x4a5577); mesh(G_CYL, base, s, 0, 0.15, 0, 1.9, 0.3, 1.9); const pr = mesh(new THREE.TorusGeometry(1.75, 0.22, 8, 28), o.podMat, s, 0, 0.35, 0); pr.rotation.x = Math.PI / 2;
    if (!k) { mesh(new THREE.SphereGeometry(1.4, 14, 8, 0, 6.3, 0, 1.58), metal, s, 0, 0.3, 0); } else mesh(G_CYL, dark, s, 0, 0.32, 0, 1.4, 0.06, 1.4);
    // 装填口 / 毒腺
    s = S('launcher');
    if (!k) mesh(G_BOX, base, s, 0, 0.7, 0, 3.6, 1.4, 3.6); else mesh(G_SPH, toon(0x4a8a3a), s, 0, 0.9, 0, 2.1, 1.3, 2.1);
    o.tubes = []; o.alarmMat = glow(0x4a5577); mesh(G_BOX, o.alarmMat, s, 0, 1.5, -1.5, 3.2, 0.2, 0.2);
    for (let i = 0; i < 3; i++) { mesh(G_CYL, dark, s, (i - 1) * 1.1, 1.45, 0.2, 0.42, 0.14, 0.42); const it = makeItem(k); it.position.set((i - 1) * 1.1, 2.1, 0.2); it.visible = false; s.add(it); o.tubes.push(it); }
    // 弾薬箱
    for (const key of ['crateN', 'crateH', 'crateS']) {
      s = S(key); const col = ITEM_COL[k][ST[key].item];
      mesh(G_BOX, base, s, 0, 0.6, 0, 3, 1.2, 2.4); mesh(G_BOX, glow(col), s, 0, 1.22, 0, 3.05, 0.08, 2.45);
      for (let i = -1; i <= 1; i++) { const it = makeItem(k); setItem(it, k, ST[key].item); it.position.set(i * 0.8, 1.55, 0); it.rotation.x = k ? 0 : 1.3; s.add(it); }
    }
    // 必殺技コンソール
    o.cons = {};
    CON.forEach((key, i) => {
      s = S(key); const m = glow(0x4a5577); mesh(G_BOX, base, s, 0, 0.6, 0, 2.2, 1.2, 1.8);
      if (k) mesh(G_SPH, m, s, 0, 1.7, 0, 0.75, 0.75, 0.75);
      else if (i === 0) mesh(G_CYL, m, s, 0, 1.35, 0, 0.7, 0.3, 0.7); else if (i === 1) { const t = mesh(new THREE.TorusGeometry(0.7, 0.16, 8, 20), m, s, 0, 1.6, 0); t.rotation.x = Math.PI / 2; mesh(G_CYL, m, s, 0, 1.4, 0, 0.12, 0.5, 0.12); } else { const l = mesh(G_BOX, m, s, 0, 1.75, 0, 0.2, 1.3, 0.2); l.rotation.z = 0.5; }
      o.cons[key] = m;
    });
    // 回避スラスター / 硬質化腺
    s = S('thruster'); o.thrMat = glow(0x3d5a66); mesh(G_CYL, base, s, 0, 0.4, 0, 1.9, 0.8, 1.9);
    o.fan = grp(s, 0, 1, 0);
    if (!k) for (let i = 0; i < 4; i++) { const b = mesh(G_BOX, o.thrMat, o.fan, 0, 0, 0, 3, 0.12, 0.5); b.rotation.y = i * Math.PI / 4; }
    else for (let i = 0; i < 5; i++) { const b = mesh(G_CONE, o.thrMat, o.fan, Math.cos(i * 1.26) * 0.8, 0.5, Math.sin(i * 1.26) * 0.8, 0.5, 1.8 + (i % 2) * 0.6, 0.5); b.rotation.z = -Math.cos(i * 1.26) * 0.4; b.rotation.x = Math.sin(i * 1.26) * 0.4; }
    // 必殺チャージャー（空き時間に連打）
    s = S('charger'); mesh(G_CYL, base, s, 0, 0.4, 0, 1.5, 0.8, 1.5); o.chgMat = glow(0xffd23f);
    o.chgBar = mesh(G_CYL, o.chgMat, s, 0, 1.2, 0, 0.9, 0.8, 0.9);
    o.pump = grp(s, 0, 1.7, 0); mesh(G_CYL, metal, o.pump, 0, 0.5, 0, 0.12, 1.2, 0.12); mesh(G_BOX, toon(k ? 0xff5af0 : 0xff5a4f), o.pump, 0, 1.1, 0, 1.4, 0.25, 0.3);
    // 乗組員・アイテム・トラブル
    o.crew = []; o.marks = []; o.carry = [];
    for (let i = 0; i < 4; i++) {
      const f = makeFigure(SLOT_COL[team * 4 + i], team); root.add(f); o.crew.push(f);
      const mk = mesh(new THREE.RingGeometry(0.95, 1.25, 24), glow(0xffc531, { transparent: true, opacity: 0.95, depthWrite: false }), root); mk.rotation.x = -Math.PI / 2; mk.visible = false; o.marks.push(mk);
      const it = makeItem(k); it.visible = false; root.add(it); o.carry.push(it);
    }
    o.items = []; for (let i = 0; i < 12; i++) { const it = makeItem(k); it.visible = false; root.add(it); o.items.push(it); }
    o.troubles = [];
    for (let i = 0; i < 5; i++) {
      const g = grp(root), u = {}; g.visible = false;
      u.fire = grp(g); u.cones = []; for (let j = 0; j < 3; j++) u.cones.push(mesh(G_CONE, glow(k ? [0x9be36d, 0x6a2fd6, 0xc9ff8a][j] : [0xff6f3c, 0xffb347, 0xffe066][j]), u.fire, (j - 1) * 0.55, 0.9, (j % 2) * 0.4, 0.7 - j * 0.12, 1.8, 0.7 - j * 0.12));
      u.glow = mesh(new THREE.CircleGeometry(1.7, 20), glow(k ? 0x9be36d : 0xff7a2a, { transparent: true, opacity: 0.3, depthWrite: false }), u.fire, 0, 0.05, 0); u.glow.rotation.x = -Math.PI / 2;
      u.cable = grp(g); const cm = toon(k ? 0xff9fc8 : 0xffd23f); const a = mesh(G_CYL, cm, u.cable, -0.95, 0.25, 0, 0.14, 1.3, 0.14); a.rotation.z = 1.35; const b = mesh(G_CYL, cm, u.cable, 0.95, 0.3, 0.1, 0.14, 1.3, 0.14); b.rotation.z = -1.25;
      mesh(new THREE.CircleGeometry(1.3, 16), glow(0x9ad8ff, { transparent: true, opacity: 0.22, depthWrite: false }), u.cable, 0, 0.05, 0).rotation.x = -Math.PI / 2;
      g.userData = u; o.troubles.push(g);
    }
    o.tiltA = 0; return o;
  }
  const interiors = [makeInterior(0), makeInterior(1)]; for (const o of interiors) { intScene.add(o.root); o.root.visible = false; }

  // ------------------------------------------------------------ 状態
  let shakeC = 0, shakeI = 0, time = 0, riseT = [1, 1], lastPhase = '', viewTeam = 0;
  const titleG = [{ x: 330, face: 1, hp: 100, sp: 30, walk: 0, vx: 0, charge: 0, downT: 0, stunT: 0, sysT: 0, dodgeT: 0, dead: 0, fl: 0, atk: null, guarding: false }, { x: 670, face: -1, hp: 100, sp: 60, walk: 0, vx: 0, charge: 0, downT: 0, stunT: 0, sysT: 0, dodgeT: 0, dead: 0, fl: 0, atk: null, guarding: false }];
  function resetCity() { for (const b of buildings) { b.broken = false; b.fall = 0; b.pivot.scale.y = 1; b.pivot.rotation.z = 0; b.pivot.visible = true; } }

  function setCam(cam, px, py, pz, tx, ty, tz, shake) {
    cam.position.set(px + (shake ? rnd(-shake, shake) * 0.06 : 0), py + (shake ? rnd(-shake, shake) * 0.06 : 0), pz); cam.lookAt(tx, ty, tz); cam.updateMatrixWorld();
  }
  function syncP1(G, view, dt, show) {
    const P = G && G.p1;
    for (let s = 0; s < 8; s++) {
      const f = p1Figs[s], mk = p1Marks[s]; f.visible = !!(show && P); mk.visible = false; if (!f.visible) continue;
      const c = P.chars[s]; f.position.set(c.x, 0, c.z); f.rotation.y = c.fa;
      const sp = Math.hypot(c.vx || 0, c.vz || 0), lx = f.userData.lx === undefined ? c.x : f.userData.lx, lz = f.userData.lz === undefined ? c.z : f.userData.lz;
      f.userData.walk = (f.userData.walk || 0) + Math.hypot(c.x - lx, c.z - lz) * 1.4; f.userData.lx = c.x; f.userData.lz = c.z;
      poseFigure(f, f.userData.walk, c.carry >= 0, c.punchT, c.stun > 0, time);
      f.rotation.z = c.stun > 0 ? 1.2 : 0; f.position.y = c.stun > 0 ? 0.5 : 0;
      f.scale.setScalar(P.hen[c.team] ? 1.3 : 1.15);
      if (view.locals.includes(s)) { mk.visible = true; mk.position.set(c.x, 0.12, c.z); mk.material.color.set(SLOT_COL[s]); }
    }
    let n = 0;
    if (show && P) for (const c of P.cits) {
      if (n >= citPool.length) break; const o = citPool[n++], u = o.userData; o.visible = true;
      u.mat.color.set(c.type ? 0xffd23f : CIT_COL[c.id % CIT_COL.length]); u.hat.visible = !!c.type;
      let y = c.y || 0, rz = 0;
      if (c.state === 'held') { y = 2.9; rz = 1.57; const ch = P.chars.find(h => h.carry === c.id); if (ch) { o.position.set(ch.x, y, ch.z); o.rotation.set(0, ch.fa, rz); o.scale.setScalar(c.type ? 1.25 : 1.05); continue; } }
      if (c.state === 'air') rz = time * 12;
      const hop = c.state === 'free' && !(c.dizzy > 0) ? Math.abs(Math.sin(time * 9 + c.id)) * 0.25 : 0;
      o.position.set(c.x, y + hop, c.z); o.rotation.set(0, 0, c.dizzy > 0 ? 1.4 : rz); o.scale.setScalar(c.type ? 1.25 : 1.05);
    }
    for (; n < citPool.length; n++) citPool[n].visible = false;
    baseObjs.forEach((o, k) => {
      o.ring.visible = o.fill.visible = o.prog.visible = !!(show && P); const own = P ? P.bases[k].own : -1, col = own < 0 ? 0xdfe3f5 : own ? 0xc26bff : 0x4fd1ff;
      o.ring.material.color.set(col); o.fill.material.color.set(col); o.fill.material.opacity = own < 0 ? 0.1 : 0.24; o.flag.color.set(own < 0 ? 0xbfc4d6 : col);
      o.flagM.rotation.y = Math.sin(time * 3 + k) * 0.3;
      if (P && show) {
        const b = P.bases[k], cap = Math.round(b.cap * 40) / 40;
        if (cap !== o.cap) { o.cap = cap; o.prog.geometry.dispose(); o.prog.geometry = new THREE.RingGeometry(b.r - 1.9, b.r - 1, 40, 1, Math.PI / 2, -Math.max(0.001, cap * Math.PI * 2)); }
        o.prog.material.color.set(b.capTeam ? 0xc26bff : 0x4fd1ff); o.prog.visible = cap > 0;
      }
    });
    goalObjs.forEach((o, t) => { if (o.spin) o.spin.rotation.x = time * 1.5; });
  }
  function syncGiants(G, t, dt) {
    for (let k = 0; k < 2; k++) {
      const u = giants[k]; let g, T = null, rise = 1;
      if (G && G.teams && G.phase !== 'p1') { T = G.teams[k]; g = T.g; if (G.phase === 'trans') { const first = G.tr.loser < 0 ? 0 : G.tr.loser, start = k === first ? 6.6 : 5.0; rise = ease(clamp((start - G.tr.t) / 1.6, 0, 1)); } }
      else if (!G) g = titleG[k];
      u.root.visible = !!g && rise > 0.001; if (!u.root.visible) { riseT[k] = 0; continue; }
      if (rise > 0.01 && riseT[k] <= 0.01) { pCity.burst(ex(g.x), 1, 0, 60, ['#8d8f9e', '#b9bbc9', '#6d6f7e'], 26, 3.2, 'dust', 6); shakeC = Math.max(shakeC, 26); }
      riseT[k] = rise; poseGiant(u, g, T, G, t, rise);
      if (T && Math.random() < 0.5 && (G.phase === 'p2' || G.phase === 'escape')) {
        const pts = { rarm: [-2, 20], larm: u.kind ? [-10, 8] : [2, 20], head: [0, 28], legs: [0, 6] };
        for (const z of ZKEYS) if (zoneOff(T, z)) { const p = pts[z]; pCity.add(ex(g.x) + p[0] * g.face * (z === 'larm' && u.kind ? 1 : 0.3) + rnd(-1.5, 1.5), p[1] + rnd(-1, 1), 3 + rnd(-2, 2), rnd(-1, 1), rnd(4, 8), rnd(-1, 1), 0.7, rnd(1, 1.8), pick(u.kind ? ['#9be36d', '#6a2fd6'] : ['#ff9a3c', '#ffd23f', '#ff5a4f']), 'fire'); }
        if (g.dead > 0) pCity.add(ex(g.x) + rnd(-8, 8), rnd(2, 14), rnd(-3, 5), rnd(-2, 2), rnd(5, 10), rnd(-2, 2), 1, rnd(1.5, 3), pick(['#59586a', '#ff6f3c', '#3a3a48']), 'fire');
      }
    }
  }
  function syncExteriorFx(G, dt) {
    let n = 0;
    if (G && G.missiles) for (const m of G.missiles) {
      if (n >= misPool.length) break; const o = misPool[n++], u = o.userData; o.visible = true;
      o.position.set(ex(m.x), m.y * XS, 2.5); const col = ITEM_COL[m.team][m.t];
      u.body.visible = u.tip.visible = !m.team; u.blob.visible = !!m.team; u.body.material.color.set(col); u.blob.material.color.set(col);
      o.rotation.set(0, 0, Math.atan2(m.vy, m.vx)); o.rotation.y = 0;
      if (m.vx < 0) { o.rotation.z = Math.atan2(m.vy, -m.vx); o.rotation.y = Math.PI; }
      if (Math.random() < 0.8) pCity.add(o.position.x, o.position.y, 2.5, rnd(-1, 1), rnd(-1, 1), rnd(-1, 1), 0.4, rnd(0.5, 0.9), m.team ? '#c9ff8a' : '#e6e8f2', 'dust');
    }
    for (; n < misPool.length; n++) misPool[n].visible = false;
    // 光線
    let beam = null;
    if (G && G.sp && G.sp.phase === 'fire') { const A = G.teams[G.sp.team], D = G.teams[1 - G.sp.team]; beam = { from: A, to: D, miss: G.sp.out === 'dodge', col: A.id ? 0xff5af0 : 0x6ee6ff }; }
    else if (G && G.phase === 'escape' && G.esc.t < 1.6) { const A = G.teams[1 - G.esc.loser], D = G.teams[G.esc.loser]; beam = { from: A, to: D, miss: false, col: A.id ? 0xff5af0 : 0x6ee6ff }; }
    beamIn.visible = beamOut.visible = !!beam;
    if (beam) {
      const u = giants[beam.from.id], x0 = ex(beam.from.g.x) + beam.from.g.face * 4, x1 = beam.miss ? x0 + beam.from.g.face * 200 : ex(beam.to.g.x), y = u.chestY, len = Math.abs(x1 - x0), w = 1.3 + Math.sin(time * 40) * 0.3;
      beamIn.position.set((x0 + x1) / 2, y, 2.5); beamIn.scale.set(len, w, w); beamOut.position.copy(beamIn.position); beamOut.scale.set(len, w * 2.4, w * 2.4); beamOut.material.color.set(beam.col);
      pCity.add(x0 + rnd(-1, 1), y + rnd(-1, 1), 3, beam.from.g.face * rnd(10, 30), rnd(-6, 6), rnd(-6, 6), 0.4, rnd(0.6, 1.2), beam.from.id ? '#ffb3f8' : '#c9f2ff', 'spark');
    }
  }
  function syncCrowd(G, dt, show) {
    crowd.visible = show; if (!show) return; const d = pCity.d;
    const gx = G && G.teams ? [ex(G.teams[0].g.x), ex(G.teams[1].g.x)] : [-27, 27];
    crowdP.forEach((p, i) => {
      for (const x of gx) if (Math.abs(p.x - x) < 26) p.dir = Math.sign(p.x - x) || 1;
      p.x += p.dir * p.sp * dt; p.ph += dt * 12; if (p.x < -84) p.x = 84; if (p.x > 84) p.x = -84;
      d.position.set(p.x, 0.45 + Math.abs(Math.sin(p.ph)) * 0.15, p.z); d.scale.set(0.34, 0.9, 0.34); d.rotation.set(0, 0, 0); d.updateMatrix(); crowd.setMatrixAt(i, d.matrix);
    });
    crowd.instanceMatrix.needsUpdate = true;
  }
  function syncBuildings(mode, dt) {
    for (const b of buildings) {
      b.pivot.visible = !(mode === 'side' && b.front);
      const tgt = mode === 'top' && b.b.z - b.b.d / 2 > camState.z + 1 && Math.abs(b.b.x - camState.x) < 46 * camState.zoom ? 0.16 : 1;
      if (b.op !== tgt) { b.op = Math.abs(b.op - tgt) < 0.02 ? tgt : lerp(b.op, tgt, Math.min(1, dt * 8)); const tr = b.op < 0.99; for (const mt of [b.side, b.roofMat]) { if (mt.transparent !== tr) { mt.transparent = tr; mt.depthWrite = !tr; mt.needsUpdate = true; } mt.opacity = b.op; } b.m.castShadow = !tr; }
      if (b.broken && b.fall < 1) { b.fall = Math.min(1, b.fall + dt * 1.6); b.pivot.scale.y = 1 - b.fall * 0.72; b.pivot.rotation.z = Math.sin(b.seed) * 0.1 * b.fall; if (Math.random() < 0.6) pCity.add(b.b.x + rnd(-b.b.w, b.b.w) / 2, b.b.h * (1 - b.fall) * 0.6, b.b.z + b.b.d / 2, rnd(-3, 3), rnd(1, 5), rnd(0, 4), 1.2, rnd(1.5, 3), pick(['#8d8f9e', '#6d6f7e']), 'dust'); }
    }
  }
  function syncInterior(G, team, view, dt) {
    const o = interiors[team], T = G.teams[team], k = team, sp = G.sp;
    interiors[0].root.visible = team === 0; interiors[1].root.visible = team === 1;
    const target = T.tilt ? -T.tilt.dir * 0.23 : 0; o.tiltA = lerp(o.tiltA, target, Math.min(1, dt * 7)); o.root.rotation.z = o.tiltA;
    const esc = G.phase === 'escape' && G.esc.loser === team;
    hemi.color.set(esc ? (Math.sin(time * 10) > 0 ? 0xff7766 : 0xffb0a0) : k ? 0xffd9ee : 0xffffff);
    for (const z of ZKEYS) { const m = o.zones[z], off = zoneOff(T, z) || esc; m.visible = off; m.material.opacity = 0.16 + Math.sin(time * 6) * 0.07; }
    // 動力炉
    const heat = clamp(T.fuel / 120, 0, 1), hot = T.fuel > 100, low = T.fuel < 25;
    if (k) { const beat = 1 + Math.max(0, Math.sin(time * (3 + heat * 7))) * 0.14 * (0.4 + heat); o.core.scale.set(2 * beat, 2 * beat, 2 * beat); o.coreMat.color.setRGB(0.5 + heat * 0.5, hot ? 0.25 : 0.1, hot ? 0.5 : 0.25 + (low ? Math.sin(time * 12) * 0.1 : 0)); o.reLight.color.set(0xff3366); }
    else { o.coreMat.color.setRGB(0.35 + heat * 0.65, hot ? 0.3 : 0.25 + heat * 0.45, hot ? 0.15 : 0.12); o.core.scale.set(1.7, 1.2 + (hot ? Math.sin(time * 30) * 0.1 : 0), 1.7); o.reLight.color.set(hot ? 0xff3311 : 0xff8844); }
    o.reLight.intensity = 4 + heat * 14;
    if (hot && Math.random() < 0.5) pInt.add(ix(ST.reactor.x) + rnd(-1, 1), 3, iz(ST.reactor.y) + rnd(-1, 1), rnd(-1, 1), rnd(3, 6), rnd(-1, 1), 0.5, rnd(0.3, 0.6), '#ff6f3c', 'fire');
    o.lever.rotation.z = lerp(o.lever.rotation.z, T.leverCD > 0 ? -0.7 : 0.5, Math.min(1, dt * 12));
    o.chair.rotation.y = T.swapT > 0 ? time * 20 : 0;
    o.podMat.color.set(esc ? (Math.sin(time * 12) > 0 ? 0x7dffb0 : 0x2e7d4f) : 0x4a5577);
    o.alarmMat.color.set(T.armAlarm > 0 && Math.sin(time * 20) > 0 ? 0xff5a4f : 0x4a5577);
    for (let i = 0; i < 3; i++) { const m = T.mq[i], it = o.tubes[i]; it.visible = !!m; if (m) setItem(it, k, m.t); }
    const mine = sp && sp.team === team && sp.phase !== 'fire';
    for (const key of CON) { const on = mine && sp.assign[key] !== undefined, cur = on && sp.phase === 'seq' && CON[sp.step] === key; o.cons[key].color.set(cur ? (Math.sin(time * 16) > 0 ? 0xffffff : 0xffd23f) : on ? 0xffd23f : 0x4a5577); }
    const def = sp && sp.team !== team && sp.phase !== 'fire';
    const chgOpen = T.g.sp < 100 && !(sp && sp.team === team), cb = clamp(T.chgB / 2, 0, 1);
    o.chgMat.color.set(!chgOpen ? 0x4a5577 : cb < 0.25 ? 0xff6f3c : (k ? 0xff9af0 : 0xffd23f)); o.chgBar.scale.y = 0.2 + cb * 1.4; o.chgBar.position.y = 0.8 + o.chgBar.scale.y / 2;
    o.pumpY = lerp(o.pumpY || 0, T.crew.some(c => c.role !== 'pilot' && !c.escaped && Math.hypot(c.x - ST.charger.x, c.y - ST.charger.y) < 60) ? Math.abs(Math.sin(time * 14)) * -0.5 : 0, 0.5); o.pump.position.y = 1.7 + o.pumpY;
    o.thrMat.color.set(def ? (sp.thrust >= 1 ? 0x3fe0d0 : (Math.sin(time * 10) > 0 ? 0x9ad8ff : 0x3fe0d0)) : 0x3d5a66);
    if (k) o.fan.scale.setScalar(1 + (def ? sp.thrust * 0.5 : 0)); else o.fan.rotation.y += dt * (def ? 4 + sp.thrust * 30 : 0.6);
    // 乗組員
    T.crew.forEach((c, i) => {
      const f = o.crew[i], mk = o.marks[i], ci = o.carry[i]; f.visible = !c.escaped; mk.visible = false; ci.visible = false; if (!f.visible) return;
      if (c.role === 'pilot') { f.position.set(ix(ST.seat.x), k ? 1.5 : 0.75, iz(ST.seat.y)); f.rotation.set(0, Math.PI, 0); f.scale.setScalar(0.92); poseFigure(f, 0, false, G.teams[team].g.atk ? 1 : 0, false, time); }
      else {
        f.position.set(ix(c.x), 0, iz(c.y)); f.rotation.set(0, Math.atan2(c.fx, c.fy), c.dizzy > 0 ? 1.1 : 0); if (c.dizzy > 0) f.position.y = 0.45; f.scale.setScalar(1);
        poseFigure(f, c.walk * 2.2, !!c.carry, c.working ? 1 : 0, c.dizzy > 0, time);
        if (c.carry) { ci.visible = true; setItem(ci, k, c.carry); ci.position.set(ix(c.x), 2.75, iz(c.y)); ci.rotation.y = time * 2; }
        if (c.working && Math.random() < 0.6) pInt.add(ix(c.x) + c.fx * 0.9, 0.9, iz(c.y) + c.fy * 0.9, c.fx * 5 + rnd(-1.5, 1.5), rnd(0, 2), c.fy * 5 + rnd(-1.5, 1.5), 0.3, rnd(0.2, 0.4), '#dff6ff', 'dust');
      }
      f.userData.suit.emissive.setScalar(c.adren > 0 ? 0.25 + Math.sin(time * 10) * 0.1 : 0);
      if (view.locals.includes(c.slot)) { mk.visible = true; mk.material.color.set(SLOT_COL[c.slot]); const p = f.position; mk.position.set(p.x, 0.06, p.z); }
    });
    T.items.forEach((it, i) => { if (i >= o.items.length) return; const m = o.items[i]; m.visible = true; setItem(m, k, it.t); m.position.set(ix(it.x), 0.4 + it.z * IS, iz(it.y)); m.rotation.set(it.z > 0 ? time * 8 : 1.3, i, 0); });
    for (let i = T.items.length; i < o.items.length; i++) o.items[i].visible = false;
    o.troubles.forEach((g, i) => {
      const t = T.troubles[i]; g.visible = !!t; if (!t) return; const u = g.userData; g.position.set(ix(t.x), 0, iz(t.y));
      u.fire.visible = t.type === 'fire'; u.cable.visible = t.type !== 'fire';
      if (t.type === 'fire') {
        const s = 0.55 + t.hp / 100 * 0.75; u.fire.scale.setScalar(s); u.cones.forEach((c, j) => { c.scale.y = 1.8 * (0.8 + Math.sin(time * (14 + j * 5) + i) * 0.25); c.position.y = c.scale.y / 2; });
        if (Math.random() < 0.5) pInt.add(ix(t.x) + rnd(-0.6, 0.6) * s, 1, iz(t.y) + rnd(-0.4, 0.4), rnd(-0.5, 0.5), rnd(2.5, 5), rnd(-0.5, 0.5), rnd(0.3, 0.6), rnd(0.25, 0.5) * s, pick(k ? ['#9be36d', '#6a2fd6', '#c9ff8a'] : ['#ff9a3c', '#ffd23f', '#ff5a4f']), 'fire');
      } else if (Math.random() < 0.35) pInt.add(ix(t.x) + rnd(-0.2, 0.2), 0.4, iz(t.y), rnd(-5, 5), rnd(2, 7), rnd(-5, 5), 0.25, 0.14, k ? '#ffc8e8' : '#9ad8ff', 'spark');
    });
    if (esc && Math.random() < 0.4) pInt.add(rnd(-28, 28), 0.5, rnd(-8, 8), rnd(-1, 1), rnd(3, 6), rnd(-1, 1), 0.6, rnd(0.4, 0.8), pick(['#ff6f3c', '#ffb347']), 'fire');
  }

  const api = {
    W, H, EXT_H,
    resize(w, h) { pxW = w; pxH = h; renderer.setPixelRatio(1); renderer.setSize(w, h, false); },
    setQuality(low) { renderer.shadowMap.enabled = !low; sun.castShadow = !low; city.traverse(o => { if (o.material) for (const m of [].concat(o.material)) m.needsUpdate = true; }); },
    reset() { resetCity(); riseT = [0, 0]; pCity.list.length = 0; pInt.list.length = 0; for (const o of interiors) o.tiltA = 0; baseObjs.forEach(o => o.cap = -1); },
    shake(a, where) { if (where !== 'int') shakeC = Math.max(shakeC, a); if (where !== 'city') shakeI = Math.max(shakeI, a); },
    collapse(simX, rad) {
      const x = ex(simX), r = rad * XS + 6; let best = null, bd = 1e9;
      for (const b of buildings) if (!b.broken && !b.front && b.b.z > -30) { const d = Math.abs(b.b.x - x); if (d < r + b.b.w / 2 && d < bd) { bd = d; best = b; } }
      if (best) { best.broken = true; pCity.burst(best.b.x, best.b.h * 0.6, best.b.z + best.b.d / 2, 26, ['#8d8f9e', '#b9bbc9', '#6d6f7e'], 14, 2.6, 'dust', 3); }
    },
    fx: {
      puffI(x, y, n, col, spd, size, type) { pInt.burst(ix(x), 0.9, iz(y), Math.min(n, 30), col, spd * IS * 1.3, size * IS * 1.6, type, 2); },
      sparkE(x, h, n, col) { pCity.burst(ex(x), h * XS, 3, n, col, 30, 0.6, 'spark', 4); },
      explE(x, h, n, big) { pCity.burst(ex(x), h * XS, 3, Math.min(n, 50), ['#ffb347', '#ff6f3c', '#ffe066', '#ff3c3c'], 22 * big, 2.6 * big, 'fire', 3); pCity.burst(ex(x), h * XS, 3, Math.min(n, 40) / 2, ['#59586a', '#77768a'], 10 * big, 3.2 * big, 'dust', 4); },
      puffC(x, z, n, col) { pCity.burst(x, 1, z, n, col, 9, 0.7, 'spark', 5); },
    },
    projC(x, y, z) { v3.set(x, y, z).project(camC); const vp = api._vp; return { x: (v3.x * 0.5 + 0.5) * W, y: vp.y + (1 - (v3.y * 0.5 + 0.5)) * vp.h, vis: v3.z < 1 }; },
    projE(simX, h) { return api.projC(ex(simX), h * XS, 2); },
    projI(sx, sy, h = 0) { const o = interiors[viewTeam]; v3.set(ix(sx), h, iz(sy)); o.root.localToWorld(v3); v3.project(camI); return { x: (v3.x * 0.5 + 0.5) * W, y: EXT_H + (1 - (v3.y * 0.5 + 0.5)) * (H - EXT_H) }; },
    _vp: { y: 0, h: H },
    draw(G, view, dt) {
      time += dt; viewTeam = view.team; shakeC = Math.max(0, shakeC - dt * 40); shakeI = Math.max(0, shakeI - dt * 40);
      const phase = G ? G.phase : 'title';
      if (phase !== lastPhase) { if (phase === 'p1' || phase === 'title') api.reset(); lastPhase = phase; }
      const split = phase === 'p2' || phase === 'escape' || phase === 'result';
      city.background = G && G.od ? skyB : skyA;
      // ---- カメラ
      let mode = 'top';
      if (phase === 'title') { const a = time * 0.12; camC.fov = 34; setCam(camC, Math.sin(a) * 30, 20 + Math.sin(a * 0.7) * 3, 96, 0, 15, 0, 0); mode = 'side'; }
      else if (phase === 'p1' || phase === 'trans') {
        const P = G.p1; let cx = 0, cz = 0, n = 0, spread = 0; const L = view.locals.length ? view.locals : [0, 1, 2, 3, 4, 5, 6, 7];
        for (const s of L) { cx += P.chars[s].x; cz += P.chars[s].z; n++; } cx /= n; cz /= n;
        for (const s of L) spread = Math.max(spread, Math.abs(P.chars[s].x - cx) / 1.7, Math.abs(P.chars[s].z - cz));
        const zoom = view.locals.length ? clamp(spread / 14, 1, 2.6) : 2.4;
        const k = Math.min(1, dt * 5); camState.x = lerp(camState.x, clamp(cx, -66, 66), k); camState.z = lerp(camState.z, clamp(cz, -40, 40), k); camState.zoom = lerp(camState.zoom, zoom, Math.min(1, dt * 3));
        const px = camState.x, pz = camState.z, z = camState.zoom;
        if (phase === 'p1') { camC.fov = 40; setCam(camC, px, 40 * z, pz + 20 * z, px, 0, pz - 1.5, shakeC); }
        else {
          const p = ease(clamp((8.8 - G.tr.t) / 2.2, 0, 1)); camC.fov = lerp(40, 38, p);
          setCam(camC, lerp(px, 0, p), lerp(40 * z, 21, p), lerp(pz + 20 * z, 112, p), lerp(px, 0, p), lerp(0, 15, p), lerp(pz - 1.5, 0, p), shakeC); if (p > 0.4) mode = 'side';
        }
      } else {
        const a = G.teams[0].g, b = G.teams[1].g, mid = clamp(ex((a.x + b.x) / 2) * 0.55, -14, 14); camState.x = lerp(camState.x, mid, Math.min(1, dt * 3));
        camC.fov = 30; setCam(camC, camState.x, 20, 88, camState.x, 18.4, 0, shakeC); mode = 'side';
      }
      syncP1(G, view, dt, phase === 'p1' || (phase === 'trans' && G.tr.t > 6.8));
      syncGiants(G, time, dt); syncExteriorFx(G, dt); syncCrowd(G, dt, mode === 'side'); syncBuildings(mode, dt);
      goalObjs.forEach(o => o.g.visible = phase === 'p1' || phase === 'trans'); baseObjs.forEach(o => { o.g.visible = !split && phase !== 'title'; });
      pCity.update(dt);
      // ---- 描画
      renderer.setScissorTest(false); renderer.setViewport(0, 0, pxW, pxH); renderer.clear();
      if (!split) { api._vp = { y: 0, h: H }; camC.aspect = W / H; camC.updateProjectionMatrix(); renderer.render(city, camC); }
      else {
        const eh = Math.round(pxH * EXT_H / H); api._vp = { y: 0, h: EXT_H };
        camC.aspect = W / EXT_H; camC.updateProjectionMatrix();
        renderer.setScissorTest(true); renderer.setViewport(0, pxH - eh, pxW, eh); renderer.setScissor(0, pxH - eh, pxW, eh); renderer.render(city, camC);
        syncInterior(G, view.team, view, dt); pInt.update(dt);
        camI.position.set(rnd(-shakeI, shakeI) * 0.03, 33 + rnd(-shakeI, shakeI) * 0.03, 21); camI.lookAt(0, 0, 2.1); camI.updateMatrixWorld();
        renderer.setViewport(0, 0, pxW, pxH - eh); renderer.setScissor(0, 0, pxW, pxH - eh); renderer.clearDepth(); renderer.render(intScene, camI);
        renderer.setScissorTest(false);
      }
    },
  };
  return api;
}
