// =====================================================================
// GIGA-CLASH  main.js — 入力（キーボード・タッチ・コントローラー）、
//   画面の流れ（タイトル→ロビー→試合）、オンライン同期、メインループ
// =====================================================================
import * as S from './sim.js';
import { createRenderer, W, H } from './render3d.js';
import { createHud } from './hud.js';
import { AU, sfx, BGM } from './audio.js';
import { createPeerRoom, newRoomCode, cleanCode } from './net-peer.js';
export const VERSION = typeof __VERSION__ !== 'undefined' ? __VERSION__ : 'dev';

const $ = id => document.getElementById(id);
const gl = $('gl'), ui = $('ui'), stage = $('stage'), msg = $('msg'), ctx = ui.getContext('2d');
let R;
try { R = createRenderer(gl); msg.textContent = ''; } catch (e) { msg.textContent = 'この環境では3D表示（WebGL）が使えないため、ゲームを開始できません。'; throw e; }
const hud = createHud(ctx, R);
let RS = 1;
function resize() {
  const s = Math.min(innerWidth / W, innerHeight / H), cw = Math.max(1, Math.floor(W * s)), ch = Math.max(1, Math.floor(H * s)), dpr = Math.min(window.devicePixelRatio || 1, 2), gq = typeof LOC !== 'undefined' && LOC.low ? Math.min(dpr, 1) : dpr;
  stage.style.width = cw + 'px'; stage.style.height = ch + 'px';
  ui.width = Math.round(cw * dpr); ui.height = Math.round(ch * dpr); RS = ui.width / W;
  gl.width = Math.round(cw * gq); gl.height = Math.round(ch * gq); R.resize(gl.width, gl.height);
}
addEventListener('resize', resize);
$('rot').addEventListener('pointerdown', e => e.currentTarget.classList.remove('on'));
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

// ---------------------------------------------------------------- 状態
const APP = { screen: 'title', help: -1, paused: false, note: '', noteT: 0 };
let G = null;
const NAMES = ['ハヤテ', 'ツバサ', 'リュウ', 'アカネ', 'ミドリ', 'ソラ', 'カイ', 'ナギ', 'レン', 'ヒカリ', 'ユウ', 'マコト', 'シン', 'ルナ'];
const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) { } } };
const LOC = { navi: store.get('gc_navi') !== '0', low: store.get('gc_low') === '1' || location.search.includes('fast'), n: 1, team: 0, diff: 1, skipP1: false, name: store.get('gc_name') || NAMES[(Math.random() * NAMES.length) | 0], slots: [], dev: 'kb' };
const NET = { claudeRoom: null, mode: '', code: '', peerStat: '', room: null, on: false, t0: 0, peers: [], me: null, host: null, isHost: false, claimT: 0, as: [], mid: 0, hbStr: '', seq: 0, lastQ: -1, lastEv: 0, evId: 0, ring: [], pubT: 0, inT: 0, rin: {}, inStr: '' };
function note(s, t = 3) { APP.note = s; APP.noteT = t; }
resize(); R.setQuality(LOC.low);

// ---------------------------------------------------------------- 入力
const keys = {}, uiQ = { dx: 0, dy: 0, ok: false, back: false, pause: false };
const newPend = () => ({ aP: false, bP: false, xP: false, mP: false, sP: false, eP: false, card: 0, rt: -1 });
const players = [0, 1, 2, 3].map(() => ({ pend: newPend(), cnt: { a: 0, b: 0, x: 0, m: 0, s: 0, e: 0 }, hold: { mx: 0, my: 0, a: false, x: false, g: false }, card: 0, rt: -1 }));
function press(li, act) {
  const p = players[li]; if (!p) return; p.pend[act + 'P'] = true; p.cnt[act] = (p.cnt[act] + 1) % 1000;
  if (G && G.sp && G.sp.phase === 'seq' && (act === 'a' || act === 'x' || act === 's')) { p.pend.rt = G.sp.ringT; p.rt = G.sp.ringT; }
}
function pickCard(li, n) { const p = players[li]; if (!p || !G || G.phase !== 'trans') return; p.pend.card = n; p.card = n; }
const uiActive = () => APP.screen !== 'game' || APP.paused || APP.help >= 0 || (G && G.phase === 'result');
const KEYMAP = { Space: 'a', KeyE: 'a', KeyJ: 'x', KeyK: 'b', KeyQ: 'b', KeyU: 'm', KeyI: 's', KeyX: 'e' };
const PREVENT = ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'];
addEventListener('keydown', e => {
  AU.unlock(); if (PREVENT.includes(e.code)) e.preventDefault(); if (e.repeat) return;
  keys[e.code] = true; LOC.dev = 'kb';
  if (e.code === 'KeyM') AU.setMute(!AU.muted);
  if (e.code === 'Escape' || e.code === 'KeyP') { if (uiActive() && !APP.paused) uiQ.back = true; else uiQ.pause = true; return; }
  if (uiActive()) {
    if (e.code === 'Enter' || e.code === 'Space') uiQ.ok = true;
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') uiQ.dx = -1; if (e.code === 'ArrowRight' || e.code === 'KeyD') uiQ.dx = 1;
    if (e.code === 'ArrowUp' || e.code === 'KeyW') uiQ.dy = -1; if (e.code === 'ArrowDown' || e.code === 'KeyS') uiQ.dy = 1;
    return;
  }
  if (KEYMAP[e.code]) press(0, KEYMAP[e.code]);
  if (e.code === 'Digit1' || e.code === 'Digit2' || e.code === 'Digit3') pickCard(0, +e.code.slice(5));
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; if (G && APP.screen === 'game' && !NET.on && G.phase !== 'result') APP.paused = true; });
document.addEventListener('visibilitychange', () => { if (document.hidden && G && APP.screen === 'game' && !NET.on && G.phase !== 'result') APP.paused = true; });

