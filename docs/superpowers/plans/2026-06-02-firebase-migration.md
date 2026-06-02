# IRONBOX Firebase 전환 (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** IRONBOX 다이어리 데이터를 로컬 IndexedDB에서 Firebase(Auth + Firestore)로 옮겨, 구글 로그인 기반으로 본인 계정에 저장하고 여러 기기에서 동기화한다.

**Architecture:** 빌드 도구 없는 바닐라 PWA 구조를 유지하기 위해 **Firebase compat SDK(CDN `<script>`)**를 사용한다. `store.js`의 공개 API(`init/getDay/saveDay/getAllDays/getMonthMarks/search/exportAll/importAll` 등)는 그대로 두고 내부 구현만 IndexedDB → Firestore(`users/{uid}/days/{date}`)로 교체한다. 구글 로그인 게이트를 통과해야 앱이 부팅된다. 디스크 JSON 백업/내보내기 기능은 안전망으로 유지한다.

**Tech Stack:** 바닐라 HTML/CSS/JS, Firebase compat SDK v10 (App/Auth/Firestore), Firestore 오프라인 퍼시스턴스, Vercel 정적 배포.

**검증 방식 안내(중요):** 이 앱은 현재 테스트 러너가 없는 빌드리스 PWA이고, 핵심 작업이 Firebase Auth/Firestore 연동이라 **검증은 "앱 실행 + 동작 관찰 + Firebase 콘솔 확인"** 으로 한다. 자동화 테스트(Jest + Firebase 에뮬레이터)를 새로 깔지 않는다 — 개인 사이드 프로젝트에 비해 과한 도구 도입이라 의도적으로 제외한다. 보안규칙은 콘솔 Rules Playground + 2계정 수동 확인으로 검증한다. (더 엄격히 가려면 `@firebase/rules-unit-testing` 에뮬레이터 도입이 별도 옵션.)

**참고 자료:**
- 설계 문서: `docs/2026-06-01-firebase-backend-design.md`
- 백업 복구 지점: 커밋 `e45e0c7`, `backup/pre-firebase` 브랜치, `pre-firebase-backup` 태그
- Firebase 프로젝트: `ironbox-3200a` (개인 구글 계정)

---

## 파일 구조 (생성/수정)

| 파일 | 책임 | 변경 |
|---|---|---|
| `js/firebase-config.js` | Firebase 웹 설정값(공개 식별자). 보안은 규칙+승인도메인이 담당 | **생성** |
| `js/firebase-init.js` | `firebase.initializeApp` + Firestore 오프라인 퍼시스턴스 활성화 | **생성** |
| `js/auth.js` | 구글 로그인/로그아웃, 로그인 게이트, `onAuthStateChanged` → 앱 부팅 | **생성** |
| `js/store.js` | 데이터 계층. days/meta 내부를 IndexedDB→Firestore로 교체, 공개 API 유지. fileHandle만 로컬 IDB 유지 | **수정** |
| `index.html` | Firebase SDK script 태그, config/init/auth 로드, 로그인 오버레이 마크업, 백업 메뉴에 로그인 정보/로그아웃 추가 | **수정** |
| `js/app.js` | `DOMContentLoaded → init()` 자동 실행 제거. `Auth`가 로그인 성공 시 `App.boot()` 호출하도록 변경 | **수정** |
| `css/style.css` | 로그인 오버레이 스타일 | **수정** |
| `sw.js` | 캐시 버전업 + 새 JS 파일 캐시 목록 추가 | **수정** |
| `CLAUDE.md`, `README.md` | "로컬 전용" → "클라우드 동기화" 문구 갱신 + 변경이력 | **수정** |

---

## Task 0: Firebase 콘솔 설정 + 보안규칙 배포 (사용자 작업, 검증 게이트)

코드 착수 전 콘솔에서 아래가 모두 완료/확인되어야 한다. (사용자가 수행)

**Files:** 없음 (Firebase 콘솔 작업)

- [ ] **Step 1: Authentication — Google 로그인 사용 설정 확인**

콘솔 → Authentication → Sign-in method → **Google** 공급자가 "사용 설정됨"인지 확인. 안 됐으면 켜고 저장.

- [ ] **Step 2: Firestore Database 생성 확인**

