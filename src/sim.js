// =====================================================================
// GIGA-CLASH  sim.js — ゲームのルール（DOMに依存しない）
//   前半戦：シティー・スクランブル ／ 移行 ／ 後半戦：ギガント・バトル
//   8スロット（0-3 ヒーロー、4-7 怪人）。人間がいない席は Bot。
// =====================================================================
export const P1_TIME = 120, BATTLE_TIME = 180, WORLD_W = 1000;
export const BAL = {
  fuelDecay: 2.6, burn: 0.45, botSpd: 195, notice: 1.4,
  spBase: 6, spVar: 14, spPerfect: 6, spDeal: 0.9, spTake: 1.3, spIdle: 0.4,
  thrustTime: 5.5, chgRefill: 0.5, chgPer: 0.5, optLo: 80, optHi: 105, optMul: 1.1, fatHit: 1.7, kd: 0.2, fireP: 8,
  p1Speed: 11, capTime: 5.0,
};
export const DIFF = [{ name: 'やさしい', dmg: 0.78, spd: 0.9 }, { name: 'ふつう', dmg: 0.89, spd: 0.96 }, { name: 'むずかしい', dmg: 1.0, spd: 1.0 }, { name: 'げきむず', dmg: 1.14, spd: 1.04 }, { name: '-', dmg: 1, spd: 1 }];

const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const pick = arr => arr[(Math.random() * arr.length) | 0];
const gauss = () => { let u = 0; for (let i = 0; i < 6; i++) u += Math.random(); return (u - 3) / Math.sqrt(0.5); };
const hyp = Math.hypot;

export const TEAM_NAME = ['ヒーロー', '怪人'];
export const TEAM_COL = ['#4fd1ff', '#c26bff'];
export const SLOT_COL = ['#ffc531', '#ff6464', '#38d6c4', '#5aa2ff', '#c26bff', '#ff5af0', '#9be36d', '#ff9a3c'];
export const BOT_NAMES = ['ケン', 'ミナ', 'ゴウ', 'リン', 'ガル', 'ドグ', 'ザム', 'ベラ'];
export const THEME = [
  { giant: 'ギガント・ブレイバー', seat: '操縦席', lever: '交代レバー', reactor: '動力炉', fuel: '石炭', pod: '脱出ポッド', launcher: '装填口',
    mN: '通常弾', mH: '追尾弾', mS: '足止め弾', c1: '安全装置', c2: 'バルブ', c3: '承認レバー', thruster: '回避スラスター',
    fire: '火災', cable: '断線', fireVerb: '消火', cableVerb: 'ケーブル修理', fireDone: '消火！', cableDone: '修理完了！',
    zones: { rarm: '右腕', head: '頭部', legs: '脚部', larm: '左腕' }, weak: 'パンチ', strong: 'ストレート', special: 'ギガントビーム', specialP: 'ギガント・ブレイカー!!',
    over: '動力炉オーバーヒート！', noFuel: 'エネルギー切れ！', inside: '機体内部', pilot: '操縦者', down: '機体が転倒！', wreck: '機体が大破！' },
  { giant: '超獣ドグラマグ', seat: '脳', lever: '神経レバー', reactor: '心臓', fuel: 'ダークマター', pod: '排出口', launcher: '毒腺',
    mN: '毒液弾', mH: '追尾胞子', mS: '粘着弾', c1: '怒りのツボ', c2: '毒袋', c3: '咆哮神経', thruster: '硬質化腺',
    fire: '壊死', cable: '神経切れ', fireVerb: '細胞を叩いて活性化', cableVerb: '神経をつなぐ', fireDone: '活性化！', cableDone: '接続完了！',
    zones: { rarm: '右爪', head: '頭部', legs: '脚部', larm: '尻尾' }, weak: '爪', strong: '尻尾', special: 'デストロイ光線', specialP: 'メガ・デストロイ!!',
    over: '心臓が破裂寸前！', noFuel: 'スタミナ切れ！', inside: '怪獣の体内', pilot: '支配者', down: '怪獣が転倒！', wreck: '怪獣が力尽きた！' },
];
export const ZONE_EFF = { rarm: '弱攻撃 使用不可', head: '飛び道具 使用不可', legs: '移動速度 低下', larm: '強攻撃 使用不可' };
export const BASE_INFO = [
  { key: 'hosp', name: '病院', eff: '最大HP+8' }, { key: 'lab', name: '研究所', eff: '必殺ゲージ+50' },
  { key: 'power', name: '発電所', eff: '燃料の減り-20%' }, { key: 'fact', name: '工場', eff: '弾3発で開始' }, { key: 'tv', name: 'テレビ局', eff: '作業速度+15%・声援強化' },
];
export const CARDS = [
  { name: '先制攻撃', desc: '開幕、相手を2.5秒動けなくする' },
  { name: '底力', desc: 'HPが30を切ると一度だけ18回復' },
  { name: 'ゲージ全開', desc: '必殺技ゲージ+60で開始' },
];

// ---------------------------------------------------------------------
// 街（前半戦のマップ。後半戦の背景にもなる）
// ---------------------------------------------------------------------
export const CELL = 4, GW = 40, GH = 24;
function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export const CITY = (() => {
  const R = mulberry(20261114);
  const stR = new Set([0, 5, 10, 11, 12, 13, 18, 23]), stC = new Set([0, 6, 13, 19, 20, 26, 33, 39]);
  const solid = [];
  for (let j = 0; j < GH; j++) { solid.push([]); for (let i = 0; i < GW; i++) solid[j].push(!(stR.has(j) || stC.has(i))); }
  const bases = [{ id: 0, x: -40, z: -16 }, { id: 1, x: 40, z: -16 }, { id: 2, x: -40, z: 16 }, { id: 3, x: 40, z: 16 }, { id: 4, x: 0, z: 0 }];
  bases.forEach((b, k) => { b.r = 7; Object.assign(b, BASE_INFO[k]); });
  const plaza = [[7, 12, 6, 9], [27, 32, 6, 9], [7, 12, 14, 17], [27, 32, 14, 17]];
  for (const [i0, i1, j0, j1] of plaza) for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) solid[j][i] = false;
  const cols = [[1, 5], [7, 12], [14, 18], [21, 25], [27, 32], [34, 38]], rows = [[1, 4], [6, 9], [14, 17], [19, 22]];
  const buildings = [];
  const PAL = ['#3b4566', '#46395e', '#2f4a5c', '#4a4256', '#3a5068', '#54486a'];
  cols.forEach((c, ci) => rows.forEach((r, ri) => {
    if ((ci === 1 || ci === 4) && (ri === 1 || ri === 2)) return;
    const x0 = (c[0] - 20) * CELL, x1 = (c[1] + 1 - 20) * CELL, z0 = (r[0] - 12) * CELL, z1 = (r[1] + 1 - 12) * CELL;
    const hBase = ri === 0 ? 15 : ri === 1 ? 9 : ri === 2 ? 7 : 9;
    const split = x0 + (x1 - x0) * (0.4 + R() * 0.2);
    for (const [a, b] of [[x0, split], [split, x1]]) {
      buildings.push({ x: (a + b) / 2, z: (z0 + z1) / 2, w: b - a - 1.2, d: z1 - z0 - 1.2, h: hBase + R() * (ri === 0 ? 9 : 6), col: PAL[(R() * PAL.length) | 0], style: (R() * 3) | 0 });
    }
  }));
  const goals = [{ x: -74, z: 0, r: 6 }, { x: 74, z: 0, r: 6 }];
  return { solid, bases, buildings, goals };
})();
const cellI = x => Math.floor(x / CELL + GW / 2), cellJ = z => Math.floor(z / CELL + GH / 2);
export function solidAt(x, z) { const i = cellI(x), j = cellJ(z); return i < 0 || j < 0 || i >= GW || j >= GH || CITY.solid[j][i]; }
function distField(ti, tj) {
  const df = new Int16Array(GW * GH).fill(-1); if (ti < 0 || tj < 0 || ti >= GW || tj >= GH) return df;
  const q = [ti + tj * GW]; df[q[0]] = 0;
  for (let h = 0; h < q.length; h++) {
    const c = q[h], ci = c % GW, cj = (c / GW) | 0, d = df[c] + 1;
    if (ci > 0 && !CITY.solid[cj][ci - 1] && df[c - 1] < 0) { df[c - 1] = d; q.push(c - 1); }
    if (ci < GW - 1 && !CITY.solid[cj][ci + 1] && df[c + 1] < 0) { df[c + 1] = d; q.push(c + 1); }
    if (cj > 0 && !CITY.solid[cj - 1][ci] && df[c - GW] < 0) { df[c - GW] = d; q.push(c - GW); }
    if (cj < GH - 1 && !CITY.solid[cj + 1][ci] && df[c + GW] < 0) { df[c + GW] = d; q.push(c + GW); }
  }
  return df;
}
export function moveCircle(o, dx, dz, r) {
  let nx = o.x + dx;
  if (solidAt(nx + r, o.z + r * 0.8) || solidAt(nx + r, o.z - r * 0.8) || solidAt(nx - r, o.z + r * 0.8) || solidAt(nx - r, o.z - r * 0.8)) { nx = o.x; o.vx = 0; }
  o.x = nx;
  let nz = o.z + dz;
  if (solidAt(o.x + r * 0.8, nz + r) || solidAt(o.x - r * 0.8, nz + r) || solidAt(o.x + r * 0.8, nz - r) || solidAt(o.x - r * 0.8, nz - r)) { nz = o.z; o.vz = 0; }
  o.z = nz;
}

// ---------------------------------------------------------------------
// 機体内部のレイアウト（内部座標：0..1280 x 0..420）
// ---------------------------------------------------------------------
export const ST = {
  seat: { x: 640, y: 72, r: 34, solid: 30 }, lever: { x: 748, y: 78, r: 30, solid: 12 },
  reactor: { x: 175, y: 205, r: 60, solid: 54 }, coal: { x: 82, y: 352, r: 42, solid: 36 },
  pod: { x: 74, y: 70, r: 40, solid: 0 }, launcher: { x: 985, y: 210, r: 44, solid: 36 },
  crateN: { x: 1200, y: 92, r: 34, solid: 28, item: 'mN' }, crateH: { x: 1200, y: 210, r: 34, solid: 28, item: 'mH' }, crateS: { x: 1200, y: 328, r: 34, solid: 28, item: 'mS' },
  c1: { x: 405, y: 96, r: 30, solid: 20 }, c2: { x: 405, y: 330, r: 30, solid: 20 }, c3: { x: 875, y: 330, r: 30, solid: 20 },
  thruster: { x: 640, y: 345, r: 38, solid: 28 },
  charger: { x: 880, y: 124, r: 30, solid: 20 },
};
const SOLIDS = Object.values(ST).filter(s => s.solid > 0);
export const ROOM = { x0: 24, y0: 22, x1: 1256, y1: 398 };
export const WALLS = [{ x: 250, y: 22, w: 16, h: 118 }, { x: 250, y: 272, w: 16, h: 126 }, { x: 1060, y: 22, w: 16, h: 106 }, { x: 1060, y: 292, w: 16, h: 106 }];
const PARTS = [{ x: 258, lo: 140, hi: 272 }, { x: 1068, lo: 128, hi: 292 }];
export const ZONES = {
  rarm: { x: 266, y: 22, w: 254, h: 376 }, head: { x: 520, y: 22, w: 240, h: 140 },
  legs: { x: 520, y: 262, w: 240, h: 136 }, larm: { x: 760, y: 22, w: 300, h: 376 },
};
export const ZKEYS = ['rarm', 'head', 'legs', 'larm'];
export const CON = ['c1', 'c2', 'c3'];
export const ITEMS = ['coal', 'mN', 'mH', 'mS'];
const ATK = {
  weak: { wind: 0.15, act: 0.1, rec: 0.22, range: 172, dmg: 0.78, en: 4, fat: 0.3, part: 'rarm' },
  fin: { wind: 0.17, act: 0.12, rec: 0.42, range: 190, dmg: 1.7, en: 6, fat: 0.6, part: 'rarm', kb: 60 },
  strong: { wind: 0.36, act: 0.12, rec: 0.42, range: 190, dmg: 1.9, en: 10, fat: 1.5, part: 'larm', kb: 45 },
};
export const ATK_T = { weak: ATK.weak, strong: ATK.strong, fin: ATK.fin };
const MISSILE = { mN: { dmg: 2.2, spd: 760 }, mH: { dmg: 1.7, spd: 600, unblock: true }, mS: { dmg: 0.7, spd: 680, stun: 1.7 } };

// ---------------------------------------------------------------------
// イベント（演出・音）。main 側で再生し、ホストはクライアントへ転送する
// ---------------------------------------------------------------------
function E(G, ...a) { G.ev.push(a); }
const sfx = (G, team, name) => E(G, 'sfx', team, name);
const banner = (G, team, text, sub = '', col = '#ffd23f', dur = 2.2) => E(G, 'ban', team, text, sub, col, dur);
const cutin = (G, team, text, col = '#ffd23f', dur = 1.6) => E(G, 'cut', team, text, col, dur);
const popI = (G, team, x, y, text, col = '#fff', size = 18) => E(G, 'popI', team, x | 0, y | 0, text, col, size);
const popE = (G, x, h, text, col = '#fff', size = 26) => E(G, 'popE', -1, x | 0, h | 0, text, col, size);
const popC = (G, x, z, text, col = '#fff', size = 20) => E(G, 'popC', -1, +x.toFixed(1), +z.toFixed(1), text, col, size);
const puffI = (G, team, x, y, n, col, spd = 120, size = 8, type = 'dust') => E(G, 'puffI', team, x | 0, y | 0, n, col, spd, size, type);
const sparkE = (G, x, h, n, col = '#ffe066') => E(G, 'sparkE', -1, x | 0, h | 0, n, col);
const explE = (G, x, h, n = 30, big = 1) => E(G, 'explE', -1, x | 0, h | 0, n, big);
const shake = (G, team, amt) => E(G, 'shake', team, +amt.toFixed(1));
function shout(G, T, c, text, force = false) { if (!force && c.shoutCD > 0) return; c.shoutCD = 3.5 + Math.random() * 2; E(G, 'bub', T.id, c.k, text); }