// ---- タッチ
const touch = { used: false, pointers: new Map(), stick: null, btn: {} };
function touchLayout() {
  if (!G || !LOC.slots.length || uiActive() || G.phase === 'trans') return [];
  if (G.phase === 'p1') return [{ n: 'a', x: 1150, y: 610, r: 62, label: 'かつぐ' }, { n: 'x', x: 1010, y: 652, r: 46, label: 'パンチ' }, { n: 'b', x: 1070, y: 520, r: 44, label: '投げる' }];
  const T = G.teams[LOC.slots[0] < 4 ? 0 : 1], c = T.crew.find(c => c.slot === LOC.slots[0]);
  if (c && c.role === 'pilot' && G.phase === 'p2') return [{ n: 'x', x: 1050, y: 630, r: 50, label: '弱' }, { n: 'b', x: 1170, y: 560, r: 50, label: '強' }, { n: 'g', x: 1175, y: 670, r: 42, label: 'ガード' }, { n: 'm', x: 930, y: 665, r: 40, label: '飛び道具' }, { n: 's', x: 930, y: 565, r: 44, label: '必殺', col: '#ffd23f' }, { n: 'e', x: 1222, y: 446, r: 30, label: '脱出', col: '#ff8a80' }];
  return [{ n: 'a', x: 1150, y: 620, r: 62, label: 'アクション' }, { n: 'b', x: 1015, y: 660, r: 44, label: '投げる' }];
}
const toLogical = e => { const r = ui.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H }; };
ui.addEventListener('pointerdown', e => {
  AU.unlock(); ui.focus(); const p = toLogical(e);
  if (e.pointerType === 'touch') { touch.used = true; LOC.dev = 'touch'; } else if (e.pointerType === 'mouse') LOC.dev = LOC.dev === 'touch' ? 'kb' : LOC.dev;
  hud.showFocus = false;
  try { ui.setPointerCapture(e.pointerId); } catch (_) { }
  for (const b of hud.buttons) if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) { onUI(b.id); e.preventDefault(); return; }
  if (APP.help >= 0) { onUI('helpNext'); return; }
  if (!touch.used || uiActive()) return;
  for (const b of touchLayout()) if (Math.hypot(p.x - b.x, p.y - b.y) < b.r + 12) { touch.pointers.set(e.pointerId, { kind: 'btn', name: b.n }); touch.btn[b.n] = true; if (b.n !== 'g') press(0, b.n); e.preventDefault(); return; }
  if (p.x < W * 0.5 && p.y > 150) { touch.pointers.set(e.pointerId, { kind: 'stick' }); touch.stick = { ox: p.x, oy: p.y, x: p.x, y: p.y }; }
  e.preventDefault();
}, { passive: false });
ui.addEventListener('pointermove', e => { const s = touch.pointers.get(e.pointerId); if (s && s.kind === 'stick' && touch.stick) { const p = toLogical(e); touch.stick.x = p.x; touch.stick.y = p.y; } });
function endPointer(e) { const s = touch.pointers.get(e.pointerId); if (!s) return; if (s.kind === 'stick') touch.stick = null; else touch.btn[s.name] = false; touch.pointers.delete(e.pointerId); }
ui.addEventListener('pointerup', endPointer); ui.addEventListener('pointercancel', endPointer); ui.addEventListener('contextmenu', e => e.preventDefault());

// ---- コントローラー
const PADS = { list: [], prev: {}, hold: {} };
function padOwner(idx) {
  const order = PADS.list.map(g => g.index), k = order.indexOf(idx); if (k < 0) return -1;
  if (LOC.n === 1) return 0;
  if (order.length >= LOC.n) return k < LOC.n ? k : -1;
  return k + 1 < LOC.n ? k + 1 : -1;
}
function pollPads() {
  let gps = []; try { gps = navigator.getGamepads ? Array.from(navigator.getGamepads()).filter(g => g && g.connected) : []; } catch (e) { gps = []; }
  PADS.list = gps; PADS.hold = {};
  const uia = uiActive();
  for (const gp of gps) {
    const prev = PADS.prev[gp.index] || (PADS.prev[gp.index] = { b: [], dx: 0, dy: 0 });
    const b = i => !!(gp.buttons[i] && (gp.buttons[i].pressed || gp.buttons[i].value > 0.5)), edge = i => b(i) && !prev.b[i];
    let ax = gp.axes[0] || 0, ay = gp.axes[1] || 0; if (Math.hypot(ax, ay) < 0.25) ax = ay = 0;
    if (b(14)) ax = -1; if (b(15)) ax = 1; if (b(12)) ay = -1; if (b(13)) ay = 1;
    const dx = ax > 0.6 ? 1 : ax < -0.6 ? -1 : 0, dy = ay > 0.6 ? 1 : ay < -0.6 ? -1 : 0, li = padOwner(gp.index);
    const any = dx || dy || [0, 1, 2, 3, 4, 5, 9].some(b);
    if (any) { AU.unlock(); if (li === 0) LOC.dev = 'pad'; }
    if (edge(9)) uiQ.pause = true;
    if (uia) {
      if (dx && dx !== prev.dx) uiQ.dx = dx; if (dy && dy !== prev.dy) uiQ.dy = dy;
      if (edge(0)) uiQ.ok = true; if (edge(1)) uiQ.back = true;
    } else if (li >= 0) {
      if (G && G.phase === 'trans') { if (edge(2)) pickCard(li, 1); if (edge(3)) pickCard(li, 2); if (edge(1)) pickCard(li, 3); }
      else { if (edge(0)) press(li, 'a'); if (edge(2)) press(li, 'x'); if (edge(1)) press(li, 'b'); if (edge(3)) press(li, 's'); if (edge(4) || edge(6)) press(li, 'm'); if (edge(8)) press(li, 'e'); }
      const h = PADS.hold[li] || (PADS.hold[li] = { mx: 0, my: 0, a: false, x: false, g: false });
      if (Math.hypot(ax, ay) > Math.hypot(h.mx, h.my)) { h.mx = ax; h.my = ay; }
      h.a = h.a || b(0); h.x = h.x || b(2); h.g = h.g || b(5) || b(7);
    }
    prev.b = gp.buttons.map((_, i) => b(i)); prev.dx = dx; prev.dy = dy;
  }
}
function sampleHolds() {
  for (let li = 0; li < 4; li++) {
    const h = players[li].hold; h.mx = h.my = 0; h.a = h.x = h.g = false; if (li >= LOC.n || uiActive()) continue;
    if (li === 0) {
      h.mx = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0); h.my = (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0);
      h.a = !!(keys.Space || keys.KeyE); h.x = !!keys.KeyJ; h.g = !!(keys.KeyL || keys.ShiftLeft || keys.ShiftRight);
      if (touch.stick) { const dx = touch.stick.x - touch.stick.ox, dy = touch.stick.y - touch.stick.oy, l = Math.hypot(dx, dy); if (l > 10) { const m = Math.min(1, l / 60); h.mx = dx / l * m; h.my = dy / l * m; } }
      h.a = h.a || !!touch.btn.a; h.x = h.x || !!touch.btn.x; h.g = h.g || !!touch.btn.g;
    }
    const ph = PADS.hold[li];
    if (ph) { if (Math.hypot(ph.mx, ph.my) > Math.hypot(h.mx, h.my)) { h.mx = ph.mx; h.my = ph.my; } h.a = h.a || ph.a; h.x = h.x || ph.x; h.g = h.g || ph.g; }
    const l = Math.hypot(h.mx, h.my); if (l > 1) { h.mx /= l; h.my /= l; }
  }
}
function applyLocalInputs() {
  LOC.slots.forEach((slot, li) => {
    const p = players[li], i = G.inp[slot], h = p.hold, d = p.pend;
    i.mx = h.mx; i.my = h.my; i.a = h.a; i.x = h.x; i.g = h.g; i.aP = d.aP; i.bP = d.bP; i.xP = d.xP; i.mP = d.mP; i.sP = d.sP; i.eP = d.eP; i.card = d.card; i.rt = d.rt;
    players[li].pend = newPend();
  });
}

