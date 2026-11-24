# Chrome 웹스토어 등록 정보

개발자 대시보드에 그대로 붙여넣을 문구. `<…>` 는 등록 전에 채울 것.

| 항목 | 값 |
|---|---|
| 업로드 파일 | `release/md-viewer-<버전>.zip` (`bun scripts/build.js` 로 생성) |
| 카테고리 | 개발자 도구 (Developer Tools) |
| 기본 언어 | English (매니페스트 `default_locale: en`). 스토어 언어 추가: 한국어·日本語·简体中文·繁體中文·Español·Deutsch·Français |
| 개인정보 처리방침 URL | `https://lsj1137.github.io/md-manager-extension/privacy.html` (`docs/privacy.html` 을 GitHub Pages 로 공개) |
| 지원 사이트 / 홈페이지 | `https://github.com/lsj1137/md-manager-extension` |
| 스크린샷 (1280×800) | `store/images/1-light-mermaid.png` ~ `5-settings.png` |
| 작은 홍보 타일 (440×280) | `store/images/promo-small-440x280.png` |
| 마키 홍보 타일 (1400×560) | `store/images/promo-marquee-1400x560.png` |

---

## 한국어

**이름**: 마크다운 뷰어 – Mermaid·수식·목차

**요약 (132자 이내)**
.md 파일을 예쁘게 읽는 뷰어. Mermaid 다이어그램, 코드 하이라이트, KaTeX 수식, 목차, 다크/아이보리 테마, 한글 인코딩 자동 복구.

**설명**
```
브라우저로 연 .md 파일을 읽기 좋은 문서로 바꿔 보여줍니다. 로컬 파일(file://)을 기본 지원하고, 원하면 웹의 .md 주소도 켤 수 있습니다.

■ 이런 걸 그려줍니다
• Mermaid 다이어그램 — 흐름도, 시퀀스, 간트, 파이, ER, 상태도, 마인드맵 등 전 종류
  - 테마 색에 맞춰 자동으로 다시 그림
  - 클릭하면 크게 보기 (휠 확대·드래그 이동), SVG·PNG 저장, 코드 복사
• 코드 하이라이트 (190여 개 언어) + 복사·줄바꿈 버튼
• KaTeX 수식 ($…$, $$…$$)
• GitHub 스타일 표·체크리스트·각주·알림 박스(> [!NOTE])
• 문서 머리말(front matter)은 정보 카드로 표시

■ 읽기 편하게
• 자동 목차 + 현재 위치 강조, 제목 링크 복사
• 테마 4종: 자동 / 라이트 / 다크 / 아이보리
• 글자 크기, 본문 폭, 고딕/명조 전환
• 읽기 진행바, 글자 수·읽기 시간
• 문서별로 읽던 위치 기억
• 원문 보기, HTML 파일로 내보내기, 인쇄·PDF 저장용 레이아웃
• 단축키: T 목차 · D 테마 · R 원문 · E 내보내기 · J/K 제목 이동 · ? 도움말

■ 한글 문서에 강합니다
• UTF-8 문서가 깨져 보이면 자동으로 복구, EUC-KR 파일도 읽음
• 한글 줄바꿈(단어 단위)과 한글 기준 읽기 시간

■ 폴더째 보기 · 실시간 미리보기
• 툴바 아이콘 → "파일 / 폴더 열기"에서 폴더를 열면 .md 파일 목록이 나오고, 문서 안의 상대경로 이미지와 다른 .md 링크도 그대로 동작합니다.
• 열어 둔 파일은 편집기에서 저장할 때마다 자동으로 다시 그립니다.

■ 개인정보
• 어떤 데이터도 수집·전송하지 않습니다. 모든 렌더링은 내 브라우저 안에서만 이루어지며, 외부 서버나 CDN 에 접속하지 않습니다. (HTML로 내보낸 파일만 열 때 수식 글꼴을 CDN에서 불러옵니다)

※ 로컬 파일을 열려면 확장 프로그램 세부정보에서 "파일 URL에 대한 액세스 허용"을 켜 주세요.
※ 웹의 .md 파일은 팝업에서 "웹의 .md 파일도 열기"를 켰을 때만 동작합니다 (기본은 꺼짐).
```

---

## English

**Name**: Markdown Viewer – Mermaid, KaTeX & TOC

**Summary (≤132 chars)**
Beautiful Markdown reader for local and web .md files: Mermaid diagrams, code highlighting, KaTeX math, TOC, dark/ivory themes.

