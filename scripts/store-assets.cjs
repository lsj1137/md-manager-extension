// 스토어 이미지 생성: Windows node 로 실행 (node scripts/store-assets.cjs) → store/images/
// 일부 환경에서는 자동화 Chrome 에 확장을 로드할 수 없어, 같은 스크립트를 페이지에 직접 주입해 촬영
const puppeteer = require('puppeteer-core');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const root = path.resolve(__dirname, '..');
const out = path.join(root, 'store', 'images');
const TYPES = { '.md': 'text/plain; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.html': 'text/html; charset=utf-8', '.png': 'image/png', '.woff2': 'font/woff2', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const f = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) return res.writeHead(404).end();
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
  res.end(fs.readFileSync(f));
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// chrome.* API 스텁 (설정값을 주입해 테마 등을 고정)
const stub = (settings) => {
  window.chrome = window.chrome || {};
  const store = { mdvSettings: settings };
  chrome.runtime = { getURL: (p) => '/dist/' + p, id: 'x' };
  chrome.storage = { local: { get: async () => store, set: async () => {} }, onChanged: { addListener() {} } };
  chrome.extension = { isAllowedFileSchemeAccess: (cb) => cb(true) };
  chrome.tabs = { create() {} };
};

async function openDoc(browser, settings, file = 'store/showcase.md') {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.evaluateOnNewDocument(stub, settings);
  await page.goto(`http://localhost:5180/${file}`, { waitUntil: 'load' });
  await page.addScriptTag({ url: '/dist/vendor/mermaid.min.js' });
  await page.addScriptTag({ url: '/dist/content.js' });
  await page.waitForSelector('.mdv-diagram svg', { timeout: 15000 });
  await sleep(1200);
  return page;
}
const scrollToHeading = (page, text, offset = 70) =>
  page.evaluate((t, o) => {
    const h = [...document.querySelectorAll('.mdv-doc h2, .mdv-doc h3')].find((x) => x.textContent.includes(t));
    scrollTo(0, h.getBoundingClientRect().top + scrollY - o);
  }, text, offset);

(async () => {
  fs.mkdirSync(out, { recursive: true });
  await new Promise((r) => server.listen(5180, r));
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
    userDataDir: fs.mkdtempSync(path.join(os.tmpdir(), 'mdv-store-')),
  });
  const base = { fontSize: 16, width: 'normal', font: 'sans', toc: true };

  // 1. 라이트 — 첫 화면 + 흐름도
  let p = await openDoc(browser, { ...base, theme: 'light' });
  await scrollToHeading(p, 'Mermaid 다이어그램', 76);
  await p.screenshot({ path: path.join(out, '1-light-mermaid.png') });
  // 2. 확대 모달
  await scrollToHeading(p, '시퀀스');
  await p.evaluate(() => document.querySelectorAll('.mdv-diagram')[1].click());
  await sleep(400);
  await p.screenshot({ path: path.join(out, '4-zoom.png') });
  await p.close();

  // 3. 다크 — 코드
  p = await openDoc(browser, { ...base, theme: 'dark' });
  await scrollToHeading(p, '코드 하이라이트');
  await p.screenshot({ path: path.join(out, '2-dark-code.png') });
  await p.close();

  // 4. 아이보리 명조 — 표·수식
  p = await openDoc(browser, { ...base, theme: 'ivory', font: 'serif', fontSize: 17 });
  await scrollToHeading(p, '표');
  await p.screenshot({ path: path.join(out, '3-ivory-reading.png') });
  await p.close();

  // 5. 문서 + 설정 팝업 합성
  p = await openDoc(browser, { ...base, theme: 'light' });
  await scrollToHeading(p, '간트');
  const bg = (await p.screenshot({ encoding: 'base64' }));
  await p.close();
  p = await browser.newPage();
  await p.setViewport({ width: 1280, height: 800 });
  await p.evaluateOnNewDocument(stub, { ...base, theme: 'light' });
  await p.goto('http://localhost:5180/dist/popup.html', { waitUntil: 'load' });
  await sleep(300);
  const popupH = await p.evaluate(() => document.body.scrollHeight);
  const popup = await p.screenshot({ encoding: 'base64', clip: { x: 0, y: 0, width: 300, height: popupH } });
  await p.setContent(`<body style="margin:0;position:relative;width:1280px;height:800px;overflow:hidden">
    <img src="data:image/png;base64,${bg}" style="position:absolute;inset:0;filter:saturate(.9)">
    <div style="position:absolute;inset:0;background:#0f111522"></div>
    <img src="data:image/png;base64,${popup}" style="position:absolute;right:28px;top:58px;border-radius:14px;box-shadow:0 24px 60px -12px #0006,0 0 0 1px #0001">
  </body>`);
  await sleep(300);
  await p.screenshot({ path: path.join(out, '5-settings.png') });

  // 홍보 타일 (440x280 필수, 1400x560 선택)
  const icon = fs.readFileSync(path.join(root, 'dist/icons/icon128.png')).toString('base64');
  const tile = (w, h, scale) => `<body style="margin:0;width:${w}px;height:${h}px;overflow:hidden;display:flex;align-items:center;justify-content:center;gap:${28 * scale}px;
      font-family:'Pretendard Variable',Pretendard,'Segoe UI','Malgun Gothic',sans-serif;color:#fff;
      background:radial-gradient(${w}px ${h}px at 0% 0%,#7c7cf8,transparent 70%),radial-gradient(${w}px ${h}px at 100% 100%,#ec4899,transparent 70%),#6d4fe8">
    <img src="data:image/png;base64,${icon}" style="width:${96 * scale}px;height:${96 * scale}px;border-radius:${22 * scale}px;box-shadow:0 ${12 * scale}px ${30 * scale}px -8px #0005;outline:${3 * scale}px solid #ffffff55">
    <div>
      <div style="font-size:${34 * scale}px;font-weight:800;letter-spacing:-.03em;line-height:1.1">Markdown Viewer</div>
      <div style="font-size:${15 * scale}px;opacity:.92;margin-top:${8 * scale}px;font-weight:600">Mermaid · KaTeX · TOC · Dark / Ivory</div>
      <div style="font-size:${13 * scale}px;opacity:.8;margin-top:${4 * scale}px">.md 파일을 예쁘게 읽는 뷰어</div>
    </div>
  </body>`;
  await p.setViewport({ width: 440, height: 280 });
  await p.setContent(tile(440, 280, 0.82));
  await p.screenshot({ path: path.join(out, 'promo-small-440x280.png') });
  await p.setViewport({ width: 1400, height: 560 });
  await p.setContent(tile(1400, 560, 1.9));
  await p.screenshot({ path: path.join(out, 'promo-marquee-1400x560.png') });

  await browser.close();
  server.close();
  console.log('done →', out);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