// ---------------------------------------------------------------- 演出イベントの再生
let view = { team: 0, locals: [], dev: 'kb', key: {}, keyPad: {}, tipCrew: '', tipPilot: '', canRestart: true };
function playEvent(e) {
  const type = e[0], team = e[1], a = e.slice(2), vis = team < 0 || team === view.team, mine = team === view.team;
  switch (type) {
    case 'sfx': if (vis) sfx(a[0]); break;
    case 'ban': if (vis) hud.banner(a[0], a[1], a[2], a[3]); break;
    case 'cut': if (vis) hud.cutin(a[0], a[1], a[2]); break;
    case 'popI': if (mine) hud.pop('I', a[0], a[1], a[2], a[3], a[4]); break;
    case 'popE': hud.pop('E', a[0], a[1], a[2], a[3], a[4]); break;
    case 'popC': hud.pop('C', a[0], a[1], a[2], a[3], a[4]); break;
    case 'puffI': if (mine) R.fx.puffI(a[0], a[1], a[2], a[3], a[4], a[5], a[6]); break;
    case 'sparkE': R.fx.sparkE(a[0], a[1], a[2], a[3]); break;
    case 'explE': R.fx.explE(a[0], a[1], a[2], a[3]); break;
    case 'puffC': R.fx.puffC(a[0], a[1], a[2], a[3]); break;
    case 'shake': if (team < 0) R.shake(a[0]); else if (mine) R.shake(a[0], 'int'); break;
    case 'bub': if (mine) hud.bubble(a[0], a[1]); break;
    case 'col': R.collapse(a[0], a[1]); break;
  }
}
function drainEvents() {
  if (!G.ev.length) return;
  for (const e of G.ev) { playEvent(e); if (NET.on && NET.isHost) NET.ring.push({ id: ++NET.evId, t: performance.now(), e }); }
  G.ev.length = 0;
}

// ---------------------------------------------------------------- 試合の開始・終了
function beginMatch(g, slots) { G = g; LOC.slots = slots; APP.screen = 'game'; APP.paused = false; hud.reset(); R.reset(); touch.btn = {}; touch.pointers.clear(); touch.stick = null; for (const p of players) { p.pend = newPend(); p.card = 0; p.rt = -1; } hud.focus = -1; }
function offlineSlots() {
  const sl = Array.from({ length: 8 }, (_, i) => ({ name: S.BOT_NAMES[i], human: false, col: S.SLOT_COL[i] })), mine = [];
  for (let li = 0; li < LOC.n; li++) { const s = LOC.team * 4 + li; sl[s].human = true; sl[s].name = LOC.n === 1 ? 'あなた' : `P${li + 1}`; mine.push(s); }
  return [sl, mine];
}
function startOffline(extra = {}) { const [sl, mine] = offlineSlots(); beginMatch(S.createMatch({ slots: sl, diff: LOC.diff, skipP1: LOC.skipP1, ...extra }), mine); }
function toTitle() { leaveOnline(); G = null; APP.screen = 'title'; APP.paused = false; hud.focus = -1; }
function toLobby() { G = null; APP.screen = 'lobby'; APP.paused = false; hud.focus = -1; if (NET.on && NET.isHost) publishHb('lobby'); }

