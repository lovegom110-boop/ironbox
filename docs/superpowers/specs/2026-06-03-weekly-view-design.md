# 주간 타임박스 플래너 (Weekly View) — 설계

- 날짜: 2026-06-03
- 대상: IRONBOX (바닐라 HTML/CSS/JS PWA 타임박스 다이어리)

## 목표
기존 '하루 보기'는 그대로 두고, **한 주(7일)의 타임박스를 한 화면 그리드로 보는 읽기 전용 뷰**를 탭 전환으로 추가한다. 편집은 날짜를 눌러 '하루 보기'로 점프해서 한다.

## 진입 / 내비게이션
- 헤더 날짜 내비 옆에 **`[일][주]` 토글** 추가. '주' → 주간 뷰, '일' → 하루 보기.
- 주간 뷰에서: 좌우 화살표(및 ←/→ 키) = **주 단위 이동**, '오늘' = 이번 주로.
- 주 시작 요일: **일요일**(기존 달력 일~토·주말 빨강과 일관). 변경 시 `weekStartOf` 한 곳만 수정.

## 레이아웃
- **좌측 시간 게이지 + 7열(요일) 그리드**. 시간 범위/스케일은 하루 타임라인과 동일(06:00–24:00, 30분, `TimeBox.SLOTS`·`ROW_H` 재사용).
- 열 헤더: `6.3 (화)` 날짜+요일. **오늘 강조**, 주말·공휴일 빨강( `CalendarView.isRedDay`·`KR_HOLIDAYS` 재사용).
- 배치된 타임박스를 블록으로: 제목(말줄임) + ★(Big3) + ✓(완료, 흐리게). 한 날 안에서 겹치면 가로 분할(그리디 컬럼 배치).
- 타임박스(placedStart != null)만 표시. 기상/회고/메모/미배치 할일은 주간 뷰에 안 띄움.

## 상호작용 (읽기 전용)
- 요일 헤더 / 블록 / 빈 셀 클릭 → 그 날 '하루 보기'로 점프(`onPickDay(date)` → setView('day') + loadDay). 드래그/편집 없음.

## 데이터 / 구조
- `Store.getDays(dates[])` 추가 — 주어진 날짜들을 `getDay`로 병렬 조회(정규화 포함). 7일 = 7 read(오프라인 캐시 활용). getAllDays 풀스캔 회피.
- **신규 모듈 `js/weekview.js`** (`WeekView.render(container, opts)`) — app.js 비대화 방지. 겹침 컬럼 배치는 모듈 내 경량 구현(timebox 미수정).
- `js/app.js`: `state.view`('day'|'week'), `state.weekStart`. `setView(v)`로 `main`↔`#week-view` 토글 + 해당 렌더 호출. 주 내비(prev/next/today/키보드)는 `state.view` 분기.

## 모바일
- 7열이 좁으므로 그리드 영역 **가로 스크롤**(요일 최소 폭 보장). 헤더는 그리드와 함께 스크롤.

## 범위 외 (YAGNI)
주간 드래그 편집·요일 간 이동·리사이즈, 주간 통계 대시보드(B안), 미배치 할일 패널, 월요일 시작 토글 UI(코드 상수로만).

## 영향 파일
- `index.html` — `[일][주]` 토글 + `#week-view` 컨테이너 + `weekview.js` 스크립트 태그
- `js/app.js` — 뷰 상태·전환·주 내비·renderWeek
- `js/weekview.js` — 신규(WeekView.render)
- `js/store.js` — `getDays(dates)`
- `css/style.css` — 주간 그리드 스타일
- `sw.js` — SHELL에 weekview.js 추가 + 캐시 `v13 → v14`
- `CLAUDE.md`, `docs/changelog/20260603_수정사항요약.md` — 기록

## 검증
테스트 러너 없음 → `node --check` 전 파일 구문검증 + 수동 시나리오(주 전환·주 이동·오늘·날짜 클릭 점프·오늘/주말/공휴일 강조·겹침 블록·모바일 가로스크롤). 배포 전 로컬 확인 권장.
