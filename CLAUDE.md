# GIGA-CLASH — Claude 向けメモ

- ソースは `src/`。`docs/` はビルド生成物（`npm run build`）なので直接編集しない。
- 公開：GitHub Pages（main ブランチの /docs）。URL https://kt2reft.github.io/giga-clash/
- 同じビルド（docs/index.html）を claude.ai のアーティファクト（slug `a402353b-3629-42b5-bbc6-0bf565ac3c20`、capability `room` 宣言済み）にも publish_files で載せている。更新したら両方に反映する。
- オンライン：claude.ai 内では `window.claude.use('room')`、それ以外では `src/net-peer.js`（PeerJS / WebRTC、部屋を作った人がハブ）。main.js の NET はどちらも同じ presence/peers 形で扱う。
- ホストが全シミュレーションを回し、`S.encode` のスナップショット（約1.8KB以下）を presence の `s` で配る。参加者は `in` で入力を送る。
- 更新手順：
  1. src を修正 → `npm run sim -- 200`（勝率が極端に偏っていないか）
  2. `npm run release`（version を上げて docs を作り直す）
  3. ブラウザで確認（ヘッドレスなら `?nogl` で描画なしの速い確認ができる。`?peerhost=127.0.0.1&peerport=9000&peersecure=0` でローカルの PeerServer を使える）
  4. commit → push。アーティファクトも publish_files（mode patch, as index.html）で更新
- 文章・UIはすべて日本語。
