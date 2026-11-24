// 빌드 결과물(dist·release) 검증 — `bun scripts/build.js` 이후 실행
import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '../..');
const DIST = join(ROOT, 'dist');
const manifest = JSON.parse(readFileSync(join(DIST, 'manifest.json'), 'utf8'));
const locales = readdirSync(join(DIST, '_locales')).map((l) => [l, JSON.parse(readFileSync(join(DIST, `_locales/${l}/messages.json`), 'utf8'))]);

const walk = (dir) => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? walk(join(dir, f)) : [join(dir, f)]));

describe('manifest', () => {
  test('MV3 필수 항목', () => {
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(manifest.background.service_worker).toBe('background.js');
  });
  test('참조 파일이 모두 존재', () => {
    const files = [
      ...Object.values(manifest.icons),
      manifest.action.default_popup,
      manifest.background.service_worker,
      ...manifest.content_scripts.flatMap((c) => c.js),
      'viewer.html', 'viewer.js', 'popup.js', 'vendor/mermaid.min.js', 'vendor/katex/katex.min.css', 'LICENSE', 'THIRD_PARTY_NOTICES.txt',
    ];
    for (const f of files) expect(existsSync(join(DIST, f))).toBe(true);
    for (const r of manifest.web_accessible_resources.flatMap((w) => w.resources)) {
      const dir = join(DIST, r.replace(/\/?\*$/, ''));
      expect(existsSync(dir)).toBe(true);
    }
  });
  test('기본 권한은 최소: 웹 접근은 선택 권한, 정적 콘텐츠 스크립트는 file:// 만', () => {
    expect(manifest.permissions.sort()).toEqual(['scripting', 'storage']);
    expect(manifest.host_permissions).toEqual(['file:///*']);
    expect(manifest.optional_host_permissions.sort()).toEqual(['http://*/*', 'https://*/*']);
    for (const cs of manifest.content_scripts) expect(cs.matches).toEqual(['file:///*']);
  });
  test('mermaid 는 정적 주입하지 않음 (지연 로드)', () => {
    for (const cs of manifest.content_scripts) expect(cs.js.join()).not.toContain('mermaid');
  });
  test('다국어: 키 일치·길이 제한', () => {
    expect(manifest.name).toBe('__MSG_name__');
    expect(existsSync(join(DIST, `_locales/${manifest.default_locale}`))).toBe(true);
    expect(locales.map(([l]) => l).sort()).toEqual(['de', 'en', 'es', 'fr', 'ja', 'ko', 'zh_CN', 'zh_TW']);
    const en = Object.fromEntries(locales).en;
    for (const [l, m] of locales) expect([l, Object.keys(m).sort()]).toEqual([l, Object.keys(en).sort()]);
    for (const [, m] of locales) {
      expect(m.name.message.length).toBeLessThanOrEqual(75);
      expect(m.description.message.length).toBeLessThanOrEqual(132);
    }
  });
});

describe('번들', () => {
  // Chrome 은 U+FFFE/FFFF·U+FDD0~FDEF 같은 비문자가 있으면 "UTF-8 아님"으로 로드를 거부한다 (실제 발생했던 문제)
  test.each(['content.js', 'viewer.js', 'background.js', 'popup.js'])('%s 는 순수 ASCII', (f) => {
    const s = readFileSync(join(DIST, f), 'utf8');
    expect(/[^\x00-\x7e]/.test(s)).toBe(false);
  });
  test('vendor 스크립트에 Chrome 거부 문자 없음', () => {
    const s = readFileSync(join(DIST, 'vendor/mermaid.min.js'), 'utf8');
    expect(/[﷐-﷯￾￿]|[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/.test(s)).toBe(false);
  });
  test('서드파티 고지에 번들 라이브러리 전부', () => {
    const n = readFileSync(join(DIST, 'THIRD_PARTY_NOTICES.txt'), 'utf8');
    for (const lib of ['marked@', 'marked-highlight@', 'marked-footnote@', 'marked-alert@', 'marked-katex-extension@', 'katex@', 'highlight.js@', 'dompurify@', 'mermaid@']) expect(n).toContain(lib);
  });
  test('릴리스 zip 존재', () => {
    expect(existsSync(join(ROOT, `release/md-viewer-${manifest.version}.zip`))).toBe(true);
  });
});

// 금지어 목록은 공개 저장소에 올리지 않는 로컬 파일(tests/private-terms.txt, 한 줄에 정규식 하나)에서 읽는다
const TERMS_FILE = join(ROOT, 'tests/private-terms.txt');
const TERM_LINES = existsSync(TERMS_FILE) ? readFileSync(TERMS_FILE, 'utf8').split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#')) : [];
describe.skipIf(!TERM_LINES.length)('공개 자료에 비공개 정보 없음', () => {
  const TERMS = new RegExp(TERM_LINES.join('|'), 'i');
  const targets = [
    ...walk(DIST).filter((f) => /\.(js|html|css|json|txt)$/.test(f) && !f.includes('vendor')),
    join(ROOT, 'sample.md'), join(ROOT, 'README.md'), join(ROOT, 'docs/privacy.html'),
    ...walk(join(ROOT, 'store')).filter((f) => /\.(md|html)$/.test(f)),
  ];
  test.each(targets.map((f) => [f.slice(ROOT.length + 1), f]))('%s', (_, f) => {
    expect(TERMS.test(readFileSync(f, 'utf8'))).toBe(false);
  });
});
