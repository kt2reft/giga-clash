// =====================================================================
// GIGA-CLASH  hud.js — 2Dオーバーレイ（HUD・メニュー・タッチ操作の表示）
// =====================================================================
import { TN, NS, teamOf, CHARS, charOf, THEME, ZKEYS, ZONES, ZONE_EFF, ST, CON, CITY, BASE_INFO, CARDS, TEAM_NAME, TEAM_COL, SLOT_COL, DIFF, BAL, pilotOf, zoneOff, promptFor, crewNavi, chargerOpen, BATTLE_TIME } from './sim.js';
import { W, H, EXT_H } from './render3d.js';

const FONT = '"Hiragino Kaku Gothic ProN","Hiragino Sans","Noto Sans JP","Noto Sans CJK JP","Yu Gothic","Meiryo",sans-serif';
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
// コントローラーの種類ごとのボタン表記（ボタンの位置はXbox配置の名前で指定：A=下、B=右、X=左、Y=上）
export const PADL = {
  xbox: { name: 'Xbox', A: 'Ⓐ', B: 'Ⓑ', X: 'Ⓧ', Y: 'Ⓨ', L1: 'LB', R1: 'RB', L2: 'LT', R2: 'RT', sel: 'View', st: 'Menu', col: { A: '#5cc86a', B: '#ee4b4b', X: '#3f8cff', Y: '#ffc531' } },
  ps: { name: 'PlayStation', A: '✕', B: '○', X: '□', Y: '△', L1: 'L1', R1: 'R1', L2: 'L2', R2: 'R2', sel: 'Create', st: 'Options', col: { A: '#7fa8ff', B: '#ff6f6f', X: '#ff8fd0', Y: '#4fe0b0' } },
  sw: { name: 'Nintendo Switch', A: 'Ⓑ', B: 'Ⓐ', X: 'Ⓨ', Y: 'Ⓧ', L1: 'L', R1: 'R', L2: 'ZL', R2: 'ZR', sel: '−', st: '＋', col: { A: '#d9dde8', B: '#d9dde8', X: '#d9dde8', Y: '#d9dde8' } },
};
export function padKind(id = '') {
  const s = String(id).toLowerCase();
  if (/054c|playstation|dualshock|dualsense|wireless controller|ps[345]/.test(s)) return 'ps';
  if (/057e|nintendo|pro controller|joy-con|switch/.test(s)) return 'sw';
  return 'xbox';
}
const ITEM_COL = [{ coal: '#55555f', mN: '#ff5a4f', mH: '#3fa9ff', mS: '#ffd23f' }, { coal: '#9b5cff', mN: '#9be36d', mH: '#3fe0d0', mS: '#ffd23f' }];

