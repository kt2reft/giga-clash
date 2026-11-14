# 更新のしかた

公開ページ（GitHub Pages）は `docs/` フォルダの中身です。
`docs/index.html` が新しくなれば、数分で公開ページも新しくなります。

## いちばん簡単：GitHub上でソースを直す

1. GitHub で `src/` の中のファイルを開き、鉛筆アイコンで編集して「Commit changes」
2. GitHub Actions（build）が自動で `docs/` を作り直してコミットします（1〜2分）
3. 数分後に公開ページへ反映されます

Actions の進み具合はリポジトリの「Actions」タブで見られます。

## 手元のPCで直す

```sh
npm install          # 最初の1回だけ
npm run dev          # ビルドして http://localhost:8080 で確認
npm run release      # バージョンを1つ上げてビルド（公開前に）
git add -A && git commit -m "更新内容" && git push
```

## できあがったファイルを丸ごと置き換える

ほかで作った `index.html` に置き換えたいときは、GitHub 上で `docs/index.html` を開き
「…」→「Upload files」などで上書きするだけで公開されます。
（この場合は `src/` と中身がずれるので、次にソースを直すときは注意してください）

## バージョン表示と「新しいバージョン」のお知らせ

- バージョン番号は `package.json` の `version` です。タイトル画面の右下に出ます
- 公開ページを開いたままの人には、タイトル画面に「新しいバージョン」ボタンが出ます（5分ごとに確認）
- オンライン対戦でホストとバージョンが違うと、ロビーに「要再読み込み」と表示されます

## バランス調整

`src/sim.js` の先頭近くにある `BAL`（全体の数値）と `DIFF`（Botの強さ）を変えます。
変えたら `npm run sim -- 200` で、Bot同士200試合の勝率を確認できます（ヒーローと怪人が五分に近いのが目安）。

## Claude に頼むとき

「giga-clash リポジトリを更新して」と頼めば、ソースの修正・テスト・ビルド・push まで行います。
手順は [CLAUDE.md](CLAUDE.md) にまとめてあります。
