# 노트장 (날짜와 무관한 학습 노트, 폴더+태그, 노션식 2단) — 설계

- 날짜: 2026-06-07
- 대상: IRONBOX
- 관련: 기존 하루별 포스트잇 노트([2026-06-03-notes-design.md](2026-06-03-notes-design.md), [2026-06-03-slot-quickadd-sticky-notes-design.md](2026-06-03-slot-quickadd-sticky-notes-design.md))와 **별개**의 새 기능

## 목표
날짜에 묶이지 않고 **학습한 내용을 쌓아두는 별도 노트장**. 노션의 "느낌"(좌측 폴더+목록 / 우측 편집)과 핵심 정리 기능(폴더·태그·검색·즐겨찾기)을 가져오되, 블록 에디터·데이터베이스 같은 무거운 건 제외. 기존 마크다운 에디터(EasyMDE)와 안전 렌더(marked+DOMPurify)를 재사용.

기존 **하루 다이어리 안 포스트잇 노트는 그대로 유지**(라벨만 "오늘의 메모"로 변경). `days` 데이터는 손대지 않음.

## 들어가는 길 & 뷰 전환
- 상단 헤더 `actions`에 **`노트` 버튼** 추가(달력·검색 옆).
- 누르면 주간 뷰와 같은 방식으로 **전체 화면 섹션 `#notes-view`** 를 띄움(`main`·`#week-view` 숨김). 닫기 = 좌상단 `←`(또는 `노트` 버튼 토글) → 하루 보기 복귀.
- 노트장은 날짜와 무관 → 헤더의 날짜 네비/일·주 토글과 독립. 노트장 열려 있는 동안 날짜 이동 단축키·화살표는 비활성(가드).

## 화면 (원노트식 책갈피 탭 + 2단)
> 2026-06-07 1차 리뷰 반영: 폴더를 좌측 세로목록 대신 **상단 책갈피 탭(원노트식)**으로, 본문 에디터는 마크다운 원문(EasyMDE) 대신 **WYSIWYG 리치 에디터(Toast UI Editor)**로 변경. 깊이는 그대로 2단계(분류→노트).