**Description**
```
Turns any .md file you open in the browser into a clean, readable document. Works with local files (file://) out of the box; .md URLs on the web can be enabled with one click.

■ Renders
• Mermaid diagrams — flowchart, sequence, gantt, pie, ER, state, mindmap and more
  - Re-themed automatically to match light / dark / ivory
  - Click to zoom (wheel zoom & drag to pan), save as SVG / PNG, copy source
• Syntax highlighting for 190+ languages with copy & wrap buttons
• KaTeX math ($…$ and $$…$$)
• GitHub-flavored tables, task lists, footnotes and alerts (> [!NOTE])
• YAML front matter shown as a metadata card

■ Comfortable reading
• Auto table of contents with scroll-spy and copyable heading links
• 4 themes: Auto / Light / Dark / Ivory
• Font size, content width, sans / serif
• Reading progress bar, word count and reading time
• Remembers where you left off in each document
• Raw source view, export to a standalone HTML file, print & PDF-friendly layout
• Shortcuts: T TOC · D theme · R raw · E export · J/K next/prev heading · ? help

■ Folder view & live preview
• Toolbar icon → "Open file / folder": open a whole folder to browse its .md files; relative images and links between documents just work.
• Opened files re-render every time you save them in your editor.

■ Privacy
• Collects and sends no data. Everything is rendered locally in your browser; no external servers or CDNs are contacted. (Only files you export as HTML load math fonts from a CDN when opened.)

Note: to open local files, enable "Allow access to file URLs" on the extension's details page.
Web .md files are rendered only after you turn on "Also open .md files on the web" in the popup (off by default).
```

---

## 日本語 (`ja`)

**Name**: Markdown ビューア – Mermaid・数式・目次

**Summary**
ローカルや Web の .md を見やすく表示。Mermaid 図、シンタックスハイライト、KaTeX 数式、目次、ダーク/アイボリーテーマ。

**Description**
```
ブラウザで開いた .md ファイルを読みやすい文書に変換します。ローカルファイル (file://) に標準対応し、Web 上の .md もワンクリックで有効にできます。

■ 表示できるもの
• Mermaid 図 — フローチャート、シーケンス、ガント、円グラフ、ER、状態遷移、マインドマップなど
  - ライト/ダーク/アイボリーに合わせて自動で配色
  - クリックで拡大 (ホイールでズーム・ドラッグで移動)、SVG/PNG 保存、コードのコピー
• 190 以上の言語のシンタックスハイライト (コピー・折り返しボタン付き)
• KaTeX 数式 ($…$, $$…$$)
• GitHub 形式の表・チェックリスト・脚注・アラート (> [!NOTE])

■ 読みやすさ
• 自動目次と現在位置のハイライト、見出しリンクのコピー
• テーマ 4 種: 自動 / ライト / ダーク / アイボリー
• 文字サイズ・本文の幅・ゴシック/明朝の切替
• 文書ごとに読んでいた位置を記憶
• ソース表示、HTML 書き出し、印刷・PDF 用レイアウト

■ フォルダ表示・自動更新
• 「ファイル / フォルダを開く」でフォルダを開くと .md の一覧を表示。相対パスの画像や文書間リンクもそのまま動作します。
• 開いたファイルはエディタで保存するたびに自動で再描画されます。

■ プライバシー
• データは一切収集・送信しません。描画はすべてブラウザ内で行われます。
```

---

## 简体中文 (`zh_CN`)

**Name**: Markdown 阅读器 – Mermaid·公式·目录

**Summary**
美观地阅读本地和网页上的 .md 文件：Mermaid 图表、代码高亮、KaTeX 公式、目录、深色/象牙白主题。

**Description**
```
把在浏览器中打开的 .md 文件变成美观易读的文档。默认支持本地文件 (file://)，网页上的 .md 也可一键开启。

■ 支持渲染
• Mermaid 图表 — 流程图、时序图、甘特图、饼图、ER 图、状态图、思维导图等
  - 根据浅色/深色/象牙白主题自动配色
  - 点击放大（滚轮缩放、拖动平移），保存为 SVG/PNG，复制源码
• 190 多种语言的代码高亮（带复制、换行按钮）
• KaTeX 数学公式（$…$、$$…$$）
• GitHub 风格的表格、任务列表、脚注、提示框（> [!NOTE]）

■ 阅读体验
• 自动目录并高亮当前位置，可复制标题链接
• 4 种主题：自动 / 浅色 / 深色 / 象牙白
• 字号、正文宽度、黑体/宋体切换
• 记住每篇文档的阅读位置
• 源码视图、导出 HTML、适合打印和 PDF 的版式

■ 文件夹浏览与自动刷新
• 通过“打开文件 / 文件夹”打开整个文件夹，列出其中的 .md；相对路径图片和文档间链接都能正常使用。
• 已打开的文件在编辑器中每次保存后都会自动重新渲染。

■ 隐私
• 不收集、不发送任何数据，所有渲染都在浏览器内完成。
```

