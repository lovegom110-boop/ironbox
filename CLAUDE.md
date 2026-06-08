# IRONBOX — 프로젝트 노트 + 변경 이력

## 프로젝트 개요
- **이름**: IRONBOX (아이언맨 + 타임**BOX**)
- **컨셉**: 일론 머스크식 시간관리를 반영한 **개인 타임박스 다이어리 PWA**
- **스택**: 바닐라 HTML/CSS/JS + PWA (빌드 도구 없음), Vercel 정적 배포
- **저장**: Firestore(`users/{uid}/days`, 구글 로그인 후 기기 간 동기화) + 오프라인 퍼시스턴스 / 추가 안전망: File System Access 디스크 파일 + JSON 백업
- **디자인**: samsung.com 기반 라이트 (화이트 + 블랙 + 삼성 블루 `#1428A0`) + Pretendard
- **상세**: [`기획.md`](기획.md), [`DESIGN.md`](DESIGN.md), [`README.md`](README.md)

## 파일 구조
```
index.html · sw.js · manifest.json · vercel.json · icons/
widget.html · widget.webmanifest · css/widget.css · js/widget.js   — 바탕화면 위젯(오늘 할 일)
css/style.css
js/{store, timebox, calendar, gcal, weekview, notes, notebook, app, auth, firebase-init}.js
js/lib/{easymde, marked, purify}  — 노트 마크다운(self-host)
기획.md · DESIGN.md · README.md · CLAUDE.md(이 문서)
```

---

# 변경 이력 (날짜별)

> 날짜는 `YYYY-MM-DD` 한국 시각. 수정 시마다 위에서부터 새로 추가.

## 2026-06-08

### Added
- **윈도우 바탕화면 위젯 — 오늘 할 일 보기·체크·빠른추가** — 기존 코드를 그대로 재활용한 **위젯 전용 화면** 신설. 오늘 날짜의 **Big3 + 할 일만** 작은 카드로 보여주고(타임박스/달력/회고는 제외, 그건 전체 앱), 완료 체크·`#태그` 빠른추가·"자세히 보기(전체 앱 열기)"까지. 데이터·로그인은 **본 앱과 동일한 Firestore(`users/{uid}/days`)·같은 구글 계정**을 공유 → 웹/폰과 양방향. 위젯은 `onSnapshot`으로 **실시간 반영**(웹→위젯 즉시; 위젯→웹은 본 앱이 새로고침/이동 시 반영). 신규 `widget.html` + `js/widget.js` + `css/widget.css`(Samsung 라이트 토큰 재사용: 화이트+삼성블루+Pretendard, 좌측 블루 바·둥근 체크·블랙 pill). **할 일이 많으면 '할 일 목록'만 스크롤**(헤더·Big3·빠른추가·자세히보기는 항상 고정 — flex로 목록 영역이 남는 높이를 흡수). "불러오는 중 → 로그인 → 위젯" 단계로 깜빡임 제거. 한글 줄바꿈 `word-break:keep-all`. `Store.init` 불필요(days는 Firestore, `saveDay`의 디스크미러는 핸들 없으면 no-op). 데스크톱화는 두 길: **① 빌드 없이**(배포→Edge "앱으로 설치"→PowerToys Always-On-Top, 회사PC OK; 더블클릭 런처 `위젯 실행.bat`=Edge `--app` 모드) / **② Tauri 설치파일(.msi/.exe)** — `desktop/`에 Tauri v2 프로젝트 스캐폴드 신설(원격 URL=배포된 widget.html 로드 → 구글 로그인 정상, 프레임리스·투명·항상위, `withGlobalTauri`+capabilities `remote`로 창컨트롤 IPC, `tauri-plugin-shell`로 외부열기). **Rust 미설치 환경 대비 GitHub Actions 클라우드 빌드** `.github/workflows/build-widget.yml`(windows-latest에서 .msi/.exe 굽고 artifact 업로드) 추가 — 로컬 Rust 없이 설치파일 획득. `widget.js`는 Tauri IPC 없으면 인앱 ─/✕ 숨김(브라우저/PWA/OS타이틀바에 위임). 빌드 안내: [desktop/README.md](desktop/README.md). ※ Rust 빌드는 이 작업 환경에서 직접 컴파일 불가(스캐폴드+클라우드 빌드까지 제공). Edge 설치용 `widget.webmanifest` 추가. SW 캐시 셸에 위젯 3종+manifest 추가, v24→v25. 설계: [docs/superpowers/specs/2026-06-08-windows-widget-design.md](docs/superpowers/specs/2026-06-08-windows-widget-design.md), 사용법: [docs/위젯-바탕화면에-올리기.md](docs/위젯-바탕화면에-올리기.md). ※ 렌더링은 헤드리스 Edge로 캡처해 디자인 확인 완료([__widget_preview.png](__widget_preview.png)).

