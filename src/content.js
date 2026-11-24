// 브라우저로 연 .md 파일(file:// · 허용 시 http/https)을 뷰어로 교체하는 콘텐츠 스크립트
import { createViewer } from './app.js';
import { fixMojibake, decodeBytes } from './render.js';

const MD_PATH = /\.(md|markdown|mdown|mkd|mdx)$/i;
const TEXT_TYPES = /^(text\/(plain|markdown|x-markdown)|application\/octet-stream)$/i;

export function isRawMarkdownPage(doc = document, loc = location) {
  let path;
  try {
    path = decodeURIComponent(loc.pathname);
  } catch {
    path = loc.pathname;
  }
  if (!MD_PATH.test(path)) return false;
  if (!TEXT_TYPES.test(doc.contentType)) return false;
  // 브라우저 기본 텍스트 보기는 <body><pre>원문</pre></body> 구조 (GitHub 등 HTML 페이지는 제외)
  const kids = doc.body?.children || [];
  return kids.length === 0 || (kids.length === 1 && kids[0].tagName === 'PRE');
}

function addStyle(path) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = chrome.runtime.getURL(path);
  document.head.append(link);
}

// mermaid(약 3MB)는 다이어그램이 있는 문서에서만 백그라운드에 주입 요청
let mermaidPromise;
const loadMermaid = () =>
  (mermaidPromise ||= chrome.runtime.sendMessage({ type: 'mdv:loadMermaid' }).then(() => {
    if (!globalThis.mermaid) throw new Error('mermaid not injected');
    return globalThis.mermaid;
  }));

function boot() {
  if (document.documentElement.dataset.mdv || !isRawMarkdownPage()) return;
  document.documentElement.dataset.mdv = '1'; // 정적·동적 등록이 겹쳐도 한 번만 실행
  const source = fixMojibake(document.body.querySelector('pre')?.textContent ?? document.body.textContent);
  let name = location.pathname.split('/').pop();
  try {
    name = decodeURIComponent(name);
  } catch {}

  document.head.innerHTML = '<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">';
  addStyle('vendor/katex/katex.min.css');
  addStyle('viewer.css');
  document.body.innerHTML = '';
  document.body.className = 'mdv-body';
  const root = document.createElement('div');
  root.className = 'mdv';
  document.body.append(root);

  const viewer = createViewer({ root, title: name, source, posKey: location.href.split('#')[0], loadMermaid });
  watch(viewer, source);
}

// 파일 변경 감지: 같은 주소를 주기적으로 다시 읽어본다 (브라우저가 막으면 조용히 포기)
async function watch(viewer, initial) {
  let last = initial;
  const read = async () => {
    const res = await fetch(location.href, { cache: 'no-store' });
    if (!res.ok && res.status !== 0) throw new Error(res.status);
    return decodeBytes(await res.arrayBuffer());
  };
  try {
    await read();
  } catch {
    return;
  }
  setInterval(async () => {
    if (document.hidden) return;
    try {
      const text = await read();
      if (text !== last) {
        last = text;
        viewer.update(text);
      }
    } catch {}
  }, 1500);
}

boot();