콘솔 → Firestore Database 가 생성되어 있는지 확인. 위치는 `asia-northeast3`(서울) 권장. 없으면 **프로덕션 모드**로 생성.

- [ ] **Step 3: 보안규칙 배포**

콘솔 → Firestore Database → 규칙(Rules) 탭에 아래를 붙여넣고 **게시(Publish)**.

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

- [ ] **Step 4: 승인된 도메인 추가**

콘솔 → Authentication → Settings → 승인된 도메인(Authorized domains)에 현재 Vercel 배포 도메인 추가(예: `ironbox.vercel.app`). `localhost`는 기본 포함.

- [ ] **Step 5: 규칙 검증 (Rules Playground)**

콘솔 Firestore → 규칙 → "Rules Playground"에서:
- 시뮬레이션: 인증 없음(unauthenticated) + `users/test123/days/2026-06-02` read → **거부(deny)** 되어야 함
- 시뮬레이션: 인증 uid=`test123` + 같은 경로 read → **허용(allow)** 되어야 함
- 시뮬레이션: 인증 uid=`other` + `users/test123/...` read → **거부** 되어야 함

세 결과가 위와 같으면 규칙이 올바르다. (이게 멀티유저 격리의 핵심 검증)

---

## Task 1: Firebase SDK + config + 초기화

**Files:**
- Create: `js/firebase-config.js`
- Create: `js/firebase-init.js`
- Modify: `index.html` (head/script 태그)

- [ ] **Step 1: Firebase config 파일 생성**

`js/firebase-config.js`:

```js
/* =========================================================================
 * firebase-config.js — Firebase 웹 설정값
 *  ※ 이 apiKey 등은 "비밀키"가 아니라 공개돼도 되는 클라이언트 식별자입니다.
 *    실제 보안은 ① Firestore 보안규칙(본인만 접근) ② 승인된 도메인 제한이 담당합니다.
 *    (정적 사이트는 클라이언트에 설정값을 둘 수밖에 없으며, 이것이 Firebase 권장 방식)
 * ====================================================================== */
window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyCZnR8-8Z4hX3wxxzEvLlKhw8ns8Z0GTQk",
  authDomain: "ironbox-3200a.firebaseapp.com",
  projectId: "ironbox-3200a",
  storageBucket: "ironbox-3200a.firebasestorage.app",
  messagingSenderId: "376568404481",
  appId: "1:376568404481:web:f77e54bf9181d98e4ffe00",
  measurementId: "G-RP4NHNY06C"
};
```

- [ ] **Step 2: Firebase 초기화 파일 생성**

`js/firebase-init.js`:

```js
/* =========================================================================
 * firebase-init.js — Firebase 앱 초기화 + Firestore 오프라인 퍼시스턴스
 *  compat SDK 로드 직후, 다른 모든 스크립트보다 먼저 실행되어야 함.
 * ====================================================================== */
(function () {
  "use strict";
  firebase.initializeApp(window.FIREBASE_CONFIG);

  // 오프라인 퍼시스턴스: 로컬 캐시로 오프라인 동작 + 기기 간 동기화
  // (어떤 Firestore 호출보다 먼저 1회만 실행)
  firebase.firestore().enablePersistence({ synchronizeTabs: true })
    .catch(function (err) {
      // failed-precondition: 여러 탭 동시 열림 / unimplemented: 미지원 브라우저
      console.warn("Firestore persistence 미활성:", err && err.code);
    });
})();
```

- [ ] **Step 3: index.html에 SDK + 파일 로드 추가**

`index.html`에서 기존 `<script src="js/store.js">` **위쪽**에 아래를 삽입한다. (Firebase SDK → config → init → store/앱 순서가 중요)

찾을 위치 — 기존:
```html
  <script src="js/store.js"></script>
  <script src="js/timebox.js"></script>
```

다음으로 교체:
```html
  <!-- Firebase compat SDK (CDN) -->
  <script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-auth-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore-compat.js"></script>
  <script src="js/firebase-config.js"></script>
  <script src="js/firebase-init.js"></script>

  <script src="js/store.js"></script>
  <script src="js/timebox.js"></script>
```

- [ ] **Step 4: 검증 — 초기화 무오류**

