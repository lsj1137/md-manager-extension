// 뷰어 화면 셸: 상단바·목차·본문·원문보기·다이어그램/이미지 확대·내보내기·설정 연동
import { renderMarkdown, slugify } from './render.js';
import { t, lang } from './i18n.js';

const DEFAULTS = { theme: 'auto', fontSize: 16, width: 'normal', font: 'sans', toc: true };
const THEMES = ['auto', 'light', 'dark', 'ivory'];
// 저장값 정리: 예전 이름(sepia)·알 수 없는 테마는 바로잡는다
export const normalizeSettings = (s) => {
  const out = { ...DEFAULTS, ...(s || {}) };
  if (out.theme === 'sepia') out.theme = 'ivory';
  if (!THEMES.includes(out.theme)) out.theme = DEFAULTS.theme;
  return out;
};
// 테마 순환: 화면이 실제로 바뀌는 다음 테마로 (예: 시스템이 라이트일 때 자동→라이트는 건너뜀)
export function nextTheme(current, systemDark) {
  const resolve = (th) => (th === 'auto' ? (systemDark ? 'dark' : 'light') : th);
  let i = THEMES.indexOf(current);
  for (let n = 0; n < THEMES.length; n++) {
    i = (i + 1) % THEMES.length;
    if (resolve(THEMES[i]) !== resolve(current)) return THEMES[i];
  }
  return current;
}
const WIDTHS = ['narrow', 'normal', 'wide', 'full'];
// 빌드 시 설치된 KaTeX 버전으로 치환 (bun 테스트 등 미치환 환경은 기본값)
const KATEX_VERSION = typeof __KATEX_VERSION__ === 'string' ? __KATEX_VERSION__ : '0.16';
const POS_LIMIT = 200; // 읽던 위치를 기억할 최대 문서 수

const storage = globalThis.chrome?.storage?.local;
const assetUrl = (p) => globalThis.chrome?.runtime?.getURL?.(p) ?? p;

