// 확장 전용 뷰어 페이지: 파일/폴더 열기·드래그&드롭·붙여넣기 + 파일 변경 자동 반영
import { createViewer, svg } from './app.js';
import { decodeBytes } from './render.js';
import { t, lang } from './i18n.js';

const LANDING = { title: 'Markdown Viewer', ...t.landing };

const SKIP_DIRS = new Set(['node_modules', '.git', '.svn', 'dist', 'build', '.next', '.cache']);
const MD_FILE = /\.(md|markdown|mdown|mkd|mdx)$/i;
const MAX_FILES = 2000;
const MAX_DEPTH = 6;

const root = document.querySelector('div.mdv');
const landing = document.querySelector('.mdv-landing');
document.documentElement.lang = lang;

// ---------- 시작 화면 ----------
landing.innerHTML = `
  <div class="mdv-drop">
    <img src="icons/icon128.png" alt="" width="72" height="72">
    <h1>${LANDING.title}</h1>
    <p>${LANDING.lead}</p>
    <div class="mdv-drop-actions">
      <button class="mdv-cta" data-open="file">${svg('file', 16)} ${LANDING.openFile}</button>
      <button class="mdv-cta ghost" data-open="folder">${svg('toc', 16)} ${LANDING.openFolder}</button>
    </div>
    <p class="sub">${LANDING.sub}</p>
    <div class="chips">${LANDING.chips.map((c) => `<span>${c}</span>`).join('')}</div>
  </div>
  <input type="file" id="mdv-file" accept=".md,.markdown,.mdown,.mkd,.mdx,.txt" hidden>`;

let viewer = null;
let fileHandle = null; // 현재 파일 (자동 새로고침 대상)
let lastModified = 0;
let dir = null; // 열린 폴더 { handle, files: [{path, handle}] }
let currentPath = '';
let blobUrls = [];

// mermaid 는 다이어그램이 있을 때만 불러온다
let mermaidPromise;
const loadMermaid = () =>
  (mermaidPromise ||= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'vendor/mermaid.min.js';
    s.onload = () => resolve(globalThis.mermaid);
    s.onerror = reject;
    document.head.append(s);
  }));

// ---------- 폴더 내 경로 처리 ----------
const dirname = (p) => p.split('/').slice(0, -1).join('/');
function joinPath(base, rel) {
  const out = base ? base.split('/') : [];
  for (const part of rel.split('/')) {
    if (part === '..') out.pop();
    else if (part && part !== '.') out.push(part);
  }
  return out.join('/');
}
const cleanRel = (href) => {
  const p = href.split(/[?#]/)[0];
  try {
    return decodeURIComponent(p);
  } catch {
    return p;
  }
};

async function fileAt(path) {
  if (!dir) return null;
  const parts = path.split('/');
  let h = dir.handle;
  try {
    for (const p of parts.slice(0, -1)) h = await h.getDirectoryHandle(p);
    return await (await h.getFileHandle(parts.at(-1))).getFile();
  } catch {
    return null;
  }
}

async function resolveAsset(src) {
  const file = await fileAt(joinPath(dirname(currentPath), cleanRel(src)));
  if (!file) return null;
  const url = URL.createObjectURL(file);
  blobUrls.push(url);
  return url;
}

function onLink(href) {
  if (!dir) return false;
  const path = joinPath(dirname(currentPath), cleanRel(href));
  const entry = dir.files.find((f) => f.path === path);
  if (!entry) return false;
  openEntry(entry);
  return true;
}

async function walk(handle, prefix = '', depth = 0, out = []) {
  if (depth > MAX_DEPTH) return out;
  const entries = [];
  for await (const e of handle.values()) entries.push(e);
  entries.sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'file' ? -1 : 1));
  for (const e of entries) {
    if (out.length >= MAX_FILES) break;
    const path = prefix ? `${prefix}/${e.name}` : e.name;
    if (e.kind === 'file' && MD_FILE.test(e.name)) out.push({ path, handle: e });
    else if (e.kind === 'directory' && !SKIP_DIRS.has(e.name) && !e.name.startsWith('.')) await walk(e, path, depth + 1, out);
  }
  return out;
}

function renderFileList() {
  const panel = viewer.filesPanel;
  if (!dir) {
    panel.hidden = true;
    panel.innerHTML = '';
    return;
  }
  panel.hidden = false;
  // 제목이 적어 목차가 접혀 있어도 파일 목록이 있으면 사이드바를 보인다
  root.classList.remove('no-toc');
  panel.innerHTML = `<div class="mdv-toc-head"></div>${dir.files.length > 8 ? `<input class="mdv-files-filter" type="search" placeholder="${LANDING.filter}">` : ''}<nav></nav>`;
  panel.querySelector('.mdv-toc-head').textContent = `${LANDING.files} · ${dir.handle.name} (${dir.files.length})`;
  const nav = panel.querySelector('nav');
  // 폴더별로 묶어 파일명만 표시 (긴 경로가 반복되지 않게)
  let lastDir = null;
  for (const f of dir.files) {
    const d = dirname(f.path);
    if (d !== lastDir) {
      lastDir = d;
      if (d) {
        const h = document.createElement('div');
        h.className = 'mdv-files-dir';
        h.title = d;
        h.append(Object.assign(document.createElement('span'), { textContent: d.split('/').join(' / ') }));
        h.dataset.dir = d;
        nav.append(h);
      }
    }
    const a = document.createElement('a');
    a.href = '#';
    a.textContent = f.path.split('/').pop();
    a.title = f.path;
    a.dataset.path = f.path;
    a.dataset.dir = d;
    if (d) a.classList.add('in-dir');
    a.classList.toggle('active', f.path === currentPath);
    a.addEventListener('click', (e) => {
      e.preventDefault();
      openEntry(f);
    });
    nav.append(a);
  }
  // 현재 파일이 목록 안에 보이도록 (페이지는 움직이지 않게 목록만 스크롤)
  const active = nav.querySelector('a.active');
  if (active) nav.scrollTop = active.offsetTop - nav.offsetTop - nav.clientHeight / 2;

  const filter = panel.querySelector('.mdv-files-filter');
  filter?.addEventListener('input', () => {
    const qv = filter.value.trim().toLowerCase();
    const shownDirs = new Set();
    for (const a of nav.querySelectorAll('a')) {
      const hit = !qv || a.dataset.path.toLowerCase().includes(qv);
      a.hidden = !hit;
      if (hit) shownDirs.add(a.dataset.dir);
    }
    for (const h of nav.querySelectorAll('.mdv-files-dir')) h.hidden = !shownDirs.has(h.dataset.dir);
  });
}