로컬에서 앱 실행(예: VS Code Live Server 또는 `npx serve`로 `http://localhost`). 브라우저 콘솔에서:
```js
firebase.app().options.projectId   // → "ironbox-3200a"
typeof firebase.firestore          // → "function"
```
Expected: projectId가 출력되고, 빨간 에러 없음(persistence 경고는 무방).

- [ ] **Step 5: 커밋**

```bash
git add js/firebase-config.js js/firebase-init.js index.html
git commit -m "feat(firebase): compat SDK + 초기화 + 오프라인 퍼시스턴스 추가"
```

---

## Task 2: 구글 로그인 게이트

**Files:**
- Create: `js/auth.js`
- Modify: `index.html` (로그인 오버레이 마크업 + script 태그 + 백업메뉴 로그아웃)
- Modify: `css/style.css` (오버레이 스타일)
- Modify: `js/app.js` (자동 init 제거, boot 노출)

- [ ] **Step 1: app.js — 자동 부팅 제거하고 boot 노출**

`js/app.js` 맨 아래의 자동 실행 줄을 찾는다:
```js
  document.addEventListener("DOMContentLoaded", init);
})();
```

다음으로 교체한다 (이제 Auth가 로그인 성공 후 호출):
```js
  // 로그인 게이트 통과 후 Auth가 호출한다 (auth.js 참고)
  window.App = { boot: init };
})();
```

- [ ] **Step 2: index.html — 로그인 오버레이 마크업 추가**

`<body>` 바로 다음, `<header class="topbar">` 위에 삽입:
```html
  <!-- 로그인 게이트 -->
  <div id="auth-gate" class="auth-gate" hidden>
    <div class="auth-card">
      <div class="auth-brand">IRONBOX</div>
      <p class="auth-sub">구글 계정으로 로그인하면 내 다이어리가 모든 기기에서 동기화됩니다.</p>
      <button id="google-signin" class="btn-primary auth-btn">Google로 로그인</button>
      <p id="auth-error" class="auth-error" hidden></p>
    </div>
  </div>
```

- [ ] **Step 3: index.html — auth.js 로드 추가 (맨 마지막 app.js 뒤)**

기존:
```html
  <script src="js/app.js"></script>
</body>
```
교체:
```html
  <script src="js/app.js"></script>
  <script src="js/auth.js"></script>
</body>
```

- [ ] **Step 4: auth.js 생성**

`js/auth.js`:
```js
/* =========================================================================
 * auth.js — 구글 로그인 게이트
 *  로그인 성공 시에만 App.boot() 호출. 미로그인 시 게이트 오버레이 표시.
 * ====================================================================== */
(function () {
  "use strict";
  const gate = document.getElementById("auth-gate");
  const btn = document.getElementById("google-signin");
  const errEl = document.getElementById("auth-error");
  let booted = false;

  function showError(msg) {
    errEl.textContent = msg;
    errEl.hidden = false;
  }

  btn.addEventListener("click", function () {
    errEl.hidden = true;
    const provider = new firebase.auth.GoogleAuthProvider();
    firebase.auth().signInWithPopup(provider).catch(function (e) {
      showError("로그인 실패: " + (e && e.message ? e.message : e));
    });
  });

  firebase.auth().onAuthStateChanged(function (user) {
    if (user) {
      gate.hidden = true;
      if (!booted) {
        booted = true;
        window.App.boot();   // 앱 시작 (Store.init은 currentUser.uid 사용)
      }
    } else {
      gate.hidden = false;
    }
  });

  // 백업 메뉴의 로그아웃 버튼(있으면) 연결
  window.signOutIronbox = function () {
    firebase.auth().signOut();
    location.reload();
  };
})();
```

- [ ] **Step 5: css/style.css — 오버레이 스타일 추가 (파일 끝에)**

```css
/* 로그인 게이트 */
.auth-gate {
  position: fixed; inset: 0; z-index: 1000;
  display: flex; align-items: center; justify-content: center;
  background: #ffffff;
}
.auth-card {
  text-align: center; padding: 40px 28px; max-width: 360px; width: 90%;
}
.auth-brand { font-size: 28px; font-weight: 800; letter-spacing: -0.02em; margin-bottom: 12px; }
.auth-sub { color: #555; font-size: 14px; line-height: 1.5; margin-bottom: 24px; }
.auth-btn { width: 100%; }
.auth-error { color: #c00; font-size: 13px; margin-top: 14px; }
```

