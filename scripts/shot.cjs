// 렌더링 확인용 스크린샷: Windows node 로 실행 (node scripts/shot.cjs)
const puppeteer = require('puppeteer-core');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const root = path.resolve(__dirname, '..');
const server = http.createServer((req, res) => {
  const f = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!fs.existsSync(f)) return res.writeHead(404).end();
  const type = f.endsWith('.md') ? 'text/plain; charset=utf-8' : f.endsWith('.css') ? 'text/css' : f.endsWith('.js') ? 'text/javascript' : f.endsWith('.html') ? 'text/html; charset=utf-8' : f.endsWith('.png') ? 'image/png' : f.endsWith('.woff2') ? 'font/woff2' : 'application/octet-stream';
  res.writeHead(200, { 'content-type': type });
  res.end(fs.readFileSync(f));
});

(async () => {
  await new Promise((r) => server.listen(5179, r));
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
    userDataDir: fs.mkdtempSync(path.join(os.tmpdir(), 'mdv-')),
    args: ['--window-size=1440,1000'],
    defaultViewport: { width: 1440, height: 1000 },
  });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  const out = path.join(root, 'shots');
  fs.mkdirSync(out, { recursive: true });

  // 일부 환경에서는 자동화 Chrome 에 확장을 로드할 수 없어, 같은 스크립트를 페이지에 직접 주입해 검증
  await page.evaluateOnNewDocument(() => {
    window.chrome = window.chrome || {};
    chrome.runtime = { getURL: (p) => '/dist/' + p };
  });
  await page.goto('http://localhost:5179/sample.md', { waitUntil: 'load' });
  await page.addScriptTag({ url: '/dist/vendor/mermaid.min.js' });
  await page.addScriptTag({ url: '/dist/content.js' });
  await page.waitForSelector('.mdv-diagram svg', { timeout: 15000 }).catch(() => errors.push('no diagram'));
  await new Promise((r) => setTimeout(r, 1500));
  const info = await page.evaluate(() => ({
    diagrams: document.querySelectorAll('.mdv-diagram svg').length,
    errorsBox: document.querySelectorAll('.mdv-diagram-error').length,
    katex: document.querySelectorAll('.katex').length,
    code: document.querySelectorAll('.mdv-code').length,
    alerts: document.querySelectorAll('.markdown-alert').length,
    toc: document.querySelectorAll('.mdv-toc nav a').length,
    footnotes: document.querySelectorAll('.footnotes li').length,
    live: !document.querySelector('.mdv-live').hidden,
  }));
  console.log(JSON.stringify(info));
  await page.screenshot({ path: path.join(out, 'light-top.png') });
  await page.evaluate(() => document.querySelector('#mermaid-다이어그램, h2:nth-of-type(1)').scrollIntoView());
  await page.evaluate(() => scrollBy(0, -70));
  await page.screenshot({ path: path.join(out, 'light-mermaid.png') });

  await page.keyboard.press('d'); // light
  await page.keyboard.press('d'); // dark
  await new Promise((r) => setTimeout(r, 1500));
  await page.screenshot({ path: path.join(out, 'dark-mermaid.png') });
  await page.evaluate(() => document.querySelector('.mdv-code').scrollIntoView());
  await page.evaluate(() => scrollBy(0, -70));
  await page.screenshot({ path: path.join(out, 'dark-code.png') });
  await page.keyboard.press('d'); // ivory
  await new Promise((r) => setTimeout(r, 800));
  await page.evaluate(() => document.querySelector('.mdv-table').scrollIntoView());
  await page.evaluate(() => scrollBy(0, -70));
  await page.screenshot({ path: path.join(out, 'ivory-table.png') });

  await page.keyboard.press('d'); // auto(light)
  await page.evaluate(() => document.querySelector('.mdv-diagram').click());
  await new Promise((r) => setTimeout(r, 500));
  await page.screenshot({ path: path.join(out, 'modal.png') });
  await page.keyboard.press('Escape');

  const landing = await browser.newPage();
  landing.on('pageerror', (e) => errors.push('landing: ' + e.message));
  await landing.goto('http://localhost:5179/dist/viewer.html', { waitUntil: 'load' });
  await landing.screenshot({ path: path.join(out, 'landing.png') });

  console.log('errors:', JSON.stringify(errors));
  await browser.close();
  server.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
