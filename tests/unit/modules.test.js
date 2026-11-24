import { describe, expect, test, mock } from 'bun:test';
import { STRINGS_ALL } from '../../src/i18n.js';

describe('i18n', () => {
  const shape = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v && typeof v === 'object' && !Array.isArray(v) ? shape(v) : Array.isArray(v) ? `array:${v.length}` : typeof v]));
  test('8개 언어 모두 키·타입·배열 길이가 영어와 같다', () => {
    expect(Object.keys(STRINGS_ALL).sort()).toEqual(['de', 'en', 'es', 'fr', 'ja', 'ko', 'zh-CN', 'zh-TW']);
    const base = shape(STRINGS_ALL.en);
    for (const [l, s] of Object.entries(STRINGS_ALL)) expect([l, shape(s)]).toEqual([l, base]);
  });
  test('빈 문구 없음, 함수형 문구는 숫자를 포함해 반환', () => {
    const walk = (o, path) => {
      for (const [k, v] of Object.entries(o)) {
        if (typeof v === 'string') expect([path + k, v.trim().length > 0]).toEqual([path + k, true]);
        else if (typeof v === 'function') expect(v(1234, 300, 7)).toMatch(/7|300|1/);
        else if (v && typeof v === 'object') walk(v, path + k + '.');
      }
    };
    for (const [l, s] of Object.entries(STRINGS_ALL)) walk(s, l + ':');
  });
  test('번역이 실제로 다름 (영어 그대로 남은 언어 없음)', () => {
    for (const l of ['ko', 'ja', 'zh-CN', 'zh-TW', 'es', 'de', 'fr']) {
      expect([l, STRINGS_ALL[l].landing.openFolder]).not.toEqual([l, STRINGS_ALL.en.landing.openFolder]);
      expect([l, STRINGS_ALL[l].themeName.ivory]).not.toEqual([l, STRINGS_ALL.en.themeName.ivory]);
    }
  });
  test('브라우저 언어 → locale', async () => {
    const { resolveLang } = await import('../../src/i18n.js');
    const cases = { 'ko-KR': 'ko', ko: 'ko', 'en-US': 'en', 'ja-JP': 'ja', 'zh-CN': 'zh-CN', zh: 'zh-CN', 'zh-SG': 'zh-CN', 'zh-TW': 'zh-TW', 'zh-HK': 'zh-TW', 'zh-Hant-TW': 'zh-TW', zh_TW: 'zh-TW', 'es-419': 'es', 'de-AT': 'de', 'fr-CA': 'fr', 'pt-BR': 'en', ru: 'en', '': 'en', undefined: 'en' };
    for (const [tag, want] of Object.entries(cases)) expect([tag, resolveLang(tag === 'undefined' ? undefined : tag)]).toEqual([tag, want]);
  });
});

describe('읽기 시간·문서 언어', () => {
  test('언어별 읽기 시간', async () => {
    const { readingStats } = await import('../../src/app.js');
    expect(readingStats('word '.repeat(460)).minutes).toBe(2); // 영어 230단어/분
    expect(readingStats('가'.repeat(900)).minutes).toBe(2); // 한글 450자/분
    expect(readingStats('漢'.repeat(900)).minutes).toBe(2); // 중국어
    expect(readingStats('あ'.repeat(900)).minutes).toBe(2); // 일본어
    expect(readingStats('漢'.repeat(450) + ' word'.repeat(230)).minutes).toBe(2); // 혼합
    expect(readingStats('').minutes).toBe(1);
  });
  test('본문 언어 추정', async () => {
    const { detectDocLang } = await import('../../src/app.js');
    expect(detectDocLang('これは日本語の文章です。漢字も含む。')).toBe('ja');
    expect(detectDocLang('한국어 문서입니다. 漢字 조금')).toBe('ko');
    expect(detectDocLang('这是一个中文文档。', 'en')).toBe('zh-CN');
    expect(detectDocLang('這是一個中文文件。', 'zh-TW')).toBe('zh-TW');
    expect(detectDocLang('Plain English text.')).toBe('');
  });
});

describe('content: .md 페이지 판정', () => {
  const fakeDoc = (type, children) => ({ contentType: type, body: { children: children.map((tagName) => ({ tagName })) } });
  const loc = (p) => ({ pathname: p });
  test('텍스트 보기 + .md 경로면 true', async () => {
    const { isRawMarkdownPage } = await import('../../src/content.js');
    expect(isRawMarkdownPage(fakeDoc('text/plain', ['PRE']), loc('/a/README.md'))).toBe(true);
    expect(isRawMarkdownPage(fakeDoc('text/markdown', ['PRE']), loc('/a/%ED%95%9C%EA%B8%80.markdown'))).toBe(true);
    expect(isRawMarkdownPage(fakeDoc('text/plain', []), loc('/x.mdx'))).toBe(true);
  });
  test('HTML 페이지(GitHub blob 등)는 false', async () => {
    const { isRawMarkdownPage } = await import('../../src/content.js');
    expect(isRawMarkdownPage(fakeDoc('text/html', ['DIV', 'DIV']), loc('/u/r/blob/main/README.md'))).toBe(false);
    expect(isRawMarkdownPage(fakeDoc('text/plain', ['PRE', 'DIV']), loc('/a.md'))).toBe(false);
  });
  test('확장자가 다르면 false, 잘못된 % 인코딩도 예외 없음', async () => {
    const { isRawMarkdownPage } = await import('../../src/content.js');
    expect(isRawMarkdownPage(fakeDoc('text/plain', ['PRE']), loc('/a.txt'))).toBe(false);
    expect(() => isRawMarkdownPage(fakeDoc('text/plain', ['PRE']), loc('/%E0%A4%A.md'))).not.toThrow();
  });
});