// ---------------------------------------------------------------- オンライン（room）
const IN_CLAUDE = !!(window.claude && typeof window.claude.use === 'function');
if (IN_CLAUDE) { try { window.claude.use('room').then(r => { NET.claudeRoom = r || null; }).catch(() => { }); } catch (e) { } }
// claude.ai の外（GitHub Pages など）では WebRTC で直接つなぐ
const PEER_OK = !IN_CLAUDE && typeof RTCPeerConnection !== 'undefined' && /^https?:$/.test(location.protocol);
const setPresence = patch => { try { const p = NET.room.presence(patch); if (p && p.catch) p.catch(() => { }); } catch (e) { } };
function myGc(h) { return { v: 2, ver: VERSION, n: LOC.name, t: LOC.team, k: LOC.n, t0: NET.t0, h: h ? 1 : 0 }; }
function onlineButton() {
  if (IN_CLAUDE) { if (!NET.claudeRoom) { note('この表示ではオンライン機能を使えません（共有された相手と、サインインした状態で開いてください）', 5); return; } NET.mode = 'claude'; NET.room = NET.claudeRoom; enterOnline(); }
  else if (PEER_OK) { APP.screen = 'online'; hud.focus = -1; }
  else note('このブラウザではオンライン対戦を使えません', 4);
}
function startPeer(code, host) {
  leaveOnline(); code = cleanCode(code); if (code.length !== 5) { note('部屋コードは5文字です', 3); return; }
  NET.mode = 'peer'; NET.code = code; NET.peerStat = 'connecting';
  NET.room = createPeerRoom({ code, host, onStatus: (st, d) => {
    NET.peerStat = st;
    if (st === 'error' || st === 'lost') { const back = NET.on; toTitle(); if (back || st === 'error') note(d || '接続が切れました', 6); }
  } });
  try { history.replaceState(null, '', '#room-' + code); } catch (e) { }
  enterOnline();
}
function inviteUrl() { return location.origin + location.pathname + '#room-' + NET.code; }
function copyInvite() {
  const url = inviteUrl();
  const done = () => note('招待リンクをコピーしました。相手に送ってください', 3);
  try { navigator.clipboard.writeText(url).then(done, () => askText('この招待リンクをコピーして相手に送ってください', url, null)); } catch (e) { askText('この招待リンクをコピーして相手に送ってください', url, null); }
}
// ---- 文字入力（部屋コード入力・リンク表示）
function askText(title, value, onOk) {
  const old = document.getElementById('ask'); if (old) old.remove();
  const box = document.createElement('div'); box.id = 'ask';
  box.style.cssText = 'position:fixed;inset:0;z-index:9;display:flex;align-items:center;justify-content:center;background:rgba(5,6,14,.75);font:bold 18px "Hiragino Sans","Noto Sans JP",sans-serif;color:#ffe9a8';
  box.innerHTML = '<div style="background:#161b33;border:3px solid #ffd23f;border-radius:16px;padding:22px;max-width:92vw;width:520px;display:flex;flex-direction:column;gap:14px"><div class="t"></div><input style="font:bold 22px monospace;padding:10px;border-radius:10px;border:2px solid #4a5577;background:#0b0d18;color:#fff;letter-spacing:2px"><div style="display:flex;gap:10px;justify-content:flex-end"><button class="c" style="font:bold 16px sans-serif;padding:10px 18px;border-radius:10px;border:0;background:#9aa3c7">閉じる</button><button class="o" style="font:bold 16px sans-serif;padding:10px 18px;border-radius:10px;border:0;background:#ffd23f">OK</button></div></div>';
  box.querySelector('.t').textContent = title; const inp = box.querySelector('input'); inp.value = value || '';
  const close = () => { box.remove(); ui.focus(); }, ok = () => { const v = inp.value; close(); if (onOk) onOk(v); };
  box.querySelector('.c').onclick = close; box.querySelector('.o').onclick = ok;
  if (!onOk) box.querySelector('.o').style.display = 'none';
  inp.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') ok(); if (e.key === 'Escape') close(); });
  box.addEventListener('pointerdown', e => e.stopPropagation()); box.addEventListener('keydown', e => e.stopPropagation());
  document.body.appendChild(box); setTimeout(() => { inp.focus(); inp.select(); }, 30);
}
function enterOnline() {
  if (!NET.room) return;
  NET.on = true; NET.verWarned = false; NET.waitT = 0; NET.resendT = 0; NET.t0 = Date.now(); NET.isHost = false; NET.host = null; NET.claimT = 0; NET.as = []; NET.mid = 0; NET.hbStr = ''; NET.rin = {}; NET.ring = []; NET.lastQ = -1;
  setPresence({ gc: myGc(false), hb: null, s: null, in: null }); APP.screen = 'lobby'; hud.focus = -1;
}
function leaveOnline() {
  if (NET.mode === 'peer' && NET.room) { const r = NET.room; NET.room = null; setTimeout(() => r.close(), 200); try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { } }
  if (!NET.on) { NET.mode = ''; return; }
  NET.on = false; NET.isHost = false; if (NET.room) setPresence({ gc: null, hb: null, s: null, in: null }); if (NET.mode === 'peer') NET.room = null; NET.mode = '';
}
const older = (a, b) => a.presence.gc.t0 < b.presence.gc.t0 || (a.presence.gc.t0 === b.presence.gc.t0 && a.peer < b.peer);
function validGc(p) { const g = p.presence && p.presence.gc; return p.kind === 'viewer' && g && typeof g === 'object' && g.v === 2 && typeof g.t0 === 'number'; }
function assignSlots() {
  const as = [null, null, null, null, null, null, null, null], sorted = NET.peers.slice().sort((a, b) => older(a, b) ? -1 : 1);
  for (const p of sorted) {
    const g = p.presence.gc, k = clamp(g.k | 0, 1, 4), want = g.t === 1 ? 1 : 0, nm = String(g.n || '？').slice(0, 8);
    for (let li = 0; li < k; li++) for (const t of [want, 1 - want]) { let done = false; for (let j = 0; j < 4; j++) if (!as[t * 4 + j]) { as[t * 4 + j] = [p.peer, li, k > 1 ? `${nm}${li + 1}` : nm]; done = true; break; } if (done) break; }
  }
  return as;
}
function publishHb(st) { const hb = { st, ver: VERSION, mid: NET.mid, as: NET.as, diff: LOC.diff, sk: LOC.skipP1 ? 1 : 0 }, str = JSON.stringify(hb); if (str !== NET.hbStr) { NET.hbStr = str; setPresence({ hb }); } }
function slotsFromAs(as) { const sl = [], mine = []; for (let i = 0; i < 8; i++) { const a = as[i]; sl.push(a ? { name: String(a[2]).slice(0, 10), human: true, col: S.SLOT_COL[i] } : { name: S.BOT_NAMES[i], human: false, col: S.SLOT_COL[i] }); if (a && NET.me && a[0] === NET.me.peer) mine[a[1]] = i; } return [sl, mine.filter(x => x !== undefined)]; }
function hostStart() {
  NET.as = assignSlots(); NET.mid = (Date.now() % 1e9) | 0; NET.rin = {}; NET.ring = []; NET.evId = 0; NET.seq = 0;
  const [sl, mine] = slotsFromAs(NET.as); beginMatch(S.createMatch({ slots: sl, diff: LOC.diff, skipP1: LOC.skipP1 }), mine); publishHb('game');
}
function netTick(dt, now) {
  if (!NET.on || !NET.room) return;
  let all = []; try { all = NET.room.peers() || []; } catch (e) { all = []; }
  NET.me = all.find(p => p.sameTab) || null; NET.peers = all.filter(validGc);
  if (!NET.me || !NET.peers.includes(NET.me)) {
    // つながらないまま時間が過ぎたら、あきらめてタイトルへ戻る
    NET.waitT = (NET.waitT || 0) + dt; NET.resendT = (NET.resendT || 0) + dt;
    if (NET.resendT > 1.5) { NET.resendT = 0; setPresence({ gc: myGc(false) }); }
    if (NET.waitT > (NET.mode === 'peer' ? 25 : 9)) { NET.waitT = 0; toTitle(); note('オンラインに接続できませんでした（共有された相手が、サインインした状態で開く必要があります）', 6); }
    return;
  }
  NET.waitT = 0;
  // ---- ホストを決める（先に入った人。すでにホストがいればその人）
  let host = null;
  if (NET.mode === 'peer') {
    // 部屋を作った人がホスト
    host = NET.peers.find(p => p.peer === NET.room.hubId) || null;
    if (NET.room.isHub && !NET.me.presence.gc.h) setPresence({ gc: myGc(true) });
  } else {
  const claims = NET.peers.filter(p => p.presence.gc.h);
  for (const p of claims) if (!host || older(p, host)) host = p;
  const iClaim = !!NET.me.presence.gc.h;
  if (host && host !== NET.me && iClaim) { setPresence({ gc: myGc(false), hb: null, s: null }); NET.hbStr = ''; }
  }
  if (!host && NET.mode !== 'peer') { let first = NET.me; for (const p of NET.peers) if (older(p, first)) first = p; NET.claimT = first === NET.me ? NET.claimT + dt : 0; if (NET.claimT > 1.2) { setPresence({ gc: myGc(true) }); NET.claimT = 0; } }
  const wasHost = NET.isHost, prevHost = NET.host; NET.host = host; NET.isHost = host === NET.me;
  if (prevHost && !host && G && !wasHost) { note('ホストが退出したため、ロビーに戻りました'); G = null; APP.screen = 'lobby'; NET.mid = 0; }
  if (NET.isHost) {
    if (!wasHost) { NET.hbStr = ''; if (G && G.client) { G = null; APP.screen = 'lobby'; } }
    if (APP.screen === 'lobby' || !G) { NET.as = assignSlots(); publishHb('lobby'); }
    else {
      // 退出した人の席は Bot が引き継ぐ
      NET.as.forEach((a, i) => { if (a && !NET.peers.some(p => p.peer === a[0])) { NET.as[i] = null; G.slots[i].human = false; G.slots[i].name += '(Bot)'; note(`${a[2]} が退出しました。Botが引き継ぎます`); } });
      publishHb('game');
      // 参加者の入力を受け取る
      for (const p of NET.peers) {
        if (p === NET.me) continue; const pin = p.presence.in; if (!Array.isArray(pin) || pin[0] !== NET.mid) continue;
        for (let li = 0; li < 4; li++) {
          const a = pin[li + 1]; if (!Array.isArray(a) || a.length < 11 || !a.every(Number.isFinite)) continue;
          const slot = NET.as.findIndex(x => x && x[0] === p.peer && x[1] === li); if (slot < 0) continue;
          const key = p.peer + ':' + li, last = NET.rin[key] || a, i = G.inp[slot];
          i.mx = clamp(a[0] / 9, -1, 1); i.my = clamp(a[1] / 9, -1, 1); i.a = !!(a[2] & 1); i.x = !!(a[2] & 2); i.g = !!(a[2] & 4);
          if (a[3] !== last[3]) i.aP = true; if (a[4] !== last[4]) i.bP = true; if (a[5] !== last[5]) i.xP = true; if (a[6] !== last[6]) i.mP = true; if (a[7] !== last[7]) i.sP = true; if (a[8] !== last[8]) i.eP = true;
          if (a[9] >= 1 && a[9] <= 3) i.card = a[9] | 0; if ((i.aP || i.xP || i.sP) && a[10] >= 0) i.rt = a[10] / 100;
          NET.rin[key] = a;
        }
      }
    }
  } else if (host) {
    const hb = host.presence.hb;
    if (hb && typeof hb === 'object' && Array.isArray(hb.as)) {
      NET.as = hb.as; LOC.diff = clamp(hb.diff | 0, 0, 3); LOC.skipP1 = !!hb.sk;
      if (hb.ver && hb.ver !== VERSION && !NET.verWarned) { NET.verWarned = true; note(`ホストとバージョンが違います（ホスト ${hb.ver}／あなた ${VERSION}）。両方ともページを再読み込みしてください`, 8); }
      if (hb.st === 'game' && hb.mid !== NET.mid) {
        NET.mid = hb.mid; NET.lastQ = -1; NET.lastEv = 0; const [sl, mine] = slotsFromAs(hb.as);
        beginMatch(S.createMatch({ slots: sl, client: true }), mine); G.ev.length = 0; G.cd = 99;
        for (const s of mine) { if (G.p1.chars[s]) G.p1.chars[s].pred = true; }
      } else if (hb.st === 'lobby' && G) { G = null; APP.screen = 'lobby'; NET.mid = 0; }
      const s = host.presence.s;
      if (G && G.client && s && typeof s === 'object' && s.m === NET.mid && s.q !== NET.lastQ && Array.isArray(s.d)) {
        NET.lastQ = s.q;
        try { S.decode(G, s.d); } catch (e) { }
        for (const sl of LOC.slots) { const T = G.teams && G.teams[sl < 4 ? 0 : 1]; if (T) T.crew[sl % 4].pred = true; }
        if (Array.isArray(s.e)) for (const ev of s.e) if (Array.isArray(ev) && ev[0] > NET.lastEv) { NET.lastEv = ev[0]; try { playEvent(ev.slice(1)); } catch (e) { } }
      }
    }
    // 自分の入力を送る
    if (G && G.client && now - NET.inT > 30) {
      NET.inT = now; const pk = [NET.mid];
      for (let li = 0; li < LOC.slots.length; li++) { const p = players[li], h = p.hold; pk.push([Math.round(h.mx * 9), Math.round(h.my * 9), (h.a ? 1 : 0) | (h.x ? 2 : 0) | (h.g ? 4 : 0), p.cnt.a, p.cnt.b, p.cnt.x, p.cnt.m, p.cnt.s, p.cnt.e, G.phase === 'trans' ? p.card : 0, p.rt >= 0 ? Math.round(p.rt * 100) : -1]); }
      const str = JSON.stringify(pk); if (str !== NET.inStr) { NET.inStr = str; setPresence({ in: pk }); }
    }
  }
}
const enc = new TextEncoder();
function hostPublish(now) {
  if (!NET.on || !NET.isHost || !G || now - NET.pubT < 50) return; NET.pubT = now;
  NET.ring = NET.ring.filter(r => now - r.t < 900);
  let ev = NET.ring.map(r => [r.id, ...r.e]); const d = S.encode(G);
  let pkt = { m: NET.mid, q: ++NET.seq, d, e: ev };
  while (ev.length && enc.encode(JSON.stringify(pkt)).length > 3300) { ev = ev.slice(Math.ceil(ev.length / 4)); pkt = { m: NET.mid, q: NET.seq, d, e: ev }; }
  setPresence({ s: pkt });
}
// ---- クライアント：自分のキャラだけ先に動かして、操作の遅れを感じにくくする
function predict(dt) {
  if (!G || !G.client) return;
  LOC.slots.forEach((slot, li) => {
    const h = players[li].hold, moving = Math.abs(h.mx) + Math.abs(h.my) > 0.1;
    if (G.phase === 'p1' && G.cd <= 0) {
      const c = G.p1.chars[slot]; if (!c || c.nx === undefined) return;
      if (c.stun > 0) { c.x += (c.nx - c.x) * Math.min(1, dt * 12); c.z += (c.nz - c.z) * Math.min(1, dt * 12); c.vx = c.vz = 0; return; }
      const sp = S.BAL.p1Speed * (c.carry >= 0 ? 0.82 : 1) * (G.p1.hen[c.team] ? 1.1 : 1), k = Math.min(1, dt * 12);
      c.vx = (c.vx || 0) + (h.mx * sp - (c.vx || 0)) * k; c.vz = (c.vz || 0) + (h.my * sp - (c.vz || 0)) * k; S.moveCircle(c, c.vx * dt, c.vz * dt, 0.9);
      const err = Math.hypot(c.nx - c.x, c.nz - c.z), pull = !moving ? 6 : err > 3.5 ? 2.5 : 0; c.x += (c.nx - c.x) * Math.min(1, dt * pull); c.z += (c.nz - c.z) * Math.min(1, dt * pull);
    } else if (G.teams && (G.phase === 'p2' || G.phase === 'escape')) {
      const T = G.teams[slot < 4 ? 0 : 1], c = T.crew[slot % 4]; if (!c || c.nx === undefined || c.role === 'pilot' || c.escaped) return;
      if (c.dizzy > 0 || T.tilt) { c.x += (c.nx - c.x) * Math.min(1, dt * 12); c.y += (c.ny - c.y) * Math.min(1, dt * 12); c.vx = c.vy = 0; return; }
      S.moveCrew(G, T, c, h.mx, h.my, dt);
      const err = Math.hypot(c.nx - c.x, c.ny - c.y), pull = !moving ? 6 : err > 55 ? 2.5 : 0; c.x += (c.nx - c.x) * Math.min(1, dt * pull); c.y += (c.ny - c.y) * Math.min(1, dt * pull);
    }
  });
}

