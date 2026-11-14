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
    case 'ui': AU.tone(660, 0.06, 'triangle', 0.15, 1.4); break;
    case 'step': AU.noise(0.2, 0.35, 160, 'lowpass'); break;
    case 'fanfare': [523, 659, 784, 1046].forEach((f, i) => AU.tone(f, 0.35, 'square', 0.12, 1, T + i * 0.12)); break;
    case 'sad': [392, 349, 311, 262].forEach((f, i) => AU.tone(f, 0.4, 'triangle', 0.14, 1, T + i * 0.2)); break;
  }
}
// ---- BGM：オリジナル曲「ギガント発進！」（ニ短調・4小節ループ）
const mtof = m => 440 * Math.pow(2, (m - 69) / 12), _ = null;
const LEAD = [62, _, _, _, 65, _, 69, _, 74, _, 72, _, 69, _, _, _, 70, _, _, _, 69, _, 65, _, 62, _, 65, _, 67, _, _, _,
  67, _, _, _, 69, _, 72, _, 76, _, 74, _, 72, _, _, _, 73, _, _, _, 76, _, 73, _, 69, _, _, _, _, _, _, _];
const ROOTS = [38, 34, 36, 33], CHORD = [[62, 65, 69], [58, 62, 65], [60, 64, 67], [61, 64, 69]];
export const BGM = {
  mode: 'title', next: 0, step: 0,
  tick() {
    const ac = AU.ctx; if (!ac || AU.muted || this.mode === 'off') return;
    const tempo = { od: 156, battle: 132, escape: 160, city: 118, title: 96 }[this.mode] || 96, spb = 60 / tempo / 4;
    if (this.next < ac.currentTime) this.next = ac.currentTime + 0.05;
    while (this.next < ac.currentTime + 0.15) { this.play(this.step, this.next, spb); this.next += spb; this.step = (this.step + 1) % 64; }
  },
  play(s, t, spb) {
    const bar = (s / 16) | 0, i = s % 16, root = ROOTS[bar], D = AU.bgm, m = this.mode;
    if (m === 'title') {
      if (i % 8 === 0) AU.tone(mtof(root + 12), spb * 7, 'triangle', 0.12, 1, t, D);
      if (i % 4 === 0) CHORD[bar].forEach(n => AU.tone(mtof(n), spb * 4, 'sine', 0.025, 1, t, D));
      if (LEAD[s]) AU.tone(mtof(LEAD[s]), spb * 3, 'triangle', 0.06, 1, t, D); return;
    }
    if (m === 'city') {
      if (i % 4 === 0) AU.tone(mtof(root + 12), spb * 1.8, 'triangle', 0.14, 1, t, D);
      if (i % 4 === 2) CHORD[bar].forEach(n => AU.tone(mtof(n + 12), spb * 1.2, 'square', 0.018, 1, t, D));
      if (i % 8 === 0) AU.tone(150, 0.12, 'sine', 0.35, 0.3, t, D); if (i % 8 === 4) AU.noise(0.08, 0.16, 2200, 'bandpass', t, D);
      if (i % 2 === 1) AU.noise(0.03, 0.05, 7000, 'highpass', t, D);
      if (LEAD[s]) AU.tone(mtof(LEAD[s] + 12), spb * 1.6, 'triangle', 0.07, 1, t, D); return;
    }
    if (m === 'escape') {
      if (i % 4 === 0) { AU.tone(mtof(root + 12), spb * 2, 'sawtooth', 0.1, 1, t, D); AU.noise(0.12, 0.3, 120, 'lowpass', t, D); }
      if (i % 8 === 0) AU.tone(880, spb * 3, 'square', 0.05, 1, t, D); if (i % 8 === 4) AU.tone(660, spb * 3, 'square', 0.05, 1, t, D); return;
    }
    if (i % 2 === 0) AU.tone(mtof(root + (i % 8 === 6 ? 12 : 0)), spb * 1.6, 'sawtooth', 0.09, 1, t, D);
    if (i % 4 === 0) AU.tone(150, 0.16, 'sine', 0.5, 0.25, t, D);
    if (i % 8 === 4) AU.noise(0.12, 0.25, 1800, 'bandpass', t, D);
    if (i % 2 === 1) AU.noise(0.03, 0.08, 7000, 'highpass', t, D);
    if (LEAD[s]) AU.tone(mtof(LEAD[s]), spb * 3.2, 'square', 0.055, 1, t, D);
    if (m === 'od') { AU.tone(mtof(CHORD[bar][i % 3] + 12), spb * 0.9, 'square', 0.03, 1, t, D); if (i % 4 === 2) AU.noise(0.05, 0.12, 5000, 'highpass', t, D); }
  },
};
