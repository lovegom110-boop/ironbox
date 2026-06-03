# 기상/회고/내일계획 입력칸 UX 개선 — 설계

- 날짜: 2026-06-03
- 대상: IRONBOX (기상 한마디 / 오늘 회고 / 내일 업무계획 = `renderTextField`가 그리는 3칸)

## 문제 (사용자 피드백)
1. 저장/수정/삭제 버튼 + 보기↔편집 모드 전환이 번거롭다.
2. 칸이 작고 내용따라 안 늘어난다.
3. 디자인이 밋밋하다.

## 해결: "그냥 칸"
세 칸을 **항상 편집 가능한 자동저장 textarea** 하나로 단순화.
- **모드/버튼 제거**: 보기↔편집 모드, 저장·수정·삭제 버튼 전부 삭제. 클릭하면 바로 타이핑.
- **자동 저장**: `input` 디바운스 저장 + `blur` 시 즉시 저장(공백 trim). 버튼 없음.
- **자동 높이**: `autoGrow()`로 `height=auto→scrollHeight`. 내용만큼 늘어나고 스크롤 없음. 빈 칸은 CSS `min-height`로 바닥 보장.
- **입력 보존**: 포커스 중이면 `renderTextField`가 그 칸을 재구축하지 않음(`document.activeElement === textarea` 가드). 타이핑 중 다른 동작의 render로 커서가 날아가지 않게.
- **디자인**: 부드러운 테두리(`--line-soft`)·연한 배경(`--bg-soft`)·여백·네이비 포커스링·정돈된 플레이스홀더. 일기장 느낌. (`.field-auto`)

## 구현
- `js/app.js`: `renderTextField` 재작성 + `autoGrow(ta)` 헬퍼. 호출부(render의 wake/feedback/tomorrow) 시그니처 불변.
- `css/style.css`: `.field-auto`(+`.multi`, `.text-field .field-auto{flex:1}`) 추가. 기존 `.field-input/.field-text/.field-buttons`는 미사용으로 잔존(데드코드, 별도 정리 대상).
- `sw.js`: 캐시 `v16 → v17`.

## 범위 외 (YAGNI)
Big3 입력칸, 할 일 빠른추가, 할 일 인라인 편집, 작업별 메모(📝)는 그대로(이번 요청은 이 3칸).

## 검증
`node --check` + 수동(클릭→바로 입력→자동저장, 줄 늘리면 칸 확장, 날짜 이동 시 내용 반영, 포커스 중 다른 동작에도 입력 유지). 배포 전 라이브 확인.
