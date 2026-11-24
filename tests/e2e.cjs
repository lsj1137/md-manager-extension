// 브라우저 E2E 테스트 — Windows node 로 실행: node tests/e2e.cjs  (먼저 bun scripts/build.js)
// 일부 환경에서는 자동화 Chrome 에 확장을 로드할 수 없어, chrome.* API 를 스텁으로 흉내 내고 빌드된 스크립트를 페이지에 직접 주입한다.
const puppeteer = require('puppeteer-core');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = path.resolve(__dirname, '..');
const PORT = 5181;
const ORIGIN = `http://localhost:${PORT}`;
const LIVE_FILE = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mdv-live-')), 'live.md');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';

// ---------- 테스트 서버 ----------
const TYPES = { '.css': 'text/css', '.js': 'text/javascript', '.html': 'text/html; charset=utf-8', '.png': 'image/png', '.woff2': 'font/woff2', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  const f = url === '/live/live.md' ? LIVE_FILE : path.join(ROOT, url);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) return res.writeHead(404).end();
  let type = TYPES[path.extname(f)] || 'application/octet-stream';
  if (f.endsWith('.md')) type = 'text/plain; charset=utf-8';
  if (url.endsWith('/mojibake.md')) type = 'text/plain; charset=windows-1252'; // UTF-8 파일을 1252 로 잘못 해석시키기
  if (url.endsWith('/html.md')) type = 'text/html; charset=utf-8';
  res.writeHead(200, { 'content-type': type, 'cache-control': 'no-store' });
  res.end(fs.readFileSync(f));
});

// ---------- chrome.* 스텁 (페이지 로드 전에 주입) ----------
function stub({ lang, seed }) {
  const KEY = '__stubStore';
  if (seed && !sessionStorage.getItem('__seeded')) {
    localStorage.setItem(KEY, JSON.stringify(seed));
    sessionStorage.setItem('__seeded', '1');
  }
  const load = () => JSON.parse(localStorage.getItem(KEY) || '{}');
  const listeners = [];
  window.chrome = window.chrome || {};
  window.__msgs = [];
  window.__downloads = [];
  chrome.runtime = {
    id: 'test',
    getURL: (p) => '/dist/' + p,
    sendMessage: async (msg) => {
      window.__msgs.push(msg);
      if (msg.type === 'mdv:loadMermaid') {
        await new Promise((res, rej) => {
          const s = document.createElement('script');
          s.src = '/dist/vendor/mermaid.min.js';
          s.onload = res;
          s.onerror = rej;
          document.head.append(s);
        });
        return { ok: true };
      }
    },
  };
  chrome.storage = {
    local: {
      get: async (k) => {
        const all = load();
        return typeof k === 'string' ? (k in all ? { [k]: all[k] } : {}) : all;
      },
      set: async (o) => {
        const all = load();
        const changes = {};
        for (const [k, v] of Object.entries(o)) (changes[k] = { oldValue: all[k], newValue: v }), (all[k] = v);
        localStorage.setItem(KEY, JSON.stringify(all));
        listeners.forEach((fn) => fn(changes, 'local'));
      },
    },
    onChanged: { addListener: (fn) => listeners.push(fn) },
  };
  chrome.i18n = { getUILanguage: () => lang };
  chrome.extension = { isAllowedFileSchemeAccess: (cb) => cb(true) };
  chrome.tabs = { create: (o) => (window.__tabs = [...(window.__tabs || []), o]) };
  chrome.permissions = {
    contains: async () => !!window.__perm,
    request: async () => ((window.__permReq = (window.__permReq || 0) + 1), (window.__perm = true)),
    remove: async () => !(window.__perm = false),
  };
  // 다운로드 가로채기: <a download> 클릭 시 blob 내용을 기록
  const click = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    if (!this.download) return click.call(this);
    const rec = { name: this.download, pending: true };
    window.__downloads.push(rec);
    fetch(this.href)
      .then((r) => r.blob())
      .then(async (b) => Object.assign(rec, { type: b.type, size: b.size, text: b.type.startsWith('text') || b.type.includes('svg') ? await b.text() : '', pending: false }));
  };
}