// ---------------------------------------------------------------- メニュー操作
function onUI(id) {
  AU.unlock(); sfx('ui');
  const host = !NET.on || NET.isHost;
  if (id.startsWith('card')) { pickCard(0, +id.slice(4) + 1); return; }
  switch (id) {
    case 'solo': leaveOnline(); APP.screen = 'lobby'; hud.focus = -1; break;
    case 'online': onlineButton(); break;
    case 'create': startPeer(newRoomCode(), true); break;
    case 'join': askText('ホストから聞いた部屋コード（5文字）を入力', '', v => startPeer(v, false)); break;
    case 'invite': copyInvite(); break;
    case 'reload': location.reload(); break;
    case 'help': APP.help = 0; hud.focus = -1; break;
    case 'helpNext': APP.help = APP.help >= 2 ? -1 : APP.help + 1; hud.focus = -1; break;
    case 'mute': AU.setMute(!AU.muted); break;
    case 'gfx': LOC.low = !LOC.low; store.set('gc_low', LOC.low ? '1' : '0'); R.setQuality(LOC.low); resize(); break;
    case 'team': LOC.team ^= 1; if (NET.on) setPresence({ gc: myGc(NET.isHost) }); break;
    case 'locals': LOC.n = LOC.n % 4 + 1; if (NET.on) setPresence({ gc: myGc(NET.isHost) }); break;
    case 'diff': if (host) LOC.diff = (LOC.diff + 1) % 4; break;
    case 'navi': LOC.navi = !LOC.navi; store.set('gc_navi', LOC.navi ? '1' : '0'); break;
    case 'p1': if (host) LOC.skipP1 = !LOC.skipP1; break;
    case 'name': LOC.name = NAMES[(NAMES.indexOf(LOC.name) + 1 + ((Math.random() * 3) | 0)) % NAMES.length]; store.set('gc_name', LOC.name); if (NET.on) setPresence({ gc: myGc(NET.isHost) }); break;
    case 'start': case 'again': if (!host) break; if (NET.on) hostStart(); else startOffline(); break;
    case 'lobby': if (host) toLobby(); break;
    case 'back': case 'quit': case 'leave': toTitle(); break;
    case 'menu': APP.paused = true; hud.focus = -1; break;
    case 'resume': APP.paused = false; break;
  }
}
function uiNav() {
  const B = hud.buttons;
  if (uiQ.pause && APP.screen === 'game' && G && G.phase !== 'result') { APP.paused = !APP.paused; hud.focus = -1; }
  if (uiActive() && B.length) {
    const def = () => { const i = B.findIndex(b => ['start', 'solo', 'again', 'resume', 'helpNext'].includes(b.id)); return i < 0 ? 0 : i; };
    if (uiQ.dx || uiQ.dy) {
      hud.showFocus = true;
      if (hud.focus < 0 || hud.focus >= B.length) hud.focus = def();
      else { const c = B[hud.focus], cx = c.x + c.w / 2, cy = c.y + c.h / 2; let best = -1, bd = 1e9; B.forEach((b, i) => { if (i === hud.focus) return; const ox = b.x + b.w / 2 - cx, oy = b.y + b.h / 2 - cy, along = ox * uiQ.dx + oy * uiQ.dy; if (along <= 4) return; const d = along + (Math.abs(ox * uiQ.dy) + Math.abs(oy * uiQ.dx)) * 2; if (d < bd) { bd = d; best = i; } }); if (best >= 0) hud.focus = best; }
    }
    if (uiQ.ok) { const i = hud.showFocus && hud.focus >= 0 && hud.focus < B.length ? hud.focus : def(); if (B[i]) onUI(B[i].id); }
    if (uiQ.back) { if (APP.help >= 0) APP.help = -1; else if (APP.paused) APP.paused = false; else if (APP.screen === 'lobby' || APP.screen === 'online') toTitle(); }
  }
  uiQ.dx = uiQ.dy = 0; uiQ.ok = uiQ.back = uiQ.pause = false;
}
function lobbyModel() {
  const L = { navi: LOC.navi, online: NET.on, team: LOC.team, nLocal: LOC.n, diff: LOC.diff, skipP1: LOC.skipP1, name: LOC.name, dev: LOC.dev, host: !NET.on || NET.isHost, slots: [], status: '', hint: '', padInfo: `コントローラー ${PADS.list.length}台` };
  if (NET.on) {
    const as = NET.as || [];
    for (let i = 0; i < 8; i++) { const a = as[i], me = a && NET.me && a[0] === NET.me.peer; L.slots.push(a ? { name: String(a[2]).slice(0, 10), human: true, col: S.SLOT_COL[i], me, tag: me ? 'あなた' : (NET.host && a[0] === NET.host.peer ? 'ホスト' : '参加者') } : { name: S.BOT_NAMES[i], human: false, col: S.SLOT_COL[i], me: false, tag: 'Bot' }); }
    if (NET.mode === 'peer') {
      L.code = NET.code;
      L.status = NET.peerStat === 'connecting' ? '接続中…' : !NET.host ? 'ホストを待っています…' : `部屋コード ${NET.code}　｜　部屋に ${NET.peers.length} 人（最大8人）`;
      for (let i = 0; i < 8; i++) { const a = as[i]; if (!a) continue; const p = NET.peers.find(q => q.peer === a[0]); if (p && p.presence.gc.ver && p.presence.gc.ver !== VERSION) L.slots[i].tag = '要再読み込み'; }
    } else L.status = !NET.me ? '接続中…' : !NET.host ? '部屋を準備中…' : `部屋に ${NET.peers.length} 人。このページを開いて「オンライン」を押した人が集まります`;
    L.hint = NET.mode === 'peer' ? '「招待リンクをコピー」で相手を呼べます。空いている席はBotが入ります' : '空いている席はBotが入ります。全員が同じチームなら協力プレイになります';
  } else {
    const [sl, mine] = offlineSlots(); sl.forEach((s, i) => L.slots.push({ ...s, me: mine.includes(i), tag: mine.includes(i) ? (LOC.n === 1 ? 'あなた' : mine.indexOf(i) === 0 && PADS.list.length < LOC.n ? 'キーボード' : 'コントローラー') : 'Bot' }));
    L.status = 'チームを選んでスタート。空いている席はBotが入ります';
    L.hint = LOC.n > 1 ? (PADS.list.length >= LOC.n ? '全員コントローラーで操作します（P1はキーボードも可）' : `P1はキーボード、P2からはコントローラー（いま${PADS.list.length}台。足りない人は動かせません）`) : 'コントローラーをつなぐと、そのまま使えます';
  }
  return L;
}
const KEYS = {
  kb: { a: '[Space]', aHold: '[Space長押し]', b: '[K]', s: '[I]' }, pad: { a: 'Ⓐ', aHold: 'Ⓐ長押し', b: 'Ⓑ', s: 'Ⓨ' }, touch: { a: '', aHold: '長押し', b: '「投げる」', s: '「必殺」' },
};
const TIPS = {
  kb: ['WASD：移動　Space：拾う・入れる・作業（長押し）・連打　K：投げる', 'A/D：移動　J連打：コンボ　K：強　L：ガード（直前でジャスト）　U：飛び道具　I：必殺技　X：脱出'],
  pad: ['スティック：移動　Ⓐ：拾う・入れる・作業（長押し）・連打　Ⓑ：投げる', 'Ⓧ連打：コンボ　Ⓑ：強　RB：ガード（直前でジャスト）　LB：飛び道具　Ⓨ：必殺技　Back：脱出'],
  touch: ['左側をなぞって移動　右のボタンで操作', '左側をなぞって移動　右のボタンで攻撃・ガード・必殺技'],
};