- **상단바**: `← 닫기` · "노트" · (우측) `🔍 전체 검색` · `+ 새 노트`.
- **책갈피 탭 줄**: `🗂 전체` · `⭐ 즐겨찾기` · [사용자 분류들…] · `📭 미분류` · `+ 분류`. 가로 스크롤. 활성 탭은 아래 본문과 연결된 원노트식 강조. 사용자 분류 탭은 **더블클릭→이름변경/삭제**(이름 지우고 저장 시 삭제, 안의 노트는 미분류로), **드래그로 순서이동**.
- **본문 2단**:
  - **왼쪽 노트목록 칼럼**: (선택 분류의) 태그 칩 줄 + 노트 목록(제목 + "n일 전" + #태그). 핀 고정 노트가 위, 그다음 최근 수정순.
  - **오른쪽 편집 패널**: 제목 input + 분류 선택(select) + 태그 input(`#파이썬 마케팅`) + `⭐핀` + `삭제`, 그 아래 **Toast UI Editor**(WYSIWYG 기본, 하단 토글로 마크다운). 툴바: 제목·굵게·기울임·취소선·구분선·인용·목록·체크리스트·들여쓰기·표·링크·코드·코드블록.
- **모바일(좁은 화면)**: 한 열. 기본은 탭+목록, 노트 선택 시 `.nb-editing`으로 편집 패널만, `←`로 복귀.

## 에디터 (Toast UI Editor, WYSIWYG)
- 라이브러리 self-host: `js/lib/toastui-editor-all.min.js`(UMD 전역 `toastui.Editor`) + `toastui-editor.min.css` (v3.2.2, MIT). 자체 SVG 아이콘 → 오프라인에서도 아이콘 정상(FontAwesome 의존 없음).
- 저장은 **여전히 마크다운**(`editor.getMarkdown()`) → 기존 저장/백업/검색과 호환. 검색 등 외부 렌더는 계속 `Notes.mdToSafeHtml`(marked→DOMPurify).
- 인스턴스는 노트 열 때 1회 생성, 다른 노트로 바꾸거나 닫을 때 `destroy()` 전에 내용 flush 저장. `change` 디바운스 자동저장.
- **이미지 업로드 제외(YAGNI)**: 노트=문서 1개·1MiB 한도 때문에 base64 임베드 위험 → 이미지 버튼 미노출(링크/URL은 가능). 첨부는 추후 Firebase Storage 도입 시.
- **하루별 "오늘의 메모" 포스트잇은 기존 EasyMDE 유지**(이번 변경 범위 밖, 두 에디터 공존). 추후 통일 검토.

## 데이터 (단순하게)
새 Firestore 하위 컬렉션·메타 doc, `days`와 완전 분리. 노트 하나당 문서 하나(작은 텍스트 → 전체 로드/클라이언트 검색 안전).

- `users/{uid}/notebook/{noteId}` = `{ id, title, body(마크다운), folderId(null=미분류), tags:[string], pinned:bool, createdAt, updatedAt }`
- `users/{uid}/notebookMeta/folders` = `{ folders: [{ id, name }] }` (배열 순서 = 표시 순서). 가상 폴더(전체/즐겨찾기/미분류)는 저장 안 함.
- 오프라인·기기 간 동기화는 현재 Firestore 퍼시스턴스 그대로(새 장치 없음).

### Store API 추가 (`js/store.js`)
- `newStandaloneNote()` → 위 노트 기본 객체.
- `getNotes()` → 컬렉션 전체 로드(updatedAt desc 정렬은 뷰에서). 정규화로 필드 기본값 보장(손상 문서 가드).
- `saveNote(note)` → `updatedAt=Date.now()` 후 `set`. `_scheduleMirror()`.
- `deleteNote(id)` → doc 삭제.
- `getFolders()` / `saveFolders(folders)` → 메타 doc read/write.
- **백업 포함**: `exportAll()`에 `notes`·`folders` 추가, `importAll()`이 있으면 머지(키 덮어쓰기, 일괄삭제 금지 — 기존 days 정책과 동일). 디스크 파일 미러도 함께. (데이터 안전망 일관성)

## 동작 규칙
- **폴더 삭제** → 안의 노트는 지우지 않고 `folderId=null`(미분류)로 이동.
- **저장**: 제목/본문/태그/폴더/핀 변경 시 디바운스 자동 저장(앱 다른 곳과 동일, 저장 버튼 없음). 편집 중 좌측 목록 재렌더는 자유(우측 EasyMDE 인스턴스는 노트 열 때 1회 생성, 다른 노트로 바꿀 때만 `toTextArea()`로 정리 → 입력 소실 방지, 기존 모달 패턴과 동일).
- **검색**: 로드된 노트를 제목+본문+태그로 클라이언트 필터(폴더 무시, 전 노트 대상). 기존 `Store.search`와 같은 방식.
- **새 노트**: `+ 노트` → 현재 선택 폴더에 빈 노트 생성 후 우측에서 바로 편집.

## 렌더 / 보안
- 미리보기·읽기 렌더는 **기존 `Notes.mdToSafeHtml`(marked→DOMPurify) 재사용**(XSS 차단, 링크 새 탭). 저장은 마크다운 원문.

## 신규/영향 파일
- **신규** `js/notebook.js` — `Notebook` 모듈: 뷰 열기/닫기, 책갈피 탭·노트목록·편집 패널 렌더, 분류(폴더)/태그/검색/핀 CRUD, Toast UI Editor 수명주기(생성·flush·destroy).
- **신규** `js/lib/toastui-editor-all.min.js` · `js/lib/toastui-editor.min.css` (v3.2.2, self-host).
- `index.html` — 헤더 `노트` 버튼 + `<section id="notes-view">` 골격 + TUI css(head)/js + `js/notebook.js` 로드. 하루 노트 섹션 라벨 "노트"→"오늘의 메모".
- `js/app.js` — `노트` 버튼 → `Notebook.open()`(헤더·본문 숨김), 닫기 시 복귀, 노트장 열림 중 날짜 단축키 가드, `window.appToast` 노출.
- `js/store.js` — 위 Store API + export/import/mirror 확장 + `normalizeNote`.
- `css/style.css` — 책갈피 탭(.nb-tabs/.nb-tab)·2단 본문(.nb-listcol/.nb-list/.nb-editor)·모바일 1열·태그 칩 + TUI 컨테이너 높이. samsung 라이트 톤 유지.
- `sw.js` — SHELL에 `js/notebook.js` + TUI 2파일 추가, 캐시 `v20→v22`.

## 범위 외 (YAGNI)
중첩(트리) 폴더, 노트 간 링크/백링크, 이미지·파일 첨부(이미지 업로드 버튼 제외), 노트 드래그 정렬(핀+수정순으로 충분), 실시간 협업, 버전 히스토리. 하루별 포스트잇 에디터 통일(추후).

## 검증
`node --check js/*.js` + 수동: 노트장 열기/닫기, 폴더 추가·이름변경·삭제(→미분류 이동), 노트 생성·편집·자동저장·삭제, 폴더 간 이동, 태그 달기·태그 필터, 핀 고정 정렬, 전체 검색, 마크다운/링크 렌더·XSS 무력화, 모바일 1열 전환, 기기 간 동기화, JSON 백업에 노트 포함. 배포 전 라이브 확인(렌더 눈으로).