// ---------- 러너 ----------
const tests = [];
const test = (name, fn) => tests.push({ name, fn });
const assert = (cond, msg) => {
  if (!cond) throw new Error(msg);
};
const eq = (a, b, msg) => assert(a === b, `${msg}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (page, fn, arg, timeout = 8000) => {
  await page.waitForFunction(fn, { timeout, polling: 100 }, arg);
};

// 부드러운 스크롤이 끝날 때까지 (scrollY 가 400ms 동안 그대로) 대기
async function settle(page) {
  let last = -1, same = 0;
  for (let i = 0; i < 100 && same < 4; i++) {
    await sleep(100);
    const y = await page.evaluate(() => scrollY);
    same = y === last ? same + 1 : 0;
    last = y;
  }
  await sleep(100);
}

let browser;
async function newPage({ lang = 'ko-KR', seed } = {}) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: 1280, height: 860 });
  page.__errors = [];
  page.on('pageerror', (e) => page.__errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && !/favicon|404/.test(m.text()) && page.__errors.push(m.text()));
  await page.evaluateOnNewDocument(stub, { lang, seed });
  page.__ctx = ctx;
  return page;
}
async function injectContent(page) {
  await page.addScriptTag({ url: '/dist/content.js' });
  await until(page, () => !!document.querySelector('.mdv-doc'));
  await until(page, () => !document.querySelector('.mdv-mermaid:empty'), null, 20000);
  await sleep(150);
}
async function openDoc(file, opts) {
  const page = await newPage(opts);
  await page.goto(ORIGIN + file, { waitUntil: 'load' });
  await injectContent(page);
  return page;
}
async function reloadDoc(page) {
  await page.reload({ waitUntil: 'load' });
  await injectContent(page);
}
const close = async (page) => {
  const errs = page.__errors;
  await page.__ctx.close();
  assert(errs.length === 0, 'page errors: ' + errs.join(' | '));
};
const key = (page, k) => page.keyboard.press(k);
const q = (page, fn, ...args) => page.evaluate(fn, ...args);

// ================= 콘텐츠 스크립트 (브라우저로 연 .md) =================
test('sample.md 렌더링 요소', async () => {
  const p = await openDoc('/sample.md');
  const r = await q(p, () => ({
    diagrams: document.querySelectorAll('.mdv-diagram svg').length,
    errors: document.querySelectorAll('.mdv-diagram-error').length,
    katex: document.querySelectorAll('.katex').length,
    code: document.querySelectorAll('.mdv-code').length,
    alerts: document.querySelectorAll('.markdown-alert').length,
    toc: document.querySelectorAll('.mdv-toc nav a').length,
    footnotes: document.querySelectorAll('.footnotes li').length,
    meta: document.querySelectorAll('.mdv-meta dt').length,
    tasks: document.querySelectorAll('.mdv-doc input[type=checkbox]').length,
    title: document.title,
    stats: document.querySelector('.mdv-stats').textContent,
  }));
  eq(r.diagrams, 4, '다이어그램');
  eq(r.errors, 1, '문법오류 박스');
  assert(r.katex >= 3, 'katex ' + r.katex);
  eq(r.code, 3, '코드블록');
  eq(r.alerts, 3, '알림');
  eq(r.toc, 11, '목차 항목');
  eq(r.footnotes, 1, '각주');
  eq(r.meta, 3, 'front matter');
  eq(r.tasks, 3, '체크박스');
  eq(r.title, 'Markdown Viewer 기능 샘플', '제목');
  assert(/자/.test(r.stats), '통계 ' + r.stats);
  await close(p);
});

test('mermaid 지연 로드: 다이어그램 있으면 1회 요청', async () => {
  const p = await openDoc('/sample.md');
  const msgs = await q(p, () => window.__msgs.map((m) => m.type));
  eq(JSON.stringify(msgs), JSON.stringify(['mdv:loadMermaid']), '요청');
  await key(p, 'd');
  await key(p, 'd');
  await sleep(1500);
  eq(await q(p, () => window.__msgs.length), 1, '테마 변경 후에도 재요청 없음');
  await close(p);
});

test('mermaid 지연 로드: 다이어그램 없으면 불러오지 않음', async () => {
  const p = await openDoc('/tests/fixtures/nomermaid.md');
  eq(await q(p, () => window.__msgs.length), 0, '요청 수');
  eq(await q(p, () => typeof window.mermaid), 'undefined', 'mermaid 전역');
  await close(p);
});

test('테마 전환·배경색·다이어그램 재렌더', async () => {
  const p = await openDoc('/sample.md', { seed: { mdvSettings: { theme: 'light' } } });
  const bg = () => q(p, () => getComputedStyle(document.querySelector('.mdv')).backgroundColor);
  const fill = () => q(p, () => getComputedStyle(document.querySelector('.mdv-diagram svg .node rect, .mdv-diagram svg .node polygon')).fill);
  eq(await bg(), 'rgb(251, 251, 250)', '라이트 배경');
  const lightFill = await fill();
  await key(p, 'd');
  await until(p, () => document.querySelector('.mdv').dataset.theme === 'dark');
  await sleep(1500);
  eq(await bg(), 'rgb(22, 24, 29)', '다크 배경(#16181d)');
  assert((await fill()) !== lightFill, '다크에서 다이어그램 색이 바뀌어야 함');
  eq(await q(p, () => document.querySelectorAll('.mdv-diagram svg').length), 4, '재렌더 후 다이어그램 수');
  await key(p, 'd');
  await until(p, () => document.querySelector('.mdv').dataset.theme === 'ivory');
  eq(await bg(), 'rgb(248, 245, 236)', '아이보리 배경(#f8f5ec)');
  await close(p);
});

test('자동 테마에서 D: 화면이 그대로인 단계는 건너뜀', async () => {
  for (const scheme of ['light', 'dark']) {
    const p = await newPage({ seed: { mdvSettings: { theme: 'auto' } } });
    await p.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scheme }]);
    await p.goto(ORIGIN + '/tests/fixtures/nomermaid.md', { waitUntil: 'load' });
    await injectContent(p);
    const shown = [await q(p, () => document.querySelector('.mdv').dataset.theme)];
    for (let i = 0; i < 4; i++) {
      await key(p, 'd');
      await sleep(150);
      shown.push(await q(p, () => document.querySelector('.mdv').dataset.theme));
    }
    for (let i = 1; i < shown.length; i++) assert(shown[i] !== shown[i - 1], `${scheme}: 같은 화면 연속 ${shown.join('→')}`);
    eq(shown[0], scheme, '시작 화면');
    await close(p);
  }
});

test('예전 세피아 설정은 아이보리로 표시', async () => {
  const p = await openDoc('/tests/fixtures/nomermaid.md', { seed: { mdvSettings: { theme: 'sepia' } } });
  eq(await q(p, () => document.querySelector('.mdv').dataset.theme), 'ivory', '테마');
  eq(await q(p, () => getComputedStyle(document.querySelector('.mdv')).backgroundColor), 'rgb(248, 245, 236)', '배경');
  await close(p);
});

test('설정 저장 후 새로고침에도 유지', async () => {
  const p = await openDoc('/tests/fixtures/nomermaid.md');
  await key(p, '+');
  await key(p, '+');
  await key(p, 'w');
  await key(p, 'f');
  await sleep(300);
  await reloadDoc(p);
  const r = await q(p, () => {
    const m = document.querySelector('.mdv');
    return { size: m.style.getPropertyValue('--mdv-font-size'), width: m.dataset.width, font: m.dataset.font };
  });
  eq(r.size, '18px', '글자 크기');
  eq(r.width, 'wide', '본문 폭');
  eq(r.font, 'serif', '글꼴');
  await close(p);
});

test('원문 보기 토글', async () => {
  const p = await openDoc('/tests/fixtures/nomermaid.md');
  await key(p, 'r');
  let r = await q(p, () => ({ raw: !document.querySelector('.mdv-raw').hidden, doc: document.querySelector('.mdv-doc').hidden, text: document.querySelector('.mdv-raw').textContent }));
  assert(r.raw && r.doc, '원문 표시');
  assert(r.text.startsWith('# 다이어그램 없는 문서'), '원문 내용');
  await key(p, 'r');
  r = await q(p, () => document.querySelector('.mdv-raw').hidden && !document.querySelector('.mdv-doc').hidden);
  assert(r, '렌더링 복귀');
  await close(p);
});

test('목차 클릭·J/K 이동·맨 위로', async () => {
  const p = await openDoc('/tests/fixtures/long.md');
  const topOf = (n) => q(p, (i) => document.getElementById('섹션-' + i).getBoundingClientRect().top, n);
  await q(p, () => [...document.querySelectorAll('.mdv-toc nav a')].find((a) => a.textContent === '섹션 20').click());
  await settle(p);
  let top = await topOf(20);
  assert(top >= 0 && top < 110, '목차 이동 후 위치 ' + top);
  eq(await q(p, () => document.querySelector('.mdv-toc nav a.active').textContent), '섹션 20', '활성 목차');
  assert(await q(p, () => { const a = document.querySelector('.mdv-toc nav a.active').getBoundingClientRect(); const b = document.querySelector('.mdv-toc').getBoundingClientRect(); return a.top >= b.top && a.bottom <= b.bottom; }), '활성 목차가 목차 영역 안에 보임');
  await key(p, 'j');
  await settle(p);
  top = await topOf(21);
  assert(top >= 0 && top < 110, 'J 이동 ' + top);
  await key(p, 'k');
  await settle(p);
  top = await topOf(20);
  assert(top >= 0 && top < 110, 'K 이동 ' + top);
  await key(p, 'g');
  await settle(p);
  eq(await q(p, () => scrollY), 0, '맨 위로');
  await close(p);
});

test('도움말·모달 열고 닫기, 휠 확대', async () => {
  const p = await openDoc('/sample.md');
  await key(p, '?');
  assert(await q(p, () => !document.querySelector('.mdv-help').hidden), '도움말 열림');
  await key(p, 'Escape');
  assert(await q(p, () => document.querySelector('.mdv-help').hidden), '도움말 닫힘');
  await q(p, () => document.querySelector('.mdv-diagram').click());
  assert(await q(p, () => !document.querySelector('.mdv-modal').hidden), '모달 열림');
  await p.mouse.move(640, 430);
  await p.mouse.wheel({ deltaY: -300 });
  await sleep(200);
  const tr = await q(p, () => document.querySelector('.mdv-canvas').style.transform);
  assert(/scale\((?!1\))/.test(tr), '확대 ' + tr);
  await key(p, 'Escape');
  assert(await q(p, () => document.querySelector('.mdv-modal').hidden), '모달 닫힘');
  await close(p);
});

test('코드 복사 버튼 → 클립보드', async () => {
  const p = await openDoc('/sample.md');
  await p.browserContext().overridePermissions(ORIGIN, ['clipboard-read', 'clipboard-write', 'clipboard-sanitized-write']);
  await q(p, () => document.querySelector('.mdv-code [data-code="copy"]').click());
  await sleep(300);
  const clip = await q(p, () => navigator.clipboard.readText());
  assert(clip.includes('public BigDecimal getTotal'), '클립보드: ' + clip.slice(0, 60));
  assert(await q(p, () => document.querySelector('.mdv-code [data-code="copy"]').classList.contains('ok')), '복사 완료 표시');
  await close(p);
});

test('다이어그램 SVG·PNG 저장', async () => {
  const p = await openDoc('/sample.md');
  await q(p, () => document.querySelector('.mdv-mermaid [data-d="svg"]').click());
  await q(p, () => document.querySelector('.mdv-mermaid [data-d="png"]').click());
  await until(p, () => window.__downloads.length === 2 && window.__downloads.every((d) => !d.pending));
  const [s, png] = await q(p, () => window.__downloads);
  eq(s.name, 'Markdown Viewer 기능 샘플-diagram-1.svg', 'SVG 파일명');
  assert(s.type === 'image/svg+xml' && s.text.includes('<svg') && s.text.includes('xmlns="http://www.w3.org/2000/svg"'), 'SVG 내용');
  assert(!s.text.includes('foreignObject'), 'SVG 에 foreignObject 없음');
  eq(png.type, 'image/png', 'PNG 타입');
  assert(png.size > 5000, 'PNG 크기 ' + png.size);
  await close(p);
});

test('HTML 내보내기 (E)', async () => {
  const p = await openDoc('/sample.md', { seed: { mdvSettings: { theme: 'dark' } } });
  await key(p, 'e');
  await until(p, () => window.__downloads.length === 1 && !window.__downloads[0].pending);
  const d = await q(p, () => window.__downloads[0]);
  eq(d.name, 'Markdown Viewer 기능 샘플.html', '파일명');
  assert(d.text.startsWith('<!doctype html>'), 'HTML 문서');
  assert(d.text.includes('data-theme="dark"'), '현재 테마 반영');
  assert((d.text.match(/<svg[^>]+aria-roledescription/g) || []).length === 4, '다이어그램 4개 포함');
  assert(d.text.includes('class="katex'), '수식 포함');
  const body = d.text.slice(d.text.indexOf('<body'));
  assert(!/class="mdv-diagram-tools|class="mdv-anchor|data-code="copy"/.test(body), '조작 버튼 제거');
  assert(!/["'(]\/dist\/(vendor|viewer)/.test(d.text), '확장 내부 경로 없음');
  const katexVer = JSON.parse(fs.readFileSync(path.join(ROOT, 'node_modules/katex/package.json'), 'utf8')).version;
  assert(d.text.includes(`npm/katex@${katexVer}/dist/fonts/`), '설치된 KaTeX 버전으로 CDN 참조');
  await close(p);
});

test('XSS 문서: 스크립트 실행 안 됨', async () => {
  const p = await openDoc('/tests/fixtures/xss.md');
  await sleep(800);
  eq(await q(p, () => window.__xss), undefined, '__xss');
  const r = await q(p, () => ({
    bad: document.querySelectorAll('.mdv-doc script, .mdv-doc iframe, .mdv-doc object, .mdv-doc [onerror], .mdv-doc [onload]').length,
    js: [...document.querySelectorAll('.mdv-doc a')].filter((a) => /^javascript:/i.test(a.getAttribute('href') || '')).length,
    diagramImg: document.querySelectorAll('.mdv-diagram img').length,
  }));
  eq(r.bad, 0, '위험 요소');
  eq(r.js, 0, 'javascript: 링크');
  eq(r.diagramImg, 0, '다이어그램 라벨 내 img');
  // 클릭해도 실행 안 됨
  await q(p, () => document.querySelector('.mdv-doc a')?.click());
  await sleep(200);
  eq(await q(p, () => window.__xss), undefined, '클릭 후 __xss');
  await close(p);
});

test('인코딩 깨진 한글 자동 복구', async () => {
  const p = await openDoc('/tests/fixtures/mojibake.md');
  const r = await q(p, () => ({ h1: document.querySelector('.mdv-doc h1').textContent, body: document.querySelector('.mdv-doc p').textContent }));
  eq(r.h1.replace(/^#/, ''), '인코딩 테스트', '제목');
  eq(r.body, '한글 본문 — “따옴표” ✓', '본문');
  await close(p);
});

test('HTML 페이지(.md 주소)는 건드리지 않음', async () => {
  const p = await newPage();
  await p.goto(ORIGIN + '/tests/fixtures/html.md', { waitUntil: 'load' });
  await p.addScriptTag({ url: '/dist/content.js' });
  await sleep(500);
  const r = await q(p, () => ({ app: !!document.getElementById('app'), mdv: !!document.querySelector('.mdv') }));
  assert(r.app && !r.mdv, '원래 페이지 유지');
  await close(p);
});

test('파일 변경 시 자동 새로고침', async () => {
  fs.writeFileSync(LIVE_FILE, '# 처음\n\n본문');
  const p = await openDoc('/live/live.md');
  fs.writeFileSync(LIVE_FILE, '# 바뀜\n\n```mermaid\nflowchart LR\n A-->B\n```');
  await until(p, () => document.querySelector('.mdv-doc h1')?.textContent.includes('바뀜'), null, 8000);
  await until(p, () => !!document.querySelector('.mdv-diagram svg'), null, 15000);
  await close(p);
});

test('읽던 위치 기억 / 해시가 있으면 해시 우선', async () => {
  const p = await openDoc('/tests/fixtures/long.md');
  await q(p, () => scrollTo(0, 3000));
  await sleep(900);
  await reloadDoc(p);
  await sleep(300);
  const y = await q(p, () => scrollY);
  assert(Math.abs(y - 3000) < 5, '복원 위치 ' + y);
  await p.goto(ORIGIN + '/tests/fixtures/long.md#섹션-30', { waitUntil: 'load' });
  await injectContent(p);
  await sleep(400);
  const top = await q(p, () => document.getElementById('섹션-30').getBoundingClientRect().top);
  assert(top >= 0 && top < 150, '해시 위치 ' + top);
  await close(p);
});

test('제목 링크 복사', async () => {
  const p = await openDoc('/tests/fixtures/long.md');
  await p.browserContext().overridePermissions(ORIGIN, ['clipboard-read', 'clipboard-write', 'clipboard-sanitized-write']);
  await q(p, () => document.querySelector('#섹션-5 .mdv-anchor').click());
  await sleep(300);
  const clip = await q(p, () => navigator.clipboard.readText());
  assert(decodeURIComponent(clip).endsWith('/tests/fixtures/long.md#섹션-5'), '링크 ' + clip);
  await close(p);
});

test('영어 UI', async () => {
  const p = await openDoc('/sample.md', { lang: 'en-US' });
  const r = await q(p, () => ({
    toc: document.querySelector('.mdv-toc-head').textContent,
    stats: document.querySelector('.mdv-stats').textContent,
    help: document.querySelector('.mdv-help h3').textContent,
    btn: document.querySelector('[data-act="raw"]').title,
    err: document.querySelector('.mdv-diagram-error strong').textContent,
  }));
  eq(r.toc, 'Contents', '목차');
  assert(/min read/.test(r.stats), '통계 ' + r.stats);
  eq(r.help, 'Keyboard shortcuts', '도움말');
  eq(r.btn, 'View source (R)', '버튼');
  eq(r.err, 'Diagram syntax error', '오류');
  await close(p);
});

test('다국어 UI: 6개 언어 문서·팝업·시작 화면', async () => {
  const { pathToFileURL } = require('url');
  const cases = { 'ja-JP': 'ja', 'zh-CN': 'zh-CN', 'zh-TW': 'zh-TW', 'es-ES': 'es', 'de-DE': 'de', 'fr-FR': 'fr' };
  for (const [tag, loc] of Object.entries(cases)) {
    const L = (await import(pathToFileURL(path.join(ROOT, `src/locales/${loc}.js`)).href)).default;
    let p = await openDoc('/sample.md', { lang: tag });
    const r = await q(p, () => ({ toc: document.querySelector('.mdv-toc-head').textContent, help: document.querySelector('.mdv-help h3').textContent, raw: document.querySelector('[data-act="raw"]').title, err: document.querySelector('.mdv-diagram-error strong').textContent }));
    eq(r.toc, L.toc, `${loc} 목차`);
    eq(r.help, L.shortcuts, `${loc} 도움말`);
    eq(r.raw, L.raw, `${loc} 버튼`);
    eq(r.err, L.dError, `${loc} 오류 문구`);
    await close(p);
    p = await newPage({ lang: tag });
    await p.goto(ORIGIN + '/dist/popup.html', { waitUntil: 'load' });
    await sleep(200);
    const pop = await q(p, () => ({ open: document.querySelector('#openViewer').textContent, ivory: document.querySelector('[data-v="ivory"]').textContent, lang: document.documentElement.lang }));
    eq(pop.open, L.popup.open, `${loc} 팝업`);
    eq(pop.ivory, L.themeName.ivory, `${loc} 아이보리`);
    eq(pop.lang, loc, `${loc} html lang`);
    await close(p);
    p = await openViewer({ lang: tag });
    assert((await q(p, () => document.querySelector('.mdv-landing').textContent)).includes(L.landing.openFolder), `${loc} 시작 화면`);
    await close(p);
  }
});

test('문서 언어 자동 판별: 줄바꿈 규칙·lang 속성', async () => {
  for (const [file, want, wb] of [['/tests/fixtures/ja.md', 'ja', 'normal'], ['/tests/fixtures/zh.md', 'zh-CN', 'normal'], ['/sample.md', 'ko', 'keep-all'], ['/tests/fixtures/long.md', 'ko', 'keep-all']]) {
    const p = await openDoc(file, { lang: 'en-US' });
    const r = await q(p, () => { const d = document.querySelector('.mdv-doc'); return { lang: d.getAttribute('lang'), wb: getComputedStyle(d).wordBreak, overflow: d.scrollWidth > d.clientWidth + 1, stats: document.querySelector('.mdv-stats').textContent }; });
    eq(r.lang, want, `${file} lang`);
    eq(r.wb, wb, `${file} word-break`);
    assert(!r.overflow, `${file} 가로 넘침 없음`);
    await close(p);
  }
});

// ================= 확장 뷰어 페이지 =================
async function openViewer(opts) {
  const p = await newPage(opts);
  await p.goto(ORIGIN + '/dist/viewer.html', { waitUntil: 'load' });
  await until(p, () => !!document.querySelector('.mdv-landing .mdv-cta'));
  return p;
}

test('뷰어: 시작 화면 → 파일 업로드', async () => {
  const p = await openViewer();
  eq(await q(p, () => document.querySelectorAll('.mdv-landing [data-open]').length), 2, '열기 버튼');
  const input = await p.$('#mdv-file');
  await input.uploadFile(path.join(ROOT, 'sample.md'));
  await until(p, () => !!document.querySelector('div.mdv .mdv-doc h1'));
  await until(p, () => document.querySelectorAll('.mdv-diagram svg').length === 4, null, 20000);
  assert(await q(p, () => document.querySelector('.mdv-landing').hidden), '시작 화면 숨김');
  assert(await q(p, () => !!window.mermaid), '뷰어에서도 mermaid 지연 로드');
  await close(p);
});

// 메모리 기반 가짜 폴더 핸들 (File System Access API 흉내)
async function fakeFolder(p, extra = 0) {
  await q(p, async (extra) => {
    const files = {};
    for (const f of ['README.md', 'docs/guide.md', 'img/pic.png']) files[f] = await (await fetch('/tests/fixtures/folder/' + f)).blob();
    // 파일이 많은 폴더 흉내 (긴 이름·깊은 경로 포함)
    for (let i = 0; i < extra; i++) files[`notes/${i % 3 ? 'meeting' : 'very-long-directory-name-for-testing/sub'}/note-${String(i).padStart(3, '0')}-아주-긴-파일-이름-테스트용-문서.md`] = new Blob([`# 노트 ${i}`]);
    const fileHandle = (name, path) => ({ kind: 'file', name, getFile: async () => new File([files[path]], name, { lastModified: 1 }) });
    const notFound = () => new DOMException('not found', 'NotFoundError');
    const dirHandle = (name, prefix) => ({
      kind: 'directory',
      name,
      async *values() {
        const seen = new Set();
        for (const p of Object.keys(files).filter((x) => x.startsWith(prefix))) {
          const [head, ...rest] = p.slice(prefix.length).split('/');
          if (seen.has(head)) continue;
          seen.add(head);
          yield rest.length ? dirHandle(head, prefix + head + '/') : fileHandle(head, prefix + head);
        }
      },
      async getDirectoryHandle(n) {
        if (!Object.keys(files).some((x) => x.startsWith(prefix + n + '/'))) throw notFound();
        return dirHandle(n, prefix + n + '/');
      },
      async getFileHandle(n) {
        if (!files[prefix + n]) throw notFound();
        return fileHandle(n, prefix + n);
      },
    });
    await window.__mdv.openDirectory(dirHandle('my-notes', ''));
  }, extra);
}

