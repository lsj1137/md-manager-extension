// 마크다운 → 안전한 HTML 변환 (GFM·코드하이라이트·수식·각주·알림)
import { Marked } from 'marked';
import { markedHighlight } from 'marked-highlight';
import markedFootnote from 'marked-footnote';
import markedAlert from 'marked-alert';
import markedKatex from 'marked-katex-extension';
import hljs from 'highlight.js';
import DOMPurify from 'dompurify';

const escapeHtml = (s) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const marked = new Marked(
  markedHighlight({
    langPrefix: 'hljs language-',
    highlight(code, lang) {
      // mermaid 는 하이라이트하지 않고 원문 그대로 둔다 (후처리에서 다이어그램으로 교체)
      if (lang === 'mermaid' || lang === 'math') return escapeHtml(code);
      if (lang && hljs.getLanguage(lang)) return hljs.highlight(code, { language: lang }).value;
      return hljs.highlightAuto(code).value;
    },
  }),
  markedFootnote({ description: '각주' }),
  markedAlert(),
  markedKatex({ throwOnError: false, nonStandard: true, output: 'htmlAndMathml' }),
  { gfm: true, breaks: false }
);

// YAML front matter 를 단순 key: value 로 분리
export function splitFrontMatter(src) {
  const m = src.match(/^﻿?---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { meta: null, body: src };
  const meta = [];
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([\w가-힣.-]+)\s*:\s*(.*)$/);
    if (kv) meta.push([kv[1], kv[2].replace(/^["']|["']$/g, '')]);
    else if (meta.length && line.trim()) meta[meta.length - 1][1] += ' ' + line.trim();
  }
  return { meta, body: src.slice(m[0].length) };
}

export function renderMarkdown(src) {
  const { meta, body } = splitFrontMatter(src);
  const html = marked.parse(body);
  // 정화기를 쓸 수 없는 환경이면 렌더링 대신 원문을 이스케이프해서 보여준다 (fail-closed)
  if (!DOMPurify.isSupported) return { meta, html: `<pre>${escapeHtml(src)}</pre>` };
  const clean = DOMPurify.sanitize(html, {
    ADD_TAGS: ['input', 'section'],
    ADD_ATTR: ['checked', 'disabled', 'type', 'aria-hidden', 'data-footnote-ref', 'data-footnote-backref', 'data-footnotes'],
  });
  return { meta, html: clean };
}

// 한글 포함 헤딩 슬러그 (GitHub 방식과 유사)
export function slugify(text, used) {
  let base = text.trim().toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s+/g, '-') || 'section';
  let slug = base, i = 1;
  while (used.has(slug)) slug = `${base}-${i++}`;
  used.add(slug);
  return slug;
}

// 깨진 인코딩 복구: UTF-8 바이트가 windows-1252 로 해석된 경우 되돌린다
const CP1252 = { 0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x02c6: 0x88, 0x2030: 0x89, 0x0160: 0x8a, 0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92, 0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b, 0x0153: 0x9c, 0x017e: 0x9e, 0x0178: 0x9f };

export function fixMojibake(text) {
  if (!/[À-ï][\u0080-¿‘-›€Œ-ƒˆ˜]/.test(text)) return text;
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c < 0x100) bytes[i] = c;
    else if (CP1252[c] !== undefined) bytes[i] = CP1252[c];
    else return text; // 1252 로 표현 불가한 문자가 있으면 원문 유지
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return text;
  }
}

// 바이트 → 문자열 (UTF-8 우선, 실패 시 EUC-KR)
export function decodeBytes(buf) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    return new TextDecoder('euc-kr').decode(buf);
  }
}