// ---------- 열기 ----------
async function show(text, name, key) {
  landing.hidden = true;
  root.hidden = false;
  blobUrls.forEach(URL.revokeObjectURL);
  blobUrls = [];
  if (viewer) await viewer.load(text, name, key);
  else {
    viewer = createViewer({ root, title: name, source: text, posKey: key, loadMermaid, resolveAsset, onLink, extra: { toolbar: `<button class="mdv-btn" data-open="file" title="${LANDING.openOther}">${svg('file')}</button>` } });
    await viewer.ready;
  }
  renderFileList();
}

async function openEntry(entry) {
  currentPath = entry.path;
  fileHandle = entry.handle;
  const file = await entry.handle.getFile();
  lastModified = file.lastModified;
  await show(decodeBytes(await file.arrayBuffer()), file.name, `dir:${dir.handle.name}/${entry.path}`);
}

async function openDirectory(handle) {
  const files = await walk(handle);
  dir = { handle, files };
  const first = files.find((f) => /^readme\.md$/i.test(f.path)) || files.find((f) => /readme\.md$/i.test(f.path)) || files[0];
  if (first) await openEntry(first);
  else await show(`# ${handle.name}\n\n${LANDING.empty}`, handle.name);
}

async function openFileHandle(h) {
  dir = null;
  currentPath = '';
  fileHandle = h;
  const file = await h.getFile();
  lastModified = file.lastModified;
  await show(decodeBytes(await file.arrayBuffer()), file.name, `file:${file.name}:${file.size}`);
}

async function openPlainFile(file) {
  dir = null;
  currentPath = '';
  fileHandle = null;
  await show(decodeBytes(await file.arrayBuffer()), file.name, `file:${file.name}:${file.size}`);
}

async function pick(kind) {
  try {
    if (kind === 'folder' && window.showDirectoryPicker) return await openDirectory(await showDirectoryPicker());
    if (window.showOpenFilePicker) {
      const [h] = await showOpenFilePicker({ types: [{ description: 'Markdown', accept: { 'text/markdown': ['.md', '.markdown', '.mdown', '.mkd', '.mdx', '.txt'] } }] });
      return await openFileHandle(h);
    }
  } catch (e) {
    if (e?.name === 'AbortError') return;
  }
  document.querySelector('#mdv-file').click();
}

document.querySelector('#mdv-file').addEventListener('change', (e) => e.target.files[0] && openPlainFile(e.target.files[0]));
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-open]');
  if (b) pick(b.dataset.open);
});
addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() === 'o' && !e.ctrlKey && !e.metaKey && !/input|textarea/i.test(e.target.tagName)) pick('file');
});

// 드래그&드롭 (핸들을 얻으면 자동 새로고침까지, 폴더도 가능)
addEventListener('dragover', (e) => {
  e.preventDefault();
  document.body.classList.add('dragging');
});
addEventListener('dragleave', (e) => e.relatedTarget || document.body.classList.remove('dragging'));
addEventListener('drop', async (e) => {
  e.preventDefault();
  document.body.classList.remove('dragging');
  const item = [...e.dataTransfer.items].find((i) => i.kind === 'file');
  if (!item) return;
  const h = item.getAsFileSystemHandle ? await item.getAsFileSystemHandle() : null;
  if (h?.kind === 'directory') await openDirectory(h);
  else if (h?.kind === 'file') await openFileHandle(h);
  else await openPlainFile(item.getAsFile());
});

// 시작 화면에서 마크다운 텍스트 붙여넣기
addEventListener('paste', (e) => {
  if (landing.hidden) return;
  const text = e.clipboardData.getData('text/plain');
  if (!text.trim()) return;
  dir = null;
  fileHandle = null;
  show(text, LANDING.pasted);
});

// 파일 변경 감시
setInterval(async () => {
  if (!fileHandle || document.hidden || !viewer) return;
  try {
    const file = await fileHandle.getFile();
    if (file.lastModified !== lastModified) {
      lastModified = file.lastModified;
      viewer.update(decodeBytes(await file.arrayBuffer()));
    }
  } catch {}
}, 1000);

// 시작 화면도 저장된 테마를 따른다
globalThis.chrome?.storage?.local.get('mdvSettings').then(({ mdvSettings }) => {
  const th = mdvSettings?.theme === 'sepia' ? 'ivory' : mdvSettings?.theme || 'auto';
  const dark = th === 'dark' || (th === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  landing.dataset.theme = dark ? 'dark' : th === 'ivory' ? 'ivory' : 'light';
});

// 자동화 테스트용 진입점 (확장 전용 페이지라 외부에 노출되지 않음)
globalThis.__mdv = { openDirectory, openFileHandle, openPlainFile, get viewer() { return viewer; }, t };