test('뷰어: 폴더 열기 → 파일 목록·상대경로 이미지·문서 간 링크', async () => {
  const p = await openViewer();
  await fakeFolder(p);
  await until(p, () => document.querySelector('.mdv-doc h1')?.textContent.includes('폴더 홈'));
  let r = await q(p, () => ({
    files: [...document.querySelectorAll('.mdv-files nav a')].map((a) => a.title),
    active: document.querySelector('.mdv-files nav a.active')?.title,
    head: document.querySelector('.mdv-files .mdv-toc-head').textContent,
  }));
  eq(JSON.stringify(r.files), JSON.stringify(['README.md', 'docs/guide.md']), '파일 목록');
  eq(r.active, 'README.md', '처음 연 파일');
  assert(r.head.includes('my-notes'), '폴더 이름');
  await until(p, () => {
    const img = document.querySelector('.mdv-doc img');
    return img?.src.startsWith('blob:') && img.complete && img.naturalWidth === 48;
  });
  await q(p, () => [...document.querySelectorAll('.mdv-doc a')].find((a) => a.textContent === '가이드로 이동').click());
  await until(p, () => document.querySelector('.mdv-doc h1')?.textContent.includes('가이드'));
  await until(p, () => {
    const img = document.querySelector('.mdv-doc img');
    return img?.src.startsWith('blob:') && img.complete && img.naturalWidth === 48;
  });
  eq(await q(p, () => document.querySelector('.mdv-files nav a.active').title), 'docs/guide.md', '활성 파일');
  await q(p, () => [...document.querySelectorAll('.mdv-doc a')].find((a) => a.textContent === '홈으로').click());
  await until(p, () => document.querySelector('.mdv-doc h1')?.textContent.includes('폴더 홈'));
  await close(p);
});

