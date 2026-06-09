# 더블클릭으로 할 일 내용 수정 — 설계 (2026-06-09)

## 배경 / 문제
- **위젯**(`widget.html`/`js/widget.js`)에는 할 일·Big3 글자를 인라인으로 고치는 방법이 전혀 없다(체크·별표·순서변경·빠른추가만 가능).
- **본 앱**(`js/app.js`)은 코드상 `text.ondblclick = startEditInline` 이 걸려 있으나 **"할 일"에서는 실제로 동작하지 않는다.**
  - 할 일 글자를 한 번 클릭하면 `#task-list`의 `pointerdown→pointerup`(이동 없음) → `selectTask()` → `render()` 가 호출되어 **목록이 통째로 재구축**되고 글자 노드가 새 노드로 교체된다.
  - 더블클릭은 "같은 요소에서 두 번"이어야 성립하는데, 첫 클릭에 노드가 교체되어 두 번째 click이 다른 노드에 떨어지므로 `dblclick`이 `.task-text`에서 발생하지 않는다(공통 조상에서만 발생).
  - **Big3는** 글자 클릭에 `selectTask`/`render`가 없어 노드가 유지되므로 더블클릭이 정상 동작한다.

## 목표
1. 본 앱 "할 일"에서도 더블클릭 수정이 동작하게 고친다.
2. 위젯에서 할 일·Big3 더블클릭 수정을 새로 추가한다(본 앱과 동일 UX).

## 설계

### ① 본 앱 (`js/app.js`)
- **위임(delegation) 방식**으로 전환: 안정적으로 살아남는 컨테이너 `#task-list`에 `dblclick` 리스너 하나를 단다.
  - 핸들러: `e.target.closest("input,textarea,button,select")` 면 무시 → `.task-main` 안인지 확인 → `.task[data-id]` 찾기 → 그 안의 현재 `.task-text` 노드를 집어 `startEditInline(id, textEl, "task-edit")`.
  - 컨테이너는 재렌더에도 교체되지 않으므로, 두 click의 공통 조상인 `#task-list`에서 `dblclick`이 확실히 발생 → 안정 동작.
- 기존 per-node `text.ondblclick`(line 335, 할 일용)은 죽은 코드라 제거. "수정" 버튼·title 안내는 유지.
- Big3는 현행 유지(이미 동작).

### ② 위젯 (`js/widget.js`)
- 모듈 변수 `editingId = null` 추가.
- `taskRow`의 글자 `span`에 `title="더블클릭하여 수정"` + `ondblclick → startEditW(t.id, span)` (위젯은 글자 클릭에 재렌더가 없어 per-node로 충분; Big3·할 일 공용 `taskRow`라 둘 다 적용).
- `startEditW(id, span)`:
  - 현재 `currentDay.tasks`에서 id로 task를 찾고, 없으면 중단.
  - `input.dataset.edit="1"`, 값 = `taskToInputW(t)`(`"제목 #태그…"`), `span.replaceWith(input)`, focus+select.
  - `commit(save)`: 1회 가드 → `editingId=null` → save면 `parseTags(input.value)` → **커밋 시점의 `currentDay.tasks`에서 id로 live task 재탐색**(편집 중 스냅샷 교체 대비) → 변경 있으면 `text/tags` 갱신 후 `persist()` → `render()`.
  - Enter=commit(true), Esc=commit(false), blur=commit(true).
- `taskToInputW(t)`: 본 앱 `taskToInput`과 동일(tags 우선, 없으면 category).
- **mid-edit 가드**: `render()` 최상단에 `if (editingId != null && document.querySelector("[data-edit]")) return;` — 편집 중 들어온 onSnapshot 재렌더가 입력칸을 지우지 않게 함.

### CSS (`css/widget.css`)
- `.w-edit-input` 추가: `flex:1; min-width:0;` 로 글자 자리를 그대로 채우고, 파란 테두리 + `--blue-soft` 포커스 링.

### 서비스워커
- `sw.js` 캐시 `v29 → v30`(JS/CSS 변경 반영).

## 검증
- 위젯은 헤드리스 Edge로 렌더링해 편집칸 모양/동작을 캡처 확인.
- 본 앱은 로그인 의존이라 코드 추적으로 근거 제시(델리게이션이 dblclick 미발생 원인을 직접 해소).
