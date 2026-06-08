/* =========================================================================
 * widget.js — IRONBOX 바탕화면 위젯
 *  오늘 날짜의 Big3 + 할 일을 보여주고(실시간), 완료 체크 / 빠른 추가.
 *  데이터·로그인은 본 앱과 동일한 Firestore(users/{uid}/days)·구글 계정을 공유.
 *  store.js / firebase-init.js 를 그대로 재사용한다(Store.init 불필요 — days는 Firestore).
 * ====================================================================== */
(function () {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const loading = $("#w-loading");
  const gate = $("#auth-gate");
  const root = $("#widget");
  let booted = false;

  // 화면 모드 전환 (로딩 / 로그인 / 위젯) — 깜빡임 없이 한 번에
  function show(which) {
    loading.hidden = which !== "loading";
    gate.hidden = which !== "gate";
    root.hidden = which !== "widget";
  }

  // ⚠ Tauri(데스크톱)에서 "자세히 보기"로 열 전체 앱 주소.
  //   웹에서 테스트할 땐 같은 폴더의 index.html("./")이면 충분.
  //   Tauri로 구운 뒤엔 배포된 https 주소(예: "https://내앱.vercel.app/")로 바꾸면
  //   시스템 기본 브라우저에서 전체 앱이 열린다.
  const FULL_APP_URL = "https://ironbox-six.vercel.app/";

  let today = null;       // 실제 오늘 "YYYY-MM-DD"
  let viewDate = null;    // 현재 보고 있는 날짜 "YYYY-MM-DD"
  let currentDay = null;  // 최신 스냅샷의 day 객체
  let unsub = null;       // onSnapshot 해제 함수

  /* ---------- 유틸 (app.js parseTags 와 동일 규칙) ---------- */
  function parseTags(raw) {
    const tags = [];
    const text = (raw || "")
      .replace(/#([^\s#]+)/g, (m, tag) => { tags.push(tag); return " "; })
      .replace(/\s+/g, " ").trim();
    return { text, tags: [...new Set(tags)] };
  }
  // store.js normalizeDay 와 동일 패턴 (Store.emptyDay/newTask 재사용)
  function normalizeDay(date, data) {
    const day = Object.assign(Store.emptyDay(date), data || {});
    day.date = date;
    day.tasks = ((data && data.tasks) || []).map((t) => Object.assign(Store.newTask(""), t));
    return day;
  }
  function dayRef(date) {
    const u = firebase.auth().currentUser;
    return firebase.firestore().collection("users").doc(u.uid).collection("days").doc(date);
  }
  function toast(msg) {
    const t = $("#w-toast");
    t.textContent = msg; t.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { t.hidden = true; }, 2200);
  }
  function fmtDate(dateStr) {
    const [y, m, d] = dateStr.split("-").map(Number);
    const dow = ["일", "월", "화", "수", "목", "금", "토"][new Date(y, m - 1, d).getDay()];
    return `${m}월 ${d}일 (${dow})`;
  }
  function shiftDate(dateStr, delta) {
    const [y, m, d] = dateStr.split("-").map(Number);
    const dt = new Date(y, m - 1, d + delta);
    const mm = String(dt.getMonth() + 1).padStart(2, "0");
    const dd = String(dt.getDate()).padStart(2, "0");
    return `${dt.getFullYear()}-${mm}-${dd}`;
  }

  /* ---------- 실시간 구독 ---------- */
  function subscribe() {
    if (unsub) { unsub(); unsub = null; }
    const d = viewDate;
    unsub = dayRef(d).onSnapshot(
      (snap) => { currentDay = normalizeDay(d, snap.exists ? snap.data() : null); render(); },
      (err) => { console.warn("구독 실패:", err); toast("불러오기 실패"); }
    );
  }
  function goToDate(date) { viewDate = date; subscribe(); }
  // 자정 넘김 / 창 다시 포커스 시 오늘 재확인 (오늘을 보고 있었으면 따라서 갱신)
  function checkDateRoll() {
    const t = Store.todayStr();
    if (t === today) return;
    const wasToday = (viewDate === today);
    today = t;
    if (wasToday) { viewDate = t; subscribe(); } else { render(); }
  }

  /* ---------- 저장 ---------- */
  function persist() {
    return Store.saveDay(currentDay).catch((e) => { console.error("저장 실패:", e); toast("저장 실패"); });
  }

  /* ---------- 액션 ---------- */
  function toggleDone(id) {
    const t = currentDay.tasks.find((x) => x.id === id);
    if (!t) return;
    t.done = !t.done;
    render();        // 낙관적 즉시 반영
    persist();
  }
  function quickAdd(raw) {
    const { text, tags } = parseTags(raw);
    if (!text) return;
    const t = Store.newTask(text); t.tags = tags;
    currentDay.tasks.push(t);
    render();
    persist();
  }

  /* ---------- 렌더 ---------- */
  function taskRow(t) {
    const li = document.createElement("li");
    li.className = "w-item" + (t.done ? " done" : "");
    const cb = document.createElement("button");
    cb.className = "w-check" + (t.done ? " on" : "");
    cb.type = "button";
    cb.setAttribute("aria-label", "완료 토글");
    cb.textContent = t.done ? "✓" : "";
    cb.onclick = () => toggleDone(t.id);
    const span = document.createElement("span");
    span.className = "w-item-text";
    span.textContent = t.text || "(제목 없음)";
    li.appendChild(cb);
    li.appendChild(span);
    return li;
  }
  function emptyHint(msg) {
    const li = document.createElement("li");
    li.className = "w-empty";
    li.textContent = msg;
    return li;
  }
  function render() {
    if (!currentDay) return;
    const isToday = (viewDate === today);
    const dateBtn = $("#w-date");
    dateBtn.innerHTML = '<span class="tick">⏱</span>' + fmtDate(viewDate);
    dateBtn.classList.toggle("other", !isToday);
    $("#w-today").hidden = isToday;

    const big3 = currentDay.tasks.filter((t) => t.isBig3);
    const tasks = currentDay.tasks.filter((t) => !t.isBig3);

    const b3 = $("#w-big3"); b3.innerHTML = "";
    if (big3.length) big3.forEach((t) => b3.appendChild(taskRow(t)));
    else b3.appendChild(emptyHint("핵심 3가지는 전체 앱에서 정해보세요."));
    $("#w-big3-count").textContent = big3.length ? `${big3.filter((t) => t.done).length} / ${big3.length}` : "";

    const tl = $("#w-tasks"); tl.innerHTML = "";
    if (tasks.length) tasks.forEach((t) => tl.appendChild(taskRow(t)));
    else tl.appendChild(emptyHint("아래 칸에 할 일을 적어보세요."));
    $("#w-task-count").textContent = tasks.length ? `${tasks.filter((t) => t.done).length} / ${tasks.length}` : "";
  }

  /* ---------- 윈도우 컨트롤 / 전체 앱 열기 (Tauri 있으면 네이티브, 없으면 웹 동작) ---------- */
  function tauriWin() {
    const T = window.__TAURI__;
    if (!T || !T.window) return null;
    try { return T.window.getCurrentWindow ? T.window.getCurrentWindow() : (T.window.getCurrent ? T.window.getCurrent() : T.window.appWindow); }
    catch (_) { return null; }
  }
  function wireWindowControls() {
    const min = $("#w-min"), close = $("#w-close");
    const win = tauriWin();
    if (win) {
      // Tauri 프레임리스 창: 인앱 버튼이 실제 창을 제어
      min.onclick = () => { try { win.minimize(); } catch (_) {} };
      close.onclick = () => { try { (win.hide ? win.hide() : win.close()); } catch (_) {} };
    } else {
      // 브라우저 탭 / Edge "앱으로 설치" / OS 타이틀바가 있는 창 → 자체 창틀이 닫기를 담당하므로 인앱 버튼 숨김
      const ctl = document.querySelector(".w-winctl");
      if (ctl) ctl.hidden = true;
    }
  }
  function openFullApp() {
    const T = window.__TAURI__;
    if (T && T.shell && T.shell.open) { T.shell.open(FULL_APP_URL); return; }   // 시스템 브라우저
    window.open(FULL_APP_URL, "_blank");
  }

  /* ---------- 부트 ---------- */
  function boot() {
    wireWindowControls();
    today = Store.todayStr();
    viewDate = today;
    $("#w-open-full").onclick = openFullApp;
    $("#w-prev").onclick = () => goToDate(shiftDate(viewDate, -1));
    $("#w-next").onclick = () => goToDate(shiftDate(viewDate, 1));
    const goToday = () => { if (viewDate !== today) goToDate(today); };
    $("#w-date").onclick = goToday;
    $("#w-today").onclick = goToday;
    $("#w-add-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const inp = $("#w-add-input");
      quickAdd(inp.value);
      inp.value = "";
    });
    subscribe();
    setInterval(checkDateRoll, 60 * 1000);
    window.addEventListener("focus", checkDateRoll);
  }

  /* ---------- 로그인 ---------- */
  function showAuthError(e) {
    if (!e) return;
    const el = $("#w-auth-error");
    el.textContent = "로그인 실패: " + (e.message ? e.message : e);
    el.hidden = false;
  }
  function startSignIn() {
    $("#w-auth-error").hidden = true;
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    // 데스크톱 앱(WebView)·일부 브라우저는 팝업이 막힘(auth/popup-blocked) → 리다이렉트 로그인으로 자동 전환
    firebase.auth().signInWithPopup(provider).catch((e) => {
      const code = e && e.code;
      if (code === "auth/popup-blocked" ||
          code === "auth/operation-not-supported-in-this-environment" ||
          code === "auth/popup-closed-by-user" ||
          code === "auth/cancelled-popup-request") {
        firebase.auth().signInWithRedirect(provider).catch(showAuthError);
      } else {
        showAuthError(e);
      }
    });
  }
  $("#w-signin").addEventListener("click", startSignIn);

  // 리다이렉트 로그인 후 돌아왔을 때 에러만 표시(성공 시 onAuthStateChanged가 화면 전환)
  firebase.auth().getRedirectResult().catch(showAuthError);

  firebase.auth().onAuthStateChanged((user) => {
    if (user) {
      if (!booted) { booted = true; boot(); }
      else { today = Store.todayStr(); viewDate = today; subscribe(); }
      show("widget");
    } else {
      if (unsub) { unsub(); unsub = null; }
      show("gate");
    }
  });
})();