test('뷰어: 파일이 많은 폴더 — 목록이 겹치지 않고 검색 가능', async () => {
  const p = await openViewer();
  await fakeFolder(p, 120);
  await until(p, () => document.querySelectorAll('.mdv-files nav a').length === 122);
  await sleep(400); // 사이드바 전환 애니메이션
  const side = await q(p, () => { const a = document.querySelector('.mdv-toc'); return { w: a.getBoundingClientRect().width, op: getComputedStyle(a).opacity, noToc: document.querySelector('div.mdv').classList.contains('no-toc') }; });
  assert(side.w > 200 && side.op === '1' && !side.noToc, '제목이 1개인 문서여도 파일 목록 사이드바 표시 ' + JSON.stringify(side));
  const r = await q(p, () => {
    const items = [...document.querySelectorAll('.mdv-files nav > *')].filter((n) => !n.hidden);
    const rects = items.map((n) => n.getBoundingClientRect());
    let overlaps = 0, flat = 0;
    for (let i = 0; i < rects.length; i++) {
      if (rects[i].height < 16) flat++;
      if (i && rects[i].top < rects[i - 1].bottom - 0.5) overlaps++;
    }
    const nav = document.querySelector('.mdv-files nav');
    return { overlaps, flat, scrollable: nav.scrollHeight > nav.clientHeight, dirs: document.querySelectorAll('.mdv-files-dir').length, head: document.querySelector('.mdv-files .mdv-toc-head').textContent, oneLine: [...document.querySelectorAll('.mdv-files nav a')].every((a) => a.getBoundingClientRect().height < 30) };
  });
  const look = await q(p, () => {
    const d = document.querySelector('.mdv-files-dir'), a = document.querySelector('.mdv-files nav a.in-dir');
    const cs = (n, pe) => getComputedStyle(n, pe);
    return { dIcon: cs(d, '::before').maskImage || cs(d, '::before').webkitMaskImage, aIcon: cs(a, '::before').maskImage || cs(a, '::before').webkitMaskImage, dW: cs(d).fontWeight, aW: cs(a).fontWeight, dBg: cs(d).backgroundColor, aBorder: cs(a).borderLeftWidth };
  });
  assert(/svg/.test(look.dIcon) && /svg/.test(look.aIcon) && look.dIcon !== look.aIcon, '폴더·파일 아이콘이 서로 다름');
  assert(+look.dW > +look.aW, `폴더 글씨가 더 굵음 ${look.dW}/${look.aW}`);
  assert(look.dBg !== 'rgba(0, 0, 0, 0)' && look.aBorder === '1px', '폴더 배경·파일 안내선');
  eq(r.overlaps, 0, '겹치는 항목');
  eq(r.flat, 0, '납작하게 눌린 항목');
  assert(r.scrollable, '목록 자체 스크롤');
  assert(r.oneLine, '파일명은 한 줄(말줄임)');
  eq(r.dirs, 3, '폴더 묶음 (docs, notes/meeting, notes/very-long.../sub — 루트는 머리 없음)');
  assert(r.head.includes('(122)'), '파일 수 ' + r.head);
  await p.type('.mdv-files-filter', 'note-01');
  const f = await q(p, () => ({
    shown: [...document.querySelectorAll('.mdv-files nav a')].filter((a) => !a.hidden).length,
    dirs: [...document.querySelectorAll('.mdv-files-dir')].filter((d) => !d.hidden).length,
  }));
  eq(f.shown, 10, '검색 결과 (note-010~019)');
  assert(f.dirs >= 1 && f.dirs <= 2, '해당 폴더 머리만 표시 ' + f.dirs);
  await p.screenshot({ path: path.join(ROOT, 'shots', 'many-files.png') });
  await close(p);
});