// ---------------------------------------------------------------------
// 試合の作成
// ---------------------------------------------------------------------
export function newInp() { return { mx: 0, my: 0, a: false, x: false, g: false, aP: false, bP: false, xP: false, mP: false, sP: false, eP: false, card: 0, rt: -1 }; }
function newStat() { return { jg: 0, combo: 0, chg: 0, cit: 0, cap: 0, ko: 0, dmg: 0, mdmg: 0, coal: 0, load: 0, fix: 0, perfect: 0, thrust: 0, fall: 0, drop: 0, ff: 0, boom: 0, pilotT: 0 }; }
export function createMatch(cfg) {
  const G = {
    cfg, slots: cfg.slots, auto: !!cfg.auto, client: !!cfg.client, t: 0, ev: [], inp: [], st: [], phase: 'p1', cd: 3, time: P1_TIME,
    od: false, hitstop: 0, sp: null, missiles: [], teams: null, p1: null, tr: null, esc: null, result: null, cheered: false,
    cnt: { sp: 0, spP: 0, dodge: 0, graze: 0, hit: 0, cancel: 0, kd: 0, sys: 0, boom: 0, fires: 0 },
  };
  for (let i = 0; i < 8; i++) { G.inp.push(newInp()); G.st.push(newStat()); }
  const humans = [0, 1].map(t => G.slots.slice(t * 4, t * 4 + 4).filter(s => s.human).length);
  const d = DIFF[cfg.diff == null ? 1 : cfg.diff];
  G.hc = [0, 1].map(t => cfg.hc ? cfg.hc[t] : (humans[t] === 0 && humans[1 - t] > 0 ? d : DIFF[4]));
  // 人間がいるチームのBotは少しだけ手を抜く（人間の働きが勝敗に効くように）
  G.lazy = cfg.lazy || [0, 1].map(t => humans[t] > 0); G.proxy = cfg.proxy == null ? -1 : cfg.proxy;
  setupP1(G);
  if (cfg.skipP1) { startTrans(G); G.tr.t = 0.01; }
  return G;
}
const isBot = (G, slot) => G.auto || !G.slots[slot].human;
const teamHasHuman = (G, t) => !G.auto && G.slots.slice(t * 4, t * 4 + 4).some(s => s.human);

// =====================================================================
// 前半戦：シティー・スクランブル
// =====================================================================
function setupP1(G) {
  const P = G.p1 = { chars: [], cits: [], bases: CITY.bases.map(b => ({ id: b.id, x: b.x, z: b.z, r: b.r, own: -1, capTeam: -1, cap: 0 })), pts: [0, 0], cnt: [0, 0], hen: [false, false], spawned: 0, spawnT: 0, nextId: 0, dbl: false, quake: false };
  for (let s = 0; s < 8; s++) {
    const team = s < 4 ? 0 : 1, k = s % 4;
    P.chars.push({ slot: s, team, k, x: (team ? 1 : -1) * (64 - (k % 2) * 4), z: -4.5 + k * 3, vx: 0, vz: 0, fa: team ? -Math.PI / 2 : Math.PI / 2, carry: -1, stun: 0, inv: 0, pcd: 0, punchT: 0,
      binp: newInp(), planT: Math.random() * 0.4, job: null, df: null, dfKey: -1, stuckT: 0, lx: 0, lz: 0, role: 'cap' });
  }
  for (const t of [0, 1]) { let n = 0; for (const ch of P.chars) if (ch.team === t && isBot(G, ch.slot)) ch.role = n++ % 2 ? 'cit' : 'cap'; }
  for (let i = 0; i < 12; i++) spawnCit(G);
}
function spawnCit(G) {
  const P = G.p1;
  for (let k = 0; k < 40; k++) {
    const x = rnd(-56, 56), z = rnd(-44, 44);
    if (solidAt(x, z) || solidAt(x + 1, z) || solidAt(x - 1, z) || solidAt(x, z + 1) || solidAt(x, z - 1)) continue;
    P.cits.push({ id: P.nextId++, x, z, y: 0, vx: 0, vz: 0, vy: 0, state: 'free', by: -1, type: Math.random() < 0.14 ? 1 : 0, wt: 0, tx: x, tz: z, dizzy: 0, team: -1 });
    P.spawned++; return;
  }
}
const citById = (P, id) => P.cits.find(c => c.id === id);
function citPts(G, c) { return (c.type ? 3 : 1) * (G.p1.dbl ? 2 : 1); }
function scoreCit(G, c, ch, thrown) {
  const P = G.p1, pts = citPts(G, c) + (thrown ? 1 : 0);
  P.pts[ch.team] += pts; P.cnt[ch.team]++; G.st[ch.slot].cit++;
  c.state = 'gone'; const g = CITY.goals[ch.team];
  popC(G, g.x, g.z, (thrown ? 'ナイスシュート！ ' : '') + `+${pts}`, ch.team ? '#e4a8ff' : '#9fe8ff', thrown ? 24 : 20);
  sfx(G, -1, thrown ? 'perfect' : 'good'); E(G, 'puffC', -1, +g.x.toFixed(1), +g.z.toFixed(1), 10, ch.team ? '#c26bff' : '#4fd1ff');
}
function dropCit(G, ch, panic) {
  if (ch.carry < 0) return; const c = citById(G.p1, ch.carry); ch.carry = -1; if (!c) return;
  c.state = 'free'; c.by = -1; c.dizzy = panic ? 0.5 : 0.2; c.wt = 0; c.x = ch.x; c.z = ch.z;
}
function p1Char(G, ch, inp, dt) {
  const P = G.p1;
  ch.pcd -= dt; ch.punchT -= dt; ch.inv -= dt;
  let mx = inp.mx, mz = inp.my, ctl = 12;
  if (ch.stun > 0) { ch.stun -= dt; mx = mz = 0; ctl = 4; if (ch.stun <= 0) ch.inv = 0.8; }
  const cc = ch.carry >= 0 ? citById(P, ch.carry) : null;
  const hc = isBot(G, ch.slot) ? G.hc[ch.team].spd * (G.lazy[ch.team] && G.proxy !== ch.slot ? 0.93 : 1) : 1;
  const sp = BAL.p1Speed * (cc ? (cc.type ? 0.68 : 0.82) + (ch.team ? 0.06 : 0) : 1) * (P.hen[ch.team] ? 1.1 : 1) * hc;
  const k = Math.min(1, dt * ctl);
  ch.vx += (mx * sp - ch.vx) * k; ch.vz += (mz * sp - ch.vz) * k;
  moveCircle(ch, ch.vx * dt, ch.vz * dt, 0.9);
  if (Math.abs(mx) + Math.abs(mz) > 0.2) ch.fa = Math.atan2(mx, mz);
  if (ch.stun > 0) return;
  const fx = Math.sin(ch.fa), fz = Math.cos(ch.fa);
  if (inp.aP) {
    if (ch.carry >= 0) dropCit(G, ch, false);
    else {
      let best = null, bd = 2.6;
      for (const c of P.cits) if (c.state === 'free') { const d = hyp(c.x - ch.x, c.z - ch.z); if (d < bd) { bd = d; best = c; } }
      if (best) { best.state = 'held'; best.by = ch.slot; ch.carry = best.id; sfx(G, -1, 'pick'); }
    }
  }
  if (inp.xP && ch.pcd <= 0) {
    ch.pcd = 0.55; ch.punchT = 0.22; ch.vx += fx * 9; ch.vz += fz * 9; sfx(G, -1, 'whoosh');
    for (const o of P.chars) {
      if (o.team === ch.team || o.stun > 0 || o.inv > 0) continue;
      const dx = o.x - ch.x, dz = o.z - ch.z, d = hyp(dx, dz);
      if (d < 3.4 && (dx * fx + dz * fz) / (d || 1) > 0.25) {
        o.stun = 1.3; o.vx = fx * 16; o.vz = fz * 16; dropCit(G, o, true); G.st[ch.slot].ko++;
        sfx(G, -1, 'hitL'); popC(G, o.x, o.z, 'ドカッ！', '#ffd23f', 18); E(G, 'puffC', -1, +o.x.toFixed(1), +o.z.toFixed(1), 6, '#ffe066');
      }
    }
  }
  if (inp.bP && ch.carry >= 0) {
    const c = citById(P, ch.carry); ch.carry = -1;
    if (c) { c.state = 'air'; c.by = ch.slot; c.team = ch.team; c.x = ch.x; c.z = ch.z; c.y = 2.2; c.vx = fx * 15 + ch.vx * 0.3; c.vz = fz * 15 + ch.vz * 0.3; c.vy = 8.5; sfx(G, -1, 'whoosh'); }
  }
  if (ch.carry >= 0) {
    const g = CITY.goals[ch.team];
    if (hyp(ch.x - g.x, ch.z - g.z) < g.r) { const c = citById(P, ch.carry); ch.carry = -1; if (c) scoreCit(G, c, ch, false); }
  }
}
function pathDir(ch, tx, tz) {
  const ci = cellI(ch.x), cj = cellJ(ch.z), ti = cellI(tx), tj = cellJ(tz);
  const direct = () => { const dx = tx - ch.x, dz = tz - ch.z, d = hyp(dx, dz) || 1; return [dx / d, dz / d]; };
  if ((ci === ti && cj === tj) || ti < 0 || tj < 0 || ti >= GW || tj >= GH || CITY.solid[tj][ti]) return direct();
  const key = ti + tj * GW; if (ch.dfKey !== key) { ch.df = distField(ti, tj); ch.dfKey = key; }
  const df = ch.df; let best = df[ci + cj * GW], bi = ci, bj = cj; if (best < 0) return direct();
  for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
    if (!di && !dj) continue; const ni = ci + di, nj = cj + dj;
    if (ni < 0 || nj < 0 || ni >= GW || nj >= GH || CITY.solid[nj][ni]) continue;
    if (di && dj && (CITY.solid[cj][ni] || CITY.solid[nj][ci])) continue;
    const v = df[ni + nj * GW]; if (v >= 0 && v < best) { best = v; bi = ni; bj = nj; }
  }
  const gx = (bi - GW / 2 + 0.5) * CELL, gz = (bj - GH / 2 + 0.5) * CELL, dx = gx - ch.x, dz = gz - ch.z, d = hyp(dx, dz) || 1;
  return [dx / d, dz / d];
}
function botP1(G, ch, dt) {
  const P = G.p1, inp = ch.binp; inp.aP = inp.bP = inp.xP = false; inp.mx = inp.my = 0;
  if (ch.stun > 0) return inp;
  ch.planT -= dt;
  const goal = CITY.goals[ch.team];
  if (ch.planT <= 0) {
    ch.planT = 0.35 + Math.random() * 0.2; ch.job = null;
    if (ch.carry >= 0) ch.job = { t: 'goal' };
    else {
      // 市民を運んでいる敵が近ければ追う
      let foe = null, fd = ch.role === 'cit' ? 14 : 8;
      for (const o of P.chars) if (o.team !== ch.team && o.carry >= 0 && o.stun <= 0) { const d = hyp(o.x - ch.x, o.z - ch.z); if (d < fd) { fd = d; foe = o; } }
      if (foe) ch.job = { t: 'hunt', o: foe };
      else {
        const mates = P.chars.filter(o => o.team === ch.team && o !== ch);
        let base = null, bd = 1e9;
        if (ch.role === 'cap' || G.time < 25) {
          for (const b of P.bases) {
            if (b.own === ch.team && !P.chars.some(o => o.team !== ch.team && hyp(o.x - b.x, o.z - b.z) < b.r)) continue;
            const taken = mates.filter(o => o.job && o.job.t === 'cap' && o.job.b === b).length;
            const d = hyp(b.x - ch.x, b.z - ch.z) + taken * 45; if (d < bd) { bd = d; base = b; }
          }
        }
        if (base && bd < 150) { if (ch.capB !== base.id) { ch.capB = base.id; ch.ox = rnd(-3.5, 3.5); ch.oz = rnd(-3.5, 3.5); } ch.job = { t: 'cap', b: base, ox: ch.ox, oz: ch.oz }; }
        else {
          let cit = null, cd = 1e9;
          for (const c of P.cits) if (c.state === 'free') {
            if (mates.some(o => o.job && o.job.t === 'cit' && o.job.c === c)) continue;
            const d = hyp(c.x - ch.x, c.z - ch.z) + hyp(c.x - goal.x, c.z - goal.z) * 0.4 - (c.type ? 12 : 0); if (d < cd) { cd = d; cit = c; }
          }
          if (cit) ch.job = { t: 'cit', c: cit };
          else ch.job = { t: 'cap', b: P.bases[4], ox: ch.k - 1.5, oz: 2 - ch.k };
        }
      }
    }
  }
  const j = ch.job; let tx = ch.x, tz = ch.z;
  if (j) {
    if (j.t === 'goal') {
      tx = goal.x; tz = goal.z; const d = hyp(tx - ch.x, tz - ch.z);
      if (d < 12 && d > goal.r + 1 && !solidAt((ch.x + tx) / 2, (ch.z + tz) / 2) && Math.random() < 0.05) { ch.fa = Math.atan2(tx - ch.x, tz - ch.z); inp.bP = true; return inp; }
    } else if (j.t === 'hunt') { tx = j.o.x; tz = j.o.z; }
    else if (j.t === 'cap') { tx = j.b.x + j.ox; tz = j.b.z + j.oz; }
    else if (j.t === 'cit') { tx = j.c.x; tz = j.c.z; if (j.c.state !== 'free') ch.planT = 0; else if (hyp(tx - ch.x, tz - ch.z) < 2.2) inp.aP = true; }
  }
  if (hyp(tx - ch.x, tz - ch.z) > 0.8) { const [dx, dz] = pathDir(ch, tx, tz); inp.mx = dx; inp.my = dz; }
  // 近くの敵を殴る
  if (ch.pcd <= 0) for (const o of P.chars) {
    if (o.team === ch.team || o.stun > 0 || o.inv > 0) continue;
    const dx = o.x - ch.x, dz = o.z - ch.z, d = hyp(dx, dz);
    if (d < 3 && Math.random() < (o.carry >= 0 || (j && j.t === 'cap') ? 0.12 : 0.03)) { ch.fa = Math.atan2(dx, dz); inp.mx = dx / d; inp.my = dz / d; inp.xP = true; break; }
  }
  if (Math.abs(inp.mx) + Math.abs(inp.my) > 0.3) {
    if (hyp(ch.x - ch.lx, ch.z - ch.lz) < 0.03) ch.stuckT += dt; else ch.stuckT = 0;
    if (ch.stuckT > 0.7) { const a = rnd(0, 6.28); ch.vx += Math.cos(a) * 10; ch.vz += Math.sin(a) * 10; ch.stuckT = 0; ch.dfKey = -1; }
  }
  ch.lx = ch.x; ch.lz = ch.z;
  return inp;
}
function stepP1(G, dt) {
  const P = G.p1;
  if (G.cd > 0) { G.cd -= dt; if (G.cd <= 0) { banner(G, 0, 'シティー・スクランブル開始！', '市民をシェルターへ運び、拠点を確保せよ', '#4fd1ff', 3); banner(G, 1, 'シティー・スクランブル開始！', '市民をダークゲートへ放り込み、拠点を奪え', '#c26bff', 3); sfx(G, -1, 'alarm'); } return; }
  G.time -= dt;
  if (G.time <= 60 && !P.quake) { P.quake = true; shake(G, -1, 14); sfx(G, -1, 'step'); banner(G, -1, '地面が揺れている…', '何か巨大なものが近づいている', '#ff9a3c', 2.4); }
  if (G.time <= 30 && !P.dbl) { P.dbl = true; shake(G, -1, 18); sfx(G, -1, 'alarm'); banner(G, -1, 'ラスト30秒！', '市民のポイントが2倍', '#ffd23f', 2.4); }
  P.spawnT -= dt;
  if (P.spawnT <= 0) { P.spawnT = 2.2; if (P.cits.filter(c => c.state === 'free').length < 12 && P.spawned < 44) spawnCit(G); }
  P.flip = !P.flip;
  for (let q = 0; q < 8; q++) { const ch = P.chars[P.flip ? q : 7 - q]; p1Char(G, ch, isBot(G, ch.slot) ? botP1(G, ch, dt) : G.inp[ch.slot], dt); }
  // キャラ同士の押し合い
  for (let i = 0; i < 8; i++) for (let j = i + 1; j < 8; j++) {
    const a = P.chars[i], b = P.chars[j], dx = b.x - a.x, dz = b.z - a.z, d = hyp(dx, dz);
    if (d < 1.7 && d > 0.01) { const p = (1.7 - d) / 2; moveCircle(a, -dx / d * p, -dz / d * p, 0.9); moveCircle(b, dx / d * p, dz / d * p, 0.9); }
  }
  // 市民
  for (let i = P.cits.length - 1; i >= 0; i--) {
    const c = P.cits[i];
    if (c.state === 'gone') { P.cits.splice(i, 1); continue; }
    if (c.state === 'held') { const ch = P.chars[c.by]; if (!ch || ch.carry !== c.id) { c.state = 'free'; c.by = -1; } else { c.x = ch.x; c.z = ch.z; } continue; }
    if (c.state === 'air') {
      c.vy -= 25 * dt; c.y += c.vy * dt; const ox = c.x, oz = c.z; c.x += c.vx * dt; c.z += c.vz * dt;
      if (solidAt(c.x, c.z)) { c.x = ox; c.z = oz; c.vx *= -0.3; c.vz *= -0.3; }
      const thrower = P.chars[c.by];
      for (const o of P.chars) if (o.team !== c.team && o.stun <= 0 && o.inv <= 0 && c.y < 3 && hyp(o.x - c.x, o.z - c.z) < 1.6) { o.stun = 0.9; dropCit(G, o, true); sfx(G, -1, 'bonk'); popC(G, o.x, o.z, 'ゴツン！', '#ffd23f', 18); c.vx *= -0.2; c.vz *= -0.2; }
      if (c.y <= 0) {
        c.y = 0; const g = CITY.goals[c.team];
        if (thrower && hyp(c.x - g.x, c.z - g.z) < g.r + 1) scoreCit(G, c, thrower, true);
        else { c.state = 'free'; c.by = -1; c.dizzy = 1.2; c.wt = 0; }
      }
      continue;
    }
    if (c.dizzy > 0) { c.dizzy -= dt; continue; }
    // うろうろ・怪人から逃げる
    let fx = 0, fz = 0;
    for (const ch of P.chars) if (ch.team === 1) { const dx = c.x - ch.x, dz = c.z - ch.z, d = hyp(dx, dz); if (d < 4.5 && d > 0.01) { fx += dx / d; fz += dz / d; } }
    let sp = 2.6;
    if (fx || fz) { const l = hyp(fx, fz) || 1; c.vx = fx / l * 3.8; c.vz = fz / l * 3.8; sp = 3.8; c.wt = 0.5; }
    else {
      c.wt -= dt;
      if (c.wt <= 0) { c.wt = rnd(1.5, 4); const a = rnd(0, 6.28); c.tx = Math.cos(a); c.tz = Math.sin(a); if (Math.random() < 0.3) c.tx = c.tz = 0; }
      c.vx = c.tx * sp; c.vz = c.tz * sp;
    }
    const bx = c.x, bz = c.z; moveCircle(c, c.vx * dt, c.vz * dt, 0.6);
    if (c.x === bx && c.z === bz) c.wt = 0;
    c.x = clamp(c.x, -78, 78); c.z = clamp(c.z, -46, 46);
  }
  // 拠点
  for (const b of P.bases) {
    const n = [0, 0];
    for (const ch of P.chars) if (ch.stun <= 0 && ch.carry < 0 && hyp(ch.x - b.x, ch.z - b.z) < b.r) n[ch.team]++;
    const A = n[0] && !n[1] ? 0 : n[1] && !n[0] ? 1 : -1;
    if (A >= 0 && b.own !== A) {
      const rate = Math.pow(n[A], 0.7) / BAL.capTime * dt;
      if (b.capTeam !== A) { b.cap -= rate * 2; if (b.cap <= 0) { b.cap = 0; b.capTeam = A; } }
      else {
        b.cap += rate;
        if (b.cap >= 1) {
          b.own = A; b.cap = 0; b.capTeam = -1;
          for (const ch of P.chars) if (ch.team === A && hyp(ch.x - b.x, ch.z - b.z) < b.r) G.st[ch.slot].cap++;
          const info = BASE_INFO[b.id];
          banner(G, -1, `${TEAM_NAME[A]}が${info.name}を確保！`, `後半戦：${info.eff}`, TEAM_COL[A], 2); sfx(G, -1, 'fix');
          E(G, 'puffC', -1, b.x, b.z, 24, TEAM_COL[A]);
          if (!P.hen[A]) { P.hen[A] = true; banner(G, A, 'チーム変身！', '移動速度アップ', '#ffd23f', 1.8); sfx(G, A, 'fanfare'); }
        }
      }
    } else if (A < 0 && !n[0] && !n[1] && b.cap > 0) b.cap = Math.max(0, b.cap - dt * 0.08);
  }
  if (G.time <= 0) { G.time = 0; startTrans(G); }
}