const ICON = {
  toc: '<path d="M4 6h16M4 12h10M4 18h13"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  code: '<path d="m8 16-4-4 4-4M16 8l4 4-4 4"/>',
  minus: '<path d="M5 12h14"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  width: '<path d="M3 12h18M7 8l-4 4 4 4M17 8l4 4-4 4"/>',
  font: '<path d="M4 20 10 4h1l6 16M6.5 14h8"/>',
  print: '<path d="M6 9V3h12v6M6 18H4v-7h16v7h-2M8 14h8v7H8z"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7M12 17h.01"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/>',
  check: '<path d="m5 12 5 5 9-10"/>',
  expand: '<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>',
  html: '<path d="M4 4h16v16H4z"/><path d="m9 10-2 2 2 2M15 10l2 2-2 2"/>',
  wrap: '<path d="M3 6h18M3 12h15a3 3 0 0 1 0 6h-4M16 16l-2 2 2 2M3 18h7"/>',
  up: '<path d="m6 15 6-6 6 6"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
  reset: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5"/>',
};
export const svg = (name, size = 18) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICON[name]}</svg>`;

const el = (tag, attrs = {}, html = '') => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (html) n.innerHTML = html;
  return n;
};

const isRelative = (u) => !!u && !/^([a-z][a-z0-9+.-]*:|\/\/|#|\/)/i.test(u);

function download(blob, name) {
  const a = el('a', { href: URL.createObjectURL(blob), download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

// Mermaid 테마 변수 (본문 테마와 색 계열 맞춤)
const MERMAID_VARS = {
  light: { background: '#ffffff', primaryColor: '#eef2ff', primaryBorderColor: '#6366f1', primaryTextColor: '#1e1b4b', secondaryColor: '#ecfdf5', secondaryBorderColor: '#10b981', tertiaryColor: '#fff7ed', tertiaryBorderColor: '#f59e0b', lineColor: '#64748b', textColor: '#1f2937', noteBkgColor: '#fef9c3', noteBorderColor: '#eab308', clusterBkg: '#f8fafc', clusterBorder: '#cbd5e1', edgeLabelBackground: '#ffffff' },
  dark: { background: '#1c1f26', primaryColor: '#2b2f52', primaryBorderColor: '#818cf8', primaryTextColor: '#e0e7ff', secondaryColor: '#16342c', secondaryBorderColor: '#34d399', tertiaryColor: '#3d2e17', tertiaryBorderColor: '#fbbf24', lineColor: '#94a3b8', textColor: '#e5e7eb', noteBkgColor: '#3e3717', noteBorderColor: '#ca8a04', clusterBkg: '#22252d', clusterBorder: '#3d424e', edgeLabelBackground: '#22252d', darkMode: true },
  ivory: { background: '#fdfbf5', primaryColor: '#f3ecdb', primaryBorderColor: '#a17a4a', primaryTextColor: '#3a3226', secondaryColor: '#e9f0e1', secondaryBorderColor: '#6b8f3a', tertiaryColor: '#f6e6da', tertiaryBorderColor: '#c0703f', lineColor: '#8b7a62', textColor: '#3a3226', noteBkgColor: '#fbf1cc', noteBorderColor: '#c49a3a', clusterBkg: '#f7f3e8', clusterBorder: '#ddd3bd', edgeLabelBackground: '#fdfbf5' },
};
const PIE = {
  light: ['#6366f1', '#22c55e', '#f59e0b', '#ec4899', '#06b6d4', '#a855f7', '#ef4444', '#84cc16'],
  dark: ['#818cf8', '#4ade80', '#fbbf24', '#f472b6', '#22d3ee', '#c084fc', '#f87171', '#a3e635'],
  ivory: ['#a0703c', '#6b8f3a', '#c0703f', '#9d4b6e', '#3f7f7a', '#7a5fa8', '#b5523b', '#8a9a3a'],
};

// 읽기 시간: 한·중·일 글자는 글자 수로(분당 약 450자), 나머지 언어는 단어 수로(분당 약 230단어) 계산해 합산
const CJK = /[\p{Script=Hangul}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u;
const CJK_G = new RegExp(CJK.source, 'gu');
export function readingStats(text) {
  const chars = text.replace(/\s/g, '').length;
  const tokens = text.match(/[\p{L}\p{N}]+/gu) || [];
  const cjk = (text.match(CJK_G) || []).length;
  const otherWords = tokens.filter((w) => !CJK.test(w)).length;
  const minutes = Math.max(1, Math.round(cjk / 450 + otherWords / 230));
  return { chars, words: tokens.length, minutes };
}

// 문서 본문 언어 추정 (한자 글꼴 선택·줄바꿈 규칙용): 가나→ja, 한글→ko, 한자만→zh(UI가 번체면 zh-TW)
export function detectDocLang(text, uiLang = lang) {
  const n = (re) => (text.match(re) || []).length;
  const kana = n(/[\p{Script=Hiragana}\p{Script=Katakana}]/gu);
  const hangul = n(/\p{Script=Hangul}/gu);
  const han = n(/\p{Script=Han}/gu);
  const letters = n(/\p{L}/gu) || 1;
  if (kana / letters > 0.05) return 'ja';
  if (hangul / letters > 0.2) return 'ko';
  if (han / letters > 0.2) return uiLang === 'zh-TW' ? 'zh-TW' : uiLang === 'ja' ? 'ja' : 'zh-CN';
  return '';
}

/**
 * 뷰어 생성
 * @param opts.root          그릴 요소
 * @param opts.title         제목(파일명)
 * @param opts.source        마크다운 원문
 * @param opts.posKey        읽던 위치 기억용 키 (없으면 기억 안 함)
 * @param opts.loadMermaid   mermaid 지연 로더 () => Promise<mermaid>
 * @param opts.resolveAsset  상대경로 이미지 → URL 변환 (src) => Promise<string|null>
 * @param opts.onLink        상대경로 링크 클릭 처리 (href) => boolean(처리했으면 true)
 * @param opts.extra.toolbar 상단바에 추가할 HTML
 */
export function createViewer({ root, title, source, posKey, loadMermaid, resolveAsset, onLink, extra = {} }) {
  let settings = { ...DEFAULTS };
  let current = source;
  let key = posKey;
  let mermaidSeq = 0;
  let renderGen = 0;
  let restored = false;

  root.innerHTML = `
    <div class="mdv-progress"><span></span></div>
    <header class="mdv-topbar">
      <div class="mdv-left">
        <button class="mdv-btn" data-act="toc" title="${t.tocKey}">${svg('toc')}</button>
        <div class="mdv-title">${svg('file', 16)}<span></span></div>
      </div>
      <div class="mdv-right">
        <span class="mdv-stats"></span>
        ${extra.toolbar || ''}
        <span class="mdv-sep"></span>
        <button class="mdv-btn" data-act="font-" title="${t.fontDown}">${svg('minus')}</button>
        <button class="mdv-btn mdv-size" data-act="font0" title="${t.fontReset}"></button>
        <button class="mdv-btn" data-act="font+" title="${t.fontUp}">${svg('plus')}</button>
        <button class="mdv-btn" data-act="width" title="${t.width}">${svg('width')}</button>
        <button class="mdv-btn" data-act="family" title="${t.family}">${svg('font')}</button>
        <button class="mdv-btn" data-act="theme" title="${t.theme}">${svg('sun')}</button>
        <button class="mdv-btn" data-act="raw" title="${t.raw}">${svg('code')}</button>
        <button class="mdv-btn" data-act="export" title="${t.exportHtml} (E)">${svg('html')}</button>
        <button class="mdv-btn" data-act="print" title="${t.print}">${svg('print')}</button>
        <button class="mdv-btn" data-act="help" title="${t.help}">${svg('help')}</button>
      </div>
    </header>
    <div class="mdv-layout">
      <aside class="mdv-toc">
        <div class="mdv-files" hidden></div>
        <div class="mdv-toc-head">${t.toc}</div><nav></nav>
      </aside>
      <main class="mdv-main">
        <div class="mdv-meta" hidden></div>
        <article class="mdv-doc"></article>
        <pre class="mdv-raw" hidden></pre>
      </main>
    </div>
    <button class="mdv-totop" title="${t.toTop}">${svg('up', 20)}</button>
    <div class="mdv-modal" hidden>
      <div class="mdv-modal-bar">
        <span class="mdv-modal-hint">${t.modalHint}</span>
        <button class="mdv-btn" data-modal="reset" title="${t.reset}">${svg('reset')}</button>
        <button class="mdv-btn" data-modal="close" title="${t.close}">${svg('close')}</button>
      </div>
      <div class="mdv-stage"><div class="mdv-canvas"></div></div>
    </div>
    <div class="mdv-help" hidden>
      <div class="mdv-help-card">
        <h3>${t.shortcuts}</h3>
        <dl>${t.helpRows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>
        <p>${t.helpFoot}</p>
      </div>
    </div>
    <div class="mdv-toast"></div>`;

  const $ = (s) => root.querySelector(s);
  const doc = $('.mdv-doc');
  const raw = $('.mdv-raw');
  const tocNav = $('.mdv-toc nav');
  const modal = $('.mdv-modal');
  const canvas = $('.mdv-canvas');

  let docTitle = title;
  const setTitle = (s) => {
    docTitle = s;
    $('.mdv-title span').textContent = s;
    document.title = s;
  };
  setTitle(title);

  const toast = (msg) => {
    const box = $('.mdv-toast');
    box.textContent = msg;
    box.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => box.classList.remove('show'), 1600);
  };

  const copyText = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = el('textarea');
      ta.value = text;
      document.body.append(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
  };

  // ---------- 설정 ----------
  const media = matchMedia('(prefers-color-scheme: dark)');
  const effectiveTheme = () => (settings.theme === 'auto' ? (media.matches ? 'dark' : 'light') : settings.theme);

  function applySettings(rerenderDiagrams = true) {
    const theme = effectiveTheme();
    const prev = root.dataset.theme;
    root.dataset.theme = theme;
    root.dataset.width = settings.width;
    root.dataset.font = settings.font;
    root.classList.toggle('toc-hidden', !settings.toc);
    root.style.setProperty('--mdv-font-size', settings.fontSize + 'px');
    $('.mdv-size').textContent = settings.fontSize;
    document.documentElement.style.colorScheme = theme === 'dark' ? 'dark' : 'light';
    if (rerenderDiagrams && prev && prev !== theme) renderDiagrams();
  }
  const save = () => storage?.set({ mdvSettings: settings });
  const update = (patch, msg) => {
    settings = { ...settings, ...patch };
    applySettings();
    save();
    if (msg) toast(msg);
  };
  media.addEventListener('change', () => settings.theme === 'auto' && applySettings());
  globalThis.chrome?.storage?.onChanged?.addListener((ch, area) => {
    if (area === 'local' && ch.mdvSettings) {
      settings = normalizeSettings(ch.mdvSettings.newValue);
      applySettings();
    }
  });

  // ---------- 읽던 위치 기억 ----------
  async function restorePosition() {
    if (restored) return;
    restored = true;
    if (!key || !storage || location.hash) return;
    const { mdvPos = {} } = await storage.get('mdvPos');
    const y = mdvPos[key]?.y;
    if (y > 0) scrollTo(0, y);
  }
  let posTimer;
  function rememberPosition() {
    if (!key || !storage) return;
    clearTimeout(posTimer);
    posTimer = setTimeout(async () => {
      const { mdvPos = {} } = await storage.get('mdvPos');
      mdvPos[key] = { y: Math.round(scrollY), t: Date.now() };
      const keys = Object.keys(mdvPos);
      if (keys.length > POS_LIMIT) {
        keys.sort((a, b) => mdvPos[a].t - mdvPos[b].t).slice(0, keys.length - POS_LIMIT).forEach((k) => delete mdvPos[k]);
      }
      storage.set({ mdvPos });
    }, 400);
  }

  // ---------- 렌더링 ----------
  async function render(src, keepScroll = false) {
    const y = scrollY;
    const { meta, html } = renderMarkdown(src);
    doc.innerHTML = html;
    raw.textContent = src;

    const metaBox = $('.mdv-meta');
    if (meta?.length) {
      metaBox.hidden = !raw.hidden;
      metaBox.innerHTML = '<dl>' + meta.map(() => '<dt></dt><dd></dd>').join('') + '</dl>';
      metaBox.querySelectorAll('dt').forEach((n, i) => (n.textContent = meta[i][0]));
      metaBox.querySelectorAll('dd').forEach((n, i) => (n.textContent = meta[i][1]));
      const tt = meta.find(([k]) => k === 'title');
      if (tt) setTitle(tt[1]);
    } else {
      metaBox.hidden = true;
      metaBox.innerHTML = '';
    }

    enhanceHeadings();
    enhanceCode();
    enhanceTables();
    enhanceImages();
    enhanceLinks();
    updateStats();
    const diagrams = renderDiagrams();
    if (keepScroll) scrollTo(0, y);
    else if (location.hash) setTimeout(() => document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView(), 50);
    // 다이어그램이 그려진 뒤에야 문서 높이가 확정되므로 그 다음에 위치 복원
    await diagrams;
    if (!keepScroll) await restorePosition();
  }

  function updateStats() {
    const text = doc.textContent;
    const docLang = detectDocLang(text);
    if (docLang) doc.setAttribute('lang', docLang);
    else doc.removeAttribute('lang');
    const { chars, words, minutes } = readingStats(text);
    $('.mdv-stats').textContent = t.stats(chars, words, minutes);
  }

  let headings = [];
  function enhanceHeadings() {
    const used = new Set();
    headings = [...doc.querySelectorAll('h1, h2, h3, h4')].filter((h) => !h.closest('.footnotes'));
    tocNav.innerHTML = '';
    const minLevel = Math.min(...headings.map((h) => +h.tagName[1]), 6);
    for (const h of headings) {
      h.id = slugify(h.textContent, used);
      const a = el('a', { class: 'mdv-anchor', href: '#' + h.id, title: t.headingLink }, '#');
      a.addEventListener('click', (e) => {
        e.preventDefault();
        history.replaceState(null, '', '#' + h.id);
        h.scrollIntoView({ behavior: 'smooth' });
        copyText(location.href);
        toast(t.linkCopied);
      });
      h.prepend(a);
      const item = el('a', { href: '#' + h.id, class: `lv${+h.tagName[1] - minLevel}` });
      item.textContent = h.textContent.replace(/^#/, '');
      item.addEventListener('click', (e) => {
        e.preventDefault();
        history.replaceState(null, '', '#' + h.id);
        h.scrollIntoView({ behavior: 'smooth' });
      });
      tocNav.append(item);
    }
    root.classList.toggle('no-toc', headings.length < 2 && $('.mdv-files').hidden);
    spy();
  }

  function enhanceCode() {
    for (const pre of doc.querySelectorAll('pre')) {
      const code = pre.querySelector('code');
      if (!code) continue;
      const lang = (code.className.match(/language-(\S+)/) || [])[1] || '';
      if (lang === 'mermaid') {
        const box = el('div', { class: 'mdv-mermaid', 'data-loading': t.dLoading });
        box.dataset.src = code.textContent;
        pre.replaceWith(box);
        continue;
      }
      const wrap = el('div', { class: 'mdv-code' });
      const lines = code.textContent.replace(/\n$/, '').split('\n').length;
      const head = el('div', { class: 'mdv-code-head' });
      head.innerHTML = `
        <span class="mdv-lang"></span>
        <span class="mdv-code-lines">${t.lines(lines)}</span>
        <button class="mdv-mini" data-code="wrap" title="${t.wrap}">${svg('wrap', 15)}</button>
        <button class="mdv-mini" data-code="copy" title="${t.copy}">${svg('copy', 15)}</button>`;
      head.querySelector('.mdv-lang').textContent = lang || 'text';
      pre.replaceWith(wrap);
      wrap.append(head, pre);
      head.addEventListener('click', async (e) => {
        const b = e.target.closest('button');
        if (!b) return;
        if (b.dataset.code === 'wrap') wrap.classList.toggle('wrapped');
        if (b.dataset.code === 'copy') {
          await copyText(code.textContent);
          b.innerHTML = svg('check', 15);
          b.classList.add('ok');
          setTimeout(() => ((b.innerHTML = svg('copy', 15)), b.classList.remove('ok')), 1400);
        }
      });
    }
  }

  function enhanceTables() {
    for (const tb of doc.querySelectorAll('table')) {
      const w = el('div', { class: 'mdv-table' });
      tb.replaceWith(w);
      w.append(tb);
    }
  }

  function enhanceImages() {
    for (const img of doc.querySelectorAll('img')) {
      img.loading = 'lazy';
      img.addEventListener('click', () => openModal(img.cloneNode()));
      const src = img.getAttribute('src');
      if (resolveAsset && isRelative(src)) {
        img.dataset.src = src;
        resolveAsset(src).then((url) => {
          if (url) img.src = url;
          else img.classList.add('mdv-img-missing'), (img.title = t.imgNeedFolder);
        });
      }
    }
  }

  function enhanceLinks() {
    for (const a of doc.querySelectorAll('a[href]')) {
      const href = a.getAttribute('href');
      if (/^https?:/i.test(href)) (a.target = '_blank'), (a.rel = 'noopener noreferrer');
      else if (onLink && isRelative(href))
        a.addEventListener('click', (e) => {
          if (onLink(href)) e.preventDefault();
        });
    }
  }

  // ---------- Mermaid ----------
  async function renderDiagrams() {
    const boxes = doc.querySelectorAll('.mdv-mermaid');
    if (!boxes.length) return;
    const gen = ++renderGen; // 테마를 연달아 바꾸면 이전 렌더링 결과는 버린다
    let mermaid = globalThis.mermaid;
    if (!mermaid && loadMermaid) {
      try {
        mermaid = await loadMermaid();
      } catch {}
    }
    if (gen !== renderGen) return;
    if (!mermaid) {
      boxes.forEach((b) => (b.innerHTML = `<div class="mdv-diagram-error">${t.dNoLib}</div>`));
      return;
    }
    const theme = effectiveTheme();
    const v = MERMAID_VARS[theme];
    const pie = Object.fromEntries(PIE[theme].map((c, i) => [`pie${i + 1}`, c]));
    Object.assign(pie, { pieStrokeColor: v.background, pieStrokeWidth: '2px', pieOuterStrokeColor: v.background, pieSectionTextColor: '#ffffff', pieTitleTextColor: v.textColor, pieLegendTextColor: v.textColor, pieOpacity: '0.95' });
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: 'base',
      // SVG 라벨만 사용 (foreignObject 가 있으면 PNG 변환 시 캔버스가 오염돼 저장 불가)
      htmlLabels: false,
      flowchart: { curve: 'basis', htmlLabels: false },
      themeVariables: { ...v, ...pie, fontFamily: getComputedStyle(root).getPropertyValue('--mdv-sans') || 'sans-serif', fontSize: '14px' },
    });
    for (const box of boxes) {
      const src = box.dataset.src;
      try {
        const { svg: out } = await mermaid.render(`mdv-mmd-${++mermaidSeq}`, src);
        if (gen !== renderGen) return;
        box.innerHTML = `
          <div class="mdv-diagram-tools">
            <button class="mdv-mini" data-d="code" title="${t.dCode}">${svg('code', 15)}</button>
            <button class="mdv-mini" data-d="copy" title="${t.dCopy}">${svg('copy', 15)}</button>
            <button class="mdv-mini" data-d="svg" title="${t.dSvg}">${svg('download', 15)}</button>
            <button class="mdv-mini" data-d="png" title="${t.dPng}">${svg('image', 15)}</button>
            <button class="mdv-mini" data-d="zoom" title="${t.dZoom}">${svg('expand', 15)}</button>
          </div>
          <div class="mdv-diagram">${out}</div>
          <pre class="mdv-diagram-src" hidden></pre>`;
        box.querySelector('.mdv-diagram-src').textContent = src;
      } catch (err) {
        if (gen !== renderGen) return;
        box.innerHTML = `<div class="mdv-diagram-error"><strong>${t.dError}</strong><pre></pre><pre class="src"></pre></div>`;
        const pres = box.querySelectorAll('pre');
        pres[0].textContent = String(err?.message || err).trim();
        pres[1].textContent = src;
        document.getElementById(`dmdv-mmd-${mermaidSeq}`)?.remove();
      }
    }
  }

  const diagramSvg = (box) => {
    const s = box.querySelector('.mdv-diagram svg').cloneNode(true);
    s.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    return s;
  };

  async function savePng(box, name) {
    const s = diagramSvg(box);
    const vb = s.viewBox.baseVal;
    const w = vb?.width || box.querySelector('.mdv-diagram svg').getBoundingClientRect().width;
    const h = vb?.height || box.querySelector('.mdv-diagram svg').getBoundingClientRect().height;
    const scale = 2;
    s.setAttribute('width', w);
    s.setAttribute('height', h);
    const img = new Image();
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s.outerHTML);
    await img.decode();
    const c = el('canvas');
    c.width = Math.ceil(w * scale);
    c.height = Math.ceil(h * scale);
    const ctx = c.getContext('2d');
    ctx.fillStyle = getComputedStyle(root).getPropertyValue('--paper') || '#fff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0, w, h);
    const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
    if (!blob) throw new Error('toBlob');
    download(blob, name);
  }

  doc.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-d]');
    const box = e.target.closest('.mdv-mermaid');
    if (!box) return;
    if (!b) {
      if (e.target.closest('.mdv-diagram')) openModal(box.querySelector('.mdv-diagram svg').cloneNode(true));
      return;
    }
    const idx = [...doc.querySelectorAll('.mdv-mermaid')].indexOf(box) + 1;
    const base = `${docTitle.replace(/\.[^.]+$/, '').replace(/[\\/:*?"<>|]+/g, '_')}-diagram-${idx}`;
    const act = b.dataset.d;
    if (act === 'code') box.querySelector('.mdv-diagram-src').hidden ^= true;
    if (act === 'copy') (await copyText(box.dataset.src), toast(t.dCopied));
    if (act === 'zoom') openModal(box.querySelector('.mdv-diagram svg').cloneNode(true));
    if (act === 'svg') download(new Blob([diagramSvg(box).outerHTML], { type: 'image/svg+xml' }), base + '.svg');
    if (act === 'png') savePng(box, base + '.png').catch(() => toast(t.pngFail));
  });

  // ---------- HTML 내보내기 ----------
  async function exportHtml() {
    const css = await (await fetch(assetUrl('viewer.css'))).text();
    let katexCss = await (await fetch(assetUrl('vendor/katex/katex.min.css'))).text();
    // 수식 글꼴은 내보낸 파일에서 CDN 으로 참조 (확장 내부 경로는 밖에서 열 수 없음)
    katexCss = katexCss.replace(/url\(fonts\//g, `url(https://cdn.jsdelivr.net/npm/katex@${KATEX_VERSION}/dist/fonts/`);
    const clone = doc.cloneNode(true);
    clone.querySelectorAll('.mdv-anchor, .mdv-diagram-tools, .mdv-code-head .mdv-mini, .mdv-diagram-src').forEach((n) => n.remove());
    // blob: 이미지(폴더 모드)는 data URL 로 바꿔 파일 하나로 완결
    for (const img of clone.querySelectorAll('img')) {
      if (img.src.startsWith('blob:')) {
        try {
          const blob = await (await fetch(img.src)).blob();
          img.src = await new Promise((r) => {
            const fr = new FileReader();
            fr.onload = () => r(fr.result);
            fr.readAsDataURL(blob);
          });
        } catch {}
      } else if (img.dataset.src) img.setAttribute('src', img.dataset.src);
      img.removeAttribute('data-src');
    }
    const meta = $('.mdv-meta').hidden ? '' : $('.mdv-meta').outerHTML;
    const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
    const html = `<!doctype html>
<html lang="${document.documentElement.lang || lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(docTitle)}</title>
<style>${katexCss}</style>
<style>${css}
.mdv-main { padding-top: 48px; }</style>
</head>
<body class="mdv-body">
<div class="mdv no-toc" data-theme="${root.dataset.theme}" data-width="${root.dataset.width}" data-font="${root.dataset.font}" style="--mdv-font-size:${settings.fontSize}px">
<main class="mdv-main">${meta}${clone.outerHTML}</main>
</div>
</body>
</html>`;
    download(new Blob([html], { type: 'text/html;charset=utf-8' }), docTitle.replace(/\.[^.]+$/, '').replace(/[\\/:*?"<>|]+/g, '_') + '.html');
    toast(t.exported);
  }

  // ---------- 확대 모달 (휠 줌·드래그 이동) ----------
  let zoom = { s: 1, x: 0, y: 0 };
  const applyZoom = () => (canvas.style.transform = `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.s})`);
  function openModal(node) {
    canvas.innerHTML = '';
    if (node.tagName.toLowerCase() === 'svg') {
      node.removeAttribute('width');
      node.style.maxWidth = 'none';
      node.style.maxHeight = 'none';
      node.style.width = Math.min(innerWidth * 0.9, Math.max(600, node.viewBox?.baseVal?.width || 800)) + 'px';
      node.style.height = 'auto';
    }
    canvas.append(node);
    zoom = { s: 1, x: 0, y: 0 };
    applyZoom();
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
  }
  const closeModal = () => ((modal.hidden = true), (document.body.style.overflow = ''));
  modal.addEventListener('click', (e) => {
    const b = e.target.closest('[data-modal]');
    if (b?.dataset.modal === 'close') closeModal();
    if (b?.dataset.modal === 'reset') (zoom = { s: 1, x: 0, y: 0 }), applyZoom();
  });
  const stage = $('.mdv-stage');
  stage.addEventListener('wheel', (e) => {
    e.preventDefault();
    const r = canvas.getBoundingClientRect();
    const k = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    const ns = Math.min(12, Math.max(0.2, zoom.s * k));
    const f = ns / zoom.s;
    // 커서 위치를 기준점으로 확대
    zoom.x += (e.clientX - r.left - r.width / 2) * (1 - f);
    zoom.y += (e.clientY - r.top - r.height / 2) * (1 - f);
    zoom.s = ns;
    applyZoom();
  }, { passive: false });
  let drag = null;
  stage.addEventListener('pointerdown', (e) => {
    drag = { x: e.clientX - zoom.x, y: e.clientY - zoom.y, moved: false, onStage: e.target === stage };
    stage.setPointerCapture(e.pointerId);
  });
  stage.addEventListener('pointermove', (e) => {
    if (!drag) return;
    zoom.x = e.clientX - drag.x;
    zoom.y = e.clientY - drag.y;
    drag.moved = true;
    applyZoom();
  });
  stage.addEventListener('pointerup', () => {
    // 빈 배경을 클릭(드래그 아님)하면 닫기
    if (drag && !drag.moved && drag.onStage) closeModal();
    drag = null;
  });
  stage.addEventListener('dblclick', () => ((zoom = { s: 1, x: 0, y: 0 }), applyZoom()));

  // ---------- 스크롤: 진행바·목차 하이라이트·맨위로·위치 기억 ----------
  function spy() {
    const max = document.documentElement.scrollHeight - innerHeight;
    $('.mdv-progress span').style.width = (max > 0 ? (scrollY / max) * 100 : 0) + '%';
    $('.mdv-totop').classList.toggle('show', scrollY > 600);
    let active = headings[0];
    for (const h of headings) if (h.getBoundingClientRect().top < 120) active = h;
    tocNav.querySelectorAll('a').forEach((a) => {
      const on = !!active && a.getAttribute('href') === '#' + active.id;
      a.classList.toggle('active', on);
      if (on && !a.dataset.seen) {
        tocNav.querySelectorAll('[data-seen]').forEach((x) => delete x.dataset.seen);
        a.dataset.seen = 1;
        // scrollIntoView 는 페이지까지 스크롤해 본문 이동을 끊으므로 목차 영역만 직접 스크롤
        const box = tocNav.closest('.mdv-toc');
        const r = a.getBoundingClientRect();
        const b = box.getBoundingClientRect();
        if (r.top < b.top + 40) box.scrollTop -= b.top + 40 - r.top;
        else if (r.bottom > b.bottom - 20) box.scrollTop += r.bottom - b.bottom + 20;
      }
    });
  }
  addEventListener('scroll', () => {
    requestAnimationFrame(spy);
    if (restored || !key) rememberPosition();
  }, { passive: true });
  $('.mdv-totop').addEventListener('click', () => scrollTo({ top: 0, behavior: 'smooth' }));

  // ---------- 상단바 버튼 ----------
  const actions = {
    toc: () => update({ toc: !settings.toc }),
    theme: () => {
      const th = nextTheme(settings.theme, media.matches);
      // 자동이면 지금 실제로 적용된 테마도 함께 표시
      const label = th === 'auto' ? `${t.themeName.auto} (${t.themeName[media.matches ? 'dark' : 'light']})` : t.themeName[th];
      update({ theme: th }, t.themeToast(label));
    },
    width: () => {
      const w = WIDTHS[(WIDTHS.indexOf(settings.width) + 1) % WIDTHS.length];
      update({ width: w }, t.widthToast(t.widthName[w]));
    },
    family: () => update({ font: settings.font === 'sans' ? 'serif' : 'sans' }, settings.font === 'sans' ? t.serif : t.sans),
    'font+': () => update({ fontSize: Math.min(26, settings.fontSize + 1) }),
    'font-': () => update({ fontSize: Math.max(12, settings.fontSize - 1) }),
    font0: () => update({ fontSize: DEFAULTS.fontSize }, t.fontResetToast),
    raw: () => {
      const showRaw = raw.hidden;
      raw.hidden = !showRaw;
      doc.hidden = showRaw;
      $('.mdv-meta').hidden = showRaw || !$('.mdv-meta').innerHTML;
      root.querySelector('[data-act="raw"]').classList.toggle('on', showRaw);
      toast(showRaw ? t.rawOn : t.rawOff);
    },
    export: () => exportHtml(),
    print: () => print(),
    help: () => ($('.mdv-help').hidden ^= true),
  };
  $('.mdv-topbar').addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (b && actions[b.dataset.act]) actions[b.dataset.act]();
  });
  $('.mdv-help').addEventListener('click', () => ($('.mdv-help').hidden = true));

  const jump = (dir) => {
    const tops = headings.map((h) => h.getBoundingClientRect().top);
    // 제목은 scroll-margin 으로 화면 위 약 72px 에 멈추므로 그 근처는 '현재 제목'으로 본다
    const target = dir > 0 ? headings[tops.findIndex((v) => v > 100)] : headings[tops.findLastIndex((v) => v < 40)];
    target?.scrollIntoView({ behavior: 'smooth' });
  };

  addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || /input|textarea|select/i.test(e.target.tagName)) return;
    if (e.key === 'Escape') {
      closeModal();
      $('.mdv-help').hidden = true;
      return;
    }
    const map = { t: 'toc', d: 'theme', r: 'raw', w: 'width', f: 'family', e: 'export', '+': 'font+', '=': 'font+', '-': 'font-', '?': 'help' };
    const k = e.key.toLowerCase();
    if (map[k]) actions[map[k]]();
    else if (k === 'j') jump(1);
    else if (k === 'k') jump(-1);
    else if (k === 'g') scrollTo({ top: 0, behavior: 'smooth' });
    else return;
    e.preventDefault();
  });

  // ---------- 시작 ----------
  const ready = (async () => {
    const saved = storage ? (await storage.get('mdvSettings')).mdvSettings : null;
    settings = normalizeSettings(saved);
    applySettings(false);
    await render(current);
  })();

  return {
    root,
    ready,
    filesPanel: $('.mdv-files'),
    setTitle,
    toast,
    update(src) {
      if (src === current) return;
      current = src;
      render(src, true);
      toast(t.reloaded);
    },
    async load(src, name, newKey) {
      current = src;
      key = newKey;
      restored = false;
      if (name) setTitle(name);
      raw.hidden = true;
      doc.hidden = false;
      root.querySelector('[data-act="raw"]').classList.remove('on');
      scrollTo(0, 0);
      await render(src);
    },
  };
}