test('뷰어: 단일 파일에서 상대경로 이미지는 안내 표시', async () => {
  const p = await openViewer();
  const input = await p.$('#mdv-file');
  await input.uploadFile(path.join(ROOT, 'tests/fixtures/folder/README.md'));
  await until(p, () => document.querySelector('.mdv-doc img')?.classList.contains('mdv-img-missing'));
  await close(p);
});

test('뷰어: 파일 핸들 자동 새로고침', async () => {
  const p = await openViewer();
  await q(p, async () => {
    window.__fake = { text: '# v1', t: 1 };
    await window.__mdv.openFileHandle({ kind: 'file', name: 'note.md', getFile: async () => new File([window.__fake.text], 'note.md', { lastModified: window.__fake.t }) });
  });
  await until(p, () => document.querySelector('.mdv-doc h1')?.textContent.includes('v1'));
  await q(p, () => Object.assign(window.__fake, { text: '# v2', t: 2 }));
  await until(p, () => document.querySelector('.mdv-doc h1')?.textContent.includes('v2'), null, 5000);
  await close(p);
});

test('뷰어: 텍스트 붙여넣기', async () => {
  const p = await openViewer();
  await q(p, () => {
    const dt = new DataTransfer();
    dt.setData('text/plain', '# 붙여넣기 제목\n\n본문');
    dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt }));
  });
  await until(p, () => document.querySelector('.mdv-doc h1')?.textContent.includes('붙여넣기 제목'));
  await close(p);
});

