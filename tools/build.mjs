// src/ をまとめて、1つのHTMLファイル（docs/index.html）にする
//   docs/ がそのまま GitHub Pages で公開される
import { build } from 'esbuild';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const version = pkg.version;
const out = path.join(root, 'docs');
fs.mkdirSync(out, { recursive: true });

const res = await build({
  entryPoints: [path.join(root, 'src/main.js')], bundle: true, format: 'iife', minify: true, target: 'es2020',
  write: false, define: { __VERSION__: JSON.stringify(version) }, logLevel: 'warning',
});
let js = res.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
let html = fs.readFileSync(path.join(root, 'src/index.html'), 'utf8');
const tag = '<script type="module" src="./main.js"></script>';
if (!html.includes(tag)) throw new Error('src/index.html に main.js の読み込みタグが見つかりません');
html = html.replace(tag, () => `<script>\n${js}\n</script>`);
fs.writeFileSync(path.join(out, 'index.html'), html);
fs.writeFileSync(path.join(out, 'version.json'), JSON.stringify({ version, built: new Date().toISOString() }) + '\n');
fs.writeFileSync(path.join(out, '.nojekyll'), '');
console.log(`ビルド完了：docs/index.html（ver ${version}、${(html.length / 1024).toFixed(0)} KB）`);