export function createHud(ctx, R) {
  const font = (sz, w = 'bold') => `${w} ${sz}px ${FONT}`;
  function rr(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function text(t, x, y, sz, col = '#fff', align = 'center', w = 'bold', stroke = null, sw = 4) {
    ctx.font = font(sz, w); ctx.textAlign = align; ctx.textBaseline = 'middle';
    if (stroke) { ctx.lineJoin = 'round'; ctx.lineWidth = sw; ctx.strokeStyle = stroke; ctx.strokeText(t, x, y); }
    ctx.fillStyle = col; ctx.fillText(t, x, y);
  }
  function tw(t, sz) { ctx.font = font(sz); return ctx.measureText(t).width; }
  function bar(x, y, w, h, v, col, bg = 'rgba(0,0,0,.55)', border = 'rgba(255,255,255,.8)', rev = false) {
    rr(x, y, w, h, h / 2); ctx.fillStyle = bg; ctx.fill();
    if (v > 0) { ctx.save(); rr(x, y, w, h, h / 2); ctx.clip(); ctx.fillStyle = col; const fw = w * clamp(v, 0, 1); ctx.fillRect(rev ? x + w - fw : x, y, fw, h); ctx.restore(); }
    rr(x, y, w, h, h / 2); ctx.lineWidth = 2; ctx.strokeStyle = border; ctx.stroke();
  }
  function label(s, x, y, sz, col, bg = 'rgba(10,12,24,.82)', border = null) {
    const w = tw(s, sz) + 16; rr(x - w / 2, y - sz * 0.8, w, sz * 1.6, 7); ctx.fillStyle = bg; ctx.fill(); if (border) { ctx.strokeStyle = border; ctx.lineWidth = 2; ctx.stroke(); }
    text(s, x, y, sz, col);
  }
  function ring(x, y, rt, scale = 1) {
    const r = (rt <= 1 ? lerp(84, 24, rt) : lerp(24, 9, (rt - 1) / 0.3)) * scale;
    ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, 24 * scale, 0, 7); ctx.stroke();
    ctx.strokeStyle = Math.abs(rt - 1) < 0.09 ? '#ffd23f' : '#ff9a3c'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(x, y, Math.max(4, r), 0, 7); ctx.stroke();
  }
  // 顔アイコン：ヒーローはヘルメット＋黒バイザー、怪人は角と赤い目
  function face(col, x, y, s = 1, team = 0) {
    ctx.lineWidth = 2.5; ctx.strokeStyle = '#1a1d2e';
    if (team === 0) {
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, 15 * s, 0, 7); ctx.fill();
      ctx.fillStyle = '#0d0f18'; ctx.beginPath(); ctx.moveTo(x - 11 * s, y - 3 * s); ctx.lineTo(x + 11 * s, y - 3 * s); ctx.lineTo(x + 9 * s, y + 3 * s); ctx.lineTo(x + 3 * s, y + 3 * s); ctx.lineTo(x + 3 * s, y + 10 * s); ctx.lineTo(x - 3 * s, y + 10 * s); ctx.lineTo(x - 3 * s, y + 3 * s); ctx.lineTo(x - 9 * s, y + 3 * s); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#9fe8ff'; ctx.fillRect(x + 2 * s, y - 2 * s, 6 * s, 1.6 * s);
      ctx.fillStyle = '#eef1ff'; ctx.fillRect(x - 1.5 * s, y - 15 * s, 3 * s, 8 * s);
      ctx.beginPath(); ctx.arc(x, y, 15 * s, 0, 7); ctx.stroke();
    } else {
      ctx.fillStyle = '#e9dcc0'; for (const d of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x + d * 8 * s, y - 9 * s); ctx.lineTo(x + d * 19 * s, y - 22 * s); ctx.lineTo(x + d * 13 * s, y - 6 * s); ctx.closePath(); ctx.fill(); ctx.stroke(); }
      ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x - 14 * s, y - 6 * s); ctx.quadraticCurveTo(x, y - 20 * s, x + 14 * s, y - 6 * s); ctx.lineTo(x + 11 * s, y + 10 * s); ctx.lineTo(x, y + 15 * s); ctx.lineTo(x - 11 * s, y + 10 * s); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ff2a2a'; for (const d of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x + d * 2 * s, y - 1 * s); ctx.lineTo(x + d * 10 * s, y - 5 * s); ctx.lineTo(x + d * 8 * s, y + 1 * s); ctx.closePath(); ctx.fill(); }
      ctx.fillStyle = '#e9dcc0'; for (const d of [-4, 0, 4]) { ctx.beginPath(); ctx.moveTo(x + (d - 2) * s, y + 6 * s); ctx.lineTo(x + (d + 2) * s, y + 6 * s); ctx.lineTo(x + d * s, y + 10 * s); ctx.closePath(); ctx.fill(); }
    }
  }

  const S = { banners: [], pops: [], cutin: null, bubbles: [], t: 0 };
  const hud = {
    buttons: [], focus: -1, showFocus: false,
    reset() { S.banners.length = 0; S.pops.length = 0; S.cutin = null; S.bubbles.length = 0; },
    banner(text_, sub, col, dur) { S.banners.push({ text: text_, sub, col, t: dur, max: dur }); if (S.banners.length > 3) S.banners.shift(); },
    cutin(text_, col, dur) { S.cutin = { text: text_, col, t: dur, max: dur }; },
    pop(layer, x, y, text_, col, size) { S.pops.push({ layer, x, y, text: text_, col, size, t: 1.1 }); if (S.pops.length > 40) S.pops.shift(); },
    bubble(k, text_) { S.bubbles = S.bubbles.filter(b => b.k !== k); S.bubbles.push({ k, text: text_, t: 1.8 }); },
    update(dt) {
      S.t += dt;
      for (const L of [S.banners, S.pops, S.bubbles]) for (let i = L.length - 1; i >= 0; i--) { L[i].t -= dt; if (L[i].layer) L[i].y += 0; if (L[i].t <= 0) L.splice(i, 1); }
      if (S.cutin) { S.cutin.t -= dt; if (S.cutin.t <= 0) S.cutin = null; }
    },
    button(id, x, y, w, h, lab, col = '#ffd23f', sub = '', sz = 24) {
      const i = hud.buttons.length; rr(x, y, w, h, 14); ctx.fillStyle = col; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#11131f'; ctx.stroke();
      if (hud.showFocus && hud.focus === i) { rr(x - 5, y - 5, w + 10, h + 10, 18); ctx.lineWidth = 4; ctx.strokeStyle = '#ffffff'; ctx.stroke(); }
      text(lab, x + w / 2, y + h / 2 - (sub ? 9 : 0), sz, '#11131f'); if (sub) text(sub, x + w / 2, y + h / 2 + 15, 12, '#2a2d40', 'center', 'normal');
      hud.buttons.push({ id, x, y, w, h });
    },

    // ================================================================ ゲーム中
    drawGame(G, view) {
      hud.buttons = [];
      if (G.phase === 'p1') drawP1(G, view);
      else if (G.phase === 'trans') drawTrans(G, view);
      else { drawP2(G, view); }
      drawSkill(G, view);
      drawOverlays(G, view);
      if (G.phase === 'result') drawResult(G, view);
    },
    drawTouch, drawTitle, drawHelp, drawLobby, drawPause, drawNote, drawOnline,
  };

  // ---------------------------------------------------------------- 前半戦
  function drawScore(G) {
    const P = G.p1, own = [0, 0]; P.bases.forEach(b => { if (b.own >= 0) own[b.own]++; });
    for (const t of [0, 1]) {
      const x = t ? W - 22 : 22, al = t ? 'right' : 'left', sc = own[t] * 4 + P.pts[t];
      text(`${TEAM_NAME[t]}チーム`, x, 22, 16, TEAM_COL[t], al, 'bold', 'rgba(0,0,0,.75)', 4);
      text(String(sc), x, 56, 44, '#fff', al, 'bold', 'rgba(0,0,0,.75)', 6);
      text(`拠点 ${own[t]}（×4）　市民 ${P.pts[t]}点`, x + (t ? -1 : 1) * 78, 62, 14, '#e8ecff', al, 'bold', 'rgba(0,0,0,.75)', 4);
    }
    P.bases.forEach((b, k) => {
      const x = W / 2 - 124 + k * 62, col = b.own < 0 ? 'rgba(30,34,56,.85)' : TEAM_COL[b.own];
      rr(x - 28, 60, 56, 24, 8); ctx.fillStyle = col; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 1.5; ctx.stroke();
      text(BASE_INFO[k].name, x, 72, 12, b.own < 0 ? '#aeb6d6' : '#11131f');
    });
  }
  function drawTimer(G, od) {
    const tm = Math.max(0, Math.ceil(G.time));
    rr(W / 2 - 52, 8, 104, 44, 12); ctx.fillStyle = od ? 'rgba(160,30,120,.85)' : 'rgba(10,12,30,.8)'; ctx.fill();
    text(`${(tm / 60) | 0}:${String(tm % 60).padStart(2, '0')}`, W / 2, 31, 28, od ? '#ffd6f6' : (G.phase === 'p1' && tm <= 30 ? '#ffd23f' : '#fff'));
  }
  function drawP1(G, view) {
    const P = G.p1;
    // 拠点とゴールのラベル
    P.bases.forEach((b, k) => {
      const p = R.projC(b.x, 0, b.z - b.r - 1); if (p.y < 90 || p.y > H + 20) return;
      const info = BASE_INFO[k], col = b.own < 0 ? '#e8ecff' : TEAM_COL[b.own];
      text(info.name, p.x, p.y - 26, 17, col, 'center', 'bold', 'rgba(0,0,0,.85)', 4);
      text(info.eff, p.x, p.y - 8, 12, '#ffe9a8', 'center', 'bold', 'rgba(0,0,0,.85)', 3);
      if (b.cap > 0) bar(p.x - 40, p.y + 4, 80, 9, b.cap, TEAM_COL[b.capTeam] || '#fff');
    });
    CITY.goals.forEach((g, t) => { const p = R.projC(g.x, 6, g.z); text(t ? 'ダークゲート' : 'シェルター', p.x, p.y, 16, TEAM_COL[t], 'center', 'bold', 'rgba(0,0,0,.85)', 4); });
    // キャラの名前
    for (const c of P.chars) {
      const p = R.projC(c.x, 3.6 + (c.carry >= 0 ? 1.6 : 0), c.z), me = view.locals.includes(c.slot);
      text(G.slots[c.slot].name, p.x, p.y, me ? 14 : 12, me ? '#fff' : SLOT_COL[c.slot], 'center', 'bold', me ? SLOT_COL[c.slot] : 'rgba(0,0,0,.8)', me ? 5 : 3);
      if (c.stun > 0) text('★ ★', p.x, p.y + 16, 12, '#ffd23f');
    }
    // 自分への案内
    for (const s of view.locals) {
      const c = P.chars[s], g = CITY.goals[c.team], p = R.projC(c.x, 0, c.z);
      if (c.carry >= 0) {
        const a = Math.atan2((g.z - c.z) * 0.8, g.x - c.x); ctx.save(); ctx.translate(p.x + Math.cos(a) * 54, p.y - 20 + Math.sin(a) * 54); ctx.rotate(a); ctx.fillStyle = TEAM_COL[c.team]; ctx.strokeStyle = '#11131f'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(-8, -11); ctx.lineTo(-8, 11); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
        if (G.cd <= 0 && s === view.locals[0]) label(`${c.team ? 'ダークゲート' : 'シェルター'}へ運べ！（${view.dev === 'touch' ? '「投げる」ボタン' : view.key.b} で投げる）`, p.x, p.y + 30, 13, '#ffe9a8');
      } else if (G.cd <= 0 && s === view.locals[0] && c.stun <= 0) {
        let near = false; for (const ci of P.cits) if (ci.state === 'free' && Math.hypot(ci.x - c.x, ci.z - c.z) < 2.6) near = true;
        const inBase = P.bases.find(b => Math.hypot(b.x - c.x, b.z - c.z) < b.r);
        if (near) label(`${view.key.a} 市民をかつぐ`, p.x, p.y + 30, 13, '#ffe9a8', 'rgba(10,12,24,.85)', '#ffc531');
        else if (inBase && inBase.own !== c.team) label('確保中…（敵がいると止まる）', p.x, p.y + 30, 13, '#cfe3ff');
      }
    }
    // ナビ（前半戦）
    if (view.navi && view.locals.length && G.cd <= 0) {
      const c = P.chars[view.locals[0]];
      if (c && c.stun <= 0) {
        let tx = null, tz = null, msg = '';
        if (c.carry >= 0) { const g = CITY.goals[c.team]; tx = g.x; tz = g.z; msg = `${c.team ? 'ダークゲート' : 'シェルター'}へ運ぶ`; }
        else {
          let best = null, bd = 30; for (const ci of P.cits) if (ci.state === 'free') { const d = Math.hypot(ci.x - c.x, ci.z - c.z); if (d < bd) { bd = d; best = ci; } }
          let base = null, bb = 1e9; for (const b of P.bases) if (b.own !== c.team) { const d = Math.hypot(b.x - c.x, b.z - c.z); if (d < bb) { bb = d; base = b; } }
          if (best) { tx = best.x; tz = best.z; msg = '市民をかつぐ'; } else if (base) { tx = base.x; tz = base.z; msg = `${BASE_INFO[base.id].name}を確保する`; }
        }
        if (tx !== null) {
          const a = R.projC(c.x, 0.5, c.z), b = R.projC(tx, 0.5, tz), dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
          if (d > 70) { const ang = Math.atan2(dy, dx); ctx.save(); ctx.translate(a.x + dx / d * 62, a.y + dy / d * 62); ctx.rotate(ang); ctx.fillStyle = '#ffd23f'; ctx.strokeStyle = '#11131f'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(-9, -12); ctx.lineTo(-9, 12); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore(); }
          const m = '次にやること：' + msg, w = tw(m, 17) + 36; rr(W / 2 - w / 2, H - 52, w, 34, 10); ctx.fillStyle = 'rgba(40,32,8,.9)'; ctx.fill(); ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 2; ctx.stroke(); text(m, W / 2, H - 35, 17, '#ffe9a8');
        }
      }
    }
    // ミニマップ
    const mx = W - 214, my = 98, mw = 200, mh = 120, sx = x => mx + (x + 80) / 160 * mw, sy = z => my + (z + 48) / 96 * mh;
    rr(mx - 4, my - 4, mw + 8, mh + 8, 8); ctx.fillStyle = 'rgba(8,10,22,.72)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.fillRect(mx, sy(-8), mw, sy(8) - sy(-8));
    P.bases.forEach(b => { ctx.strokeStyle = b.own < 0 ? '#dfe3f5' : TEAM_COL[b.own]; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(sx(b.x), sy(b.z), 8, 0, 7); ctx.stroke(); if (b.own >= 0) { ctx.fillStyle = TEAM_COL[b.own]; ctx.globalAlpha = 0.45; ctx.fill(); ctx.globalAlpha = 1; } });
    CITY.goals.forEach((g, t) => { ctx.fillStyle = TEAM_COL[t]; ctx.fillRect(sx(g.x) - 5, sy(g.z) - 9, 10, 18); });
    for (const c of P.cits) if (c.state === 'free') { ctx.fillStyle = c.type ? '#ffd23f' : '#ffffff'; ctx.fillRect(sx(c.x) - 1.5, sy(c.z) - 1.5, 3, 3); }
    for (const c of P.chars) { const me = view.locals.includes(c.slot); ctx.fillStyle = TEAM_COL[c.team]; ctx.beginPath(); ctx.arc(sx(c.x), sy(c.z), me ? 5 : 3.5, 0, 7); ctx.fill(); if (me) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke(); } }
    drawScore(G); drawTimer(G, false);
    if (P.dbl) text('市民ポイント2倍！', W / 2, 104, 18, '#ffd23f', 'center', 'bold', 'rgba(0,0,0,.85)', 4);
    if (G.cd > 0) {
      ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(0, 0, W, H);
      const t = view.team;
      text('前半戦　シティー・スクランブル', W / 2, 210, 44, '#ffd23f', 'center', 'bold', '#11131f', 8);
      text(view.locals.length ? `あなたは${TEAM_NAME[t]}チーム` : '観戦中', W / 2, 268, 26, TEAM_COL[t], 'center', 'bold', '#11131f', 6);
      const L = t ? ['市民をつかまえて「ダークゲート」へ放り込む', '拠点の輪に入って奪う（奪った拠点は後半戦の怪獣を強化）', 'ヒーローを殴って邪魔をする'] : ['市民をかついで「シェルター」へ運ぶ', '拠点の輪に入って確保（確保した拠点は後半戦のロボを強化）', '怪人を殴って市民を取り返す'];
      L.forEach((s, i) => text('・' + s, W / 2, 322 + i * 32, 20, '#fff', 'center', 'bold', 'rgba(0,0,0,.8)', 5));
      text(String(Math.ceil(G.cd)), W / 2, 470, 90, '#fff', 'center', 'bold', '#11131f', 10);
    }
  }
  // ---------------------------------------------------------------- 移行
  function drawTrans(G, view) {
    const tr = G.tr, t = tr.t, a = clamp((t - 7.6) / 0.5, 0, 1) * clamp((11 - t) / 0.4, 0, 1);
    if (a > 0) {
      ctx.globalAlpha = a; rr(W / 2 - 400, 36, 800, 300, 18); ctx.fillStyle = 'rgba(12,14,30,.9)'; ctx.fill(); ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 3; ctx.stroke();
      text('前半戦 結果', W / 2, 68, 28, '#ffd23f');
      for (const k of [0, 1]) {
        const x = W / 2 + (k ? 200 : -200);
        text(`${TEAM_NAME[k]}チーム`, x, 108, 20, TEAM_COL[k]); text(String(tr.score[k]), x, 156, 60, '#fff');
        text(`拠点 ${tr.own[k]} ×4　＋　市民 ${tr.pts[k]}点`, x, 202, 15, '#cfd6ff', 'center', 'normal');
        let y = 230; BASE_INFO.forEach((b, i) => { if (tr.mask[k] & (1 << i)) { text(`${b.name}：${b.eff}`, x, y, 14, '#ffe9a8'); y += 20; } });
        if (!tr.mask[k]) text('拠点なし', x, 230, 14, '#7d88aa');
      }
      text('VS', W / 2, 156, 26, '#9fb2e6'); ctx.globalAlpha = 1;
    }
    if (t < 6.8 && t > 1.4) {
      const first = tr.loser < 0 ? 0 : tr.loser, p = t > 5.1 ? first : 1 - first, th = THEME[p];
      text(p ? `${th.giant} 出現！` : `${th.giant} 発進！`, W / 2, 92, 54, '#fff', 'center', 'bold', TEAM_COL[p], 10);
      if (tr.loser >= 0 && t > 5.1) text('負けている側が、先に巨大化を強行！', W / 2, 146, 22, '#ffe9a8', 'center', 'bold', '#11131f', 5);
    }
    // 逆境カード
    if (tr.loser >= 0) {
      const mine = view.team === tr.loser && view.locals.length > 0, y0 = 590;
      rr(W / 2 - 420, y0 - 46, 840, 166, 16); ctx.fillStyle = 'rgba(12,14,30,.88)'; ctx.fill(); ctx.strokeStyle = TEAM_COL[tr.loser]; ctx.lineWidth = 3; ctx.stroke();
      const st = tr.pick >= 0 ? `「${CARDS[tr.pick].name}」に決定！` : mine ? `選んでください（残り${Math.max(0, t - 2.6).toFixed(0)}秒）` : '相手が選んでいます…';
      text(`逆境カード ― ${TEAM_NAME[tr.loser]}チームが1枚選ぶ　｜　${st}`, W / 2, y0 - 22, 17, TEAM_COL[tr.loser]);
      CARDS.forEach((c, i) => {
        const x = W / 2 - 390 + i * 265, picked = tr.pick === i, dim = tr.pick >= 0 && !picked, can = mine && tr.pick < 0;
        ctx.globalAlpha = dim ? 0.35 : 1;
        if (can) hud.button('card' + i, x, y0, 250, 104, '', '#ffd23f');
        else { rr(x, y0, 250, 104, 14); ctx.fillStyle = picked ? '#ffd23f' : '#2a3148'; ctx.fill(); ctx.strokeStyle = picked ? '#fff' : '#4a5577'; ctx.lineWidth = 3; ctx.stroke(); }
        const dark = picked || can;
        text((can ? view.key.cards[i] : '') + c.name, x + 125, y0 + 36, 24, dark ? '#11131f' : '#cfd6ff');
        text(c.desc, x + 125, y0 + 76, 12, dark ? '#2a2d40' : '#9fb2e6', 'center', 'normal');
        ctx.globalAlpha = 1;
      });
    } else if (t < 9) text('前半戦は引き分け。逆境カードなし！', W / 2, 620, 22, '#ffe9a8', 'center', 'bold', '#11131f', 5);
    if (t < 1.2) text('READY…', W / 2, 300, 80, '#fff', 'center', 'bold', '#11131f', 10);
  }
  // ---------------------------------------------------------------- 後半戦
  function teamHud(G, T, left, view) {
    const g = T.g, th = THEME[T.id], mine = view.team === T.id, x0 = left ? 22 : W - 22, al = left ? 'left' : 'right', d = left ? 1 : -1, bx = w => left ? x0 : x0 - w;
    text(th.giant + (mine && view.locals.length ? '（あなた）' : ''), x0, 20, 15, T.id ? '#e4cfff' : '#cfe3ff', al, 'bold', 'rgba(0,0,0,.75)', 4);
    bar(bx(380), 32, 380, 18, g.hp / g.max, g.hp < 30 ? '#ff6464' : TEAM_COL[T.id], undefined, mine ? '#fff' : 'rgba(255,255,255,.6)', !left);
    text(String(Math.ceil(g.hp)), x0 + d * 390, 41, 15, '#fff', al, 'bold', 'rgba(0,0,0,.75)', 3);
    text('エネルギー', x0, 64, 12, '#cfd6ff', al, 'bold', 'rgba(0,0,0,.75)', 3); bar(left ? x0 + 70 : x0 - 230, 57, 160, 12, g.en / 100, g.en < 20 ? '#ff6464' : '#ffd23f', undefined, undefined, !left);
    const full = g.sp >= 100;
    text('必殺技', x0, 84, 12, '#cfd6ff', al, 'bold', 'rgba(0,0,0,.75)', 3); bar(left ? x0 + 70 : x0 - 230, 77, 160, 12, g.sp / 100, full ? (Math.sin(S.t * 10) > 0 ? '#fff' : '#ffd23f') : '#ff9a3c', undefined, undefined, !left);
    const pc = pilotOf(T);
    if (full && !G.sp && G.phase === 'p2') text(mine && pc && view.locals.includes(pc.slot) ? `${view.key.s} 必殺技OK！` : 'MAX', x0 + d * 240, 84, 13, '#ffd23f', al, 'bold', 'rgba(0,0,0,.85)', 3);
    ZKEYS.forEach((z, i) => { const off = zoneOff(T, z), x = left ? x0 + i * 56 : x0 - 52 - i * 56; rr(x, 96, 52, 20, 6); ctx.fillStyle = off ? 'rgba(255,70,60,.9)' : 'rgba(30,40,70,.78)'; ctx.fill(); text(th.zones[z], x + 26, 106, 12, off ? '#fff' : '#9fb2e6'); });
    for (let i = 0; i < 3; i++) { const m = T.mq[i], x = left ? x0 + 232 + i * 18 : x0 - 246 - i * 18; rr(x, 96, 14, 20, 4); ctx.fillStyle = m ? ITEM_COL[T.id][m.t] : 'rgba(30,40,70,.78)'; ctx.fill(); }
    if (pc) text(`${th.pilot}：${G.slots[pc.slot].name}`, x0 + d * 300, 106, 12, SLOT_COL[pc.slot], al, 'bold', 'rgba(0,0,0,.8)', 3);
    if (T.fuel >= BAL.optLo && T.fuel <= BAL.optHi && G.phase === 'p2') text('最適出力', x0 + d * 240, 64, 12, '#7dffb0', al, 'bold', 'rgba(0,0,0,.85)', 3);
    const p = R.projE(g.x, 258);
    if (G.phase === 'p2') { if (g.sysT > 0) text(G.cd > 0 || g.en > 5 ? '動けない！' : th.noFuel, p.x, p.y, 17, '#ff6464', 'center', 'bold', '#000', 4); else if (g.stunT > 0) text(pc && pc.fat > 70 ? `${th.pilot}ダウン！交代を！` : '足止めされた！', p.x, p.y, 17, '#ffb347', 'center', 'bold', '#000', 4); }
  }
  function drawP2(G, view) {
    const T = G.teams[view.team], th = THEME[view.team], sp = G.sp, me = view.locals, esc = G.phase === 'escape';
    teamHud(G, G.teams[0], true, view); teamHud(G, G.teams[1], false, view); drawTimer(G, G.od);
    if (G.od) text('OVERDRIVE', W / 2, 64, 14, '#ff9af0', 'center', 'bold', 'rgba(0,0,0,.85)', 3);
    // ---- 内部のラベル
    const pc = pilotOf(T), live = G.phase === 'p2';
    for (const z of ZKEYS) {
      const Z = ZONES[z], p = R.projI(Z.x + 12, Z.y + 16), off = zoneOff(T, z);
      text(`${th.zones[z]}ブロック`, p.x, p.y, 12, off ? '#ff9a90' : 'rgba(190,205,255,.6)', 'left', 'bold', 'rgba(0,0,0,.5)', 3);
      if (off) text(`⚠ ${ZONE_EFF[z]}`, p.x, p.y + 16, 12, '#ff9a90', 'left', 'bold', 'rgba(0,0,0,.6)', 3);
    }
    const SL = (key, name, dy = 0, col = '#cfd6ff') => { const s = ST[key], p = R.projI(s.x, s.y + s.r + 14 + dy); text(name, p.x, p.y, 14, col, 'center', 'bold', 'rgba(0,0,0,.8)', 4); return p; };
    let p = SL('reactor', `${th.reactor}　${Math.round(T.fuel)}`, 8, T.fuel < 25 ? '#ff8a80' : T.fuel > 100 ? '#ffb347' : '#cfd6ff');
    bar(p.x - 44, p.y + 9, 88, 8, T.fuel / 120, T.fuel < 25 ? '#ff6464' : T.fuel > 100 ? '#ff4b2b' : '#7dffb0');
    ctx.fillStyle = '#ff4b2b'; ctx.fillRect(p.x - 44 + 88 * 100 / 120, p.y + 7, 2, 12);
    if (live && (T.fuel < 25 || T.fuel > 100)) { const q = R.projI(ST.reactor.x, ST.reactor.y, 4.2); text(T.fuel < 25 ? '燃料切れ寸前！' : '入れすぎ危険！', q.x, q.y, 14, '#ff6464', 'center', 'bold', '#000', 4); }
    const opt = T.fuel >= BAL.optLo && T.fuel <= BAL.optHi;
    if (opt && live) { const q = R.projI(ST.reactor.x, ST.reactor.y, 4.2); text('最適出力！ 攻撃力×' + BAL.optMul, q.x, q.y, 14, '#7dffb0', 'center', 'bold', '#000', 4); }
    { const cp = SL('charger', '必殺チャージャー', -4, chargerOpen(G, T) ? '#ffe9a8' : '#7d88aa'); bar(cp.x - 34, cp.y + 9, 68, 7, T.chgB / 2, T.chgB < 0.5 ? '#ff6f3c' : '#ffd23f'); }
    SL('coal', th.fuel); SL('launcher', th.launcher); SL('crateN', th.mN, -4); SL('crateH', th.mH, -4); SL('crateS', th.mS, -4);
    SL('pod', th.pod, -8, esc && G.esc.loser === T.id ? '#7dffb0' : '#7d88aa');
    if (T.armAlarm > 0) { const q = R.projI(ST.launcher.x, ST.launcher.y, 3); text('弾切れ！', q.x, q.y, 15, '#ff6464', 'center', 'bold', '#000', 4); }
    if (pc) {
      const q = R.projI(ST.seat.x, ST.seat.y + 52); text(`${th.pilot}：${G.slots[pc.slot].name}`, q.x, q.y, 13, SLOT_COL[pc.slot], 'center', 'bold', 'rgba(0,0,0,.8)', 3);
      const f = pc.fat / 100; text('疲労', q.x - 46, q.y + 17, 11, '#aab3d6', 'right', 'bold', 'rgba(0,0,0,.7)', 3); bar(q.x - 40, q.y + 12, 80, 9, f, f > 0.8 ? '#ff6464' : f > 0.55 ? '#ffb347' : '#7dffb0');
    }
    const needSwap = live && pc && (pc.fat > 80 || T.g.stunT > 0), lp = R.projI(ST.lever.x + 40, ST.lever.y + 10);
    text(needSwap ? '◀ 交代して！' : '交代', lp.x, lp.y, needSwap ? 14 : 12, needSwap ? '#ffb347' : '#cfd6ff', 'left', 'bold', 'rgba(0,0,0,.8)', 3);
    const mineSp = sp && sp.team === T.id && sp.phase !== 'fire', defSp = sp && sp.team !== T.id && sp.phase !== 'fire';
    for (const key of CON) {
      const s = ST[key], on = mineSp && sp.assign[key] !== undefined; SL(key, th[key], -2, on ? '#ffe9a8' : '#7d88aa');
      if (on) {
        const q = R.projI(s.x, s.y, 3.4), isMe = me.includes(sp.assign[key]);
        text(isMe ? '▼ あなたの持ち場' : G.slots[sp.assign[key]].name, q.x, q.y, isMe ? 15 : 13, isMe ? '#ffc531' : '#ffe9a8', 'center', 'bold', '#000', 4);
        if (sp.phase === 'seq' && CON[sp.step] === key && !sp.pressed) { const c = R.projI(s.x, s.y, 1.6); ring(c.x, c.y, sp.ringT, 0.9); }
      }
    }
    p = SL('thruster', th.thruster, 0, defSp ? '#aef8ef' : '#7d88aa');
    if (defSp) { const q = R.projI(ST.thruster.x, ST.thruster.y, 3.6); bar(q.x - 50, q.y - 2, 100, 12, sp.thrust, sp.thrust >= 1 ? '#3fe0d0' : '#9ad8ff'); text(sp.thrust >= 1 ? '準備OK！' : '長押しで起動！', q.x, q.y - 16, 14, '#aef8ef', 'center', 'bold', '#000', 4); }
    T.troubles.forEach(t => { const q = R.projI(t.x, t.y + 34); if (t.type === 'fire') bar(q.x - 26, q.y, 52, 7, t.hp / 100, T.id ? '#9be36d' : '#ff6f3c'); else bar(q.x - 26, q.y, 52, 7, t.prog, '#7dffb0'); });
    for (const c of T.crew) {
      if (c.role === 'pilot' || c.escaped) continue; const isMe = me.includes(c.slot), q = R.projI(c.x, c.y, c.carry ? 3.9 : 2.9);
      text(G.slots[c.slot].name, q.x, q.y, isMe ? 14 : 12, isMe ? '#fff' : SLOT_COL[c.slot], 'center', 'bold', isMe ? SLOT_COL[c.slot] : 'rgba(0,0,0,.75)', isMe ? 5 : 3);
      if (c.dizzy > 0) text('★ ★ ★', q.x, q.y + 15, 11, '#ffd23f');
    }
    for (const b of S.bubbles) {
      const c = T.crew[b.k]; if (!c || c.escaped) continue; const q = c.role === 'pilot' ? R.projI(ST.seat.x, ST.seat.y, 4) : R.projI(c.x, c.y, 4.6), w = tw(b.text, 14) + 16;
      ctx.globalAlpha = clamp(b.t * 3, 0, 1); rr(q.x - w / 2, q.y - 13, w, 26, 10); ctx.fillStyle = '#fff'; ctx.fill(); ctx.beginPath(); ctx.moveTo(q.x - 5, q.y + 12); ctx.lineTo(q.x, q.y + 20); ctx.lineTo(q.x + 5, q.y + 12); ctx.fill(); text(b.text, q.x, q.y, 14, '#1a1d2e'); ctx.globalAlpha = 1;
    }
    // ---- ナビ（次にやること）
    if (view.navi && me.length) {
      const c = T.crew.find(x => x.slot === me[0]);
      let nv = c && crewNavi(G, T, c);
      if (c && c.role === 'pilot' && live && G.cd <= 0) {
        const msg = c.fat > 75 ? `疲れてきた！ ${view.key.e} で仲間と交代` : T.g.sp >= 100 && !G.sp ? `必殺技OK！ ${view.key.s} で発動` : (Math.floor(S.t / 5) % 2 ? `${view.key.j}でジャンプ！ 相手を飛び越えて回り込める（強攻撃は対空になる）` : `${view.key.x}連打でコンボ／敵の攻撃の直前にガードでジャストガード`);
        const w = tw(msg, 16) + 36; rr(W / 2 - w / 2, EXT_H + 26, w, 32, 10); ctx.fillStyle = 'rgba(40,32,8,.9)'; ctx.fill(); ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 2; ctx.stroke(); text(msg, W / 2, EXT_H + 42, 16, '#ffe9a8');
      }
      if (nv) {
        const a = R.projI(c.x, c.y, 0.3), b = R.projI(nv.x, nv.y, 0.3), dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), pulse = 0.5 + Math.sin(S.t * 6) * 0.5;
        if (d > 60) {
          ctx.save(); ctx.strokeStyle = 'rgba(255,214,90,.55)'; ctx.lineWidth = 4; ctx.setLineDash([10, 10]); ctx.lineDashOffset = -S.t * 40;
          ctx.beginPath(); ctx.moveTo(a.x + dx / d * 34, a.y + dy / d * 34); ctx.lineTo(b.x - dx / d * 34, b.y - dy / d * 34); ctx.stroke(); ctx.restore();
          const ang = Math.atan2(dy, dx); ctx.save(); ctx.translate(a.x + dx / d * 44, a.y + dy / d * 44); ctx.rotate(ang); ctx.fillStyle = '#ffd23f'; ctx.strokeStyle = '#11131f'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(-8, -11); ctx.lineTo(-8, 11); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
        }
        ctx.strokeStyle = `rgba(255,214,90,${0.5 + pulse * 0.5})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(b.x, b.y, 40 + pulse * 8, 22 + pulse * 4, 0, 0, 7); ctx.stroke();
        const msg = '次にやること：' + nv.text, w = tw(msg, 17) + 36;
        rr(W / 2 - w / 2, EXT_H + 26, w, 34, 10); ctx.fillStyle = 'rgba(40,32,8,.9)'; ctx.fill(); ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 2; ctx.stroke();
        text(msg, W / 2, EXT_H + 43, 17, '#ffe9a8');
      }
    }
    // ---- 自分への操作ガイド
    me.forEach((s, li) => {
      const c = T.crew.find(x => x.slot === s); if (!c || c.role === 'pilot' || c.escaped || !(live || esc)) return;
      const pr = promptFor(G, T, c), q = R.projI(c.x, c.y + 30), key = (view.keyPads && view.keyPads[li]) || (li === 0 ? view.key : view.keyPad);
      if (pr) label((pr.startsWith('長押し') ? key.aHold : key.a) + ' ' + pr.replace('長押し：', ''), q.x, q.y + 6, 14, '#ffe9a8', 'rgba(10,12,24,.88)', SLOT_COL[s]);
      else if (c.carry) label(li === 0 && view.dev === 'touch' ? '「投げる」ボタンで放り投げ' : `${key.b} 投げる　${key.a} 置く`, q.x, q.y + 6, 13, '#cfd6ff', 'rgba(10,12,24,.75)');
    });
    // ---- 必殺技パネル
    if (sp && sp.phase !== 'fire') {
      const y0 = 246, A = G.teams[sp.team];
      if (sp.team === T.id) {
        const names = [th.c1, th.c2, th.c3, '発射'], x0 = W / 2 - 250;
        rr(x0, y0 - 18, 500, 40, 10); ctx.fillStyle = 'rgba(40,30,8,.88)'; ctx.fill(); ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 2; ctx.stroke();
        for (let i = 0; i < 4; i++) { const r = sp.res[i], cur = sp.phase === 'seq' && sp.step === i, col = r === 'P' ? '#ffd23f' : r === 'G' ? '#7dffb0' : r === 'M' ? '#ff6464' : cur ? '#fff' : '#8a7d55'; text(`${i + 1}.${names[i]}${r ? (r === 'P' ? ' ◎' : r === 'G' ? ' ○' : ' ×') : ''}`, x0 + 64 + i * 124, y0 + 2, 14, col); }
        if (sp.phase === 'prep') text(`配置まで ${Math.max(0, sp.t).toFixed(1)}秒`, W / 2, y0 - 34, 15, '#ffe9a8', 'center', 'bold', '#000', 4);
        if (sp.phase === 'seq' && sp.step === 3 && !sp.pressed) { const q = R.projE(A.g.x, 150); ring(q.x, q.y, sp.ringT); if (pc && me.includes(pc.slot)) text(`${view.key.s} で発射！`, q.x, q.y + 46, 16, '#ffd23f', 'center', 'bold', '#000', 4); }
      } else {
        rr(W / 2 - 250, y0 - 18, 500, 40, 10); ctx.fillStyle = 'rgba(50,8,40,.9)'; ctx.fill(); ctx.strokeStyle = '#ff5af0'; ctx.lineWidth = 2; ctx.stroke();
        text(`敵の${THEME[sp.team].special}！`, W / 2 - 236, y0 + 2, 15, '#ff9af0', 'left'); bar(W / 2 + 10, y0 - 7, 150, 16, sp.thrust, sp.thrust >= 1 ? '#3fe0d0' : '#9ad8ff');
        text(sp.thrust >= 1 ? '回避OK' : sp.thrust >= 0.6 ? 'かすり' : '直撃コース', W / 2 + 204, y0 + 2, 14, sp.thrust >= 1 ? '#3fe0d0' : sp.thrust >= 0.6 ? '#ffe9a8' : '#ff6464');
        text(sp.phase === 'prep' ? `発射準備中… ${th.thruster}を起動しろ！` : `発射まであと ${4 - sp.step} 段階！`, W / 2, y0 - 34, 15, '#ffd6f6', 'center', 'bold', '#000', 4);
      }
    }
    // ---- 内部の見出し帯
    ctx.fillStyle = '#121729'; ctx.fillRect(0, EXT_H - 3, W, 22); ctx.fillStyle = TEAM_COL[view.team]; ctx.fillRect(0, EXT_H - 3, W, 2);
    const c0 = me.length ? T.crew.find(c => c.slot === me[0]) : null, role = !c0 ? '観戦中' : c0.role === 'pilot' ? th.pilot : c0.escaped ? '脱出済み' : '裏方';
    text(`${th.inside}　｜　${me.length ? 'あなた：' : ''}${role}`, 16, EXT_H + 8, 13, TEAM_COL[view.team], 'left');
    if (c0) text(c0.role === 'pilot' ? view.tipPilot : view.tipCrew, W - 16, EXT_H + 8, 12, '#9fb2e6', 'right', 'normal');
    if (live && G.cd > 0) { text(G.cd > 1.4 ? 'READY' : 'FIGHT!!', W / 2, 180, 84, '#fff', 'center', 'bold', '#11131f', 10); }
    if (live && !view.navi && G.time > BATTLE_TIME - 9 && G.cd <= 0 && c0 && c0.role !== 'pilot') {
      ctx.globalAlpha = clamp(G.time - (BATTLE_TIME - 9), 0, 1); rr(W / 2 - 330, 640, 660, 50, 12); ctx.fillStyle = 'rgba(8,10,22,.88)'; ctx.fill(); ctx.strokeStyle = '#ffc531'; ctx.lineWidth = 2; ctx.stroke();
      text(`${th.fuel}・弾・${th.fire}に気を配ろう。疲れた${th.pilot}は${th.lever}で交代！`, W / 2, 665, 16, '#ffe9a8'); ctx.globalAlpha = 1;
    }
    if (esc) {
      const lost = G.esc.loser === T.id; rr(W / 2 - 240, 328, 480, 54, 12); ctx.fillStyle = lost ? 'rgba(80,0,0,.88)' : 'rgba(10,50,30,.88)'; ctx.fill(); ctx.strokeStyle = lost ? '#ff5a4f' : '#7dffb0'; ctx.lineWidth = 3; ctx.stroke();
      text(lost ? `${th.pod}へ急げ！ 残り ${Math.max(0, G.esc.t).toFixed(1)}秒` : 'トドメの一撃をチャージ中！', W / 2, 355, 24, '#fff');
      if (lost) for (const s of me) { const c = T.crew.find(x => x.slot === s); if (c && !c.escaped) { const a0 = R.projI(c.x, c.y), b0 = R.projI(ST.pod.x, ST.pod.y), a = Math.atan2(b0.y - a0.y, b0.x - a0.x); ctx.save(); ctx.translate(a0.x + Math.cos(a) * 50, a0.y + Math.sin(a) * 50); ctx.rotate(a); ctx.fillStyle = '#7dffb0'; ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-8, -9); ctx.lineTo(-8, 9); ctx.fill(); ctx.restore(); } }
    }
  }
  // ---------------------------------------------------------------- キャラ固有スキル
  function drawSkill(G, view) {
    if (!view.locals.length || view.dev === 'touch' || !G.skcd) return;
    const slot = view.locals[0], ch = charOf(slot), cd = G.skcd[slot] || 0;
    let line = null, total = 1;
    if (G.phase === 'p1' && G.cd <= 0) { line = ch.p1; total = ch.cd1; }
    else if (G.phase === 'p2' && G.cd <= 0) { const T = G.teams[teamOf(slot)], c = T.crew[slot % TN]; if (c && c.role !== 'pilot' && !c.escaped) { line = ch.p2; total = ch.cd2; } }
    if (!line) return;
    const x = G.phase === 'p2' ? W / 2 - 180 : 18, y = G.phase === 'p2' ? H - 60 : H - 66, ready = cd <= 0, [nm, desc] = line.split('：');
    rr(x, y, 360, 52, 12); ctx.fillStyle = 'rgba(8,10,22,.86)'; ctx.fill(); ctx.strokeStyle = ready ? '#7dffb0' : '#4a5577'; ctx.lineWidth = 2; ctx.stroke();
    const cx = x + 28, cy = y + 26; ctx.fillStyle = ready ? '#7dffb0' : '#2a3148'; ctx.beginPath(); ctx.arc(cx, cy, 19, 0, 7); ctx.fill();
    if (!ready) { ctx.fillStyle = '#7dffb0'; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, 19, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - cd / total)); ctx.closePath(); ctx.globalAlpha = 0.45; ctx.fill(); ctx.globalAlpha = 1; }
    text(ready ? view.key.k : String(Math.ceil(cd)), cx, cy, ready ? 15 : 16, ready ? '#11131f' : '#fff');
    text(`${ch.title}のスキル：${nm}`, x + 56, y + 17, 14, ready ? '#7dffb0' : '#9fb2e6', 'left'); text(desc, x + 56, y + 37, 12, '#cfd6ff', 'left', 'normal');
  }
  // ---------------------------------------------------------------- 共通のかぶせ表示
  function drawOverlays(G, view) {
    for (const p of S.pops) {
      let q; if (p.layer === 'E') { if (G.phase === 'p1') continue; q = R.projE(p.x, p.y); } else if (p.layer === 'I') { if (!G.teams || G.phase === 'trans') continue; q = R.projI(p.x, p.y, 1.5); } else q = R.projC(p.x, 4, p.y);
      ctx.globalAlpha = clamp(p.t * 2, 0, 1); text(p.text, q.x, q.y - (1.1 - p.t) * 34, p.size, p.col, 'center', 'bold', 'rgba(0,0,0,.85)', 4);
    }
    ctx.globalAlpha = 1;
    let by = G.phase === 'p1' ? 150 : 150;
    for (const b of S.banners) {
      const a = clamp(Math.min(b.t, (b.max - b.t) * 4 + 0.2), 0, 1); ctx.globalAlpha = a;
      const w = Math.max(360, tw(b.text, 26) + 60, b.sub ? tw(b.sub, 14) + 40 : 0);
      rr(W / 2 - w / 2, by - 24, w, b.sub ? 62 : 44, 12); ctx.fillStyle = 'rgba(8,10,22,.84)'; ctx.fill(); ctx.strokeStyle = b.col; ctx.lineWidth = 3; ctx.stroke();
      text(b.text, W / 2, by - 2, 26, b.col); if (b.sub) text(b.sub, W / 2, by + 24, 14, '#e8ecff', 'center', 'normal');
      by += b.sub ? 72 : 54; ctx.globalAlpha = 1; if (by > 300) break;
    }
    if (S.cutin) {
      const c = S.cutin, p = 1 - c.t / c.max, slide = p < 0.15 ? (1 - p / 0.15) : p > 0.85 ? -(p - 0.85) / 0.15 : 0;
      ctx.save(); ctx.translate(slide * W, 0);
      ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.beginPath(); ctx.moveTo(0, 300); ctx.lineTo(W, 240); ctx.lineTo(W, 380); ctx.lineTo(0, 440); ctx.fill();
      ctx.fillStyle = c.col; ctx.beginPath(); ctx.moveTo(0, 312); ctx.lineTo(W, 252); ctx.lineTo(W, 260); ctx.lineTo(0, 320); ctx.fill(); ctx.beginPath(); ctx.moveTo(0, 420); ctx.lineTo(W, 360); ctx.lineTo(W, 368); ctx.lineTo(0, 428); ctx.fill();
      ctx.save(); ctx.translate(W / 2, 340); ctx.rotate(-0.047); text(c.text, 0, 0, 58, '#fff', 'center', 'bold', c.col, 8); ctx.restore(); ctx.restore();
    }
  }
  // ---------------------------------------------------------------- リザルト
  function drawResult(G, view) {
    const r = G.result; ctx.fillStyle = `rgba(5,6,14,${Math.min(0.88, r.t * 1.5)})`; ctx.fillRect(0, 0, W, H); if (r.t < 0.3) return;
    const mine = view.locals.length > 0, won = r.win === view.team;
    const title = r.win < 0 ? 'DRAW' : mine ? (won ? 'MISSION CLEAR!' : 'MISSION FAILED') : `${TEAM_NAME[r.win]}チームの勝利！`;
    text(title, W / 2, 60, 58, r.win < 0 ? '#cfd6ff' : mine ? (won ? '#ffd23f' : '#ff6464') : TEAM_COL[r.win], 'center', 'bold', '#11131f', 10);
    text(`${r.win >= 0 ? TEAM_NAME[r.win] + 'チームの勝ち　／　' : ''}${r.reason}　／　残りHP ${THEME[0].giant} ${r.hp[0]}・${THEME[1].giant} ${r.hp[1]}`, W / 2, 108, 16, '#e8ecff', 'center', 'normal');
    const n = r.awards.length, cw = 280, gap = 16, x0 = W / 2 - (n * cw + (n - 1) * gap) / 2;
    r.awards.forEach((a, i) => {
      const x = x0 + i * (cw + gap), y = 132, sl = G.slots[a.slot];
      rr(x, y, cw, 112, 16); ctx.fillStyle = '#161b33'; ctx.fill(); ctx.strokeStyle = i >= 3 ? '#ff9af0' : '#ffd23f'; ctx.lineWidth = 3; ctx.stroke();
      text(a.title, x + cw / 2, y + 24, 17, i >= 3 ? '#ff9af0' : '#ffd23f'); face(sl.col, x + 44, y + 70, 1.3, teamOf(a.slot));
      text(sl.name, x + 78, y + 62, 20, sl.col, 'left'); text(a.note, x + 78, y + 88, 12, '#cfd6ff', 'left', 'normal');
    });
    const y0 = 256; rr(60, y0, W - 120, 322, 14); ctx.fillStyle = 'rgba(22,27,51,.92)'; ctx.fill();
    const cols = ['名前', '与ダメージ', '飛び道具', '燃料', '装填', '修理', 'PERFECT', '転倒', '市民', '拠点', 'スコア'];
    cols.forEach((c, i) => text(c, 160 + i * 98, y0 + 22, 13, i === 10 ? '#ffd23f' : '#9fb2e6'));
    for (let s = 0; s < NS; s++) {
      const y = y0 + 48 + s * 26.5 + (s >= TN ? 6 : 0), st = r.st[s], sl = G.slots[s];
      if (view.locals.includes(s)) { rr(70, y - 12, W - 140, 24, 7); ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.fill(); }
      ctx.fillStyle = TEAM_COL[teamOf(s)]; ctx.fillRect(74, y - 10, 5, 20);
      text(sl.name + (sl.human ? '' : '（Bot）'), 160, y, 14, sl.col); st.forEach((v, i) => text(String(v), 258 + i * 98, y, 14, '#e8ecff')); if (r.score) text(String(r.score[s]), 160 + 10 * 98, y, 14, '#ffd23f');
    }
    if (r.score && view.locals.length) {
      const sc = r.score[view.locals[0]];
      text(`あなたのスコア ${sc}`, 90, 600, 22, '#ffd23f', 'left'); text(view.newBest ? '★ 自己ベスト更新！' : `自己ベスト ${view.best}`, 90, 630, 16, view.newBest ? '#7dffb0' : '#cfd6ff', 'left');
      if (r.jg && r.jg[view.locals[0]]) text(`ジャストガード ${r.jg[view.locals[0]]}回`, 90, 656, 14, '#7fe8ff', 'left', 'normal');
    }
    if (r.t > 0.8) {
      if (view.canRestart) { hud.button('again', W / 2 - 320, 600, 300, 66, 'もう1戦', '#ffd23f', view.dev === 'kb' ? 'Enter' : ''); hud.button('lobby', W / 2 + 20, 600, 300, 66, 'ロビーへ', '#cfe3ff'); }
      else { text('ホストの操作を待っています…', W / 2 - 170, 633, 18, '#ffe9a8'); hud.button('leave', W / 2 + 20, 600, 300, 66, '退出する', '#cfe3ff'); }
    }
  }
  // ---------------------------------------------------------------- タッチ操作
  function drawTouch(touch, layout) {
    ctx.save();
    if (touch.stick) {
      const st = touch.stick; ctx.globalAlpha = 0.3; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(st.ox, st.oy, 60, 0, 7); ctx.fill();
      const dx = st.x - st.ox, dy = st.y - st.oy, l = Math.min(60, Math.hypot(dx, dy)), a = Math.atan2(dy, dx); ctx.globalAlpha = 0.6; ctx.beginPath(); ctx.arc(st.ox + Math.cos(a) * l, st.oy + Math.sin(a) * l, 28, 0, 7); ctx.fill();
    } else { ctx.globalAlpha = 0.16; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(150, 610, 60, 0, 7); ctx.fill(); ctx.globalAlpha = 0.5; text('移動', 150, 610, 16, '#fff'); }
    for (const b of layout) {
      ctx.globalAlpha = touch.btn[b.n] ? 0.8 : 0.42; ctx.fillStyle = b.col || '#ffffff'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 7); ctx.fill();
      ctx.globalAlpha = 0.95; text(b.label, b.x, b.y, b.r > 45 ? 16 : 13, '#11131f');
    }
    ctx.restore();
  }
  // ---------------------------------------------------------------- メニュー
  function drawTitle(ui) {
    hud.buttons = [];
    const g = ctx.createLinearGradient(0, 0, 0, 300); g.addColorStop(0, 'rgba(8,6,24,.7)'); g.addColorStop(1, 'rgba(8,6,24,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, 300);
    const g2 = ctx.createLinearGradient(0, 420, 0, H); g2.addColorStop(0, 'rgba(8,6,24,0)'); g2.addColorStop(1, 'rgba(8,6,24,.8)'); ctx.fillStyle = g2; ctx.fillRect(0, 420, W, 300);
    ctx.save(); ctx.translate(W / 2, 110); ctx.rotate(-0.04);
    text('GIGA-CLASH', 0, 0, 104, '#ffd23f', 'center', 'bold', '#11131f', 14); text('ギガ・クラッシュ', 0, 68, 30, '#fff', 'center', 'bold', '#11131f', 6); ctx.restore();
    text('街で守れ。そして、乗り込め。― 5人で1体の巨大ロボ／大怪獣を動かす特撮パーティーアクション', W / 2, 222, 18, '#ffe9a8', 'center', 'bold', 'rgba(0,0,0,.8)', 5);
    hud.button('solo', W / 2 - 320, 470, 300, 76, 'あそぶ', '#ffd23f', 'ひとり・同じ画面でみんなと');
    hud.button('online', W / 2 + 20, 470, 300, 76, 'オンライン', ui.online ? '#7fd6ff' : '#6b7391', ui.online ? 'ヒーロー vs 怪人（最大10人）' : ui.onlineWhy);
    hud.button('help', W / 2 - 320, 562, 300, 52, '遊び方', '#cfe3ff', '', 20);
    hud.button('mute', W / 2 + 20, 562, 142, 52, ui.muted ? '音：OFF' : '音：ON', '#9aa3c7', '', 18);
    hud.button('gfx', W / 2 + 178, 562, 142, 52, ui.low ? '画質：軽い' : '画質：きれい', '#9aa3c7', '', 18);
    text(ui.pads ? `コントローラー ${ui.pads}台 接続中` : 'コントローラー対応（つなぐと自動で使えます）', W / 2, 650, 14, '#cfd6ff', 'center', 'bold', 'rgba(0,0,0,.8)', 4);
    text(`ver ${ui.ver}`, W - 14, H - 14, 12, 'rgba(220,226,255,.6)', 'right', 'normal');
    if (ui.newVer) hud.button('reload', W - 330, 14, 316, 50, `新しいバージョン ${ui.newVer}`, '#7dffb0', '押すと再読み込みします', 16);
  }
  // ---------------------------------------------------------------- 遊び方・操作マニュアル
  function keycap(k, x, y, col = '#e8ecff', wmin = 34) {
    const w = Math.max(wmin, tw(k, 15) + 16); rr(x, y - 15, w, 30, 6); ctx.fillStyle = '#2a3156'; ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.fillRect(x + 3, y - 12, w - 6, 8); text(k, x + w / 2, y + 1, 15, col); return w;
  }
  // 「キー列 → 説明」を1行で描く。keys は配列（間に「/」が入る）
  function keyRow(keys, desc, x, y, colFn, dx = 120) {
    let cx = x; keys.forEach((k, i) => { if (i) { text('/', cx + 7, y, 14, '#8a93b5'); cx += 14; } cx += keycap(k, cx, y, colFn ? colFn(k) : '#e8ecff') + 4; });
    text(desc, Math.max(cx + 10, x + dx), y, 15, '#e8ecff', 'left', 'normal');
  }
  function padIcon(P, pos, x, y, r = 15) {   // pos: A/B/X/Y
    ctx.fillStyle = '#1b2040'; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.strokeStyle = P.col[pos]; ctx.lineWidth = 2.5; ctx.stroke();
    text(P[pos], x, y + 1, r * 1.05, P.col[pos]);
  }
  function drawPadDiagram(P, cx, cy) {
    ctx.save(); ctx.translate(cx, cy);
    // 本体
    ctx.fillStyle = '#2a3156'; ctx.strokeStyle = '#8a93b5'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-150, -48); ctx.quadraticCurveTo(0, -70, 150, -48); ctx.quadraticCurveTo(205, -30, 210, 40); ctx.quadraticCurveTo(215, 110, 170, 118); ctx.quadraticCurveTo(130, 120, 95, 60); ctx.lineTo(-95, 60); ctx.quadraticCurveTo(-130, 120, -170, 118); ctx.quadraticCurveTo(-215, 110, -210, 40); ctx.quadraticCurveTo(-205, -30, -150, -48); ctx.closePath(); ctx.fill(); ctx.stroke();
    // 肩ボタン
    for (const d of [-1, 1]) { rr(d < 0 ? -190 : 110, -84, 80, 22, 8); ctx.fillStyle = '#3a4270'; ctx.fill(); ctx.stroke(); rr(d < 0 ? -182 : 118, -110, 64, 22, 8); ctx.fill(); ctx.stroke(); }
    text(`${P.L1}`, -150, -73, 13, '#ffe9a8'); text(`${P.R1}`, 150, -73, 13, '#ffe9a8'); text(`${P.L2}`, -150, -99, 12, '#cfd6ff'); text(`${P.R2}`, 150, -99, 12, '#cfd6ff');
    // スティックと十字キー
    ctx.fillStyle = '#151a33'; ctx.beginPath(); ctx.arc(-130, 0, 30, 0, 7); ctx.fill(); ctx.fillStyle = '#4a5280'; ctx.beginPath(); ctx.arc(-130, 0, 18, 0, 7); ctx.fill();
    ctx.fillStyle = '#151a33'; ctx.fillRect(-82, 42, 40, 14); ctx.fillRect(-69, 29, 14, 40);
    // 選択・スタート
    rr(-40, -20, 28, 14, 7); ctx.fillStyle = '#151a33'; ctx.fill(); rr(12, -20, 28, 14, 7); ctx.fill();
    text(P.sel, -26, -36, 11, '#cfd6ff'); text(P.st, 26, -36, 11, '#cfd6ff');
    // 右スティック（使わない）
    ctx.fillStyle = '#151a33'; ctx.beginPath(); ctx.arc(62, 48, 22, 0, 7); ctx.fill();
    // ABXY（位置どおり）
    padIcon(P, 'Y', 135, -32); padIcon(P, 'X', 103, 0); padIcon(P, 'B', 167, 0); padIcon(P, 'A', 135, 32);
    text('移動', -130, 44, 12, '#cfd6ff'); text('移動', -62, 84, 11, '#cfd6ff');
    ctx.restore();
  }
  // 画面の右下（ボタンがある所）を拡大して描く
  function drawPhone(L, title, x, y, sc) {
    const X0 = 860, Y0 = 420, w = 420 * sc, h = 300 * sc;
    ctx.save(); rr(x, y, w, h, 16); ctx.fillStyle = '#20284a'; ctx.fill(); ctx.clip();
    for (const b of L) { const bx = x + (b.x - X0) * sc, by = y + (b.y - Y0) * sc; ctx.fillStyle = b.col || '#e8ecff'; ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.arc(bx, by, b.r * sc, 0, 7); ctx.fill(); ctx.globalAlpha = 1; text(b.label, bx, by, b.r * sc > 30 ? 15 : 12, '#11131f'); }
    ctx.restore(); rr(x, y, w, h, 16); ctx.strokeStyle = '#8a93b5'; ctx.lineWidth = 2; ctx.stroke();
    text(title, x + w / 2, y - 18, 17, '#ffe9a8'); text('（画面の右下）', x + w / 2, y + h + 16, 12, '#8a93b5', 'center', 'normal');
  }
  const TL = {
    p1: [{ x: 1150, y: 610, r: 62, label: 'かつぐ' }, { x: 1010, y: 652, r: 46, label: 'パンチ' }, { x: 1070, y: 520, r: 44, label: '投げる' }, { x: 1200, y: 470, r: 40, label: 'スキル', col: '#7dffb0' }],
    crew: [{ x: 1150, y: 620, r: 62, label: '作業' }, { x: 1015, y: 660, r: 44, label: '投げる' }, { x: 1200, y: 470, r: 40, label: 'スキル', col: '#7dffb0' }],
    pilot: [{ x: 1050, y: 630, r: 50, label: '弱' }, { x: 1170, y: 560, r: 50, label: '強' }, { x: 1175, y: 670, r: 42, label: 'ガード' }, { x: 930, y: 665, r: 40, label: '飛び道具' }, { x: 930, y: 565, r: 44, label: '必殺', col: '#ffd23f' }, { x: 1222, y: 446, r: 30, label: '脱出', col: '#ff8a80' }, { x: 1060, y: 500, r: 44, label: 'ジャンプ', col: '#9fe8ff' }],
  };
  const HELP_TABS = ['試合の流れ', '機体の中', 'キーボード', 'コントローラー', 'スマホ'];
  function drawHelp(page, opt = {}) {
    hud.buttons = [];
    ctx.fillStyle = 'rgba(5,6,14,.93)'; ctx.fillRect(0, 0, W, H); rr(70, 22, W - 140, H - 44, 20); ctx.fillStyle = '#161b33'; ctx.fill(); ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 3; ctx.stroke();
    HELP_TABS.forEach((t, i) => hud.button('help' + i, 100 + i * 218, 36, 206, 42, t, i === page ? '#ffd23f' : '#5b6488', '', 17));
    const rows = R0 => { const sp = R0.length > 7 ? 54 : 60; R0.forEach((l, i) => { text(l[0], 120, 150 + i * sp, 18, '#ffe9a8', 'left'); text(l[1], 280, 150 + i * sp, 16, '#e8ecff', 'left', 'normal'); }); };
    if (page === 0) {
      text('遊び方 ― 試合の流れ', W / 2, 106, 26, '#ffd23f');
      rows([
        ['チーム', 'ヒーロー5人 vs 怪人5人。人がいない席はBotが入る。'],
        ['前半戦(2分)', '街で市民を奪い合い、5つの拠点を取り合う「シティー・スクランブル」。'],
        ['市民', 'かついで自分のゴールへ。ヒーローはシェルター、怪人はダークゲート。投げ入れてもOK。'],
        ['拠点', '輪の中に立つと確保。敵がいると止まる。取った拠点は後半戦の機体を強化する。'],
        ['見分け方', 'ヒーローは足元に水色の輪、怪人は赤紫の輪。自分は黄色の輪で目立つ。'],
        ['逆境カード', '前半で負けた側は、後半を有利にするカードを1枚選べる。先に巨大化もできる。'],
        ['キャラ', '10人それぞれに固有スキルがある。ロビーの「キャラ」で選べる。前半戦と裏方で効果が変わる。'],
        ['後半戦(3分)', '巨大ロボ vs 大怪獣。1人が操縦、4人が内部で裏方。相手のHPを0にしたら勝ち。'],
      ]);
    } else if (page === 1) {
      text('遊び方 ― 後半戦（機体の中）', W / 2, 106, 26, '#ffd23f');
      rows([
        ['燃料', '動力炉（心臓）へ燃料を運ぶ。切れると動けない。入れすぎると爆発！'],
        ['弾', '3種類の弾を装填口へ。操縦者が撃つ。足止め弾は相手の必殺技の準備を止められる。'],
        ['修理', '攻撃を受けると内部で火災や断線が起きる。長押しで直さないと、その部位が使えない。'],
        ['転倒', '機体が倒れると内部が傾いて全員が転がる。持ち物も落とす。'],
        ['必殺技', 'ゲージMAXで発動。光った4つの装置の前で、輪が重なる瞬間に押す。全部PERFECTで大技。'],
        ['チャージャー', '手が空いたら「必殺チャージャー」を連打。燃料80〜105は最適出力で攻撃力アップ。'],
        ['回避', '相手が必殺技を準備したら、回避装置を長押し。ゲージ満タンで回避、6割でかすり。'],
        ['交代・操縦', '交代レバーを引いた人が次の操縦者。弱攻撃の連打でコンボ、直前のガードで「ジャストガード」。'],
      ]);
    } else if (page === 2) {
      text('操作 ― キーボード', W / 2, 106, 26, '#ffd23f');
      text('前半戦・裏方（機体の中）', 120, 146, 18, '#7fe8ff', 'left');
      const y1 = 182, g = 40;
      keyRow(['W', 'A', 'S', 'D'], '移動（矢印キーでもOK）', 120, y1);
      keyRow(['Space'], 'かつぐ・拾う・入れる・作業（長押し）・連打', 120, y1 + g);
      keyRow(['J'], 'パンチ（前半戦）', 120, y1 + g * 2);
      keyRow(['K'], '投げる', 120, y1 + g * 3);
      keyRow(['I'], 'キャラ固有スキル', 120, y1 + g * 4);
      keyRow(['1', '2', '3'], '逆境カードを選ぶ', 120, y1 + g * 5);
      text('操縦中（後半戦）', 660, 146, 18, '#ffd23f', 'left');
      keyRow(['A', 'D'], '移動', 660, y1);
      keyRow(['W', 'Space'], 'ジャンプ（相手を飛び越える）', 660, y1 + g);
      keyRow(['J'], '弱攻撃（連打でコンボ）', 660, y1 + g * 2);
      keyRow(['K'], '強攻撃（ジャンプ中は対空）', 660, y1 + g * 3);
      keyRow(['L', 'Shift'], 'ガード', 660, y1 + g * 4);
      keyRow(['U'], '飛び道具', 660, y1 + g * 5);
      keyRow(['I'], '必殺技（ゲージMAX）', 660, y1 + g * 6);
      keyRow(['X'], '緊急脱出（操縦を交代）', 660, y1 + g * 7);
      keyRow(['Esc'], '一時停止', 120, y1 + g * 7);
      text('同じ画面で2人以上のときは、P1がキーボード、P2からはコントローラーを使います。', W / 2, 560, 15, '#cfd6ff', 'center', 'normal');
    } else if (page === 3) {
      const kind = PADL[opt.pad] ? opt.pad : 'xbox', P = PADL[kind];
      text(`操作 ― コントローラー（${P.name}）`, W / 2, 106, 26, '#ffd23f');
      drawPadDiagram(P, 330, 300);
      hud.button('helpPad', 190, 450, 280, 50, `表記：${P.name}`, '#9fe8ff', '押すと切り替え（Xbox／PS／Switch）', 16);
      const colFn = k => k === P.A ? P.col.A : k === P.B ? P.col.B : k === P.X ? P.col.X : k === P.Y ? P.col.Y : '#e8ecff';
      text('前半戦・裏方', 600, 140, 17, '#7fe8ff', 'left');
      const y1 = 172, g = 33;
      keyRow(['スティック', '十字'], '移動', 600, y1);
      keyRow([P.A], 'かつぐ・拾う・入れる・作業（長押し）・連打', 600, y1 + g, colFn);
      keyRow([P.X], 'パンチ（前半戦）', 600, y1 + g * 2, colFn);
      keyRow([P.B], '投げる', 600, y1 + g * 3, colFn);
      keyRow([P.Y], 'キャラ固有スキル', 600, y1 + g * 4, colFn);
      text('操縦中（後半戦）', 600, 342, 17, '#ffd23f', 'left');
      const y2 = 374;
      keyRow([P.A, '十字↑'], 'ジャンプ', 600, y2, colFn);
      keyRow([P.X], '弱攻撃（連打でコンボ）', 600, y2 + g, colFn);
      keyRow([P.B], '強攻撃', 600, y2 + g * 2, colFn);
      keyRow([P.R1, P.R2], 'ガード', 600, y2 + g * 3);
      keyRow([P.L1, P.L2], '飛び道具', 600, y2 + g * 4);
      keyRow([P.Y], '必殺技（ゲージMAX）', 600, y2 + g * 5, colFn);
      keyRow([P.sel], '緊急脱出（操縦を交代）', 600, y2 + g * 6);
      text(`${P.st}：一時停止　／　逆境カード：${P.X} ${P.Y} ${P.B}`, 330, 528, 15, '#cfd6ff', 'center', 'normal');
      text(`メニュー：スティックで選んで ${kind === 'sw' ? P.B : P.A} 決定・${kind === 'sw' ? P.A : P.B} もどる`, 330, 552, 15, '#cfd6ff', 'center', 'normal');
      if (kind === 'sw') text('※Switchは試合中、ボタンの位置どおりに動きます（下のⒷがアクション）', 330, 578, 13, '#ffb3a8', 'center', 'normal');
    } else {
      text('操作 ― スマホ・タブレット（横向き）', W / 2, 106, 26, '#ffd23f');
      const sc = 0.78, w = 420 * sc, gx = (W - 3 * w - 72) / 2; drawPhone(TL.p1, '前半戦', gx, 160, sc); drawPhone(TL.crew, '裏方（機体の中）', gx + w + 36, 160, sc); drawPhone(TL.pilot, '操縦中', gx + (w + 36) * 2, 160, sc);
      const L = [['左半分', 'どこでも指を置いてなぞると移動（指を置いた所がスティックの中心）'], ['大きいボタン', '前半戦は「かつぐ」、裏方は「アクション」（長押しで作業）'], ['緑のボタン', 'キャラ固有スキル。使うと待ち時間の秒数が出る'], ['操縦中', 'ジャンプ・弱・強・ガード・飛び道具・必殺・脱出のボタンに変わる'], ['ナビ', '次にやることが黄色い矢印で出る（ロビーでON/OFF）']];
      L.forEach((l, i) => { text(l[0], 120, 448 + i * 34, 17, '#ffe9a8', 'left'); text(l[1], 280, 448 + i * 34, 15, '#e8ecff', 'left', 'normal'); });
    }
    if (page > 0) hud.button('helpPrev', W / 2 - 340, H - 92, 300, 52, 'もどる', '#9aa3c7', '', 20);
    hud.button('helpNext', W / 2 + (page > 0 ? 40 : -150), H - 92, 300, 52, page < 4 ? '次へ' : '閉じる', '#ffd23f', '', 20);
  }
  function drawLobby(L) {
    hud.buttons = [];
    ctx.fillStyle = 'rgba(5,6,14,.82)'; ctx.fillRect(0, 0, W, H);
    text(L.online ? 'オンライン ロビー' : 'ロビー', W / 2, 44, 36, '#ffd23f', 'center', 'bold', '#11131f', 6);
    text(L.status, W / 2, 82, 15, '#cfd6ff', 'center', 'normal');
    for (const t of [0, 1]) {
      const x = t ? W / 2 + 20 : W / 2 - 480;
      rr(x, 104, 460, 300, 16); ctx.fillStyle = 'rgba(22,27,51,.94)'; ctx.fill(); ctx.strokeStyle = TEAM_COL[t]; ctx.lineWidth = 3; ctx.stroke();
      text(`${TEAM_NAME[t]}チーム`, x + 230, 130, 22, TEAM_COL[t]); text(t ? '怪人 → 大怪獣ドグラマグに乗り込む' : 'ヒーロー → 巨大ロボ ブレイバーに乗り込む', x + 230, 156, 13, '#9fb2e6', 'center', 'normal');
      for (let k = 0; k < TN; k++) {
        const sl = L.slots[t * TN + k], y = 172 + k * 46; rr(x + 16, y, 428, 42, 10); ctx.fillStyle = sl.me ? 'rgba(255,255,255,.14)' : 'rgba(255,255,255,.05)'; ctx.fill(); if (sl.me) { ctx.strokeStyle = sl.col; ctx.lineWidth = 2; ctx.stroke(); }
        face(sl.human ? sl.col : '#6b7391', x + 46, y + 21, 0.88, t);
        text(sl.name, x + 76, y + 21, 18, sl.human ? sl.col : '#8a93b5', 'left'); text(sl.tag, x + 432, y + 21, 13, sl.me ? '#ffe9a8' : '#8a93b5', 'right', 'normal');
        const ch = CHARS[t][k], d1 = `${ch.title}｜${ch.p1.split('：')[0]}・${ch.p2.split('：')[0]}`, room = 432 - 40 - (86 + tw(sl.name, 18)); ctx.font = font(12, 'normal'); text(ctx.measureText(d1).width < room ? d1 : `${ch.title}｜${ch.p1.split('：')[0]}`, x + 86 + tw(sl.name, 18), y + 22, 12, sl.me ? '#ffe9a8' : '#7d88aa', 'left', 'normal');
      }
    }
    const y1 = 424, bw = 226, x0 = W / 2 - 480;
    hud.button('team', x0, y1, bw, 58, 'チームを替える', '#cfe3ff', `いま：${TEAM_NAME[L.team]}`, 19);
    hud.button('locals', x0 + 244, y1, bw, 58, `ローカル人数：${L.nLocal}`, '#cfe3ff', L.padInfo, 19);
    if (L.host) { hud.button('diff', x0 + 488, y1, bw, 58, `Botの強さ：${DIFF[L.diff].name}`, '#cfe3ff', '相手が全員Botのとき', 19); hud.button('p1', x0 + 732, y1, bw, 58, L.skipP1 ? '後半戦だけ' : '前半戦＋後半戦', '#cfe3ff', '試合の長さ', 19); }
    else { text(`Botの強さ：${DIFF[L.diff].name}　／　${L.skipP1 ? '後半戦だけ' : '前半戦＋後半戦'}（ホストが設定）`, x0 + 730, y1 + 29, 15, '#9fb2e6'); }
    if (L.online) hud.button('name', x0, y1 + 74, bw, 52, `名前：${L.name}`, '#9aa3c7', '押すと変わる', 17);
    hud.button('char', x0 + 488, y1 + 74, bw, 52, `キャラ：${CHARS[L.team][L.ch].title}`, '#ffd6a5', '押すとキャラを替える', 17);
    hud.button('navi', x0 + 244, y1 + 74, bw, 52, `ナビ：${L.navi ? 'ON' : 'OFF'}`, L.navi ? '#ffe9a8' : '#9aa3c7', L.navi ? '次にやることを表示' : '上級者向け：表示しない', 17);
    if (L.code) { hud.button('invite', x0 + 732, y1 + 74, bw, 52, '招待リンクをコピー', '#7dffb0', `部屋コード ${L.code}`, 17); }
    if (L.host) hud.button('start', W / 2 - 170, 564, 340, 72, 'スタート！', '#ffd23f', L.online ? 'あなたがホストです' : (L.dev === 'kb' ? 'Enter' : ''), 30);
    else text('ホストがスタートするのを待っています…', W / 2, 600, 22, '#ffe9a8', 'center', 'bold', '#11131f', 5);
    hud.button('back', W - 250, 628, 200, 52, 'もどる', '#9aa3c7', '', 20);
    text(L.hint, 60, 654, 14, '#cfd6ff', 'left', 'normal');
  }
  function drawOnline() {
    hud.buttons = [];
    ctx.fillStyle = 'rgba(5,6,14,.82)'; ctx.fillRect(0, 0, W, H);
    text('オンライン対戦', W / 2, 120, 44, '#ffd23f', 'center', 'bold', '#11131f', 8);
    text('友だちと同じ部屋に入って、ヒーロー vs 怪人で遊べます（最大10人・足りない席はBot）', W / 2, 180, 17, '#e8ecff', 'center', 'normal');
    hud.button('create', W / 2 - 320, 250, 300, 110, '部屋を作る', '#ffd23f', 'あなたがホスト。招待リンクを送る', 28);
    hud.button('join', W / 2 + 20, 250, 300, 110, 'コードで参加', '#7fd6ff', '5文字の部屋コードを入力', 28);
    text('招待リンクを開いた人は、自動でその部屋に入ります', W / 2, 410, 16, '#cfd6ff', 'center', 'normal');
    text('つながらないときは、ホストのネットワーク（会社・学校のWi-Fiなど）が原因のことがあります', W / 2, 440, 13, '#9fb2e6', 'center', 'normal');
    hud.button('back', W / 2 - 100, 520, 200, 56, 'もどる', '#9aa3c7', '', 20);
  }
  function drawPause(online) {
    hud.buttons = [];
    ctx.fillStyle = 'rgba(5,6,14,.75)'; ctx.fillRect(0, 0, W, H);
    text(online ? 'メニュー' : '一時停止', W / 2, 210, 56, '#ffd23f', 'center', 'bold', '#11131f', 8);
    if (online) text('オンライン中は試合が止まりません', W / 2, 262, 16, '#cfd6ff', 'center', 'normal');
    hud.button('resume', W / 2 - 160, 300, 320, 68, 'もどる', '#ffd23f', '', 26); hud.button('quit', W / 2 - 160, 388, 320, 60, online ? '退出してタイトルへ' : 'タイトルへ', '#cfe3ff', '', 22);
  }
  function drawNote(s) { const w = Math.max(600, tw(s, 16) + 40); rr(W / 2 - w / 2, H - 62, w, 44, 12); ctx.fillStyle = 'rgba(8,10,22,.92)'; ctx.fill(); ctx.strokeStyle = '#ff9a3c'; ctx.lineWidth = 2; ctx.stroke(); text(s, W / 2, H - 40, 16, '#ffe9a8'); }
  return hud;
}
