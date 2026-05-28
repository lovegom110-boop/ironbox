/* =========================================================================
 * gcal.js — Google OAuth + Calendar API (브라우저 측 토큰 플로우)
 *  - 사용자 본인 Client ID 필요 (Google Cloud Console > OAuth 2.0 Client > 웹앱)
 *  - 승인된 JavaScript 출처: 배포 URL + http://localhost:8123 추가 필수
 *  - scope: calendar.events (이벤트 생성·읽기·수정·삭제만)
 *  - 토큰은 메모리만, 종료 시 사라짐. Client ID·선택 캘린더는 localStorage.
 * ====================================================================== */
(function (global) {
  "use strict";

  const SCOPE = "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly";
  const LS_CLIENT = "gcal_client_id";
  const LS_CAL = "gcal_selected_cal";
  let accessToken = null;
  let tokenExpiresAt = 0;

  function loadGSI() {
    return new Promise((resolve, reject) => {
      if (global.google && global.google.accounts && global.google.accounts.oauth2) return resolve();
      const existing = document.getElementById("gsi-script");
      if (existing) { existing.addEventListener("load", () => resolve()); existing.addEventListener("error", () => reject(new Error("GSI 로드 실패"))); return; }
      const s = document.createElement("script");
      s.id = "gsi-script";
      s.src = "https://accounts.google.com/gsi/client";
      s.async = true; s.defer = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("Google Identity Services 로드 실패 (오프라인이거나 차단됨)"));
      document.head.appendChild(s);
    });
  }

  function requestToken(clientId) {
    return new Promise((resolve, reject) => {
      const client = global.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: SCOPE,
        callback: (resp) => {
          if (resp.error) return reject(new Error(resp.error_description || resp.error));
          accessToken = resp.access_token;
          tokenExpiresAt = Date.now() + (Number(resp.expires_in || 3600) - 60) * 1000;
          resolve(accessToken);
        },
        error_callback: (e) => reject(new Error((e && (e.message || e.type)) || "인증 취소/실패"))
      });
      client.requestAccessToken({ prompt: "" });
    });
  }

  async function connect(clientId) {
    if (!clientId) throw new Error("Client ID가 필요합니다");
    localStorage.setItem(LS_CLIENT, clientId);
    await loadGSI();
    return requestToken(clientId);
  }

  async function ensureToken() {
    if (accessToken && Date.now() < tokenExpiresAt) return accessToken;
    const id = localStorage.getItem(LS_CLIENT);
    if (!id) throw new Error("Client ID 미설정 — 먼저 '캘린더 연결'을 누르세요");
    await loadGSI();
    return requestToken(id);
  }

  async function listCalendars() {
    const tok = await ensureToken();
    const r = await fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=writer", {
      headers: { Authorization: "Bearer " + tok }
    });
    if (!r.ok) throw new Error("캘린더 목록 실패 (" + r.status + ")");
    const data = await r.json();
    return (data.items || []).map((c) => ({ id: c.id, summary: c.summary, primary: !!c.primary }));
  }

  async function createEvent(calId, event) {
    const tok = await ensureToken();
    const r = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events`, {
      method: "POST",
      headers: { Authorization: "Bearer " + tok, "Content-Type": "application/json" },
      body: JSON.stringify(event)
    });
    if (!r.ok) {
      const txt = await r.text();
      let msg = "이벤트 생성 실패 " + r.status;
      try { const j = JSON.parse(txt); if (j.error) msg += " — " + (j.error.message || JSON.stringify(j.error).slice(0, 400)); }
      catch (_) { msg += ": " + txt.slice(0, 400); }
      throw new Error(msg);
    }
    return r.json();
  }

  function tzOffsetStr() {
    const m = -new Date().getTimezoneOffset();
    const sign = m >= 0 ? "+" : "-";
    const a = Math.abs(m);
    return `${sign}${String(Math.floor(a / 60)).padStart(2, "0")}:${String(a % 60).padStart(2, "0")}`;
  }
  // 24:00 → 다음날 00:00 등 자정 경계 안전하게 처리
  function isoFor(dateStr, totalMin, tz) {
    const [Y, M, D] = dateStr.split("-").map(Number);
    const dt = new Date(Y, M - 1, D);
    dt.setMinutes(dt.getMinutes() + totalMin);
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const d = String(dt.getDate()).padStart(2, "0");
    const hh = String(dt.getHours()).padStart(2, "0");
    const mm = String(dt.getMinutes()).padStart(2, "0");
    return `${y}-${m}-${d}T${hh}:${mm}:00${tz}`;
  }

  async function exportDay(day, calId, startHour, slotMin) {
    const placed = day.tasks.filter((t) => t.plannedStart != null);
    if (!placed.length) return { created: 0, failed: 0, total: 0, errors: [] };
    const tz = tzOffsetStr();
    const tzName = (Intl.DateTimeFormat && Intl.DateTimeFormat().resolvedOptions().timeZone) || "Asia/Seoul";
    let created = 0, failed = 0;
    const errors = [];
    for (const t of placed) {
      const startMin = startHour * 60 + t.plannedStart * slotMin;
      const endMin = startMin + (t.plannedDur || 1) * slotMin;
      const event = {
        summary: (t.isBig3 ? "★ " : "") + t.text,
        description: t.category ? "#" + t.category : "",
        start: { dateTime: isoFor(day.date, startMin, tz), timeZone: tzName },
        end: { dateTime: isoFor(day.date, endMin, tz), timeZone: tzName }
      };
      try { await createEvent(calId, event); created++; }
      catch (e) { failed++; errors.push(t.text + ": " + e.message); }
    }
    return { created, failed, total: placed.length, errors };
  }

  global.GCal = {
    SCOPE,
    getClientId: () => localStorage.getItem(LS_CLIENT) || "",
    getSelectedCalId: () => localStorage.getItem(LS_CAL) || "",
    setSelectedCalId: (id) => localStorage.setItem(LS_CAL, id || ""),
    isAuthed: () => !!(accessToken && Date.now() < tokenExpiresAt),
    connect, listCalendars, createEvent, exportDay,
    disconnect: () => { accessToken = null; tokenExpiresAt = 0; }
  };
})(window);
