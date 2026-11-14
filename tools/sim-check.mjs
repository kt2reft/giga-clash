// バランス確認：Bot同士で試合を回して勝率を出す（npm run sim -- 200）
import * as S from '../src/sim.js';
const N = +(process.argv[2] || 100); const win = [0, 0, 0]; let t = 0;
for (let n = 0; n < N; n++) {
  const slots = Array.from({ length: S.NS }, (_, i) => ({ name: S.BOT_NAMES[i], human: false, col: S.SLOT_COL[i] }));
  const G = S.createMatch({ slots, auto: true, hc: [S.DIFF[4], S.DIFF[4]], lazy: [false, false] });
  let k = 0; while (G.phase !== 'result' && k++ < 60 * 600) { S.step(G, 1 / 60); G.ev.length = 0; }
  win[G.result.win + 1]++; t += S.BATTLE_TIME - G.time;
}
console.log(`${N}試合：ヒーロー ${win[1]}勝 ／ 怪人 ${win[2]}勝 ／ 引き分け ${win[0]}　後半戦の平均 ${(t / N).toFixed(0)}秒`);
