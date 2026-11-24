// 팝업: 설정 변경 → storage 저장 → 열린 문서에 즉시 반영, 웹 .md 지원 권한 토글
import { lang, t } from './i18n.js';

const WEB_ORIGINS = ['http://*/*', 'https://*/*'];
const DEFAULTS = { theme: 'auto', fontSize: 16, width: 'normal', font: 'sans', toc: true };

const TEXT = t.popup;

const $ = (s) => document.querySelector(s);
document.documentElement.lang = lang;
document.querySelectorAll('[data-i18n]').forEach((n) => (n.innerHTML = TEXT[n.dataset.i18n]));
const labelSeg = (key, labels) => document.querySelectorAll(`.seg[data-key="${key}"] button`).forEach((b, i) => (b.textContent = labels[i]));
labelSeg('theme', ['auto', 'light', 'dark', 'ivory'].map((k) => t.themeName[k]));
labelSeg('width', ['narrow', 'normal', 'wide', 'full'].map((k) => t.widthName[k]));
labelSeg('font', TEXT.fonts);

let settings = { ...DEFAULTS };

function paint() {
  document.querySelectorAll('.seg').forEach((seg) => {
    seg.querySelectorAll('button').forEach((b) => b.classList.toggle('on', settings[seg.dataset.key] === b.dataset.v));
  });
  $('#size').value = settings.fontSize;
  $('#sizeVal').textContent = settings.fontSize + 'px';
  $('#toc').checked = settings.toc;
}

function set(patch) {
  settings = { ...settings, ...patch };
  chrome.storage.local.set({ mdvSettings: settings });
  paint();
}

chrome.storage.local.get('mdvSettings').then(({ mdvSettings }) => {
  settings = { ...DEFAULTS, ...mdvSettings };
  if (settings.theme === 'sepia') settings.theme = 'ivory'; // 예전 이름
  paint();
});

document.querySelectorAll('.seg').forEach((seg) =>
  seg.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b) set({ [seg.dataset.key]: b.dataset.v });
  })
);
$('#size').addEventListener('input', (e) => set({ fontSize: +e.target.value }));
$('#toc').addEventListener('change', (e) => set({ toc: e.target.checked }));
$('#openViewer').addEventListener('click', () => chrome.tabs.create({ url: chrome.runtime.getURL('viewer.html') }));
$('#openSettings').addEventListener('click', () => chrome.tabs.create({ url: 'chrome://extensions/?id=' + chrome.runtime.id }));

// 웹 .md 지원: 선택 권한 요청/반납 (등록은 백그라운드가 권한 변경 이벤트로 처리)
chrome.permissions.contains({ origins: WEB_ORIGINS }).then((ok) => ($('#web').checked = ok));
$('#web').addEventListener('change', async (e) => {
  const want = e.target.checked;
  const ok = want ? await chrome.permissions.request({ origins: WEB_ORIGINS }) : !(await chrome.permissions.remove({ origins: WEB_ORIGINS }));
  e.target.checked = ok;
});

chrome.extension.isAllowedFileSchemeAccess((ok) => ($('#fileAccess').hidden = ok));