---

## 繁體中文 (`zh_TW`)

**Name**: Markdown 閱讀器 – Mermaid·數學式·目錄

**Summary**
美觀地閱讀本機與網路上的 .md 檔案：Mermaid 圖表、程式碼醒目提示、KaTeX 數學式、目錄、深色/象牙白主題。

**Description**
```
把在瀏覽器中開啟的 .md 檔案變成美觀易讀的文件。預設支援本機檔案 (file://)，網路上的 .md 也可一鍵開啟。

■ 支援轉譯
• Mermaid 圖表 — 流程圖、循序圖、甘特圖、圓餅圖、ER 圖、狀態圖、心智圖等
  - 依淺色/深色/象牙白主題自動配色
  - 點選放大（滾輪縮放、拖曳移動），儲存為 SVG/PNG，複製原始碼
• 190 多種語言的程式碼醒目提示（附複製、換行按鈕）
• KaTeX 數學式（$…$、$$…$$）
• GitHub 風格的表格、工作清單、註腳、提示方塊（> [!NOTE]）

■ 閱讀體驗
• 自動目錄並標示目前位置，可複製標題連結
• 4 種主題：自動 / 淺色 / 深色 / 象牙白
• 字級、內文寬度、黑體/明體切換
• 記住每份文件的閱讀位置
• 原始碼檢視、匯出 HTML、適合列印與 PDF 的版面

■ 資料夾瀏覽與自動重新整理
• 透過「開啟檔案 / 資料夾」開啟整個資料夾，列出其中的 .md；相對路徑圖片與文件間連結都能正常運作。
• 已開啟的檔案在編輯器中每次儲存後都會自動重新轉譯。

■ 隱私權
• 不收集、不傳送任何資料，所有轉譯都在瀏覽器內完成。
```

---

## Español (`es`)

**Name**: Visor de Markdown – Mermaid, KaTeX e índice

**Summary**
Lee archivos .md locales y web con estilo: diagramas Mermaid, resaltado de código, fórmulas KaTeX, índice, temas oscuro y marfil.

**Description**
```
Convierte cualquier archivo .md que abras en el navegador en un documento limpio y fácil de leer. Funciona con archivos locales (file://) y, con un clic, también con archivos .md de la web.

■ Renderiza
• Diagramas Mermaid: diagramas de flujo, secuencia, Gantt, circulares, ER, estados, mapas mentales y más
  - Colores adaptados automáticamente a los temas claro / oscuro / marfil
  - Clic para ampliar (zoom con la rueda y arrastre), guardar como SVG / PNG, copiar el código
• Resaltado de sintaxis para más de 190 lenguajes, con botones de copiar y ajustar líneas
• Fórmulas KaTeX ($…$ y $$…$$)
• Tablas, listas de tareas, notas al pie y avisos (> [!NOTE]) al estilo GitHub

■ Lectura cómoda
• Índice automático que resalta la sección actual y enlaces copiables a cada encabezado
• 4 temas: Automático / Claro / Oscuro / Marfil
• Tamaño de texto, ancho del contenido, sans / serif
• Recuerda dónde dejaste cada documento
• Vista de código fuente, exportación a HTML y diseño apto para imprimir y PDF

■ Vista de carpeta y actualización automática
• «Abrir archivo / carpeta» muestra todos los .md de una carpeta; las imágenes relativas y los enlaces entre documentos funcionan.
• Los archivos abiertos se vuelven a renderizar cada vez que los guardas en tu editor.

■ Privacidad
• No recopila ni envía ningún dato. Todo se renderiza localmente en tu navegador.
```

---

## Deutsch (`de`)

**Name**: Markdown-Viewer – Mermaid, KaTeX & Inhalt

**Summary**
Schöner Reader für lokale und Web-.md-Dateien: Mermaid-Diagramme, Syntaxhervorhebung, KaTeX, Inhaltsverzeichnis, Dunkel/Elfenbein.