// =====================================================================
// 移行（巨大化カットシーン・逆境カード）
// =====================================================================
function startTrans(G) {
  const P = G.p1;
  for (const ch of P.chars) { dropCit(G, ch, false); ch.vx = ch.vz = 0; }
  const own = [0, 0], mask = [0, 0];
  for (const b of P.bases) if (b.own >= 0) { own[b.own]++; mask[b.own] |= 1 << b.id; }
  const score = [own[0] * 4 + P.pts[0], own[1] * 4 + P.pts[1]];
  const loser = score[0] === score[1] ? -1 : (score[0] < score[1] ? 0 : 1);
  G.tr = { t: 11, loser, pick: -1, score, own, mask, pts: P.pts.slice(), cnt: P.cnt.slice(), botPick: (Math.random() * 3) | 0 };
  G.phase = 'trans'; G.time = BATTLE_TIME; G.cd = 0;
  setupP2(G);
  sfx(G, -1, 'boom'); shake(G, -1, 20);
}
function stepTrans(G, dt) {
  const tr = G.tr; tr.t -= dt;
  if (tr.loser >= 0 && tr.pick < 0) {
    for (let k = 0; k < 4; k++) { const s = tr.loser * 4 + k; if (!isBot(G, s) && G.inp[s].card >= 1 && G.inp[s].card <= 3) { tr.pick = G.inp[s].card - 1; sfx(G, -1, 'perfect'); } }
    if (tr.pick < 0 && (tr.t < 2.6 || (!teamHasHuman(G, tr.loser) && tr.t < 5))) { tr.pick = tr.botPick; sfx(G, -1, 'perfect'); }
  }
  if (tr.t <= 0) {
    if (tr.loser >= 0) {
      const L = G.teams[tr.loser], W = G.teams[1 - tr.loser];
      L.card = tr.pick;
      if (tr.pick === 0) { W.g.sysT = 2.5; banner(G, -1, `逆境カード「${CARDS[0].name}」`, `${THEME[W.id].giant} は開幕動けない！`, TEAM_COL[L.id], 2.4); }
      if (tr.pick === 2) L.g.sp = Math.min(100, L.g.sp + 60);
    }
    G.phase = 'p2'; G.cd = 2.2; G.time = BATTLE_TIME;
  }
}