// ---------------------------------------------------------------- 自己ベスト
const BEST = { v: +(store.get('gc_best') || 0), isNew: false, g: null };
function recordBest() {
  if (!G || G.phase !== 'result' || !G.result || !G.result.score || BEST.g === G.result || !LOC.slots.length) return;
  BEST.g = G.result; const sc = G.result.score[LOC.slots[0]] || 0;
  BEST.isNew = sc > BEST.v; if (BEST.isNew) { BEST.v = sc; store.set('gc_best', String(sc)); }
}
// ---------------------------------------------------------------- メインループ
const STEP = 1 / 60, NOGL = location.search.includes('nogl'); let acc = 0, last = performance.now();
function frame(now) {
  const dt = Math.min(0.134, (now - last) / 1000); last = now;
  pollPads(); uiNav(); sampleHolds(); netTick(dt, now);
  if (G && APP.screen === 'game') {
    if (G.client) { predict(dt); S.clientTick(G, dt); for (const p of players) p.pend = newPend(); }
    else if (!APP.paused || NET.on) {
      acc += dt; let n = 0;
      while (acc >= STEP && n < 8) { applyLocalInputs(); S.step(G, STEP); acc -= STEP; n++; }
      if (acc > STEP * 8) acc = 0;
      drainEvents(); hostPublish(now);
    }
  }
  // ---- 表示
  const dev = LOC.dev;
  recordBest(); view = { navi: LOC.navi, best: BEST.v, newBest: BEST.isNew, team: LOC.slots.length ? (LOC.slots[0] < 4 ? 0 : 1) : 0, locals: LOC.slots, dev, key: KEYS[dev], keyPad: KEYS.pad, tipCrew: TIPS[dev][0], tipPilot: TIPS[dev][1], canRestart: !NET.on || NET.isHost };
  const inGame = G && APP.screen === 'game';
  BGM.mode = !inGame ? 'title' : G.phase === 'p1' ? (G.cd > 0 ? 'title' : 'city') : G.phase === 'trans' ? 'off' : G.phase === 'p2' ? (G.cd > 0 ? 'off' : G.od ? 'od' : 'battle') : G.phase === 'escape' ? 'escape' : 'off';
  BGM.tick();
  hud.update(dt); APP.noteT -= dt;
  if (!NOGL) R.draw(inGame ? G : null, view, APP.paused && !NET.on ? 0 : dt);
  ctx.setTransform(RS, 0, 0, RS, 0, 0); ctx.clearRect(0, 0, W, H);
  if (inGame) {
    hud.drawGame(G, view);
    if (touch.used && !uiActive()) hud.drawTouch(touch, touchLayout());
    if (G.phase !== 'result' && !APP.paused) hud.button('menu', W / 2 + 62, 14, 34, 34, '≡', 'rgba(255,255,255,.55)', '', 20);
    if (APP.paused) hud.drawPause(NET.on);
  } else if (APP.screen === 'lobby') hud.drawLobby(lobbyModel());
  else if (APP.screen === 'online') hud.drawOnline();
  else hud.drawTitle({ online: IN_CLAUDE ? !!NET.claudeRoom : PEER_OK, onlineWhy: 'この表示では使えません', muted: AU.muted, pads: PADS.list.length, low: LOC.low, ver: VERSION, newVer: UPD.newVer });
  if (APP.help >= 0) hud.drawHelp(APP.help);
  if (APP.noteT > 0) hud.drawNote(APP.note);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ---------------------------------------------------------------- 新しいバージョンの確認（GitHub Pages）
const UPD = { newVer: '' };
async function checkVersion() {
  if (IN_CLAUDE || !/^https?:$/.test(location.protocol) || VERSION === 'dev') return;
  try { const r = await fetch('./version.json?t=' + Date.now(), { cache: 'no-store' }); if (!r.ok) return; const j = await r.json(); if (j && j.version && j.version !== VERSION) UPD.newVer = String(j.version).slice(0, 20); } catch (e) { }
}
checkVersion(); setInterval(() => { if (APP.screen !== 'game') checkVersion(); }, 5 * 60 * 1000);
// ---------------------------------------------------------------- 招待リンク（#room-XXXXX）から自動で参加
{ const m = /^#room-([A-Za-z0-9]{5})$/.exec(location.hash); if (m && PEER_OK) setTimeout(() => startPeer(m[1], false), 300); }

// ---------------------------------------------------------------- テスト用
window.__GC = { AU, BGM, BEST, VERSION, startPeer, get G() { return G; }, S, APP, LOC, NET, R, hud, players, startOffline, onUI, press, toTitle };