**Description**
```
Macht aus jeder im Browser geöffneten .md-Datei ein sauberes, gut lesbares Dokument. Lokale Dateien (file://) funktionieren sofort, .md-Dateien im Web lassen sich mit einem Klick aktivieren.

■ Darstellung
• Mermaid-Diagramme – Flussdiagramme, Sequenz, Gantt, Kreisdiagramme, ER, Zustände, Mindmaps und mehr
  - Farben passen sich automatisch an Hell / Dunkel / Elfenbein an
  - Klicken zum Vergrößern (Zoom per Mausrad, Verschieben per Ziehen), als SVG / PNG speichern, Quelltext kopieren
• Syntaxhervorhebung für über 190 Sprachen mit Kopier- und Umbruch-Schaltfläche
• KaTeX-Formeln ($…$ und $$…$$)
• Tabellen, Aufgabenlisten, Fußnoten und Hinweise (> [!NOTE]) im GitHub-Stil

■ Angenehm lesen
• Automatisches Inhaltsverzeichnis mit Markierung der aktuellen Position, kopierbare Überschrift-Links
• 4 Designs: Automatisch / Hell / Dunkel / Elfenbein
• Schriftgröße, Textbreite, serifenlos / Serif
• Merkt sich die Leseposition jedes Dokuments
• Quelltextansicht, HTML-Export, druck- und PDF-freundliches Layout

■ Ordneransicht & automatische Aktualisierung
• „Datei / Ordner öffnen“ listet alle .md-Dateien eines Ordners; relative Bilder und Links zwischen Dokumenten funktionieren.
• Geöffnete Dateien werden bei jedem Speichern im Editor automatisch neu dargestellt.

■ Datenschutz
• Erfasst und sendet keinerlei Daten. Alles wird lokal im Browser dargestellt.
```

---

## Français (`fr`)

**Name**: Lecteur Markdown – Mermaid, KaTeX et sommaire

**Summary**
Lisez vos fichiers .md locaux et web : diagrammes Mermaid, coloration syntaxique, formules KaTeX, sommaire, thèmes sombre et ivoire.

**Description**
```
Transforme tout fichier .md ouvert dans le navigateur en un document clair et agréable à lire. Fonctionne avec les fichiers locaux (file://) et, en un clic, avec les fichiers .md du Web.

■ Affiche
• Diagrammes Mermaid : organigrammes, séquences, Gantt, camemberts, ER, états, cartes mentales…
  - Couleurs adaptées automatiquement aux thèmes clair / sombre / ivoire
  - Clic pour agrandir (zoom à la molette, déplacement par glisser), enregistrement SVG / PNG, copie du code
• Coloration syntaxique pour plus de 190 langages, avec boutons copier et retour à la ligne
• Formules KaTeX ($…$ et $$…$$)
• Tableaux, listes de tâches, notes de bas de page et encadrés (> [!NOTE]) façon GitHub

■ Lecture confortable
• Sommaire automatique qui suit la position, liens de titres copiables
• 4 thèmes : Auto / Clair / Sombre / Ivoire
• Taille du texte, largeur du contenu, sans / serif
• Mémorise votre position de lecture pour chaque document
• Vue source, export HTML, mise en page adaptée à l’impression et au PDF

■ Vue dossier et actualisation automatique
• « Ouvrir un fichier / dossier » liste tous les .md d’un dossier ; les images relatives et les liens entre documents fonctionnent.
• Les fichiers ouverts sont réaffichés à chaque enregistrement dans votre éditeur.

■ Confidentialité
• Aucune donnée n’est collectée ni envoyée. Tout est rendu localement dans votre navigateur.
```

---

## 개인정보 / 권한 탭 (Privacy practices)

**단일 목적 (Single purpose)**
> Render Markdown (.md) files opened in the browser as formatted, readable documents.

**권한 사유 (Permission justification)**

| 권한 | 사유 (영문 입력) |
|---|---|
| `storage` | Saves display preferences (theme, font size, width, TOC) and the last reading position per document, locally. |
| `scripting` | Injects the bundled Mermaid library only into Markdown tabs that actually contain diagrams (lazy loading), and registers the content script for web .md URLs when the user opts in. |
| Host `file:///*` | Renders local .md files the user opens in the browser. The content script runs only on URLs ending in .md/.markdown/.mdx and only when the browser shows the file as plain text. |
| Optional host `http://*/*`, `https://*/*` | Not granted at install. Requested only when the user turns on "Also open .md files on the web" in the popup, so .md files on websites can be rendered. Can be turned off any time. |

**원격 코드 사용 (Remote code)**: No — 모든 라이브러리(marked, mermaid, KaTeX, highlight.js, DOMPurify)는 패키지에 포함.

**데이터 사용 (Data usage)**: 아무 항목도 체크하지 않음 (수집하는 사용자 데이터 없음). 하단 3개 인증 항목은 모두 체크:
- 승인된 사용 사례 외에 사용자 데이터를 제3자에게 판매하거나 전송하지 않음
- 단일 목적과 무관한 목적으로 사용자 데이터를 사용하거나 전송하지 않음
- 신용도 판단이나 대출 목적으로 사용자 데이터를 사용하거나 전송하지 않음