// =====================================================================
// 後半戦：ギガント・バトル
// =====================================================================
function setupP2(G) {
  const tr = G.tr;
  G.teams = [0, 1].map(id => {
    const T = {
      id, fuel: 72, chgB: 2, troubles: [], items: [], mq: [], tilt: null, leverCD: 0, swapT: 0, swaps: 0, armAlarm: 0, buzzCD: 0, planT: 0, kdCD: 0, card: -1, cardUsed: false,
      bp: { decT: 0, guardT: 0, mcd: 2, mv: 0 }, fuelMul: 1, work: 1, cheer: 0,
      g: { x: id ? 670 : 330, face: id ? -1 : 1, hp: 100, max: 100, en: 100, sp: 0, atk: null, hitT: 0, downT: 0, stunT: 0, sysT: 0, dodgeT: 0, guarding: false, walk: 0, vx: 0, charge: 0, dead: 0, fl: 0 },
      crew: [],
    };
    const m = tr ? tr.mask[id] : 0;
    if (m & 1) { T.g.max = T.g.hp = 108; }
    if (m & 2) T.g.sp = 50;
    if (m & 4) T.fuelMul = 0.8;
    if (m & 8) T.mq = [{ t: 'mN', by: id * 4 }, { t: 'mH', by: id * 4 }, { t: 'mS', by: id * 4 }];
    if (m & 16) T.work = 1.15;
    T.cheer = Math.round(Math.min(60, (tr ? tr.pts[id] : 0) * 1.1 * (m & 16 ? 1.5 : 1)));
    const pos = [[640, 215], [330, 215], [900, 210], [460, 300]];
    for (let k = 0; k < 4; k++) T.crew.push({
      slot: id * 4 + k, k, x: pos[k][0], y: pos[k][1], vx: 0, vy: 0, fx: 1, fy: 0, carry: null, role: 'crew', fat: 0, adren: 0, dizzy: 0, job: null, jobT: 0,
      shoutCD: 0, stuckT: 0, lastX: 0, lastY: 0, escaped: false, walk: 0, wallCD: 0, actCD: 0, notice: 0, working: false, conT: undefined, conStep: undefined,
    });
    // 最初の操縦者は Bot（全員人間なら4人目）
    let p = -1; for (let k = 3; k >= 0; k--) if (isBot(G, id * 4 + k)) { p = k; break; }
    if (p < 0) p = 3;
    T.crew[p].role = 'pilot'; T.crew[p].x = ST.seat.x; T.crew[p].y = ST.seat.y;
    return T;
  });
  G.missiles = []; G.sp = null; G.od = false; G.cheered = false;
}
export const pilotOf = T => T.crew.find(c => c.role === 'pilot');
export const zoneOff = (T, z) => T.troubles.some(t => t.zone === z);
const troubleCap = G => G.od ? 4 : 3;
function spawnTrouble(G, T, zone, type) {
  if (T.troubles.length >= troubleCap(G)) return null;
  const Z = ZONES[zone];
  for (let k = 0; k < 20; k++) {
    const x = rnd(Z.x + 30, Z.x + Z.w - 30), y = rnd(Z.y + 30, Z.y + Z.h - 30);
    let ok = true;
    for (const s of Object.values(ST)) if (hyp(s.x - x, s.y - y) < s.r + 38) { ok = false; break; }
    if (ok) for (const t of T.troubles) if (hyp(t.x - x, t.y - y) < 70) { ok = false; break; }
    if (!ok) continue;
    if (type === 'fire') G.cnt.fires++;
    const t = { type, zone, x, y, hp: type === 'fire' ? 45 : 0, prog: 0, born: G.t, spreadT: 7 };
    T.troubles.push(t);
    puffI(G, T.id, x, y, 10, type === 'fire' ? '#ff9a3c' : '#9ad8ff', 160, 8, 'spark');
    return t;
  }
  return null;
}
// ---- 交代
function swapPilot(G, T, newC, reason) {
  const old = pilotOf(T);
  if (!old || old === newC || T.swapT > 0) return false;
  if (newC.carry) dropItem(T, newC, 0);
  old.role = 'crew'; old.x = ST.lever.x + 26; old.y = ST.lever.y + 58; old.vx = old.vy = 0; old.adren = old.fat > 50 ? 12 : 6; old.job = null;
  newC.role = 'pilot'; newC.x = ST.seat.x; newC.y = ST.seat.y; newC.vx = newC.vy = 0; newC.job = null;
  T.swapT = 0.6; T.leverCD = 2.5; T.swaps++;
  sfx(G, T.id, 'swap'); banner(G, T.id, `${G.slots[newC.slot].name} が${THEME[T.id].seat}へ！`, reason, G.slots[newC.slot].col, 1.6);
  puffI(G, T.id, ST.seat.x, ST.seat.y, 14, '#ffffff', 140, 6, 'spark');
  return true;
}
function pullLever(G, T, c) {
  if (c.role === 'pilot') return;
  if (T.leverCD > 0) { popI(G, T.id, ST.lever.x, ST.lever.y - 30, 'レバー冷却中', '#aab'); return; }
  swapPilot(G, T, c, 'レバーで交代');
}
function ejectPilot(G, T) {
  const p = pilotOf(T); if (!p || T.swapT > 0) return;
  let best = null, bd = 1e9;
  for (const c of T.crew) if (c !== p && c.dizzy <= 0 && !c.escaped) { const d = hyp(c.x - ST.seat.x, c.y - ST.seat.y) + (isBot(G, c.slot) ? 0 : 400); if (d < bd) { bd = d; best = c; } }
  if (best) swapPilot(G, T, best, '緊急脱出で交代');
}
// ---- アイテム
function dropItem(T, c, spd) {
  if (!c.carry) return;
  T.items.push({ t: c.carry, x: c.x + c.fx * 18, y: c.y + c.fy * 18, vx: c.fx * spd + c.vx * 0.5, vy: c.fy * spd + c.vy * 0.5, z: 26, vz: spd ? 120 : 0, by: c.slot, fly: false });
  c.carry = null;
}
function throwItem(G, T, c, tx = null, ty = null) {
  if (!c.carry) return;
  let vx, vy; const vz = 230;
  if (tx !== null) { const dx = tx - c.x, dy = ty - c.y, d = hyp(dx, dy) || 1, sp = d / (2 * vz / 1000 + 0.04); vx = dx / d * sp; vy = dy / d * sp; }
  else { vx = c.fx * 470; vy = c.fy * 470; }
  T.items.push({ t: c.carry, x: c.x, y: c.y, vx, vy, z: 30, vz, by: c.slot, fly: true });
  c.carry = null; sfx(G, T.id, 'whoosh');
}
function feedReactor(G, T, c, viaThrow) {
  T.fuel += 15; G.st[c.slot].coal++; sfx(G, T.id, 'feed');
  puffI(G, T.id, ST.reactor.x, ST.reactor.y - 10, 8, '#ff9a3c', 110, 7, 'spark');
  popI(G, T.id, ST.reactor.x, ST.reactor.y - 70, viaThrow ? 'ナイス投入！ +15' : '+15', '#ffb347');
  if (T.fuel >= 120) reactorBoom(G, T, c);
}
function reactorBoom(G, T, c) {
  G.cnt.boom++; T.fuel = 32; T.g.en = 0; T.g.sysT = Math.max(T.g.sysT, 1.6); T.g.hp = Math.max(1, T.g.hp - 3); G.st[c.slot].boom++;
  sfx(G, T.id, 'boom'); shake(G, T.id, 10);
  puffI(G, T.id, ST.reactor.x, ST.reactor.y, 40, '#ff6f3c', 320, 14, 'fire');
  banner(G, T.id, THEME[T.id].over, `${G.slots[c.slot].name} が${THEME[T.id].fuel}を入れすぎた！`, '#ff5a4f');
  for (const o of T.crew) if (o.role !== 'pilot' && hyp(o.x - ST.reactor.x, o.y - ST.reactor.y) < 150) { o.dizzy = 1.2; const a = Math.atan2(o.y - ST.reactor.y, o.x - ST.reactor.x); o.vx += Math.cos(a) * 500; o.vy += Math.sin(a) * 500; shout(G, T, o, 'アチチッ！', true); }
  spawnTrouble(G, T, 'rarm', 'fire');
}
function loadMissile(G, T, c, type) {
  if (T.mq.length >= 3) { popI(G, T.id, ST.launcher.x, ST.launcher.y - 60, '満杯！', '#aab'); return false; }
  T.mq.push({ t: type, by: c.slot }); G.st[c.slot].load++; sfx(G, T.id, 'load');
  popI(G, T.id, ST.launcher.x, ST.launcher.y - 60, `${THEME[T.id][type]} 装填！`, '#ffe9a8');
  return true;
}
function landItem(G, T, it) {
  it.fly = false; const c = T.crew[it.by % 4];
  if (it.t === 'coal' && hyp(it.x - ST.reactor.x, it.y - ST.reactor.y) < ST.reactor.r + 6) { feedReactor(G, T, c, true); return true; }
  if (it.t !== 'coal' && hyp(it.x - ST.launcher.x, it.y - ST.launcher.y) < ST.launcher.r + 4 && T.mq.length < 3) { loadMissile(G, T, c, it.t); return true; }
  sfx(G, T.id, 'coal'); return false;
}
function updateItems(G, T, dt) {
  for (let i = T.items.length - 1; i >= 0; i--) {
    const it = T.items[i];
    if (T.tilt) it.vx += T.tilt.dir * 1100 * dt;
    if (it.fly || it.z > 0) {
      it.vz -= 1000 * dt; it.z += it.vz * dt; it.x += it.vx * dt; it.y += it.vy * dt;
      if (it.fly && it.z < 46) for (const c of T.crew) {
        if (c.slot === it.by || c.role === 'pilot' || c.escaped) continue;
        if (hyp(c.x - it.x, c.y - it.y) < 24) {
          c.dizzy = Math.max(c.dizzy, 0.9); G.st[it.by].ff++; sfx(G, T.id, 'bonk');
          shout(G, T, c, pick(['いてっ！', 'どこ投げてんだ！', 'ぐえっ']), true);
          popI(G, T.id, c.x, c.y - 40, 'ゴツン！', '#ffd23f'); it.vx *= -0.3; it.vy *= -0.3; it.fly = false; break;
        }
      }
      if (it.z <= 0) { it.z = 0; it.vz = 0; if (landItem(G, T, it)) { T.items.splice(i, 1); continue; } it.vx *= 0.3; it.vy *= 0.3; }
    } else { const f = Math.pow(0.02, dt); it.vx *= f; it.vy *= f; it.x += it.vx * dt; it.y += it.vy * dt; }
    if (it.x < ROOM.x0 + 10) { it.x = ROOM.x0 + 10; it.vx = Math.abs(it.vx) * 0.4; }
    if (it.x > ROOM.x1 - 10) { it.x = ROOM.x1 - 10; it.vx = -Math.abs(it.vx) * 0.4; }
    if (it.y < ROOM.y0 + 10) { it.y = ROOM.y0 + 10; it.vy = Math.abs(it.vy) * 0.4; }
    if (it.y > ROOM.y1 - 10) { it.y = ROOM.y1 - 10; it.vy = -Math.abs(it.vy) * 0.4; }
    for (const w of WALLS) if (it.x > w.x - 8 && it.x < w.x + w.w + 8 && it.y > w.y && it.y < w.y + w.h) { it.x = it.x < w.x + w.w / 2 ? w.x - 8 : w.x + w.w + 8; it.vx *= -0.3; }
  }
  if (T.items.length > 10) T.items.splice(0, T.items.length - 10);
}
// ---- 乗組員の移動
export function crewSpeed(G, T, c) {
  let s = isBot(G, c.slot) ? BAL.botSpd * G.hc[T.id].spd * (G.lazy[T.id] && G.proxy !== c.slot ? 0.9 : 1) : 235;
  if (G.proxy === c.slot) s = 225;
  if (c.adren > 0) s *= 1.28;
  if (G.od) s *= 1.15;
  if (c.carry === 'coal') s *= 0.92;
  return s;
}
export function moveCrew(G, T, c, wx, wy, dt) {
  if (c.role === 'pilot' || c.escaped) return;
  let ctrl = 1; if (c.dizzy > 0) ctrl = 0.15; if (T.tilt) ctrl *= 0.3;
  const sp = crewSpeed(G, T, c), k = Math.min(1, dt * 14 * ctrl);
  c.vx += (wx * sp - c.vx) * k; c.vy += (wy * sp - c.vy) * k;
  if (T.tilt) c.vx += T.tilt.dir * 1300 * dt;
  if (Math.abs(wx) + Math.abs(wy) > 0.2) { const l = hyp(wx, wy); c.fx = wx / l; c.fy = wy / l; }
  c.x += c.vx * dt; c.y += c.vy * dt; c.walk += hyp(c.vx, c.vy) * dt * 0.05;
  const R = 16; let hitWall = false;
  if (c.x < ROOM.x0 + R) { c.x = ROOM.x0 + R; hitWall = Math.abs(c.vx) > 260; c.vx = 0; }
  if (c.x > ROOM.x1 - R) { c.x = ROOM.x1 - R; hitWall = Math.abs(c.vx) > 260; c.vx = 0; }
  if (c.y < ROOM.y0 + R) { c.y = ROOM.y0 + R; c.vy = 0; }
  if (c.y > ROOM.y1 - R) { c.y = ROOM.y1 - R; c.vy = 0; }
  for (const w of WALLS) {
    const nx = clamp(c.x, w.x, w.x + w.w), ny = clamp(c.y, w.y, w.y + w.h), dx = c.x - nx, dy = c.y - ny, d = hyp(dx, dy);
    if (d < R) {
      if (d < 0.01) c.x = c.x < w.x + w.w / 2 ? w.x - R : w.x + w.w + R;
      else { c.x = nx + dx / d * R; c.y = ny + dy / d * R; if (Math.abs(dx) > Math.abs(dy)) { if (Math.abs(c.vx) > 260) hitWall = true; c.vx = 0; } else c.vy = 0; }
    }
  }
  for (const s of SOLIDS) {
    const dx = c.x - s.x, dy = c.y - s.y, d = hyp(dx, dy), m = s.solid + R;
    if (d < m && d > 0.01) { c.x = s.x + dx / d * m; c.y = s.y + dy / d * m; const vn = (c.vx * dx + c.vy * dy) / d; if (vn < 0) { c.vx -= vn * dx / d; c.vy -= vn * dy / d; } }
  }
  if (hitWall && T.tilt && c.wallCD <= 0 && !G.client) {
    c.dizzy = Math.max(c.dizzy, 0.6); G.st[c.slot].fall++; c.wallCD = 1.2; sfx(G, T.id, 'bonk');
    popI(G, T.id, c.x, c.y - 36, 'ゴロゴロ…ゴン！', '#ffd23f', 16);
  }
}
function separateCrew(T) {
  const L = T.crew.filter(c => c.role !== 'pilot' && !c.escaped);
  for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
    const a = L[i], b = L[j], dx = b.x - a.x, dy = b.y - a.y, d = hyp(dx, dy);
    if (d < 30 && d > 0.01) { const p = (30 - d) / 2; a.x -= dx / d * p; a.y -= dy / d * p; b.x += dx / d * p; b.y += dy / d * p; }
  }
}
const near = (c, s, extra = 30) => hyp(c.x - s.x, c.y - s.y) < s.r + extra;
function nearestFloorItem(T, c, maxD = 38) {
  let best = null, bd = maxD;
  for (const it of T.items) if (!it.fly && it.z <= 0) { const d = hyp(it.x - c.x, it.y - c.y); if (d < bd) { bd = d; best = it; } }
  return best;
}
const defending = (G, T) => G.sp && G.sp.team !== T.id && G.sp.phase !== 'fire' && G.sp.thrust < 1;
function workTarget(G, T, c) {
  let best = null, bd = 1e9;
  for (const t of T.troubles) { const d = hyp(t.x - c.x, t.y - c.y); if (d < 52 && d < bd) { bd = d; best = t; } }
  if (best) return best;
  if (defending(G, T) && near(c, ST.thruster, 30)) return 'thruster';
  return null;
}
function consoleOf(G, T, c) { if (!G.sp || G.sp.team !== T.id) return null; for (const k of CON) if (G.sp.assign[k] === c.slot) return k; return null; }
function doPress(G, T, c, rt = -1) {
  if (G.phase === 'escape') { if (G.esc.loser === T.id && near(c, ST.pod, 30)) escapeCrew(G, T, c); return; }
  const ck = consoleOf(G, T, c);
  if (ck && G.sp.phase === 'seq' && CON[G.sp.step] === ck && near(c, ST[ck], 34)) { judgeConsole(G, c, rt); return; }
  if (near(c, ST.lever, 42) && T.leverCD <= 0 && T.swapT <= 0) { pullLever(G, T, c); return; }
  if (c.carry) {
    if (c.carry === 'coal' && near(c, ST.reactor, 34)) { c.carry = null; feedReactor(G, T, c, false); return; }
    if (c.carry !== 'coal' && near(c, ST.launcher, 34)) { if (loadMissile(G, T, c, c.carry)) c.carry = null; return; }
    dropItem(T, c, 0); G.st[c.slot].drop++; sfx(G, T.id, 'coal'); return;
  }
  const it = nearestFloorItem(T, c);
  if (it) { c.carry = it.t; T.items.splice(T.items.indexOf(it), 1); sfx(G, T.id, 'pick'); return; }
  if (near(c, ST.lever, 42)) { pullLever(G, T, c); return; }
  if (near(c, ST.coal, 30)) { c.carry = 'coal'; sfx(G, T.id, 'pick'); return; }
  if (near(c, ST.charger, 30) && G.phase === 'p2') { pumpCharger(G, T, c); return; }
  for (const k of ['crateN', 'crateH', 'crateS']) if (near(c, ST[k], 30)) { c.carry = ST[k].item; sfx(G, T.id, 'pick'); return; }
}
export const chargerOpen = (G, T) => T.g.sp < 100 && !(G.sp && G.sp.team === T.id);
function pumpCharger(G, T, c) {
  if (!chargerOpen(G, T)) { popI(G, T.id, ST.charger.x, ST.charger.y - 40, T.g.sp >= 100 ? '必殺技ゲージ満タン！' : '今は使えない', '#aab'); return; }
  if (T.chgB < BAL.chgPer) { popI(G, T.id, ST.charger.x, ST.charger.y - 40, 'オーバーヒート中…', '#ff9a3c', 14); return; }
  T.chgB -= BAL.chgPer; T.g.sp = Math.min(100, T.g.sp + BAL.chgPer * 2); G.st[c.slot].chg++;
  sfx(G, T.id, 'pump'); puffI(G, T.id, ST.charger.x, ST.charger.y, 3, T.id ? '#ff9af0' : '#ffd23f', 90, 5, 'spark');
  if (G.st[c.slot].chg % 5 === 0) popI(G, T.id, ST.charger.x, ST.charger.y - 40, '必殺ゲージ +', '#ffd23f', 15);
}
function doWork(G, T, c, dt) {
  const t = workTarget(G, T, c); if (!t) return false;
  const rate = (c.adren > 0 ? 1.5 : 1) * (G.od ? 1.6 : 1) * T.work;
  if (t === 'thruster') {
    const sp = G.sp; sp.thrust = Math.min(1, sp.thrust + dt / BAL.thrustTime * rate); G.st[c.slot].thrust += dt;
    if (sp.thrust >= 1 && !sp.ready) { sp.ready = true; banner(G, T.id, `${THEME[T.id].thruster} 準備完了！`, '', '#3fe0d0', 1.4); sfx(G, T.id, 'fix'); }
    return true;
  }
  if (t.type === 'fire') { t.hp -= 62 * dt * rate; if (Math.random() < 0.08) sfx(G, T.id, 'psh'); if (t.hp <= 0) finishTrouble(G, T, t, c); }
  else { t.prog += dt / 1.3 * rate; if (t.prog >= 1) finishTrouble(G, T, t, c); }
  return true;
}
function finishTrouble(G, T, t, c) {
  const i = T.troubles.indexOf(t); if (i < 0) return;
  T.troubles.splice(i, 1); G.st[c.slot].fix++; sfx(G, T.id, 'fix');
  popI(G, T.id, t.x, t.y - 30, t.type === 'fire' ? THEME[T.id].fireDone : THEME[T.id].cableDone, '#7dffb0');
  if (!zoneOff(T, t.zone)) popE(G, T.g.x, 240, `${THEME[T.id].zones[t.zone]} 復旧！`, '#7dffb0', 20);
}
function escapeCrew(G, T, c) {
  if (c.escaped) return; c.escaped = true; c.carry = null; sfx(G, T.id, 'fix');
  popI(G, T.id, ST.pod.x, ST.pod.y - 50, `${G.slots[c.slot].name} 脱出成功！`, '#7dffb0');
  puffI(G, T.id, ST.pod.x, ST.pod.y, 16, '#ffffff', 160, 7, 'spark');
}
// ---- Bot乗組員
function navStep(c, tx, ty) {
  let gx = tx, gy = ty;
  for (const P of PARTS) {
    const sideC = c.x < P.x ? -1 : 1, sideT = tx < P.x ? -1 : 1;
    if (sideC !== sideT) {
      const inGap = c.y > P.lo + 18 && c.y < P.hi - 18;
      if (Math.abs(c.x - P.x) < 50 && inGap) { gx = P.x - sideC * 50; gy = clamp(c.y, P.lo + 26, P.hi - 26); }
      else { gx = P.x + sideC * 46; gy = clamp(lerp(c.y, ty, 0.3), P.lo + 30, P.hi - 30); }
      break;
    }
  }
  let dx = gx - c.x, dy = gy - c.y; const d = hyp(dx, dy) || 1; dx /= d; dy /= d;
  for (const s of SOLIDS) {
    const ox = s.x - c.x, oy = s.y - c.y, od = hyp(ox, oy);
    if (od < s.solid + 46 && (ox * dx + oy * dy) > 0 && hyp(tx - s.x, ty - s.y) > s.solid + 10) { const side = (ox * dy - oy * dx) > 0 ? 1 : -1, ndx = dx - dy * side * 0.9, ndy = dy + dx * side * 0.9; dx = ndx; dy = ndy; }
  }
  const l = hyp(dx, dy) || 1; return [dx / l, dy / l];
}
function planBots(G, T, E_) {
  const bots = T.crew.filter(c => isBot(G, c.slot) && c.role !== 'pilot' && !c.escaped);
  const free = new Set(bots.filter(c => c.dizzy <= 0));
  const humans = T.crew.filter(c => !isBot(G, c.slot) && c.role === 'crew');
  const take = (job, pos, cond = () => true) => {
    let best = null, bd = 1e9;
    for (const b of free) { if (!cond(b)) continue; const d = hyp(b.x - pos.x, b.y - pos.y) + (b.job && b.job.key === job.key ? -80 : 0); if (d < bd) { bd = d; best = b; } }
    if (best) { free.delete(best); if (!best.job || best.job.key !== job.key) { best.job = job; best.jobT = 0; } }
    return best;
  };
  const sp = G.sp;
  if (sp && sp.team === T.id && sp.phase !== 'fire') for (const k of CON) { const b = bots.find(x => x.slot === sp.assign[k]); if (b && free.has(b)) { free.delete(b); b.job = { key: 'con' + k, type: 'console', st: k }; } }
  if (defending(G, T) && sp.el > sp.notice * (2 - G.hc[T.id].spd) * (G.lazy[T.id] ? 1.35 : 1)) {
    if (!humans.some(h => near(h, ST.thruster, 30))) take({ key: 'thr', type: 'thruster' }, ST.thruster);
    if (sp.phase === 'seq' && sp.thrust < 0.3) take({ key: 'thr2', type: 'thruster' }, ST.thruster);
  }
  const pc = pilotOf(T);
  if (pc && T.leverCD <= 0 && T.swapT <= 0 && !(sp && sp.team === T.id) && (T.g.stunT > 0.6 || (isBot(G, pc.slot) && pc.fat > 82))) take({ key: 'lever', type: 'lever' }, ST.lever, b => b.fat < 40);
  const troubles = T.troubles.filter(t => G.t - t.born > BAL.notice * (G.lazy[T.id] ? 1.9 : 1)).sort((a, b) => (b.type === 'fire' ? b.hp : 50) - (a.type === 'fire' ? a.hp : 50));
  for (const t of troubles) { if (humans.some(h => hyp(h.x - t.x, h.y - t.y) < 70)) continue; take({ key: 'tr' + t.born, type: 'trouble', tr: t }, t); }
  const fuelCarried = T.crew.filter(c => c.carry === 'coal').length, fuelNeed = T.fuel < 30 ? 2 : T.fuel < 62 ? 1 : 0;
  for (let i = fuelCarried; i < fuelNeed; i++) take({ key: 'fuel' + i, type: 'fuel' }, ST.coal);
  for (const b of free) if (b.carry === 'coal') { free.delete(b); if (!b.job || b.job.type !== 'fuel') b.job = { key: 'fuelc', type: 'fuel' }; }
  const mCarried = T.crew.filter(c => c.carry && c.carry !== 'coal').length + T.items.filter(i => i.fly && i.t !== 'coal').length;
  for (const b of free) if (b.carry && b.carry !== 'coal') { free.delete(b); b.job = { key: 'mis' + b.slot, type: 'missile', want: b.carry }; }
  if (T.mq.length + mCarried < 3) {
    const want = sp && sp.team !== T.id && sp.phase === 'prep' && sp.stopTry ? 'mS' : (Math.random() < 0.5 ? 'mN' : Math.random() < 0.6 ? 'mH' : 'mS');
    take({ key: 'misN', type: 'missile', want }, ST.launcher);
  }
  const homes = [{ x: 560, y: 210 }, { x: 760, y: 220 }, { x: 420, y: 210 }, { x: 860, y: 200 }];
  let chg = 0;
  for (const b of free) { if (chargerOpen(G, T) && chg < 1 && !humans.some(h => near(h, ST.charger, 40))) { chg++; b.job = { key: 'chg', type: 'charge' }; } else b.job = { key: 'idle' + b.k, type: 'idle', home: homes[b.k] }; }
}
function botCrew(G, T, c, dt) {
  let wx = 0, wy = 0, act = false, hold = false; const j = c.job;
  const go = (tx, ty, r = 8) => { if (hyp(tx - c.x, ty - c.y) > r) { [wx, wy] = navStep(c, tx, ty); return false; } return true; };
  const approach = (s, extra = 22) => { const a = Math.atan2(c.y - s.y, c.x - s.x); return go(s.x + Math.cos(a) * (s.r + extra), s.y + Math.sin(a) * (s.r + extra), 12) || near(c, s, extra + 6); };
  if (j && c.dizzy <= 0) {
    c.jobT += dt;
    switch (j.type) {
      case 'pod': if (approach(ST.pod, 18)) act = true; break;
      case 'console': {
        const s = ST[j.st], sp = G.sp; approach(s, 20);
        if (sp && sp.phase === 'seq' && CON[sp.step] === j.st && near(c, s, 34)) {
          if (c.conStep !== sp.step) { c.conStep = sp.step; c.conT = 1.0 + gauss() * 0.065 + (Math.random() < 0.1 ? 0.25 : 0); }
          if (sp.ringT >= c.conT && !sp.pressed) judgeConsole(G, c, -1);
        }
        break;
      }
      case 'thruster': if (approach(ST.thruster, 18)) hold = true; break;
      case 'lever': if (approach(ST.lever, 16)) act = true; break;
      case 'trouble': {
        const t = j.tr; if (!T.troubles.includes(t)) { c.job = null; break; }
        const a = Math.atan2(c.y - t.y, c.x - t.x);
        if (go(t.x + Math.cos(a) * 34, t.y + Math.sin(a) * 34, 14) || hyp(t.x - c.x, t.y - c.y) < 48) hold = true;
        break;
      }
      case 'fuel': {
        if (!c.carry) { if (approach(ST.coal, 18)) act = true; }
        else if (c.carry !== 'coal') { if (approach(ST.launcher, 18)) act = true; }
        else {
          const d = hyp(c.x - ST.reactor.x, c.y - ST.reactor.y);
          if (!j.thr && d < 190 && d > 105) { j.thr = true; if (Math.random() < 0.22 && T.fuel < 85) { const tx = ST.reactor.x + rnd(-14, 14), ty = ST.reactor.y + rnd(-22, 22); throwItem(G, T, c, tx, ty); shout(G, T, c, 'そらっ！'); break; } }
          if (approach(ST.reactor, 16)) { if (T.fuel <= 88) act = true; }
        }
        break;
      }
      case 'missile': {
        if (!c.carry) { const crate = j.want === 'mH' ? ST.crateH : j.want === 'mS' ? ST.crateS : ST.crateN; if (approach(crate, 16)) act = true; }
        else if (c.carry === 'coal') { if (approach(ST.reactor, 16)) act = T.fuel <= 95; }
        else if (approach(ST.launcher, 16)) { if (T.mq.length < 3) act = true; }
        break;
      }
      case 'idle': go(j.home.x, j.home.y, 30); break;
      case 'charge': if (approach(ST.charger, 16) && Math.random() < dt * 2.2) doPress(G, T, c); break;
    }
  }
  if (Math.abs(wx) + Math.abs(wy) > 0.3) {
    if (hyp(c.x - c.lastX, c.y - c.lastY) < 1.2) c.stuckT += dt; else c.stuckT = Math.max(0, c.stuckT - dt);
    if (c.stuckT > 0.9) { const a = rnd(0, 6.28); c.vx += Math.cos(a) * 260; c.vy += Math.sin(a) * 260; c.stuckT = 0; }
  }
  c.lastX = c.x; c.lastY = c.y;
  moveCrew(G, T, c, wx * 0.94, wy * 0.94, dt);
  c.working = false;
  if (c.dizzy <= 0) {
    if (act) { c.actCD -= dt; if (c.actCD <= 0) { doPress(G, T, c); c.actCD = 0.25; } }
    if (hold) c.working = doWork(G, T, c, dt);
  }
}
function humanCrew(G, T, c, inp, dt) {
  const dz = c.dizzy > 0;
  moveCrew(G, T, c, dz ? 0 : inp.mx, dz ? 0 : inp.my, dt);
  c.working = false; if (dz) return;
  if (inp.aP || inp.xP) doPress(G, T, c, inp.rt);
  if (inp.a || inp.x) c.working = doWork(G, T, c, dt);
  if (inp.bP && c.carry) throwItem(G, T, c);
}
// ナビ：次にやると良いこと（ライト層向けの道案内）
export function crewNavi(G, T, c) {
  if (c.role === 'pilot' || c.escaped) return null;
  const th = THEME[T.id], at = (s, text, hold = false) => ({ x: ST[s].x, y: ST[s].y, text, hold });
  if (G.phase === 'escape') return G.esc.loser === T.id ? at('pod', `${th.pod}へ逃げろ！`) : null;
  if (G.phase !== 'p2' || G.cd > 0) return null;
  const sp = G.sp;
  if (sp && sp.team === T.id && sp.phase !== 'fire') { const k = CON.find(q => sp.assign[q] === c.slot); if (k) return at(k, sp.phase === 'prep' ? '光っている持ち場へ！' : '輪が重なったら押す！'); return null; }
  if (sp && sp.team !== T.id && sp.phase !== 'fire' && sp.thrust < 1) return at('thruster', `${th.thruster}を長押し！`, true);
  const pc = pilotOf(T);
  if (pc && T.leverCD <= 0 && (pc.fat > 82 || T.g.stunT > 0.5)) return at('lever', `${th.lever}を引いて交代！`);
  if (c.carry === 'coal') return at('reactor', T.fuel > 100 ? `入れすぎ注意！様子を見て${th.reactor}へ` : `${th.reactor}へ入れる`);
  if (c.carry) return at('launcher', `${th.launcher}へ装填する`);
  let best = null, bd = 1e9; for (const t of T.troubles) { const d = hyp(t.x - c.x, t.y - c.y); if (d < bd) { bd = d; best = t; } }
  if (best) return { x: best.x, y: best.y, text: `${best.type === 'fire' ? th.fireVerb : th.cableVerb}（長押し）`, hold: true };
  if (T.fuel < 50 && !T.crew.some(o => o !== c && o.carry === 'coal')) return at('coal', `${th.fuel}を取って${th.reactor}へ`);
  if (T.mq.length < 2 && !T.crew.some(o => o !== c && o.carry && o.carry !== 'coal')) return at('crateN', `弾を取って${th.launcher}へ`);
  if (T.fuel < BAL.optLo && !T.crew.some(o => o !== c && o.carry === 'coal')) return at('coal', `${th.fuel}で最適出力（${BAL.optLo}〜${BAL.optHi}）に`);
  if (chargerOpen(G, T)) return at('charger', '必殺チャージャーを連打！');
  return null;
}
export function promptFor(G, T, c) {
  if (c.role === 'pilot' || c.escaped) return null;
  const th = THEME[T.id];
  if (G.phase === 'escape') return G.esc.loser === T.id && near(c, ST.pod, 30) ? '脱出する' : null;
  if (G.phase !== 'p2') return null;
  const ck = consoleOf(G, T, c);
  if (ck && G.sp.phase !== 'fire') return near(c, ST[ck], 34) ? (G.sp.phase === 'seq' && CON[G.sp.step] === ck ? 'タイミングよく押す！' : '合図を待て') : null;
  const wt = workTarget(G, T, c);
  if (wt === 'thruster') return `長押し：${th.thruster}起動`;
  if (wt) return '長押し：' + (wt.type === 'fire' ? th.fireVerb : th.cableVerb);
  if (near(c, ST.lever, 42) && T.leverCD <= 0) return `${th.lever}：${th.seat}へ`;
  if (c.carry) {
    if (c.carry === 'coal' && near(c, ST.reactor, 34)) return T.fuel > 95 ? `${th.fuel}を入れる（入れすぎ注意！）` : `${th.fuel}を入れる`;
    if (c.carry !== 'coal' && near(c, ST.launcher, 34)) return T.mq.length >= 3 ? `${th.launcher}が満杯` : `${th[c.carry]}を装填`;
    return null;
  }
  if (nearestFloorItem(T, c)) return '拾う';
  if (near(c, ST.lever, 42)) return T.leverCD > 0 ? 'レバー冷却中' : `${th.lever}：${th.seat}へ`;
  if (near(c, ST.coal, 30)) return `${th.fuel}を持つ`;
  if (near(c, ST.charger, 30)) return chargerOpen(G, T) ? '連打：必殺チャージャー' : '必殺ゲージ満タン';
  for (const k of ['crateN', 'crateH', 'crateS']) if (near(c, ST[k], 30)) return `${th[ST[k].item]}を持つ`;
  return null;
}
// ---- 必殺技（撃つ側4人 vs 避ける側）
function canAct(G, T) {
  const g = T.g;
  return !g.atk && g.hitT <= 0 && g.downT <= 0 && g.stunT <= 0 && g.sysT <= 0 && T.swapT <= 0 && g.dodgeT <= 0 && !(G.sp && G.sp.phase !== 'prep') && G.phase === 'p2' && G.cd <= 0;
}
function startSpecial(G, T) {
  const g = T.g; if (g.sp < 100 || G.sp || !canAct(G, T)) return false;
  g.sp = 0; G.cnt.sp++;
  const crew = T.crew.filter(c => c.role !== 'pilot'), assign = {}, used = new Set();
  for (const pass of [0, 1]) for (const c of crew) {
    if (used.has(c.slot) || (pass === 0) === isBot(G, c.slot)) continue;
    let bk = null, bd = 1e9; for (const k of CON) if (assign[k] === undefined) { const d = hyp(c.x - ST[k].x, c.y - ST[k].y); if (d < bd) { bd = d; bk = k; } }
    if (bk) { assign[bk] = c.slot; used.add(c.slot); }
  }
  for (const c of T.crew) { c.conStep = undefined; if (c.role !== 'pilot' && c.carry) dropItem(T, c, 0); }
  G.sp = { team: T.id, phase: 'prep', t: 4.2, el: 0, assign, step: 0, ringT: 0, res: [], pressed: false, nextT: 0, botFinal: null, thrust: 0, notice: Math.random() < 0.3 ? 99 : rnd(0.8, 4.5), stopTry: Math.random() < 0.35, ready: false, out: '' };
  const th = THEME[T.id], eth = THEME[1 - T.id];
  banner(G, T.id, '必殺技スタンバイ！', '光っている装置へ急げ！', '#ffd23f', 2.4);
  banner(G, 1 - T.id, `敵が${th.special}をチャージ中！`, `${eth.thruster}を長押しで起動！（${eth.mS}を当てても止められる）`, '#ff5af0', 3.2);
  sfx(G, -1, 'alarm'); sfx(G, -1, 'charge');
  for (const c of crew) if (isBot(G, c.slot)) shout(G, T, c, pick(['位置につけ！', 'いくぞ！', '任せろ！']), true);
  for (const c of G.teams[1 - T.id].crew) if (isBot(G, c.slot) && c.role !== 'pilot') shout(G, G.teams[1 - T.id], c, pick(['来るぞ！', 'よけろ！', '急げ！']));
  return true;
}
function judgeConsole(G, c, rt) {
  const sp = G.sp; if (!sp || sp.phase !== 'seq' || sp.pressed) return;
  let ringT = sp.ringT; if (rt >= 0 && Math.abs(rt - sp.ringT) < 0.45) ringT = rt;
  if (ringT < 0.55) return;
  const d = Math.abs(ringT - 1.0), r = d <= 0.09 ? 'P' : d <= 0.22 ? 'G' : 'M';
  sp.res.push(r); sp.pressed = true; sp.nextT = 0.25;
  if (r === 'P') { G.st[c.slot].perfect++; sfx(G, sp.team, 'perfect'); } else sfx(G, sp.team, r === 'G' ? 'good' : 'miss');
  const txt = r === 'P' ? 'PERFECT!' : r === 'G' ? 'GOOD' : 'MISS', col = r === 'P' ? '#ffd23f' : r === 'G' ? '#7dffb0' : '#ff6464';
  if (sp.step < 3) { const pos = ST[CON[sp.step]]; popI(G, sp.team, pos.x, pos.y - 46, txt, col, 22); } else popE(G, G.teams[sp.team].g.x, 250, txt, col, 28);
}
function cancelSpecial(G, why) {
  const sp = G.sp, T = G.teams[sp.team]; G.sp = null; T.g.sp = 50; G.cnt.cancel++;
  banner(G, T.id, '必殺技が中断された！', why, '#ff9a3c', 1.8); banner(G, 1 - T.id, '敵の必殺技を止めた！', why, '#7dffb0', 1.8); sfx(G, -1, 'fix');
}
function updateSpecial(G, dt) {
  const sp = G.sp; if (!sp) return; const T = G.teams[sp.team], D = G.teams[1 - sp.team];
  sp.el += dt;
  if (sp.phase !== 'fire') for (const k of CON) {
    const cur = T.crew.find(c => c.slot === sp.assign[k]);
    if (!cur || cur.role === 'pilot') { const used = Object.values(sp.assign), nc = T.crew.find(c => c.role !== 'pilot' && !(used.includes(c.slot) && CON.some(q => q !== k && sp.assign[q] === c.slot))); if (nc) sp.assign[k] = nc.slot; }
  }
  if (sp.phase === 'prep') {
    if (T.g.downT <= 0) sp.t -= dt; if (sp.t <= 0) { sp.phase = 'seq'; sp.step = 0; sp.ringT = 0; sp.pressed = false; sfx(G, sp.team, 'alarm'); }
  } else if (sp.phase === 'seq') {
    if (sp.pressed) { sp.nextT -= dt; if (sp.nextT <= 0) { sp.step++; sp.ringT = 0; sp.pressed = false; if (sp.step >= 4) fireSpecial(G); } return; }
    sp.ringT += dt;
    if (sp.step === 3) {
      const pc = pilotOf(T);
      if (pc && !isBot(G, pc.slot)) { const inp = G.inp[pc.slot]; if (inp.sP || inp.aP || inp.xP) judgeConsole(G, pc, inp.rt); }
      else { if (sp.botFinal === null) sp.botFinal = 1.0 + gauss() * 0.06; if (sp.ringT >= sp.botFinal) judgeConsole(G, pc || T.crew[0], -1); }
    } else if (sp.assign[CON[sp.step]] === undefined && sp.ringT > 1.0) judgeConsole(G, T.crew[0], -1);
    if (!sp.pressed && sp.ringT > 1.3) {
      sp.res.push('M'); sp.pressed = true; sp.nextT = 0.2; sfx(G, sp.team, 'miss');
      if (sp.step < 3) { const pos = ST[CON[sp.step]]; popI(G, sp.team, pos.x, pos.y - 46, 'MISS', '#ff6464', 22); } else popE(G, T.g.x, 250, 'MISS', '#ff6464', 28);
    }
  } else if (sp.phase === 'fire') {
    const before = sp.t; sp.t -= dt;
    if (before > 0.9 && sp.t <= 0.9) resolveSpecial(G);
    if (sp.t <= 0) G.sp = null;
  }
}
function fireSpecial(G) {
  const sp = G.sp, T = G.teams[sp.team], D = G.teams[1 - sp.team];
  sp.phase = 'fire'; sp.t = 1.8; sp.allP = sp.res.every(r => r === 'P');
  sp.out = sp.thrust >= 1 ? (sp.allP ? 'graze' : 'dodge') : sp.thrust >= 0.6 ? 'graze' : 'hit';
  if (sp.allP) G.cnt.spP++;
  sfx(G, -1, 'beam'); shake(G, -1, 12);
  cutin(G, -1, sp.allP ? THEME[T.id].specialP : THEME[T.id].special + '！', sp.allP ? '#ffd23f' : TEAM_COL[T.id], sp.allP ? 1.8 : 1.3);
  if (sp.out === 'dodge') D.g.dodgeT = 1.5;
}
function resolveSpecial(G) {
  const sp = G.sp, T = G.teams[sp.team], D = G.teams[1 - sp.team], val = { P: 1, G: 0.6, M: 0.15 };
  const q = sp.res.reduce((a, r) => a + val[r], 0) / sp.res.length;
  let dmg = BAL.spBase + BAL.spVar * q + (sp.allP ? BAL.spPerfect : 0);
  G.cnt[sp.out]++;
  if (sp.out === 'dodge') {
    banner(G, D.id, '回避成功！', `${THEME[D.id].thruster} 全開！`, '#3fe0d0', 1.6); banner(G, T.id, 'かわされた！', '', '#ff9a3c', 1.4);
    explE(G, D.g.x + T.g.face * 90, 60, 26, 1); E(G, 'col', -1, D.g.x + T.g.face * 90, 80); sfx(G, -1, 'boom'); return;
  }
  if (sp.out === 'graze') { dmg *= 0.5; popE(G, D.g.x, 260, 'かすった！', '#c9f2ff', 22); }
  D.g.dodgeT = 0;
  const real = hitGiant(G, D, T, dmg, 'head', { unblock: true, kd: sp.out === 'hit', special: true, kb: 70 });
  const pc = pilotOf(T); if (pc) G.st[pc.slot].dmg += real * 0.4;
  for (const s of Object.values(sp.assign)) G.st[s].dmg += real * 0.2;
  explE(G, D.g.x, 110, 40, 1.4); sfx(G, -1, 'boom'); E(G, 'col', -1, D.g.x - D.g.face * 120, 60);
  if (sp.out === 'hit') { spawnTrouble(G, D, pick(['rarm', 'larm', 'legs']), Math.random() < 0.5 ? 'fire' : 'cable'); banner(G, D.id, '直撃！', `${THEME[D.id].thruster}が間に合わなかった…`, '#ff5a4f', 1.6); }
}
// ---- 外の戦闘
function hitGiant(G, D, A, dmg, part, o = {}) {
  const g = D.g; if (G.phase !== 'p2' || g.dodgeT > 0 || g.hp <= 0) return 0;
  const blocked = g.guarding && !o.unblock && g.downT <= 0 && g.stunT <= 0;
  dmg *= G.hc[A.id].dmg;
  if (A.fuel >= BAL.optLo && A.fuel <= BAL.optHi) dmg *= BAL.optMul;
  // ジャストガード：攻撃が当たる直前（0.15秒以内）にガードを始めると、無傷で相手をよろけさせる
  const dp = pilotOf(D);
  if (blocked && o.melee && dp && !isBot(G, dp.slot) && G.t - (g.gStart || -9) < 0.15) {
    A.g.atk = null; A.g.hitT = 0.75; A.g.buf = null; g.sp = Math.min(100, g.sp + 6); G.st[dp.slot].jg++;
    sfx(G, -1, 'perfect'); sfx(G, -1, 'block'); sparkE(G, g.x + g.face * 40, 120, 24, '#ffffff'); popE(G, g.x, 230, 'ジャストガード！', '#7fe8ff', 26);
    G.hitstop = Math.max(G.hitstop, 0.12); return 0;
  }
  if (blocked) { dmg *= 0.25; g.en = Math.max(0, g.en - 5); sfx(G, -1, 'block'); sparkE(G, g.x + g.face * 40, 120, 10, '#9ad8ff'); }
  else { sfx(G, -1, dmg >= 3 ? 'hitH' : 'hitL'); sparkE(G, g.x + g.face * 30, 110, 16); }
  g.hp = Math.max(0, g.hp - dmg); g.fl = 0.12;
  if (D.card === 1 && !D.cardUsed && g.hp > 0 && g.hp < 30) { D.cardUsed = true; g.hp += 18; banner(G, -1, `逆境カード「${CARDS[1].name}」`, `${THEME[D.id].giant} のHPが回復！`, TEAM_COL[D.id], 2); sfx(G, -1, 'fanfare'); }
  const pc = pilotOf(D); if (pc) pc.fat = Math.min(100, pc.fat + dmg * BAL.fatHit * (blocked ? 0.35 : 1));
  g.sp = Math.min(100, g.sp + dmg * BAL.spTake); if (!o.special) A.g.sp = Math.min(100, A.g.sp + dmg * BAL.spDeal * (G.od ? 1.5 : 1));
  popE(G, g.x, 190, dmg.toFixed(1), blocked ? '#9ad8ff' : (D.id ? '#ffe066' : '#ff8a8a'), blocked ? 18 : 24);
  G.hitstop = Math.max(G.hitstop, 0.05 + dmg * 0.014); shake(G, -1, dmg * 2.4);
  if (!blocked) {
    if (g.atk && g.atk.t < g.atk.def.wind) g.atk = null;
    g.hitT = Math.max(g.hitT, 0.26);
    if (Math.random() < clamp(dmg / BAL.fireP * 1.15, 0.1, 0.85)) spawnTrouble(G, D, part, 'fire');
    if (dmg >= 1.85 && Math.random() < 0.4) spawnTrouble(G, D, pick(ZKEYS), 'cable');
    for (const c of D.crew) if (c.role !== 'pilot' && isBot(G, c.slot) && Math.random() < 0.3) shout(G, D, c, pick(['揺れるぞ！', 'くっ…！', 'やられた！']));
    if (o.stun) { g.stunT = Math.max(g.stunT, o.stun); g.atk = null; if (G.sp && G.sp.team === D.id && G.sp.phase === 'prep') cancelSpecial(G, '足止め成功'); }
  }
  if (o.kd && !blocked && D.kdCD <= 0 && g.hp > 0) knockdown(G, D); else g.x -= g.face * (blocked ? 8 : (o.kb ? o.kb * 0.5 : 14));
  if (g.hp <= 0) startEscape(G, D);
  return dmg;
}
function knockdown(G, T) {
  const g = T.g; G.cnt.kd++; g.downT = 2.3; g.atk = null; g.guarding = false; T.kdCD = 9;
  T.tilt = { dir: -g.face, t: 2.3 };
  sfx(G, -1, 'step'); shake(G, -1, 16); g.x -= g.face * 40; E(G, 'col', -1, g.x - g.face * 90, 50);
  for (const c of T.crew) {
    if (c.role === 'pilot' || c.escaped) continue;
    if (c.carry) { dropItem(T, c, 150); G.st[c.slot].drop++; }
    c.vx += -g.face * 200; shout(G, T, c, pick(['うわああ！', '傾くーっ！', 'ころがるー！']), true);
  }
  banner(G, T.id, THEME[T.id].down, '中のみんなが転がる！', '#ff9a3c', 1.6);
}
function fireMissile(G, T) {
  const g = T.g, th = THEME[T.id];
  if (zoneOff(T, 'head')) { if (T.buzzCD <= 0) { sfx(G, T.id, 'buzz'); popE(G, g.x, 250, `${th.zones.head}損傷：撃てない！`, '#ff6464', 18); T.buzzCD = 0.8; } return; }
  if (!T.mq.length) { if (T.buzzCD <= 0) { sfx(G, T.id, 'buzz'); T.armAlarm = 1.6; popE(G, g.x, 250, '弾がない！', '#ff6464', 20); T.buzzCD = 0.8; for (const c of T.crew) if (isBot(G, c.slot) && c.role !== 'pilot') shout(G, T, c, '弾がないって！'); } return; }
  const m = T.mq.shift();
  G.missiles.push({ t: m.t, team: T.id, by: m.by, x: g.x + g.face * 20, y: 150, vx: g.face * MISSILE[m.t].spd, vy: 120, life: 2.5 });
  g.en = Math.max(0, g.en - 2); sfx(G, -1, 'missile');
}
function updateMissiles(G, dt) {
  for (let i = G.missiles.length - 1; i >= 0; i--) {
    const m = G.missiles[i], D = G.teams[1 - m.team], A = G.teams[m.team], k = D.g; m.life -= dt;
    if (m.t === 'mH') { const dx = k.x - m.x, dy = 120 - m.y, d = hyp(dx, dy) || 1, sp = MISSILE.mH.spd; m.vx = lerp(m.vx, dx / d * sp, dt * 6); m.vy = lerp(m.vy, dy / d * sp, dt * 6); }
    else m.vy -= 260 * dt;
    m.x += m.vx * dt; m.y += m.vy * dt;
    if (Math.abs(m.x - k.x) < 55 && Math.abs(m.y - 110) < 90 && k.hp > 0 && k.dodgeT <= 0) {
      const def = MISSILE[m.t], d = hitGiant(G, D, A, def.dmg, pick(ZKEYS), { unblock: !!def.unblock, stun: def.stun || 0 });
      G.st[m.by].mdmg += d; explE(G, m.x, m.y, 14, 0.7);
      if (G.phase !== 'p2') return;
      if (def.stun && k.stunT > 0) popE(G, k.x, 270, '足止め！', '#ffd23f', 22);
      G.missiles.splice(i, 1); continue;
    }
    if (m.y < 0 || m.life <= 0 || m.x < 0 || m.x > WORLD_W) { explE(G, m.x, Math.max(m.y, 0), 10, 0.6); E(G, 'col', -1, m.x | 0, 20); G.missiles.splice(i, 1); }
  }
}
function botPilot(G, T, E_, dt) {
  const g = T.g, e = E_.g, bp = T.bp, inp = bp.inp || (bp.inp = newInp());
  inp.mx = 0; inp.xP = inp.bP = inp.mP = inp.sP = inp.eP = false; inp.g = false;
  const d = Math.abs(e.x - g.x);
  bp.decT -= dt; bp.mcd -= dt; bp.guardT -= dt;
  if (bp.guardT > 0) { inp.g = true; return inp; }
  if (g.sp >= 100 && !G.sp && d < 340 && e.hp > 4) inp.sP = true;
  const enemyPrep = G.sp && G.sp.team !== T.id && G.sp.phase === 'prep';
  if (T.mq.length && !zoneOff(T, 'head') && (bp.mcd <= 0 || (enemyPrep && G.sp.stopTry && T.mq.some(m => m.t === 'mS') && bp.mcd < 2))) { inp.mP = true; bp.mcd = enemyPrep ? 0.5 : rnd(2.2, 4.5); }
  if (e.atk && e.atk.t < e.atk.def.wind && d < e.atk.def.range + 40 && Math.random() < 0.05) { bp.guardT = 0.45; inp.g = true; return inp; }
  if (bp.decT <= 0) {
    bp.decT = rnd(0.12, 0.28);
    bp.mv = d > 164 ? 1 : d < 134 ? -1 : 0;
    if (d < 170 && g.en > 12) {
      const open = e.hitT > 0 || e.stunT > 0 || e.sysT > 0 || (e.atk && e.atk.t > e.atk.def.wind + e.atk.def.act);
      if (open && !zoneOff(T, 'larm') && Math.random() < 0.6) inp.bP = true;
      else if (!zoneOff(T, 'rarm') && Math.random() < 0.55) inp.xP = true;
      else if (!zoneOff(T, 'larm') && Math.random() < 0.18) inp.bP = true;
    }
  }
  inp.mx = bp.mv * g.face;
  return inp;
}
function updateGiant(G, T, En, dt) {
  const g = T.g, e = En.g, th = THEME[T.id];
  g.hitT -= dt; g.stunT -= dt; g.sysT -= dt; g.dodgeT -= dt; T.kdCD -= dt;
  if (g.downT > 0) { g.downT -= dt; if (g.downT <= 0) { T.tilt = null; sfx(G, -1, 'step'); } }
  g.face = e.x >= g.x ? 1 : -1;
  const pc = pilotOf(T);
  const out = T.fuel <= 0 ? 0 : clamp(0.35 + T.fuel / 90, 0.35, 1.45);
  g.en = Math.min(100, g.en + 15 * out * dt);
  if (g.en <= 0 && g.sysT <= 0 && g.downT <= 0) { g.sysT = 2.4; g.en = 0; G.cnt.sys++; banner(G, T.id, th.noFuel, `動けない…${th.fuel}を！`, '#ff5a4f', 1.8); sfx(G, T.id, 'buzz'); }
  if (pc) {
    pc.fat = Math.min(100, pc.fat + 0.45 * dt); G.st[pc.slot].pilotT += dt;
    if (pc.fat >= 100 && g.stunT <= 0) { g.stunT = 3; pc.fat = 74; banner(G, T.id, `${G.slots[pc.slot].name} が限界！`, `操縦不能…${th.lever}を引け！`, '#ff9a3c', 2.2); sfx(G, T.id, 'buzz'); }
  }
  const human = pc && !isBot(G, pc.slot);
  const inp = human ? G.inp[pc.slot] : botPilot(G, T, En, dt);
  if (human && inp.eP) ejectPilot(G, T);
  const prevG = g.guarding; g.guarding = false; g.comboT = (g.comboT || 0) - dt; if (g.comboT <= 0) g.combo = 0;
  const mine = G.sp && G.sp.team === T.id;
  if (G.sp && G.sp.phase !== 'prep') { g.charge = mine ? Math.min(1, g.charge + dt * 3) : 0; return; }
  g.charge = mine ? Math.min(1, g.charge + dt * 2) : Math.max(0, g.charge - dt * 2);
  if (g.atk) {
    g.atk.t += dt; const a = g.atk, d = a.def;
    // 入力の先行受付（攻撃中に押したボタンを覚えておく）
    if ((inp.xP || inp.bP) && a.t > d.wind * 0.5) g.buf = { type: inp.bP ? 'strong' : 'weak', t: 0.35 };
    if (g.buf) { g.buf.t -= dt; if (g.buf.t <= 0) g.buf = null; }
    // コンボ：当たった攻撃の硬直をキャンセルして次の攻撃へ（弱→弱→フィニッシュ、または弱→強）
    if (g.buf && a.landed && a.type === 'weak' && a.t >= d.wind + d.act && G.phase === 'p2') {
      let nt = g.buf.type === 'strong' ? 'strong' : (a.n >= 2 ? 'fin' : 'weak'); const nd = ATK[nt];
      if (!zoneOff(T, nd.part) && g.en >= nd.en) { g.en -= nd.en; if (pc) pc.fat = Math.min(100, pc.fat + nd.fat); g.atk = { type: nt, def: nd, t: 0, hit: false, n: a.n + 1 }; g.buf = null; return; }
      g.buf = null;
    }
    if (!a.hit && a.t >= d.wind) {
      a.hit = true; sfx(G, -1, 'whoosh');
      const dx = (e.x - g.x) * g.face;
      if (dx > 0 && dx < d.range && e.hp > 0 && e.downT <= 0) {
        const part = a.type === 'weak' ? pick(['rarm', 'larm', 'head']) : pick(['legs', 'legs', 'head', 'larm', 'rarm']);
        const real = hitGiant(G, En, T, d.dmg, part, { melee: true, kb: d.kb, kd: (a.type === 'strong' && Math.random() < BAL.kd + (a.n > 1 ? 0.15 : 0)) || (a.type === 'fin' && Math.random() < 0.3) });
        if (pc) G.st[pc.slot].dmg += real;
        if (real > 0) { a.landed = true; g.combo = (a.n || 1); g.comboT = 0.9; if (g.combo >= 2) { popE(G, e.x, 280, `${g.combo} HIT${a.type === 'weak' ? '' : '！ コンボ'}`, '#ffd23f', 20 + g.combo * 2); if (pc) G.st[pc.slot].combo = Math.max(G.st[pc.slot].combo, g.combo); } }
      }
    }
    if (a.t >= d.wind + d.act + d.rec) g.atk = null;
    return;
  }
  if (!canAct(G, T)) return;
  if (inp.sP && g.sp >= 100) { if (startSpecial(G, T)) return; }
  if (inp.mP) fireMissile(G, T);
  if (inp.g && g.en > 0) { if (!prevG) g.gStart = G.t; g.guarding = true; g.en = Math.max(0, g.en - 7 * dt); g.vx = 0; return; }
  const bufT = g.buf ? g.buf.type : null; g.buf = null;
  if (inp.xP || inp.bP || bufT) {
    const type = inp.bP || bufT === 'strong' ? 'strong' : 'weak', def = ATK[type];
    if (zoneOff(T, def.part)) { if (T.buzzCD <= 0) { sfx(G, T.id, 'buzz'); popE(G, g.x, 250, `${th.zones[def.part]}損傷：${th[type]}不可！`, '#ff6464', 18); T.buzzCD = 0.7; } }
    else if (g.en >= def.en) { g.en -= def.en; if (pc) pc.fat = Math.min(100, pc.fat + def.fat); g.atk = { type, def, t: 0, hit: false, n: 1 }; g.vx = 0; return; }
    else if (T.buzzCD <= 0) { sfx(G, T.id, 'buzz'); popE(G, g.x, 250, 'エネルギー不足', '#ff6464', 18); T.buzzCD = 0.7; }
  }
  const legs = zoneOff(T, 'legs') ? 0.45 : 1, sp = 125 * legs * (G.od ? 1.15 : 1);
  g.vx = clamp(inp.mx, -1, 1) * sp; g.x += g.vx * dt; if (Math.abs(g.vx) > 5) g.walk += dt * 6 * legs;
}
// ---- 決着
function startEscape(G, L) {
  if (G.phase !== 'p2') return;
  const W = G.teams[1 - L.id];
  G.phase = 'escape'; G.esc = { t: teamHasHuman(G, L.id) ? 9 : 4, loser: L.id, boomed: false };
  G.sp = null; L.tilt = null; W.tilt = null; G.missiles = [];
  const pc = pilotOf(L); if (pc) { pc.role = 'crew'; pc.x = ST.seat.x; pc.y = ST.seat.y + 46; }
  banner(G, L.id, THEME[L.id].wreck, `急いで${THEME[L.id].pod}へ！`, '#ff5a4f', 3);
  cutin(G, W.id, 'トドメの一撃！', '#ffd23f', 1.6);
  sfx(G, -1, 'boom');
  for (const c of L.crew) { c.job = null; c.notice = rnd(0.3, 1.6); }
}
function crewScore(s) { return s.coal * 2 + s.load * 3 + s.fix * 4 + s.perfect * 3 + s.thrust * 1.2 + s.mdmg * 2 + s.chg * 0.15; }
export function playerScore(s, won) { return Math.round(s.cit * 30 + s.cap * 50 + s.ko * 15 + s.coal * 20 + s.load * 25 + s.fix * 40 + s.perfect * 50 + s.thrust * 12 + s.dmg * 10 + s.mdmg * 15 + s.jg * 80 + s.combo * 20 + s.chg * 3 + (won ? 300 : 0)); }
function endMatch(G, win, reason) {
  G.phase = 'result';
  const all = [0, 1, 2, 3, 4, 5, 6, 7], st = G.st;
  const best = f => all.reduce((a, b) => f(st[b]) > f(st[a]) ? b : a);
  const awards = [];
  const bp = best(s => s.dmg); if (st[bp].dmg > 0) awards.push({ title: 'ベストパイロット', slot: bp, note: `与ダメージ ${st[bp].dmg.toFixed(0)}` });
  const bc = best(crewScore); awards.push({ title: 'ベストクルー', slot: bc, note: `燃料${st[bc].coal}・装填${st[bc].load}・修理${st[bc].fix}・PERFECT${st[bc].perfect}` });
  if (G.p1 && !G.cfg.skipP1) { const bs = best(s => s.cit * 2 + s.cap * 3 + s.ko); awards.push({ title: '街のMVP', slot: bs, note: `市民${st[bs].cit}・拠点${st[bs].cap}・KO${st[bs].ko}` }); }
  const funny = [];
  const f1 = best(s => s.fall); if (st[f1].fall > 0) funny.push({ title: '一番転がったで賞', slot: f1, note: `壁に激突 ${st[f1].fall}回`, v: st[f1].fall });
  const f2 = best(s => s.ff); if (st[f2].ff > 0) funny.push({ title: '味方に物をぶつけたで賞', slot: f2, note: `命中 ${st[f2].ff}回`, v: st[f2].ff * 1.5 });
  const f3 = best(s => s.boom); if (st[f3].boom > 0) funny.push({ title: '入れすぎ爆発で賞', slot: f3, note: `${st[f3].boom}回`, v: st[f3].boom * 3 });
  funny.sort((a, b) => b.v - a.v); if (funny.length) { delete funny[0].v; awards.push(funny[0]); }
  G.result = { win, reason, awards: awards.slice(0, 4), hp: [Math.ceil(G.teams[0].g.hp), Math.ceil(G.teams[1].g.hp)], swaps: [G.teams[0].swaps, G.teams[1].swaps],
    esc: G.esc ? G.teams[G.esc.loser].crew.filter(c => c.escaped).length : -1, p1: G.tr ? { score: G.tr.score, own: G.tr.own, pts: G.tr.pts } : null,
    st: st.map(s => [Math.round(s.dmg), Math.round(s.mdmg), s.coal, s.load, s.fix, s.perfect, s.fall, s.cit, s.cap]), score: st.map((s, i) => playerScore(s, win === (i < 4 ? 0 : 1))), jg: st.map(s => s.jg), t: 0 };
  sfx(G, win, 'fanfare'); if (win >= 0) sfx(G, 1 - win, 'sad');
}
function stepP2(G, dt) {
  const [A, B] = G.teams;
  for (const T of G.teams) {
    for (const c of T.crew) { c.dizzy -= dt; c.adren -= dt; c.shoutCD -= dt; c.wallCD -= dt; if (c.role !== 'pilot') c.fat = Math.max(0, c.fat - 7 * dt); }
    T.leverCD -= dt; T.swapT -= dt; T.armAlarm -= dt; T.buzzCD -= dt; T.g.fl -= dt;
  }
  if (G.cd > 0) { G.cd -= dt; if (G.cd <= 0) { banner(G, -1, 'ギガント・バトル開始！', '', '#ffd23f', 1.6); sfx(G, -1, 'alarm'); } }
  if (G.phase === 'p2' && G.cd <= 0) {
    const cine = G.sp && G.sp.phase !== 'prep';
    if (!cine) G.time -= dt;
    if (G.time <= 90 && !G.cheered) {
      G.cheered = true;
      for (const T of G.teams) if (T.cheer > 0) { T.g.sp = Math.min(100, T.g.sp + T.cheer); banner(G, T.id, T.id ? '闇のエネルギーが満ちる！' : '街の声援が届いた！', `必殺技ゲージ +${Math.round(T.cheer)}`, TEAM_COL[T.id], 2.2); sfx(G, T.id, 'fanfare'); }
    }
    if (G.time <= 60 && !G.od) { G.od = true; cutin(G, -1, 'オーバードライブ！', '#ff5af0', 1.6); banner(G, -1, '残り60秒！', '作業速度アップ・必殺技ゲージ加速', '#ff5af0', 2.4); }
    if (G.time <= 0) {
      G.time = 0; const ra = A.g.hp / A.g.max, rb = B.g.hp / B.g.max;
      endMatch(G, Math.abs(ra - rb) < 0.005 ? -1 : (ra > rb ? 0 : 1), '時間切れ・残りHPで判定'); return;
    }
    for (const T of G.teams) {
      if (!cine) { T.fuel = Math.max(0, T.fuel - BAL.fuelDecay * T.fuelMul * (G.od ? 1.2 : 1) * dt); T.g.sp = Math.min(100, T.g.sp + dt * BAL.spIdle * (G.od ? 1.8 : 1)); }
      if (T.tilt) { T.tilt.t -= dt; if (T.tilt.t <= 0) T.tilt = null; }
      T.chgB = Math.min(2, T.chgB + BAL.chgRefill * dt);
      for (const t of T.troubles) if (t.type === 'fire') {
        t.hp = Math.min(100, t.hp + 7 * dt);
        if (t.hp >= 100) { T.g.hp = Math.max(0, T.g.hp - BAL.burn * dt); t.spreadT -= dt; if (t.spreadT <= 0) { t.spreadT = 8; spawnTrouble(G, T, t.zone, 'fire'); } }
      }
    }
    for (const T of G.teams) if (T.g.hp <= 0 && G.phase === 'p2') startEscape(G, T);
    if (G.phase === 'p2') {
      updateSpecial(G, dt);
      if (G.hitstop > 0) G.hitstop -= dt;
      else {
        G.flip = !G.flip; const F = G.flip ? A : B, S2 = G.flip ? B : A;
        updateGiant(G, F, S2, dt); if (G.phase === 'p2') updateGiant(G, S2, F, dt); if (G.phase === 'p2') updateMissiles(G, dt);
        const minD = 127, a = A.g, b = B.g;
        if (Math.abs(b.x - a.x) < minD) { const mid = (a.x + b.x) / 2, s = b.x >= a.x ? 1 : -1; a.x = mid - s * minD / 2; b.x = mid + s * minD / 2; }
        a.x = clamp(a.x, 90, WORLD_W - 90); b.x = clamp(b.x, 90, WORLD_W - 90);
      }
    }
  } else if (G.phase === 'escape') {
    const esc = G.esc, L = G.teams[esc.loser], W = G.teams[1 - esc.loser];
    esc.t -= dt; L.g.dead += dt; W.g.charge = Math.min(1, W.g.charge + dt);
    if (Math.random() < dt * 3) puffI(G, L.id, rnd(300, 1000), rnd(40, 380), 6, '#ff6f3c', 140, 10, 'fire');
    if (Math.random() < dt * 5) explE(G, L.g.x + rnd(-60, 60), rnd(40, 200), 8, 0.8);
    if (esc.t < 1.6 && !esc.boomed) { esc.boomed = true; sfx(G, -1, 'beam'); shake(G, -1, 16); }
    if (esc.t <= 0 || (L.crew.every(c => c.escaped) && esc.t > 1.7)) { if (esc.t > 1.7) esc.t = 1.7; }
    if (esc.t <= 0) { explE(G, L.g.x, 100, 60, 1.8); sfx(G, -1, 'boom'); shake(G, -1, 22); endMatch(G, W.id, `${THEME[L.id].giant} 撃破！`); return; }
  }
  // 乗組員
  for (const T of G.teams) {
    const En = G.teams[1 - T.id];
    T.planT -= dt;
    if (T.planT <= 0) {
      T.planT = 0.3;
      if (G.phase === 'escape') { for (const c of T.crew) if (isBot(G, c.slot) && !c.escaped) { if (G.esc.loser === T.id) { c.notice -= 0.3; if (c.notice <= 0) c.job = { key: 'pod', type: 'pod' }; } else c.job = null; } }
      else if (G.cd <= 0) planBots(G, T, En);
    }
    for (const c of T.crew) {
      if (c.role === 'pilot' || c.escaped) continue;
      if (isBot(G, c.slot)) botCrew(G, T, c, dt); else humanCrew(G, T, c, G.inp[c.slot], dt);
    }
    separateCrew(T); updateItems(G, T, dt);
    if (G.phase === 'p2') for (const c of T.crew) if (isBot(G, c.slot) && c.role !== 'pilot' && Math.random() < dt * 0.05) {
      if (T.fuel < 25) shout(G, T, c, `${THEME[T.id].fuel}が足りない！`);
      else if (T.troubles.length) shout(G, T, c, `${THEME[T.id].zones[T.troubles[0].zone]}が${T.troubles[0].type === 'fire' ? (T.id ? '壊死してる' : '燃えてる') : '切れてる'}！`);
    }
  }
}

