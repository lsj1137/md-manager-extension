// dist/ 에 크롬 확장 패키지 생성: bun scripts/build.js
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { writeIcons } from './icons.js';

// 번들에 포함된 라이브러리 라이선스 모음 (LICENSE 파일이 없는 패키지는 package.json 기준 MIT 문구 생성)
const BUNDLED = ['marked', 'marked-highlight', 'marked-footnote', 'marked-alert', 'marked-katex-extension', 'katex', 'highlight.js', 'dompurify', 'mermaid'];
function thirdPartyNotices() {
  const parts = ['This extension bundles the following open-source software.\n'];
  for (const name of BUNDLED) {
    const dir = `node_modules/${name}`;
    const pkg = JSON.parse(readFileSync(`${dir}/package.json`, 'utf8'));
    const file = ['LICENSE', 'LICENSE.md', 'LICENSE.txt'].find((f) => existsSync(`${dir}/${f}`));
    const author = typeof pkg.author === 'string' ? pkg.author : pkg.author?.name || `${name} contributors`;
    const text = file
      ? readFileSync(`${dir}/${file}`, 'utf8').trim()
      : `MIT License\n\nCopyright (c) ${author}\n\n` + readFileSync('LICENSE', 'utf8').split('\n').slice(4).join('\n').trim();
    const repo = typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url || '';
    parts.push(`${'='.repeat(72)}\n${name}@${pkg.version} (${pkg.license})\n${repo}\n${'-'.repeat(72)}\n${text}\n`);
  }
  return parts.join('\n');
}

const DIST = 'dist';
mkdirSync(`${DIST}/vendor/katex`, { recursive: true });

const result = await Bun.build({
  entrypoints: ['src/content.js', 'src/viewer.js', 'src/background.js', 'src/popup.js'],
  outdir: DIST,
  format: 'iife',
  target: 'browser',
  minify: true,
  define: { __KATEX_VERSION__: JSON.stringify(JSON.parse(readFileSync('node_modules/katex/package.json', 'utf8')).version) },
});
if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}

// 번들러가 \uffff 같은 이스케이프를 실제 문자로 풀어버리면 Chrome 이 "UTF-8 아님"으로 거부한다 → 비ASCII 전부 재이스케이프
for (const o of result.outputs) {
  const code = readFileSync(o.path, 'utf8');
  writeFileSync(o.path, code.replace(/[^\x00-\x7e]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')));
}

cpSync('static', DIST, { recursive: true });
cpSync('node_modules/mermaid/dist/mermaid.min.js', `${DIST}/vendor/mermaid.min.js`);
cpSync('node_modules/katex/dist/katex.min.css', `${DIST}/vendor/katex/katex.min.css`);
cpSync('node_modules/katex/dist/fonts', `${DIST}/vendor/katex/fonts`, { recursive: true });
writeIcons(`${DIST}/icons`);
cpSync('LICENSE', `${DIST}/LICENSE`);
writeFileSync(`${DIST}/THIRD_PARTY_NOTICES.txt`, thirdPartyNotices());

// 스토어 업로드용 zip (manifest.json 이 zip 루트에 오도록 dist 안에서 묶는다)
const version = JSON.parse(readFileSync('static/manifest.json', 'utf8')).version;
mkdirSync('release', { recursive: true });
const zip = `release/md-viewer-${version}.zip`;
const py = `import zipfile,os
z=zipfile.ZipFile('../${zip}','w',zipfile.ZIP_DEFLATED)
for r,_,fs in os.walk('.'):
  for f in fs:
    p=os.path.join(r,f); z.write(p,os.path.relpath(p,'.'))
z.close()`;
const zipped = Bun.spawnSync(['python3', '-c', py], { cwd: DIST });
if (zipped.exitCode !== 0) {
  console.error(zipped.stderr.toString());
  process.exit(1);
}
console.log('zip →', zip);

for (const o of result.outputs) console.log(o.path.split('/').slice(-1)[0], (o.size / 1024).toFixed(0) + 'KB');
console.log('done → dist/');