- [ ] **Step 6: 검증 — 로그인 게이트 동작**

(Task 3 전이라 로그인 후 데이터 화면은 아직 깨질 수 있음. 여기선 **게이트와 로그인 자체만** 확인.)
1. 앱 새로고침 → 로그인 오버레이가 보인다.
2. "Google로 로그인" 클릭 → 구글 팝업 → 본인 계정 선택 → 팝업 닫힘 → 오버레이 사라짐.
3. 콘솔: `firebase.auth().currentUser.uid` → uid 문자열 출력.
4. 콘솔에서 `signOutIronbox()` 실행 → 새로고침되며 다시 게이트 표시.

Expected: 위 흐름이 에러 없이 진행. (단, Task 0의 승인 도메인에 `localhost`가 포함돼 있어야 함 — 기본 포함)

- [ ] **Step 7: 커밋**

```bash
git add js/auth.js index.html css/style.css js/app.js
git commit -m "feat(auth): 구글 로그인 게이트 추가 (로그인 후 앱 부팅)"
```

---

## Task 3: store.js 내부를 Firestore로 교체 (공개 API 유지)

**Files:**
- Modify: `js/store.js`

핵심: 공개 메서드 시그니처/이름은 그대로. days/meta 읽기·쓰기만 Firestore로. fileHandle만 작은 로컬 IndexedDB에 유지(핸들은 기기 종속이라 클라우드 불가).

- [ ] **Step 1: store.js 상단 — IndexedDB를 fileHandle 전용으로 축소**

`js/store.js`의 IIFE 안, 상수/유틸은 유지하고 **Firestore 참조 헬퍼**를 추가한다. `DB_NAME` 블록 근처에 추가:

```js
  // Firestore 컬렉션 참조 (로그인 후에만 호출됨 — currentUser 보장)
  function _uid() {
    const u = firebase.auth().currentUser;
    if (!u) throw new Error("로그인이 필요합니다.");
    return u.uid;
  }
  function daysCol() {
    return firebase.firestore().collection("users").doc(_uid()).collection("days");
  }
  // meta(설정)도 Firestore에 둔다. 단 fileHandle은 기기종속이라 로컬 IDB에 둔다(아래).
```

- [ ] **Step 2: init() 교체 — 로컬 IDB는 fileHandle 전용으로만 사용**

기존 `async init()` 본문(약 90–104행)을 교체:
```js
    async init() {
      _db = await open();   // 로컬 IDB: 이제 fileHandle 저장 용도만 사용 (days는 Firestore)
      try {
        if (navigator.storage && navigator.storage.persist) {
          await navigator.storage.persist();
        }
      } catch (_) {}
      try {
        const h = await metaGet("fileHandle");
        if (h) _fileHandle = h;
      } catch (_) {}
      return true;
    },
```
(내용은 거의 동일 — `open()`이 만드는 `days` IDB 스토어는 더 이상 안 쓰지만 그대로 둬도 무해하다. 주석만 갱신.)

- [ ] **Step 3: getDay / saveDay / getAllDays 를 Firestore로 교체**

기존 `getDay`(106–109), `saveDay`(111–116), `getAllDays`(118–122) 세 메서드를 교체:
```js
    async getDay(date) {
      const snap = await daysCol().doc(date).get();
      return snap.exists ? snap.data() : emptyDay(date);
    },

    async saveDay(day) {
      day.updatedAt = Date.now();
      await daysCol().doc(day.date).set(day);
      this._scheduleMirror();
      return day;
    },

    async getAllDays() {
      const snap = await daysCol().get();
      const all = snap.docs.map((d) => d.data());
      all.sort((a, b) => (a.date < b.date ? -1 : 1));
      return all;
    },
```
(`getMonthMarks`와 `search`는 내부적으로 `getAllDays`를 부르므로 수정 불필요.)

- [ ] **Step 4: importAll 을 Firestore 배치 쓰기로 교체 (마이그레이션 핵심)**

