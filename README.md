# Markdown Viewer (Mermaid)

`.md` 파일을 브라우저에서 렌더링하는 Chrome/Edge 확장. Mermaid·코드 하이라이트·KaTeX·목차·테마 지원. 외부 CDN 없이 라이브러리를 모두 내장.

## 설치
0. `bun install && bun scripts/build.js` 로 `dist/` 생성 (또는 Releases 의 zip 압축 해제)
1. `chrome://extensions` (Edge는 `edge://extensions`) → **개발자 모드** 켜기
2. **압축해제된 확장 프로그램 로드** → `dist` 폴더 선택
3. 확장 **세부정보** → **파일 URL에 대한 액세스 허용** 켜기 (로컬 파일용)

## 쓰는 법
- `.md` 파일을 브라우저 창에 끌어다 놓거나 `file:///…/문서.md` 로 열면 자동 렌더링
- 툴바 아이콘 → **파일 열기**: 확장 뷰어 페이지. 폴더도 열 수 있고, 열린 파일은 저장할 때마다 자동으로 다시 그림
- 문서에서 `?` → 단축키 (T 목차 · D 테마 · R 원문 · W 폭 · F 글꼴 · +/- 크기 · J/K 제목 이동)

## 빌드·테스트
```bash
bun install
bun scripts/build.js        # → dist/ + release/*.zip
bun test                    # 단위 테스트 (렌더러·i18n·백그라운드·빌드 결과물 검증)
node tests/e2e.cjs          # (Windows node) 브라우저 E2E — 실제 Chrome 에서 스텁으로 확장 동작 재현
node scripts/store-assets.cjs  # (Windows node) 스토어 이미지 → store/images/
```
- 웹(http/https) `.md` 지원은 기본 꺼짐. 팝업에서 켜면 선택 권한을 요청하고 백그라운드가 콘텐츠 스크립트를 동적 등록
- mermaid(약 3MB)는 다이어그램이 있는 문서에서만 주입

| 경로 | 역할 |
|---|---|
| `src/render.js` | 마크다운 → HTML (marked + 확장, DOMPurify, 인코딩 복구) |
| `src/app.js` | 뷰어 UI (상단바·목차·다이어그램·모달·단축키·설정) |
| `src/content.js` | `.md` 텍스트 페이지를 뷰어로 교체 |
| `src/viewer.js` | 확장 전용 뷰어 페이지 (파일·폴더 열기·드롭·붙여넣기) |
| `src/background.js` | mermaid 지연 주입, 웹 .md 선택 권한 ↔ 콘텐츠 스크립트 등록 |
| `src/popup.js` | 팝업 설정 |
| `src/i18n.js`, `src/locales/*.js` | 화면 문구 8개 언어(ko·en·ja·zh-CN·zh-TW·es·de·fr). 새 언어는 `locales/`에 파일 추가 + `i18n.js` 등록 + `static/_locales/` |
| `static/` | manifest·CSS·팝업·HTML·_locales |
| `tests/` | `unit/`(bun test), `e2e.cjs`, `fixtures/` |

## 스토어 배포
| 경로 | 내용 |
|---|---|
| `release/md-viewer-<버전>.zip` | 업로드 파일 (빌드 시 자동 생성) |
| `store/listing.md` | 스토어 문구(8개 언어)·권한 사유·데이터 사용 답변 |
| `store/images/` | 스크린샷 5장 + 홍보 타일 2종 (`node scripts/store-assets.cjs` 로 재생성) |
| `docs/privacy.html` | 개인정보 처리방침 (GitHub Pages 로 공개) |
| `LICENSE`, `dist/THIRD_PARTY_NOTICES.txt` | 본 확장 MIT + 번들 라이브러리 고지 |
