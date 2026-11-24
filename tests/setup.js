// bun test 전역 DOM — DOMPurify 가 공식 지원하는 jsdom 사용 (happy-dom 에선 isSupported=false 로 무력화됨)
import { JSDOM } from 'jsdom';
const { window } = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/', pretendToBeVisual: true });
for (const k of ['window', 'document', 'navigator', 'Node', 'Element', 'HTMLElement', 'DocumentFragment', 'NodeFilter', 'DOMParser', 'matchMedia', 'getComputedStyle', 'location']) {
  if (k === 'window') globalThis.window = window;
  else if (window[k] !== undefined) globalThis[k] = typeof window[k] === 'function' && !/^[A-Z]/.test(k) ? window[k].bind(window) : window[k];
}