기존 `importAll`(158–170)을 교체:
```js
    async importAll(obj, opts) {
      opts = opts || {};
      if (!obj || !Array.isArray(obj.days)) throw new Error("올바른 백업 파일이 아닙니다.");
      const days = obj.days.filter((d) => d && d.date);
      // 안전: 클라우드 데이터를 절대 일괄 삭제하지 않는다. 날짜 키 기준 덮어쓰기(머지)만 한다.
      let batch = firebase.firestore().batch();
      let inBatch = 0, total = 0;
      for (const d of days) {
        batch.set(daysCol().doc(d.date), normalizeDay(d));
        inBatch++; total++;
        if (inBatch === 450) {            // Firestore 배치 한도 500 미만으로 분할
          await batch.commit();
          batch = firebase.firestore().batch();
          inBatch = 0;
        }
      }
      if (inBatch > 0) await batch.commit();
      this._scheduleMirror();
      return total;
    },
```

- [ ] **Step 5: 검증 — Firestore 저장/조회 라운드트립**

로그인된 상태에서 앱 사용:
1. 할 일 1개 추가 + 회고에 텍스트 입력.
2. 브라우저 새로고침 → 같은 내용이 그대로 보인다(Firestore에서 로드).
3. Firebase 콘솔 → Firestore Database → `users/{내uid}/days/{오늘날짜}` 문서에 `tasks`, `feedback` 등이 들어있는지 눈으로 확인.
4. 콘솔에서 `await Store.getAllDays()` → 배열 반환 확인.
5. 비행기모드(오프라인)로 새로고침 → 캐시로 앱이 뜨고 오늘 데이터가 보인다(퍼시스턴스).

Expected: 위 모두 통과. 콘솔의 days 문서가 기존 day 구조와 동일.

- [ ] **Step 6: 커밋**

```bash
git add js/store.js
git commit -m "feat(store): days/meta 저장소를 IndexedDB→Firestore로 교체 (공개 API 유지)"
```

---

## Task 4: 기존 데이터 마이그레이션 (내 JSON → 내 클라우드)

**Files:** 없음 (기존 "JSON 불러오기" 메뉴 + Task 3의 Firestore importAll 재사용)

설계상 기존 `importFromFileInput → importAll`이 이제 Firestore로 쓰므로, **기존 "JSON 불러오기" 메뉴가 그대로 마이그레이션 도구**가 된다. 별도 코드 없이 절차만 수행.

- [ ] **Step 1: 원본 백업 확보 확인**

마이그레이션 전, 현재 PC 앱에서 받아둔 **JSON 백업 파일이 손에 있는지** 확인. 없으면, 아직 IndexedDB 버전(`pre-firebase-backup` 태그)을 띄워 "JSON 백업 내보내기"로 받아둔다. (원본은 절대 삭제 금지)

- [ ] **Step 2: 클라우드로 import 실행**

새 Firebase 버전 앱에서:
1. 구글 로그인.
2. 백업 메뉴 → **"JSON 불러오기 (파일 선택)"** → 1번의 JSON 파일 선택.
3. 토스트로 불러온 건수 표시 확인.

- [ ] **Step 3: 검증 — 건수·내용·달력 대조**

1. 콘솔: `(await Store.getAllDays()).length` → JSON의 `days` 개수와 **일치**하는지.
2. 임의의 과거 날짜 몇 개로 이동 → 할 일/회고 내용이 원본과 동일한지 육안 대조.
3. 달력 열기 → 내용 있는 날짜에 점 표시가 원본과 동일한지.
4. 검색으로 알던 키워드 조회 → 결과 나오는지.
5. Firebase 콘솔 Firestore에서 days 문서 수가 1번과 일치하는지.

Expected: 건수·내용·달력·검색 모두 원본과 일치. 하나라도 불일치면 멈추고 원인 파악(원본은 안전하므로 재시도 가능).

- [ ] **Step 4: 폰에서 동기화 확인**

폰 브라우저로 Vercel 배포본 접속(또는 로컬 네트워크) → 같은 구글 계정 로그인 → PC에서 본 다이어리가 동일하게 보이는지 확인.

Expected: 폰/PC가 같은 데이터를 보여줌(동기화 성공).

- [ ] **Step 5: (검증 통과 후에만) 안내**