test('뷰어: 영어 시작 화면', async () => {
  const p = await openViewer({ lang: 'en' });
  const txt = await q(p, () => document.querySelector('.mdv-landing').textContent);
  assert(txt.includes('Open folder') && txt.includes('Drop a .md file'), '영문 문구');
  await close(p);
});

// ================= 팝업 =================
test('팝업: 문구·설정 저장·웹 권한 토글', async () => {
  const p = await newPage();
  await p.goto(ORIGIN + '/dist/popup.html', { waitUntil: 'load' });
  await sleep(300);
  let r = await q(p, () => ({ open: document.querySelector('#openViewer').textContent, dark: document.querySelector('[data-v="dark"]').textContent, warn: document.querySelector('#fileAccess').hidden }));
  eq(r.open, '파일 / 폴더 열기', '버튼 문구');
  eq(r.dark, '다크', '테마 라벨');
  eq(await q(p, () => document.querySelector('[data-v="ivory"]').textContent), '아이보리', '아이보리 라벨');
  assert(r.warn, '파일 접근 허용 시 경고 숨김');
  await p.click('[data-v="dark"]');
  await p.click('[data-v="wide"]');
  await sleep(100);
  r = await q(p, () => JSON.parse(localStorage.getItem('__stubStore')).mdvSettings);
  assert(r.theme === 'dark' && r.width === 'wide', '저장 ' + JSON.stringify(r));
  await p.click('#web');
  await sleep(100);
  assert(await q(p, () => window.__permReq === 1 && document.querySelector('#web').checked), '권한 요청');
  await p.click('#web');
  await sleep(100);
  assert(await q(p, () => !document.querySelector('#web').checked && !window.__perm), '권한 반납');
  await p.click('#openViewer');
  eq(await q(p, () => window.__tabs?.[0]?.url), '/dist/viewer.html', '뷰어 탭 열기');
  await close(p);
});

test('팝업: 영어', async () => {
  const p = await newPage({ lang: 'en-GB' });
  await p.goto(ORIGIN + '/dist/popup.html', { waitUntil: 'load' });
  await sleep(300);
  eq(await q(p, () => document.querySelector('#openViewer').textContent), 'Open file / folder', '버튼');
  await close(p);
});

// ---------- 실행 ----------
(async () => {
  await new Promise((r) => server.listen(PORT, r));
  browser = await puppeteer.launch({ executablePath: CHROME, headless: true, userDataDir: fs.mkdtempSync(path.join(os.tmpdir(), 'mdv-e2e-')) });
  const only = process.argv[2];
  let pass = 0;
  const fails = [];
  for (const tc of tests) {
    if (only && !tc.name.includes(only)) continue;
    const t0 = Date.now();
    try {
      await tc.fn();
      pass++;
      console.log(`  ✓ ${tc.name} (${Date.now() - t0}ms)`);
    } catch (e) {
      fails.push(tc.name);
      console.log(`  ✗ ${tc.name}\n      ${String(e.message).split('\n')[0]}`);
    }
  }
  console.log(`\n${pass} passed, ${fails.length} failed`);
  await browser.close();
  server.close();
  process.exit(fails.length ? 1 : 0);
})();
