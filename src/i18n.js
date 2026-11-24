// 화면 문구: 브라우저 언어에 맞는 locale 선택 (없으면 영어)
import ko from './locales/ko.js';
import en from './locales/en.js';
import ja from './locales/ja.js';
import zhCN from './locales/zh-CN.js';
import zhTW from './locales/zh-TW.js';
import es from './locales/es.js';
import de from './locales/de.js';
import fr from './locales/fr.js';

export const STRINGS_ALL = { ko, en, ja, 'zh-CN': zhCN, 'zh-TW': zhTW, es, de, fr };

// 'zh-TW'·'zh-HK'·'zh-Hant' → 번체, 그 밖의 zh → 간체, 나머지는 앞 두 글자로 판정
export function resolveLang(tag = '') {
  const s = String(tag).toLowerCase().replace('_', '-');
  if (s.startsWith('zh')) return /hant|-tw|-hk|-mo/.test(s) ? 'zh-TW' : 'zh-CN';
  const base = s.split('-')[0];
  return base in STRINGS_ALL ? base : 'en';
}

export const lang = resolveLang(globalThis.chrome?.i18n?.getUILanguage?.() || globalThis.navigator?.language);
export const t = STRINGS_ALL[lang];