검증이 모두 통과하기 전에는 기존 IndexedDB 데이터/원본 JSON을 **삭제하지 않는다.** 통과 후에도 원본 JSON은 보관 권장(추가 안전망).

---

## Task 5: 마무리 — 백업메뉴 정리, SW 캐시, 문서 갱신

**Files:**
- Modify: `index.html` (백업 메뉴에 로그인 정보 + 로그아웃)
- Modify: `sw.js`
- Modify: `CLAUDE.md`, `README.md`

- [ ] **Step 1: 백업 메뉴에 계정/로그아웃 추가**

`index.html`의 `#menu` 안, `저장 상태` 섹션 근처에 추가:
```html
          <div class="menu-section">계정</div>
          <div id="account-email" class="menu-note"></div>
          <button class="menu-item" id="signout-btn">로그아웃</button>
          <hr />
```
그리고 `js/auth.js`의 `onAuthStateChanged` user 분기에 이메일 표시 + 버튼 연결 추가:
```js
      const emailEl = document.getElementById("account-email");
      if (emailEl) emailEl.textContent = user.email || "";
      const soBtn = document.getElementById("signout-btn");
      if (soBtn) soBtn.onclick = window.signOutIronbox;
```

- [ ] **Step 2: 저장 상태 문구 갱신**

`index.html`의 `#save-status` 기본 텍스트 "이 기기에 저장됨" → "내 구글 계정에 동기화됨"으로 변경. 메뉴 하단 안내문(41행) "서버로 전송되지 않습니다" 문구를 "내 구글 계정(Firestore)에 안전하게 동기화됩니다. 디스크 파일/JSON 백업은 추가 안전망입니다."로 변경.

- [ ] **Step 3: sw.js 캐시 버전업 + 새 파일 등록**

`sw.js`에서 캐시 버전 상수를 `v9` → `v10`으로 올리고, 캐시 대상 목록(있다면)에 `js/firebase-config.js`, `js/firebase-init.js`, `js/auth.js`를 추가한다. (Firebase CDN SDK는 cross-origin이라 캐시 목록에 넣지 않음 — 브라우저/CDN 캐시에 맡김.)

- [ ] **Step 4: 검증 — 새 SW 적용**

DevTools → Application → Service Workers에서 새 버전(v10) 활성 확인. 메뉴에 로그인 이메일 표시 + 로그아웃 동작 확인.

- [ ] **Step 5: 문서 갱신**

- `CLAUDE.md`: 프로젝트 개요의 "저장" 줄을 "Firebase(Auth 구글 로그인 + Firestore `users/{uid}/days`), 오프라인 퍼시스턴스 + 디스크/JSON 백업 안전망"으로 갱신. 2026-06-02 변경이력 섹션 추가(Added: Firebase 전환).
- `README.md`: "로컬 전용/서버 전송 없음" 서술을 "구글 로그인 + 클라우드 동기화(본인 데이터는 본인만 접근)"로 갱신.

- [ ] **Step 6: 커밋**

```bash
git add index.html sw.js CLAUDE.md README.md js/auth.js
git commit -m "chore: 백업메뉴 계정/로그아웃, SW v10, 문서 클라우드 동기화로 갱신"
```

---

## Self-Review 결과 (작성자 점검)

- **Spec 커버리지**: 설계 성공기준 6개 매핑 — (1)구글 로그인=Task2, (2)데이터 이관=Task4, (3)다기기 동기화=Task4 Step4, (4)오프라인=Task1 Step2/Task3 Step5, (5)본인만 접근 규칙=Task0 Step3/5, (6)멀티유저 격리=`users/{uid}` 경로+규칙. ✅
- **비범위 준수**: 결제/유료티어/공유 없음. ✅
- **Placeholder**: 모든 코드 스텝에 실제 코드 포함, TBD 없음. ✅
- **타입/이름 일관성**: `daysCol()`/`_uid()`/`normalizeDay()`/`App.boot()`/`signOutIronbox()` 전 태스크에서 동일 사용. ✅
- **알려진 트레이드오프**: 자동화 테스트 미도입(빌드리스+외부 연동), 보안규칙은 콘솔/2계정 수동 검증 — 문서 상단에 명시. 더 엄격히는 에뮬레이터 도입이 별도 옵션.
