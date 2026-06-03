# 빈 슬롯 즉시 생성 + 노트 위치/포스트잇 디자인 — 설계

- 날짜: 2026-06-03
- 대상: IRONBOX

## A. 빈 타임박스 클릭 → 인라인 즉시 생성 (TickTick식)
- 선택된 할 일이 없을 때 빈 슬롯 pointerdown → `drag.type="newat"`(start/cur), 드래그하면 `showCreate`로 범위 표시(소요시간 지정 가능).
- pointerup(`onDragUp`)에서 `newat`이면 `openSlotInput(start, dur)`: 타임라인 위 오버레이 `<input>`을 해당 위치에 띄움.
  - Enter → `parseTags`로 제목/태그 추출 → `Store.newTask` + `plannedStart=start, plannedDur=dur` → push → saveNow → render.
  - Esc / 빈 값 blur → 취소(오버레이 제거 후 render).
- 오버레이는 render와 충돌 없음(타이핑 중 render 미발생, finish 시 render로 정리). 기존 selectedId 배치/드래그 동작은 그대로.

## B. 노트 섹션 맨 아래로
- `index.html`에서 노트 섹션을 "내일 업무 계획" 아래(맨 밑)로 이동(순서 교체).

## C. 포스트잇/스티커 디자인 (CSS만, 패키지 불필요)
- `js/notes.js`: 카드들을 `.notes-grid`(CSS `columns` 메이슨리)로 감싸고, 각 카드에 `sticky-N`(id 해시 기반 안정 색) 클래스.
- `css`: 카드 = 파스텔 종이색(노랑/분홍/민트/하늘) + 살짝 회전(±) + 그림자 + `break-inside:avoid`. 데스크톱 2열, 모바일(≤640px) 1열. `+ 노트 추가`는 그리드 밖 전체폭.
- 본문 글자색은 종이 위 가독 위해 진하게(#3a3a3a).

## 영향 파일
- `js/app.js`(A: pointerdown newat·onDragMove·onDragUp·openSlotInput)
- `index.html`(B: 노트 섹션 이동)
- `js/notes.js`(C: notes-grid + sticky 색)
- `css/style.css`(C: 포스트잇·메이슨리, A: `.tl-newinput`)
- `sw.js`(캐시 v18→v19)

## 범위 외 (YAGNI)
드래그로 카드 재정렬, 색 수동 선택, 손글씨 폰트.

## 검증
`node --check` + 수동(빈 슬롯 클릭→입력→생성, 드래그로 길이, Esc 취소 / 노트 맨아래·포스트잇 2열·색·회전 / 모바일 1열). 배포 전 라이브 확인.
