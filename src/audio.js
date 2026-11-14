// =====================================================================
// GIGA-CLASH  audio.js — 効果音とBGM（すべてブラウザ内で合成）
// =====================================================================
export const AU = {
  ctx: null, master: null, bgm: null, sfx: null, muted: false, noiseBuf: null,
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); return; }
    try {
      const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
      const ac = this.ctx = new C();
      this.master = ac.createGain(); this.master.gain.value = this.muted ? 0 : 0.8; this.master.connect(ac.destination);
      this.bgm = ac.createGain(); this.bgm.gain.value = 0.3; this.bgm.connect(this.master);
      this.sfx = ac.createGain(); this.sfx.gain.value = 0.75; this.sfx.connect(this.master);
      const len = ac.sampleRate, b = ac.createBuffer(1, len, ac.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuf = b;
    } catch (e) { this.ctx = null; }
  },
  setMute(m) { this.muted = m; if (this.master) this.master.gain.value = m ? 0 : 0.8; },
  tone(freq, dur, type = 'square', vol = 0.2, slide = 0, t0 = 0, dest = null) {
    const ac = this.ctx; if (!ac) return; const t = t0 || ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur); o.connect(g); g.connect(dest || this.sfx); o.start(t); o.stop(t + dur + 0.02);
  },
  noise(dur, vol = 0.2, freq = 1200, type = 'bandpass', t0 = 0, dest = null) {
    const ac = this.ctx; if (!ac || !this.noiseBuf) return; const t = t0 || ac.currentTime, s = ac.createBufferSource(); s.buffer = this.noiseBuf;
    const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq; const g = ac.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    s.connect(f); f.connect(g); g.connect(dest || this.sfx); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  },
};
const cd = {};
export function sfx(name) {
  if (!AU.ctx || AU.muted) return; const now = performance.now(); if (cd[name] && now - cd[name] < 45) return; cd[name] = now; const T = AU.ctx.currentTime;
  switch (name) {
    case 'hitL': AU.noise(0.12, 0.35, 900); AU.tone(180, 0.1, 'square', 0.12, 0.5); break;
    case 'hitH': AU.noise(0.3, 0.5, 500, 'lowpass'); AU.tone(110, 0.25, 'sawtooth', 0.2, 0.4); break;
    case 'block': AU.tone(900, 0.08, 'triangle', 0.15, 0.7); AU.noise(0.06, 0.15, 3000); break;
    case 'boom': AU.noise(0.8, 0.6, 300, 'lowpass'); AU.tone(70, 0.6, 'sine', 0.4, 0.3); break;
    case 'whoosh': AU.noise(0.18, 0.18, 1600, 'bandpass'); break;
    case 'coal': AU.tone(140, 0.08, 'square', 0.15, 0.6); AU.noise(0.1, 0.2, 700); break;
    case 'feed': AU.noise(0.25, 0.25, 400, 'lowpass'); AU.tone(220, 0.15, 'sawtooth', 0.08, 1.6); break;
    case 'load': AU.tone(660, 0.05, 'square', 0.12); AU.tone(990, 0.07, 'square', 0.1, 1, T + 0.06); break;
    case 'pick': AU.tone(520, 0.05, 'triangle', 0.14, 1.3); break;
    case 'buzz': AU.tone(140, 0.25, 'square', 0.14); break;
    case 'missile': AU.noise(0.4, 0.25, 2000, 'highpass'); AU.tone(300, 0.3, 'sawtooth', 0.06, 2); break;
    case 'alarm': AU.tone(880, 0.14, 'square', 0.1); AU.tone(660, 0.14, 'square', 0.1, 1, T + 0.16); break;
    case 'swap': AU.tone(300, 0.25, 'sawtooth', 0.1, 3); AU.noise(0.25, 0.12, 2500); break;
    case 'psh': AU.noise(0.12, 0.12, 4000, 'highpass'); break;
    case 'fix': AU.tone(784, 0.08, 'triangle', 0.15); AU.tone(1175, 0.12, 'triangle', 0.15, 1, T + 0.08); break;
    case 'perfect': AU.tone(1046, 0.1, 'square', 0.12); AU.tone(1568, 0.18, 'square', 0.12, 1, T + 0.08); break;
    case 'good': AU.tone(784, 0.14, 'square', 0.1); break;
    case 'miss': AU.tone(200, 0.2, 'sawtooth', 0.1, 0.6); break;
    case 'beam': AU.noise(1.2, 0.4, 900, 'bandpass'); AU.tone(220, 1.2, 'sawtooth', 0.15, 2.5); break;
    case 'charge': AU.tone(200, 1.0, 'sawtooth', 0.06, 4); break;
    case 'bonk': AU.tone(400, 0.1, 'square', 0.15, 0.4); break;
    case 'pump': AU.tone(300 + Math.random() * 200, 0.07, 'square', 0.1, 1.8); break;
    case 'skill': AU.tone(523, 0.08, 'square', 0.12); AU.tone(784, 0.08, 'square', 0.12, 1, T + 0.07); AU.tone(1046, 0.16, 'square', 0.12, 1, T + 0.14); AU.noise(0.2, 0.12, 3000, 'highpass', T + 0.05); break;
    case 'jump': AU.noise(0.35, 0.3, 300, 'lowpass'); AU.tone(160, 0.35, 'sawtooth', 0.12, 2.2); break;
    case 'ui': AU.tone(660, 0.06, 'triangle', 0.15, 1.4); break;
    case 'step': AU.noise(0.2, 0.35, 160, 'lowpass'); break;
    case 'fanfare': [523, 659, 784, 1046].forEach((f, i) => AU.tone(f, 0.35, 'square', 0.12, 1, T + i * 0.12)); break;
    case 'sad': [392, 349, 311, 262].forEach((f, i) => AU.tone(f, 0.4, 'triangle', 0.14, 1, T + i * 0.2)); break;
  }
}
// ---- BGM：オリジナル曲「ゆけ！ギガント・ブレイバー」（ニ長調・8小節ループ）
//   ヒーロー物らしい長調のマーチ。I–♭VII–IV–I–vi–IV–V–V の進行に、
//   ブラス風の主旋律、裏拍のコード刻み、オクターブで跳ねるベース、4つ打ちのドラム。
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
// [ステップ, 音, 長さ]（1小節＝16ステップ）
const MEL = [
  [0, 69, 3], [3, 69, 1], [4, 74, 4], [8, 73, 2], [10, 71, 2], [12, 69, 4],
  [16, 67, 3], [19, 67, 1], [20, 72, 4], [24, 71, 2], [26, 69, 2], [28, 67, 4],
  [32, 71, 2], [34, 74, 2], [36, 79, 6], [42, 78, 2], [44, 76, 2], [46, 74, 2],
  [48, 81, 6], [54, 78, 2], [56, 74, 8],
  [64, 78, 3], [67, 78, 1], [68, 76, 2], [70, 74, 2], [72, 71, 4], [76, 74, 4],
  [80, 79, 3], [83, 78, 1], [84, 76, 2], [86, 74, 2], [88, 76, 4], [92, 78, 4],
  [96, 76, 2], [98, 78, 2], [100, 79, 2], [102, 81, 6], [108, 79, 2], [110, 78, 2],
  [112, 76, 6], [118, 69, 2], [120, 73, 2], [122, 76, 2], [124, 81, 4],
];
const MELAT = {}; for (const m of MEL) MELAT[m[0]] = m;
const ROOT = [38, 36, 43, 38, 35, 43, 45, 45];
const CH = [[62, 66, 69], [60, 64, 67], [59, 62, 67], [62, 66, 69], [59, 62, 66], [59, 62, 67], [61, 64, 69], [61, 64, 69]];
// 対旋律（オーバードライブ用のきらきらアルペジオ）
const ARP = [0, 1, 2, 1];
function note(f, dur, type, vol, t, dest, att = 0.008, rel = 0.06) {
  const ac = AU.ctx, o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + att); g.gain.setValueAtTime(vol * 0.8, t + Math.max(att, dur - rel)); g.gain.exponentialRampToValueAtTime(0.0008, t + dur + rel);
  o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + rel + 0.02);
}
function brass(m, dur, vol, t, D) { const f = mtof(m); note(f, dur, 'sawtooth', vol, t, D, 0.02); note(f * 1.004, dur, 'sawtooth', vol * 0.6, t, D, 0.03); note(f * 2, dur, 'square', vol * 0.18, t, D, 0.02); }
function kick(t, D, v = 0.55) { AU.tone(140, 0.14, 'sine', v, 0.3, t, D); AU.noise(0.03, 0.15, 1200, 'lowpass', t, D); }
function snare(t, D, v = 0.3) { AU.noise(0.13, v, 1900, 'bandpass', t, D); AU.tone(220, 0.06, 'triangle', v * 0.4, 0.6, t, D); }
function hat(t, D, v = 0.07, open = false) { AU.noise(open ? 0.16 : 0.035, v, 8000, 'highpass', t, D); }
function crash(t, D) { AU.noise(1.1, 0.16, 5000, 'highpass', t, D); }
export const BGM = {
  mode: 'title', next: 0, step: 0, last: '',
  tick() {
    const ac = AU.ctx; if (!ac || AU.muted || this.mode === 'off') return;
    if (this.mode !== this.last) { if ((this.last === 'battle' && this.mode === 'od') || (this.last === 'od' && this.mode === 'battle')) { /* そのまま続ける */ } else this.step = 0; this.last = this.mode; }
    const tempo = { od: 172, battle: 160, escape: 168, city: 150, title: 138 }[this.mode] || 138, spb = 60 / tempo / 4;
    if (this.next < ac.currentTime) this.next = ac.currentTime + 0.05;
    while (this.next < ac.currentTime + 0.15) { this.play(this.step, this.next, spb); this.next += spb; this.step = (this.step + 1) % 128; }
  },
  play(s, t, spb) {
    const bar = (s / 16) | 0, i = s % 16, D = AU.bgm, m = this.mode;
    if (m === 'escape') {
      // ピンチの曲：短調で刻むベースと警報のような和音
      const r = [38, 38, 34, 36][bar % 4];
      if (i % 2 === 0) note(mtof(r + (i % 4 === 2 ? 12 : 0)), spb * 1.6, 'sawtooth', 0.09, t, D);
      if (i % 4 === 0) kick(t, D); if (i === 4 || i === 12) snare(t, D); hat(t, D, 0.05);
      if (i === 0 || i === 8) for (const n of [62, 65, 69]) note(mtof(n + (bar % 2 ? 1 : 0)), spb * 6, 'square', 0.03, t, D);
      return;
    }
    const up = m === 'od' ? 2 : 0, root = ROOT[bar] + up, ch = CH[bar].map(n => n + up), mel = MELAT[s];
    // ベース：オクターブで跳ねる8分
    if (i % 2 === 0) note(mtof(root + (i % 4 === 2 ? 12 : 0)), spb * 1.7, m === 'title' ? 'triangle' : 'sawtooth', m === 'title' ? 0.14 : 0.1, t, D, 0.005, 0.03);
    // ドラム
    if (m === 'title') { if (i === 0 || i === 8) kick(t, D, 0.45); if (i === 4 || i === 12) snare(t, D, 0.22); if (i % 4 === 2) hat(t, D, 0.05); }
    else {
      if (i % 4 === 0) kick(t, D);
      if (i === 4 || i === 12) snare(t, D, m === 'city' ? 0.22 : 0.32);
      if (i % 2 === 1) hat(t, D, m === 'city' ? 0.05 : 0.07, i === 15);
      if (m === 'od' && bar === 7 && i >= 8) snare(t, D, 0.12 + (i - 8) * 0.025);
      if (m !== 'city' && i === 0 && (bar === 0 || bar === 4)) crash(t, D);
    }
    // コード：裏拍で刻む（ヒーロー物らしい推進力）
    if (i % 4 === 2 && m !== 'title') for (const n of ch) note(mtof(n), spb * 0.9, 'square', m === 'city' ? 0.016 : 0.022, t, D, 0.004, 0.03);
    if (m === 'title' && i === 0) for (const n of ch) note(mtof(n), spb * 14, 'triangle', 0.03, t, D, 0.08, 0.3);
    // 主旋律
    if (mel) {
      const n = mel[1] + up, dur = spb * mel[2] * 0.95;
      if (m === 'city') { note(mtof(n + 12), dur * 0.8, 'triangle', 0.08, t, D); note(mtof(n), dur * 0.8, 'square', 0.025, t, D); }
      else if (m === 'title') brass(n, dur, 0.045, t, D);
      else brass(n, dur, 0.06, t, D);
    }
    // オーバードライブ：16分のアルペジオ
    if (m === 'od') note(mtof(ch[ARP[i % 4]] + 12), spb * 0.8, 'square', 0.018, t, D, 0.003, 0.02);
  },
};