// =====================================================================
// 1ステップ進める
// =====================================================================
export function step(G, dt) {
  G.t += dt;
  if (G.phase === 'p1') stepP1(G, dt);
  else if (G.phase === 'trans') stepTrans(G, dt);
  else if (G.phase === 'p2' || G.phase === 'escape') stepP2(G, dt);
  else if (G.phase === 'result') G.result.t += dt;
  // ヒットストップ中に押された操縦者のボタンは、止めが解けるまで持ち越す
  const keep = G.phase === 'p2' && G.hitstop > 0 && G.teams ? G.teams.map(T => { const p = pilotOf(T); return p ? p.slot : -1; }) : null;
  G.inp.forEach((i, s) => { if (keep && keep.includes(s)) { i.aP = i.eP = false; } else { i.aP = i.bP = i.xP = i.mP = i.sP = i.eP = false; i.rt = -1; } i.card = 0; });
}

// =====================================================================
// ネットワーク用：状態の圧縮と復元（ホスト → クライアント）
// =====================================================================
const PH = ['p1', 'trans', 'p2', 'escape', 'result'];
const r1 = v => Math.round(v * 10), r0 = v => Math.round(v);
const TT = ['fire', 'cable'], SPH = ['prep', 'seq', 'fire'], OUT = ['', 'dodge', 'graze', 'hit'], RES = ['P', 'G', 'M'], AT = ['weak', 'strong', 'fin'], CS = ['free', 'held', 'air'];
export function encode(G) {
  const s = [PH.indexOf(G.phase), r1(G.time), r1(Math.max(0, G.cd)), G.od ? 1 : 0];
  if (G.phase === 'p1' || G.phase === 'trans') {
    const P = G.p1;
    s.push(P.chars.map(c => [r1(c.x), r1(c.z), r1(c.fa), c.carry, (c.stun > 0 ? 1 : 0) | (c.punchT > 0 ? 2 : 0)]),
      P.cits.filter(c => c.state !== 'gone').map(c => [c.id, r1(c.x), r1(c.z), r1(c.y), CS.indexOf(c.state) | (c.type << 2) | (c.dizzy > 0 ? 8 : 0)]),
      P.bases.map(b => [b.own, b.capTeam, r0(b.cap * 100)]), P.pts, P.cnt, (P.hen[0] ? 1 : 0) | (P.hen[1] ? 2 : 0) | (P.dbl ? 4 : 0));
  }
  if (G.phase === 'trans') { const t = G.tr; s.push([r1(t.t), t.loser, t.pick, t.score, t.own, t.mask, t.pts]); }
  if (G.phase !== 'p1') {
    s.push(G.teams.map(T => {
      const g = T.g;
      return [[r0(g.x), g.face, r1(g.hp), g.max, r0(g.en), r0(g.sp), g.atk ? [AT.indexOf(g.atk.type), r0(g.atk.t * 100)] : 0, r1(Math.max(0, g.hitT)), r1(Math.max(0, g.downT)), r1(Math.max(0, g.stunT)), r1(Math.max(0, g.sysT)), r1(Math.max(0, g.dodgeT)), g.guarding ? 1 : 0, r0(g.vx), r1(g.charge), r1(g.dead)],
        r0(T.fuel), (T.leverCD > 0 ? 1 : 0) | (T.armAlarm > 0 ? 2 : 0) | (T.swapT > 0 ? 4 : 0), T.tilt ? [T.tilt.dir, r1(T.tilt.t)] : 0, r0(T.cheer), T.card,
        T.crew.map(c => [r0(c.x), r0(c.y), ITEMS.indexOf(c.carry), (c.role === 'pilot' ? 1 : 0) | (c.dizzy > 0 ? 2 : 0) | (c.adren > 0 ? 4 : 0) | (c.escaped ? 8 : 0) | (c.working ? 16 : 0), r0(c.fat), r0(c.fx * 7), r0(c.fy * 7)]),
        T.troubles.map(t => [TT.indexOf(t.type), ZKEYS.indexOf(t.zone), r0(t.x), r0(t.y), r0(t.type === 'fire' ? t.hp : t.prog * 100)]),
        T.items.map(i => [ITEMS.indexOf(i.t), r0(i.x), r0(i.y), r0(i.z)]), T.mq.map(m => ITEMS.indexOf(m.t)), r0(T.chgB * 50), r0(g.combo || 0)];
    }));
    const sp = G.sp;
    s.push(sp ? [sp.team, SPH.indexOf(sp.phase), r1(sp.t), CON.map(k => sp.assign[k] === undefined ? -1 : sp.assign[k]), sp.step, r0(sp.ringT * 100), sp.res.map(r => RES.indexOf(r)), sp.pressed ? 1 : 0, r0(sp.thrust * 100), OUT.indexOf(sp.out), sp.allP ? 1 : 0] : 0);
    s.push(G.missiles.map(m => [ITEMS.indexOf(m.t), m.team, r0(m.x), r0(m.y), r0(m.vx), r0(m.vy)]));
    s.push(G.esc ? [r1(G.esc.t), G.esc.loser] : 0);
  }
  if (G.phase === 'result') s.push(G.result);
  return s;
}
export function decode(G, s) {
  let k = 0; const phase = PH[s[k++]];
  G.time = s[k++] / 10; G.cd = s[k++] / 10; G.od = !!s[k++];
  const snap = (o, key, v, th) => { o['n' + key] = v; if (o[key] === undefined || Math.abs(o[key] - v) > th) o[key] = v; };
  if (phase === 'p1' || phase === 'trans') {
    const P = G.p1, ch = s[k++], ci = s[k++], ba = s[k++];
    ch.forEach((a, i) => { const c = P.chars[i]; snap(c, 'x', a[0] / 10, 8); snap(c, 'z', a[1] / 10, 8); c.fa = a[2] / 10; c.carry = a[3]; c.stun = a[4] & 1 ? 0.2 : 0; if ((a[4] & 2) && c.punchT <= 0) c.punchT = 0.22; });
    const old = new Map(P.cits.map(c => [c.id, c]));
    P.cits = ci.map(a => { const c = old.get(a[0]) || { id: a[0], vx: 0, vz: 0 }; snap(c, 'x', a[1] / 10, 6); snap(c, 'z', a[2] / 10, 6); c.y = a[3] / 10; c.state = CS[a[4] & 3]; c.type = (a[4] >> 2) & 1; c.dizzy = a[4] & 8 ? 0.2 : 0; return c; });
    ba.forEach((a, i) => { const b = P.bases[i]; b.own = a[0]; b.capTeam = a[1]; b.cap = a[2] / 100; });
    P.pts = s[k++]; P.cnt = s[k++]; const f = s[k++]; P.hen = [!!(f & 1), !!(f & 2)]; P.dbl = !!(f & 4);
  }
  if (phase === 'trans') { const a = s[k++]; G.tr = { t: a[0] / 10, loser: a[1], pick: a[2], score: a[3], own: a[4], mask: a[5], pts: a[6] }; }
  if (phase !== 'p1') {
    if (!G.teams) { const keep = G.tr; G.tr = G.tr || { mask: [0, 0], pts: [0, 0] }; setupP2(G); G.tr = keep; for (const T of G.teams) for (const c of T.crew) c.role = 'crew'; }
    s[k++].forEach((a, ti) => {
      const T = G.teams[ti], g = T.g, ga = a[0];
      snap(g, 'x', ga[0], 60); g.face = ga[1]; const hp = ga[2] / 10; if (hp < g.hp - 0.05) g.fl = 0.12; g.hp = hp; g.max = ga[3]; g.en = ga[4]; g.sp = ga[5];
      if (ga[6]) { const t = ga[6][1] / 100, type = AT[ga[6][0]]; if (!g.atk || g.atk.type !== type || Math.abs(g.atk.t - t) > 0.15) g.atk = { type, def: ATK[type], t, hit: true }; } else g.atk = null;
      g.hitT = ga[7] / 10; g.downT = ga[8] / 10; g.stunT = ga[9] / 10; g.sysT = ga[10] / 10; g.dodgeT = ga[11] / 10; g.guarding = !!ga[12]; g.vx = ga[13]; g.charge = ga[14] / 10; g.dead = ga[15] / 10;
      T.fuel = a[1]; T.leverCD = a[2] & 1 ? 1 : 0; T.armAlarm = a[2] & 2 ? 0.3 : 0; T.swapT = a[2] & 4 ? 0.3 : 0; T.tilt = a[3] ? { dir: a[3][0], t: a[3][1] / 10 } : null; T.cheer = a[4]; T.card = a[5];
      a[6].forEach((ca, i) => {
        const c = T.crew[i], f = ca[3]; snap(c, 'x', ca[0], 90); snap(c, 'y', ca[1], 90); c.carry = ca[2] < 0 ? null : ITEMS[ca[2]];
        c.role = f & 1 ? 'pilot' : 'crew'; c.dizzy = f & 2 ? 0.2 : 0; c.adren = f & 4 ? 0.3 : 0; c.escaped = !!(f & 8); c.working = !!(f & 16); c.fat = ca[4];
        if (!c.pred) { c.fx = ca[5] / 7; c.fy = ca[6] / 7; }
      });
      T.troubles = a[7].map(t => ({ type: TT[t[0]], zone: ZKEYS[t[1]], x: t[2], y: t[3], hp: t[4], prog: t[4] / 100, born: 0 }));
      T.items = a[8].map(i => ({ t: ITEMS[i[0]], x: i[1], y: i[2], z: i[3], fly: false, vx: 0, vy: 0, vz: 0 }));
      T.mq = a[9].map(i => ({ t: ITEMS[i] })); T.chgB = (a[10] || 0) / 50; if ((a[11] || 0) !== (g.combo || 0)) { g.combo = a[11] || 0; } g.comboT = 0.9;
    });
    const sp = s[k++];
    if (sp) {
      const o = G.sp || {}; const ringT = sp[5] / 100;
      const same = G.sp && o.team === sp[0] && o.step === sp[4] && SPH[sp[1]] === o.phase;
      G.sp = { team: sp[0], phase: SPH[sp[1]], t: sp[2] / 10, assign: {}, step: sp[4], ringT: same && Math.abs(o.ringT - ringT) < 0.2 ? o.ringT : ringT, res: sp[6].map(i => RES[i]), pressed: !!sp[7], thrust: sp[8] / 100, out: OUT[sp[9]], allP: !!sp[10], el: 0 };
      CON.forEach((c, i) => { if (sp[3][i] >= 0) G.sp.assign[c] = sp[3][i]; });
    } else G.sp = null;
    G.missiles = s[k++].map(m => ({ t: ITEMS[m[0]], team: m[1], x: m[2], y: m[3], vx: m[4], vy: m[5] }));
    const e = s[k++]; G.esc = e ? { t: e[0] / 10, loser: e[1] } : null;
  }
  if (phase === 'result') { const r = s[k++]; if (!G.result) G.result = r; else G.result.t = Math.max(G.result.t, r.t); }
  G.phase = phase;
}
// クライアント側：受信の合間をなめらかにつなぐ
export function clientTick(G, dt, own) {
  const k = Math.min(1, dt * 14);
  const sm = (o, key) => { const n = o['n' + key]; if (n !== undefined) o[key] += (n - o[key]) * k; };
  if (G.phase === 'p1' || G.phase === 'trans') {
    for (const c of G.p1.chars) { c.punchT -= dt; if (!c.pred) { sm(c, 'x'); sm(c, 'z'); } }
    for (const c of G.p1.cits) { if (c.state !== 'held') { sm(c, 'x'); sm(c, 'z'); } }
  }
  if (G.teams && G.phase !== 'p1') {
    for (const T of G.teams) {
      const g = T.g; sm(g, 'x'); g.fl -= dt; if (g.atk) g.atk.t += dt; if (Math.abs(g.vx) > 5) g.walk += dt * 6;
      for (const c of T.crew) { if (!c.pred) { const ox = c.x, oy = c.y; sm(c, 'x'); sm(c, 'y'); c.walk += hyp(c.x - ox, c.y - oy) * 0.05; } }
    }
    for (const m of G.missiles) { m.x += m.vx * dt; m.y += m.vy * dt; }
    if (G.sp && G.sp.phase === 'seq' && !G.sp.pressed) G.sp.ringT += dt;
  }
  if (G.phase === 'result' && G.result) G.result.t += dt;
}

export const _dbg = { spawnTrouble, knockdown, hitGiant, startSpecial, startEscape, startTrans };
