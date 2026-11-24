// 서비스 워커: ① mermaid 지연 주입 ② 웹(http/https) .md 지원을 선택 권한으로 켜고 끄기
export const WEB_ORIGINS = ['http://*/*', 'https://*/*'];
const WEB_SCRIPT_ID = 'mdv-web';
const EXT = ['md', 'MD', 'markdown', 'mdown', 'mkd', 'mdx'];
// 경로가 .md 로 끝나는 주소만 (쿼리·해시 포함 허용 — 최종 판정은 콘텐츠 스크립트가 다시 함)
export const WEB_MATCHES = ['http', 'https'].flatMap((s) => EXT.map((e) => `${s}://*/*.${e}*`));

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (msg?.type !== 'mdv:loadMermaid' || !sender.tab) return;
  chrome.scripting
    .executeScript({ target: { tabId: sender.tab.id, frameIds: [sender.frameId ?? 0] }, files: ['vendor/mermaid.min.js'] })
    .then(() => reply({ ok: true }), (e) => reply({ ok: false, error: String(e) }));
  return true; // 비동기 응답
});

async function syncWebScript() {
  const granted = await chrome.permissions.contains({ origins: WEB_ORIGINS });
  const registered = (await chrome.scripting.getRegisteredContentScripts({ ids: [WEB_SCRIPT_ID] })).length > 0;
  if (granted && !registered) {
    await chrome.scripting.registerContentScripts([
      { id: WEB_SCRIPT_ID, matches: WEB_MATCHES, js: ['content.js'], runAt: 'document_end', persistAcrossSessions: true },
    ]);
  } else if (!granted && registered) {
    await chrome.scripting.unregisterContentScripts({ ids: [WEB_SCRIPT_ID] });
  }
}

chrome.runtime.onInstalled.addListener(syncWebScript);
chrome.runtime.onStartup.addListener(syncWebScript);
chrome.permissions.onAdded.addListener(syncWebScript);
chrome.permissions.onRemoved.addListener(syncWebScript);
