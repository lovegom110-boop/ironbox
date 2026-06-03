# 상세 할 일 추가 (+ 달력에서 추가) — 설계

- 날짜: 2026-06-03
- 대상: IRONBOX

## 목표
할 일을 만들 때 **제목 + 세부 메모(여러 줄)** 를 한 번에 입력하고, **달력 날짜 칸의 `+`** 로 그 날짜에 바로 추가한다. 기존 한 줄 빠른추가는 유지.

## 공용 "상세 추가" 폼 (모달)
- `#addtask-modal`: 상단에 대상 날짜(`6월 3일(수)에 할 일 추가`), **제목 input + 세부 메모 textarea + [추가]**.
- 제목 비면 추가 비활성. 제목의 `#태그` 자동 파싱(parseTags). Enter=추가.

## 진입
- **① 인박스 `상세` 버튼**: 빠른추가(제목+Enter) 옆에 추가. 누르면 폼 열림(대상 = 현재 보는 날).
- **② 달력 날짜 칸 `+`**: 칸 클릭은 기존대로 그 날 이동. 칸의 작은 `+`(모바일 대비 항상 노출·연하게)는 폼 열림(대상 = 그 날짜). 추가 후 달력 점 갱신, 달력 유지.

## 데이터 흐름
- 대상 == 현재 보는 날: `state.day.tasks`에 push → `saveNow()` → render (메모리 경로).
- 대상 != 현재 날: `Store.getDay(date)` → push → `Store.saveDay(day)` (현재 화면 불변). 달력 열려있으면 `renderCalendar()`로 점 갱신.
- 생성 시 `note`(세부 메모) 포함. (getDay/saveDay는 정규화·undefined 안전 처리 이미 적용됨)

## 영향 파일
- `index.html` — `#addtask-modal` + 인박스 `상세` 버튼
- `js/app.js` — `state.addDate`, `openAddTask(date)`, `submitAddTask()`, 달력 `onAdd` 배선, 모달 이벤트, keydown 가드에 addtask 추가
- `js/calendar.js` — 셀 `+` 버튼 + `onAdd(date)` 콜백 opt
- `css/style.css` — 모달 폼·셀 `+` 스타일
- `sw.js` — 캐시 `v15 → v16`
- `CLAUDE.md`, `docs/changelog/20260603_수정사항요약.md`

## 범위 외 (YAGNI)
시간 배치·태그 전용칸·Big3 지정(이번 선택에서 제외). 태그는 제목 `#`로 계속 가능. 달력 `+`는 hover 의존 대신 항상 노출(모바일).

## 검증
`node --check` 전 파일 + 수동 시나리오(인박스 상세추가·달력 +로 다른 날 추가·점 갱신·메모 저장·Enter/Esc). 배포 전 로컬/라이브 확인.