### Changed
- **위젯 날짜 이동 추가 + 로그인/표시 다듬기** — 위젯 헤더에 `‹ 이전날 · 날짜(클릭=오늘로) · 다음날 › · 오늘`. 보고 있는 날짜(viewDate) 기준으로 Big3·할 일 표시·완료체크·빠른추가 저장, 다른 날이면 날짜를 파랑으로 강조 + `오늘` 버튼 노출, 자정 넘김 시 '오늘'을 보던 경우에만 자동 갱신. 로그인은 팝업 차단(WebView) 시 `signInWithRedirect` 자동 폴백, 게이트 안내문구 제거. SW v25→v26. ※ Tauri 내장 브라우저는 구글 로그인 제약이 있어 실사용은 **Edge/Chrome PWA 설치**(같은 widget.html) 권장. (widget.html, js/widget.js, css/widget.css, sw.js)

## 2026-06-07

### Added
- **노트장 — 날짜와 무관한 학습 노트(원노트식 책갈피 탭 + WYSIWYG)** — 기존 하루별 포스트잇("오늘의 메모"로 라벨 변경)과 **별개**의 전체화면 노트 공간. 헤더 `노트` 버튼으로 진입(헤더·본문 숨김, 자체 `←닫기`). 상단 **책갈피 탭**=분류(전체/⭐즐겨찾기/사용자분류/미분류/+분류, 더블클릭→이름변경·삭제 시 안의 노트는 미분류로, 드래그 순서이동) + 상단바 전체검색·`+새 노트`. 본문 2단=왼쪽 노트목록(태그칩 필터, 핀 위·최근수정순·"n일 전") / 오른쪽 편집(제목·분류선택·#태그·⭐핀·삭제 + **Toast UI Editor** WYSIWYG, 표·체크리스트·코드 등). 저장은 마크다운(`getMarkdown`), 노트 전환·닫기 시 flush 저장. 모바일은 1열(목록↔편집 전환). 데이터는 **새 컬렉션 `users/{uid}/notebook`(노트 1개=문서 1개) + `notebookMeta/folders`**, `days`는 손대지 않음(마이그레이션 불필요). JSON·디스크 백업에 노트·폴더 포함. 신규 `js/notebook.js` + self-host `js/lib/toastui-editor-all.min.js`·`toastui-editor.min.css`(v3.2.2, MIT). `Store`에 getNotes/saveNote/deleteNote/getFolders/saveFolders·newStandaloneNote/newFolder·normalizeNote·export/import 확장. 하루 포스트잇은 EasyMDE 유지(공존). SW v20→v22. 설계: [docs/superpowers/specs/2026-06-07-notebook-design.md](docs/superpowers/specs/2026-06-07-notebook-design.md).

### Changed
- **즐겨찾기를 왼쪽 노트 목록에서 바로 켜고 끄기** — 기존엔 노트를 열고 편집기 안 「⭐ 즐겨찾기」를 눌러야만 켜졌고 목록엔 표시만 됐음. 이제 왼쪽 목록 각 노트에 ★ 별표(끔=☆ / 켬=★ 금색)를 두어 목록에서 바로 토글. 편집기 버튼·「즐겨찾기」 탭 카운트와 동기화(`togglePin`으로 일원화). SW v22→v23. (`js/notebook.js`, `css/style.css`)

### Security
- **공용 PC 자동로그인(세션 잔존) 노출 차단** — (1) 구글 로그인 시 `prompt: select_account` 강제로 공용 크롬에서 조용한 자동 로그인 방지(`auth.js`). (2) **Firestore 보안규칙 신설**(`firestore.rules`): `users/{uid}/**`는 본인(`request.auth.uid==uid`)만 read/write, 그 외 전부 차단 — `firebase.json`에 firestore 설정 추가 + 배포 워크플로에 `firestore:rules` best-effort 단계 추가. SW v23→v24. ※ 근본 증상(타 기기 크롬에 로그인 세션 잔존)은 그 기기에서 로그아웃으로 해소되며, 이는 웹 표준 "로그인 유지" 동작이지 데이터 격리 버그가 아님(클라이언트는 `users/{본인uid}`만 접근).

## 2026-06-03

### Added
- **작업별 세부 메모** — 각 할 일에 📝 버튼 → 인라인 textarea로 멀티라인 메모 작성·저장(Firestore, 디바운스). 메모 유무는 📝 아이콘 농도로 표시. 메모는 **검색 대상에 포함**, **업무일지 텍스트(.txt)·Google 캘린더 설명**에 함께 출력, **타임라인 블록에 📝 표시**. 기존 데이터는 normalizeDay가 `note:""` 자동 보강(마이그레이션 불필요). 설계: [docs/superpowers/specs/2026-06-03-task-notes-design.md](docs/superpowers/specs/2026-06-03-task-notes-design.md). (store.js note 필드·검색, app.js 토글/펼침/가드/텍스트내보내기, timebox.js·gcal.js·style.css, SW v12→v13)
- **주간 타임박스 플래너(읽기 전용)** — 헤더 `[일][주]` 토글로 전환. 7일 × 시간 그리드에 한 주 타임박스를 한눈에(오늘/주말/공휴일 강조, 겹침 가로분할). 요일·블록 클릭 → 그 날 '하루 보기'로 점프, 좌우 화살표 = 주 단위 이동. 신규 모듈 `js/weekview.js` + `Store.getDays(dates)`, SW v13→v14. 일요일 시작(기존 달력과 일관). 설계: [docs/superpowers/specs/2026-06-03-weekly-view-design.md](docs/superpowers/specs/2026-06-03-weekly-view-design.md).
- **상세 할 일 추가 + 달력에서 추가** — 제목 + 세부 메모(여러 줄)를 한 번에 적는 상세 추가 모달. 인박스 `상세` 버튼(현재 날) / 달력 날짜 칸 `+`(그 날짜)로 진입. 다른 날 추가는 `getDay→push→saveDay`로 화면 안 건드리고 저장, 달력 점 갱신. `js/calendar.js` 셀 `+`+`onAdd`, `js/app.js` `openAddTask/submitAddTask`, SW v15→v16. 설계: [docs/superpowers/specs/2026-06-03-detailed-task-add-design.md](docs/superpowers/specs/2026-06-03-detailed-task-add-design.md).
- **기상/회고/내일계획 입력칸 UX 개선** — 저장·수정·삭제 버튼과 보기↔편집 모드를 없애고 **항상 편집 가능한 자동저장·자동높이 textarea**로 단순화(클릭→바로 입력, 내용만큼 칸 확장, 포커스 중 입력 보존). 디자인 정돈(연한 배경·네이비 포커스링). `renderTextField` 재작성, SW v16→v17. 설계: [docs/superpowers/specs/2026-06-03-journal-fields-ux-design.md](docs/superpowers/specs/2026-06-03-journal-fields-ux-design.md)
- **노트 (하루별 카드 학습정리, 마크다운)** — 회고 아래 "노트" 섹션. 카드별 제목+마크다운 본문을 EasyMDE 에디터(모달)로 노션식 가벼운 편집(굵게·제목·목록·**하이퍼링크**). `marked`+`DOMPurify`로 살균 렌더(XSS 차단)·링크 새 탭. `day.notes` 배열(텍스트 저장, 1MiB 안전). 라이브러리 self-host(`js/lib/`)+SW 캐시 v17→v18, 신규 `js/notes.js`. 설계: [docs/superpowers/specs/2026-06-03-notes-design.md](docs/superpowers/specs/2026-06-03-notes-design.md)
- **빈 타임박스 인라인 즉시 생성 + 노트 맨아래·포스트잇** — (1) 선택 없이 빈 슬롯 클릭→그 자리 입력칸→Enter로 그 시간에 작업 생성(드래그로 길이 지정, TickTick식). (2) 노트 섹션 맨 아래 이동. (3) 노트 카드 포스트잇 디자인(파스텔 종이색·회전·그림자, 2열 메이슨리/모바일 1열, CSS만). SW v18→v19. 설계: [docs/superpowers/specs/2026-06-03-slot-quickadd-sticky-notes-design.md](docs/superpowers/specs/2026-06-03-slot-quickadd-sticky-notes-design.md)

### Fixed
- **주간 뷰 피드백 반영** — (1) 세로 휠 스크롤 안 되던 문제: `.week-view`를 뷰포트 높이 고정 내부 스크롤 컨테이너로 변경(헤더 sticky 고정). (2) Big3↔일반 구분 약함: 주간 블록 색 분리(Big3=골드, 일반=네이비+골드 좌측바). (3) 한국 공휴일 **2026-06-03 지방선거** 추가(`calendar.js`). SW v14→v15.

## 2026-06-02

### Changed
- **저장 정책 문구를 Firebase 백엔드 전환에 맞게 수정** — 옛 "로컬 전용·서버 전송 없음" 서술을 "본인 구글 계정 Firestore에 저장·동기화(보안규칙으로 본인만 접근) + 디스크 파일/JSON은 추가 안전망"으로 갱신. 반영: `js/store.js` 헤더 주석, `CLAUDE.md` 개요, `README.md`(데이터&프라이버시), `기획.md`(저장 정책·결정 로그), `manifest.json` 설명. ※ `docs/`의 설계·마이그레이션 문서와 과거 날짜 changelog는 *시점 기록*이라 보존.
- 서비스워커 캐시 `v11 → v12` (아래 JS 수정이 cache-first 전략에서 반영되도록 bump)

### Fixed (전체 버그 감사 후 수정 — 6차원 병렬 탐색·적대적 재검증으로 확정)
- **[크래시 방지] 손상/구버전 Firestore 문서로 인한 날짜 화면 폭발** — `getDay`/`getAllDays`가 읽은 문서를 `normalizeDay`로 정규화해 `tasks` 배열·필드 기본값을 항상 보장(검색·이월도 함께 견고화). (`js/store.js`)
- **[표시 누락] `#태그`가 타임라인 블록·Google 캘린더 설명에 안 나오던 문제** — 레거시 `category` 단독 대신 `tags` 우선 폴백으로 통일(인박스 칩과 일치). (`js/timebox.js`, `js/gcal.js`)
- **[입력 소실] 할일·Big3 인라인 편집 중 다른 동작의 전체 `render()`로 편집 input이 사라지던 문제** — `state.editingTaskId` + `[data-inline-edit]` mid-edit 가드 추가(텍스트필드와 동일 패턴). (`js/app.js`)
- **[통계 불일치] 큰 블록을 타임라인 맨 아래로 이동 시 `plannedDur` 미클램프** — 이동 커밋 시 `min(dur, SLOTS-start)`로 클램프해 회고 '계획 시간'과 타임라인 표시 일치. (`js/app.js`)
- **[경쟁] 로그아웃이 `signOut()` 완료 전 `location.reload()`** — `signOut().then(reload)`로 순서 보장. (`js/auth.js`)
- **[견고성] 저장 실패가 조용히 묻히던 문제** — `firestore().settings({ignoreUndefinedProperties:true})` + `saveNow`에 `.catch`로 실패 토스트 노출. (`js/firebase-init.js`, `js/app.js`)
- ※ 미완료 **이월은 의도된 동작**이라 유지(멱등 가드·우선순위/★ 보존은 추후 논의로 보류).
- ※ 보류 항목(별도 처리 필요): Firestore 보안규칙 파일화(`firestore.rules`), SW 갱신 전략(network-first/리로드 유도), 모달 키보드 접근성(Esc/포커스트랩), 데드코드 정리(`renderField`/`startFieldEdit`/`setStatus`).

## 2026-05-29

### Added
- **달력 — 한국 공휴일 표시** — 2026·2027년 공휴일(설/추석/현충일/광복절 등) + 대체공휴일까지 빨간색 + 작은 점 표기 (호버 시 공휴일명 툴팁)
- **달력 — 주말 모두 빨간색** — 토요일도 일요일과 같은 빨간색 (기존 토=파랑 → 빨강 통일)

### Fixed
- **30분(1슬롯) 타임라인 블록 제목 미표시** — 작은 블록은 메타(시간/소요) 숨기고 **제목만** 표시 (시간은 좌측 게이지에 이미 있음)
- **미완료 이월 로직 보정** — 오늘 날짜로 진입할 때만 이월 실행 (과거 빈 날짜로 이동 시 잘못 이월되던 문제 방지)
- **이월 시 토스트 알림 추가** — `"어제 미완료 N개를 오늘로 이월했어요 (어제 체크한 일은 가져오지 않습니다)"`
- **Google 캘린더 24:00 경계 버그** — 마지막 슬롯(23:30–24:00) 이벤트 전송 시 `T24:00:00`이 ISO 비표준이라 거부되던 문제. Date 객체로 자정 롤오버 처리해 다음날 `00:00`으로 정규화
- **Google 캘린더 에러 메시지 강화** — Calendar API 실패 시 응답 본문 파싱하여 `error.message` 그대로 토스트 노출(원인 추적 용이)

### Changed
- 서비스워커 캐시 `v6 → v9`

### Fixed (공휴일 데이터 보정)
- **현충일 대체공휴일 잘못 표기 제거** — 2026-06-08, 2027-06-07 (현충일은 대체공휴일 적용 대상 아님)
- **2027 크리스마스 대체공휴일 추가** — 12/25 토 → 12/27 월
- **2025년 공휴일 추가** — 과거 기록 조회 시에도 표시 (설날·삼일절·어린이날(부처님 겹침)·현충일·광복절·추석·개천절·한글날·크리스마스)

---

## 2026-05-28 — Initial Release (IRONBOX)

### Added
- **단일 페이지 구조** — 기상 → Big 3 → 할 일 + 타임라인 → 회고 → 내일 업무 계획 (위에서 아래로 스크롤)
- **30분 단위 타임박스** — 드래그앤드롭 배치 / 모서리 드래그 길이 조절 / 끌어서 이동
- **겹치는 일정 가로 병렬 배치** (Google Calendar 식)
- **Big 3 직접 입력** — Big3 슬롯에 입력 시 할 일 목록에도 자동 추가 (★ 표시), ★ 해제 가능
- **미완료 자동 이월** — 어제 체크 안 한 할 일을 오늘로 이월
- **인라인 편집** — 할 일·Big3 더블클릭 수정, 기상메모·회고는 Enter 저장 + 수정/삭제 버튼 패턴
- **입력 후 활성화되는 버튼** — 추가/저장 버튼은 입력값이 있을 때만 활성
- **달력 + 검색** — 과거 기록 조회
- **업무일지 텍스트(.txt) 내보내기** — `[업무일지] / [느낀점] / [익일 업무계획]` 형식
- **Google 캘린더 연동(OAuth)** — 단일 버튼: OAuth 로그인 → 캘린더 선택 → 오늘 일정 전송
- **로컬 우선 저장** — IndexedDB + File System Access 자동저장 + JSON 백업 (서버 전송 없음)
- **PWA** — 오프라인 동작, 홈 화면 설치 가능

### Design
- **samsung.com 기반 라이트 디자인** — 화이트 베이스 + 블랙 + 삼성 블루 `#1428A0`, pill 버튼, 넓은 여백
- **폰트: Pretendard**
- **앱 이름: IRONBOX** (아이언맨 + 타임**BOX**)

---

## 작성 규칙
- **수정마다 이 파일에 날짜 섹션 추가** (이미 같은 날짜가 있으면 그 안에 추가)
- 카테고리: `Added` / `Changed` / `Fixed` / `Removed` / `Design`
- 한 줄로 요약: **"무엇을, 왜"**가 드러나게
- 큰 변경은 별도 푸시 메시지에도 동일하게 반영