describe('background', () => {
  // chrome API 스텁
  const listeners = {};
  const on = (name) => ({ addListener: (fn) => (listeners[name] = fn) });
  let granted = false;
  let registered = [];
  const calls = { register: [], unregister: [], exec: [] };
  globalThis.chrome = {
    runtime: { onMessage: on('message'), onInstalled: on('installed'), onStartup: on('startup') },
    permissions: { contains: mock(async () => granted), onAdded: on('added'), onRemoved: on('removed') },
    scripting: {
      getRegisteredContentScripts: async () => registered,
      registerContentScripts: async (s) => (calls.register.push(s), (registered = s)),
      unregisterContentScripts: async (o) => (calls.unregister.push(o), (registered = [])),
      executeScript: async (o) => (calls.exec.push(o), [{}]),
    },
  };

  test('매치 패턴 형식이 올바르다', async () => {
    const { WEB_MATCHES } = await import('../../src/background.js');
    expect(WEB_MATCHES.length).toBeGreaterThan(0);
    for (const m of WEB_MATCHES) expect(m).toMatch(/^https?:\/\/\*\/\*\.[A-Za-z]+\*$/);
  });
  test('권한 있으면 등록, 회수하면 해제, 중복 등록 없음', async () => {
    await import('../../src/background.js');
    granted = true;
    await listeners.added();
    await listeners.startup();
    expect(calls.register.length).toBe(1);
    expect(calls.register[0][0].js).toEqual(['content.js']);
    granted = false;
    await listeners.removed();
    expect(calls.unregister.length).toBe(1);
  });
  test('mermaid 주입 요청 → 보낸 탭·프레임에 executeScript', async () => {
    await import('../../src/background.js');
    const reply = mock(() => {});
    const keepOpen = listeners.message({ type: 'mdv:loadMermaid' }, { tab: { id: 7 }, frameId: 2 }, reply);
    expect(keepOpen).toBe(true);
    await new Promise((r) => setTimeout(r, 0));
    expect(calls.exec.at(-1)).toEqual({ target: { tabId: 7, frameIds: [2] }, files: ['vendor/mermaid.min.js'] });
    expect(reply).toHaveBeenCalledWith({ ok: true });
  });
  test('다른 메시지는 무시', async () => {
    await import('../../src/background.js');
    expect(listeners.message({ type: 'other' }, { tab: { id: 1 } }, () => {})).toBeUndefined();
  });
});

describe('테마 순환', () => {
  test('항상 화면이 바뀌는 다음 테마로', async () => {
    const { nextTheme } = await import('../../src/app.js');
    // 시스템 라이트: 자동(=라이트) 다음 라이트는 건너뜀
    expect(nextTheme('auto', false)).toBe('dark');
    expect(nextTheme('light', false)).toBe('dark');
    expect(nextTheme('dark', false)).toBe('ivory');
    expect(nextTheme('ivory', false)).toBe('auto');
    // 시스템 다크: 순서상 같은 화면이 붙는 단계가 없으므로 그대로 순환
    expect(nextTheme('auto', true)).toBe('light');
    expect(nextTheme('light', true)).toBe('dark');
    expect(nextTheme('dark', true)).toBe('ivory');
    expect(nextTheme('ivory', true)).toBe('auto');
  });
  test('한 바퀴 돌면서 같은 화면이 연속되지 않음', async () => {
    const { nextTheme } = await import('../../src/app.js');
    const resolve = (th, d) => (th === 'auto' ? (d ? 'dark' : 'light') : th);
    for (const dark of [false, true])
      for (const start of ['auto', 'light', 'dark', 'ivory']) {
        let th = start;
        for (let i = 0; i < 8; i++) {
          const n = nextTheme(th, dark);
          expect(resolve(n, dark)).not.toBe(resolve(th, dark));
          th = n;
        }
      }
  });
  test('예전 sepia 설정은 ivory 로, 모르는 값은 기본값으로', async () => {
    const { normalizeSettings } = await import('../../src/app.js');
    expect(normalizeSettings({ theme: 'sepia', fontSize: 18 })).toMatchObject({ theme: 'ivory', fontSize: 18 });
    expect(normalizeSettings({ theme: 'neon' }).theme).toBe('auto');
    expect(normalizeSettings(null).theme).toBe('auto');
  });
});
