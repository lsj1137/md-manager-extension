import { describe, expect, test } from 'bun:test';
import { renderMarkdown, splitFrontMatter, slugify, fixMojibake, decodeBytes } from '../../src/render.js';

const html = (md) => renderMarkdown(md).html;
const dom = (md) => {
  const d = document.createElement('div');
  d.innerHTML = html(md);
  return d;
};

describe('front matter', () => {
  test('없으면 원문 그대로', () => {
    expect(splitFrontMatter('# hi')).toEqual({ meta: null, body: '# hi' });
  });
  test('key: value 파싱, 따옴표 제거', () => {
    const { meta, body } = splitFrontMatter('---\ntitle: "제목"\ntags: a, b\n---\n# 본문');
    expect(meta).toEqual([['title', '제목'], ['tags', 'a, b']]);
    expect(body).toBe('# 본문');
  });
  test('BOM·CRLF 처리', () => {
    const { meta, body } = splitFrontMatter('﻿---\r\ntitle: x\r\n---\r\nbody');
    expect(meta).toEqual([['title', 'x']]);
    expect(body).toBe('body');
  });
  test('여러 줄 값은 이어붙임', () => {
    const { meta } = splitFrontMatter('---\ndesc: one\n  two\n---\n');
    expect(meta).toEqual([['desc', 'one two']]);
  });
  test('본문 중간의 --- 는 front matter 아님', () => {
    expect(splitFrontMatter('# a\n---\nb: c\n---\n').meta).toBeNull();
  });
});

describe('GFM 렌더링', () => {
  test('표 정렬 속성', () => {
    const d = dom('| a | b | c |\n|:--|:-:|--:|\n| 1 | 2 | 3 |');
    const th = d.querySelectorAll('th');
    expect(th.length).toBe(3);
    expect(th[1].getAttribute('align')).toBe('center');
    expect(th[2].getAttribute('align')).toBe('right');
  });
  test('체크리스트는 비활성 체크박스', () => {
    const boxes = dom('- [x] done\n- [ ] todo').querySelectorAll('input[type="checkbox"]');
    expect(boxes.length).toBe(2);
    expect(boxes[0].hasAttribute('checked')).toBe(true);
    expect(boxes[1].hasAttribute('checked')).toBe(false);
    expect(boxes[0].hasAttribute('disabled')).toBe(true);
  });
  test('취소선·자동링크', () => {
    const d = dom('~~del~~ https://example.com');
    expect(d.querySelector('del').textContent).toBe('del');
    expect(d.querySelector('a').getAttribute('href')).toBe('https://example.com');
  });
  test('각주', () => {
    const d = dom('본문[^1]\n\n[^1]: 설명');
    expect(d.querySelector('[data-footnote-ref]')).not.toBeNull();
    expect(d.querySelector('.footnotes li').textContent).toContain('설명');
  });
  test.each(['NOTE', 'TIP', 'IMPORTANT', 'WARNING', 'CAUTION'])('알림 박스 %s', (kind) => {
    const d = dom(`> [!${kind}]\n> 내용`);
    expect(d.querySelector(`.markdown-alert-${kind.toLowerCase()}`)).not.toBeNull();
  });
  test('raw HTML details 유지', () => {
    expect(dom('<details><summary>s</summary>\n\nx\n\n</details>').querySelector('details summary')).not.toBeNull();
  });
});

describe('코드·수식·다이어그램', () => {
  test('언어 지정 하이라이트', () => {
    const d = dom('```java\npublic class A {}\n```');
    expect(d.querySelector('code.language-java .hljs-keyword')).not.toBeNull();
  });
  test('모르는 언어도 깨지지 않음', () => {
    expect(dom('```nosuchlang\nfoo bar\n```').querySelector('pre code').textContent).toContain('foo bar');
  });
  test('mermaid 블록은 원문 그대로 보존 (하이라이트 X)', () => {
    const src = 'flowchart LR\n  A["<b>x</b>"] --> B';
    const code = dom('```mermaid\n' + src + '\n```').querySelector('code.language-mermaid');
    expect(code.textContent.trim()).toBe(src);
    expect(code.querySelector('span')).toBeNull();
  });
  test('KaTeX 인라인·블록', () => {
    const d = dom('a $x^2$ b\n\n$$\n\\frac{1}{2}\n$$');
    expect(d.querySelectorAll('.katex').length).toBeGreaterThanOrEqual(2);
    expect(d.querySelector('.katex-display')).not.toBeNull();
  });
  test('잘못된 수식도 예외 없이 렌더', () => {
    expect(() => html('$\\frac{$')).not.toThrow();
  });
});

describe('XSS 방어', () => {
  test('script 제거', () => {
    expect(html('<script>alert(1)</script>')).not.toContain('<script');
  });
  test('이벤트 핸들러 속성 제거', () => {
    const out = html('<img src=x onerror="alert(1)"><svg onload="alert(1)"></svg>');
    expect(out).not.toMatch(/onerror|onload/i);
  });
  test('javascript: 링크 제거', () => {
    expect(html('[x](javascript:alert(1))')).not.toMatch(/javascript:/i);
    expect(html('<a href="javascript:alert(1)">x</a>')).not.toMatch(/javascript:/i);
  });
  test('iframe·object 제거', () => {
    expect(html('<iframe src="https://e.com"></iframe><object data="x"></object>')).not.toMatch(/<iframe|<object/i);
  });
});

describe('slugify', () => {
  test('한글·공백·기호', () => {
    expect(slugify('Mermaid 다이어그램!', new Set())).toBe('mermaid-다이어그램');
  });
  test('중복은 -1, -2', () => {
    const used = new Set();
    expect([slugify('A', used), slugify('A', used), slugify('A', used)]).toEqual(['a', 'a-1', 'a-2']);
  });
  test('기호뿐이면 section', () => {
    expect(slugify('!!!', new Set())).toBe('section');
  });
});

describe('인코딩', () => {
  const utf8 = new TextEncoder();
  test('UTF-8 이 windows-1252 로 깨진 한글 복구', () => {
    const original = '한글 마크다운 — “따옴표” 테스트 ✓';
    const broken = new TextDecoder('windows-1252').decode(utf8.encode(original));
    expect(broken).not.toBe(original);
    expect(fixMojibake(broken)).toBe(original);
  });
  test('정상 문자열은 건드리지 않음', () => {
    for (const s of ['hello', '한글 정상', 'café au lait', 'Ä Ö Ü ß']) expect(fixMojibake(s)).toBe(s);
  });
  test('decodeBytes: UTF-8', () => {
    expect(decodeBytes(utf8.encode('한글 abc'))).toBe('한글 abc');
  });
  test('decodeBytes: UTF-8 아니면 EUC-KR', () => {
    expect(decodeBytes(new Uint8Array([0xc7, 0xd1, 0xb1, 0xdb]))).toBe('한글');
  });
});
