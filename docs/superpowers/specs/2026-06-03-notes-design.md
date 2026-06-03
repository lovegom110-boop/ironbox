# 노트 (하루별 카드 학습정리, 마크다운) — 설계

- 날짜: 2026-06-03
- 대상: IRONBOX

## 목표
하루마다 **카드 형태의 노트**로 학습·공부 내용을 정리. 각 카드는 제목 + 마크다운 본문(노션식 가벼운 편집). 하이퍼링크 포함.

## 데이터
- `day.notes = [{ id, title, body(마크다운 텍스트), updatedAt }]`. `tasks`처럼 day 문서에 배열 필드.
- `Store.newNote(title)`, `emptyDay`에 `notes:[]`, `normalizeDay`가 `notes` 배열 보장.
- 텍스트(마크다운)라 1MiB 문서 한도 안전.

## UI
- 하루 보기 **"노트" 섹션**(회고 아래). 카드 목록(제목 + 렌더된 마크다운 본문) + `[+ 노트 추가]`.
- 정렬: `updatedAt` 내림차순(최근 수정 위).
- 카드: `편집`/`삭제` 버튼.

## 편집 (모달 + EasyMDE)
- `편집`/`+추가` → **노트 모달**: 제목 input + EasyMDE 마크다운 에디터(툴바: 굵게·기울임·제목·목록·링크·인용·코드·미리보기).
- EasyMDE 인스턴스는 모달 열 때 생성, 닫을 때 `toTextArea()`로 정리(한 번에 하나). 카드 목록은 순수 읽기뷰라 app `render()`가 자유롭게 재구축 가능(편집은 모달이라 충돌 없음).
- 저장: 모달 `저장` → note 객체에 title/body/updatedAt 기록 → `saveNow()` → `render()`.

## 렌더 / 보안
- 읽기뷰: `marked.parse(body)` → **`DOMPurify.sanitize()`** (XSS 차단) → innerHTML. 링크는 `target=_blank rel=noopener noreferrer`.
- 저장은 마크다운 원문(하이퍼링크 `[글자](주소)` 포함).

## 라이브러리 (무료·오픈소스, self-host → `js/lib/`, SW 캐시)
- EasyMDE(MIT) js+css, marked(MIT), DOMPurify(Apache/MPL). CDN에서 받아 로컬 보관.
- EasyMDE 툴바 아이콘은 FontAwesome(`autoDownloadFontAwesome:true`)로 온라인 시 로드 — 오프라인에선 아이콘만 비고 편집은 정상(알려진 제약).

## 신규 모듈
- `js/notes.js`(`Notes.renderList`, `Notes.mdToSafeHtml`)로 분리.

## 영향 파일
- `index.html`(노트 섹션 + 노트 모달 + lib css/js), `js/notes.js`(신규), `js/store.js`(notes 필드·newNote), `js/app.js`(renderNotes·모달·EasyMDE 수명주기), `css/style.css`, `js/lib/*`(easymde·marked·dompurify), `sw.js`(SHELL+캐시 v17→v18)

## 범위 외 (YAGNI)
이미지/첨부, 카드 드래그 정렬, 카드 간 이동, 노트 검색(추후).

## 검증
`node --check` + 수동(노트 추가·편집·마크다운/링크 렌더·삭제·날짜 이동 시 반영·XSS 입력 무력화). 배포 전 라이브 확인.
