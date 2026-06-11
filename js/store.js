/* =========================================================================
 * store.js — 데이터 계층
 *  - 1차 저장: Firestore (users/{uid}/days) — 구글 로그인 후 기기 간 동기화
 *  - 오프라인: Firestore 로컬 퍼시스턴스 캐시 (firebase-init.js)
 *  - 추가 안전망: 디스크 JSON 파일 (File System Access, 크롬/엣지) + JSON 내보내기/불러오기
 *  - 로컬 IndexedDB는 이제 파일 핸들 등 메타 저장 용도만
 *  ※ 데이터는 본인 구글 계정의 Firestore에 저장·동기화됩니다 (보안규칙으로 본인만 접근).
 * ====================================================================== */
(function (global) {
  "use strict";

  const DB_NAME = "elonDiary";
  const DB_VER = 1;
  const STORE_DAYS = "days";   // keyPath: date ("YYYY-MM-DD")
  const STORE_META = "meta";   // key-value (파일 핸들, 설정 등)
  const EXPORT_VERSION = 1;

  let _db = null;               // 로컬 IndexedDB: 이제 fileHandle 저장 용도만 (days는 Firestore)
  let _fileHandle = null;       // 연결된 디스크 파일 핸들
  let _mirrorTimer = null;

  /* ---------- Firestore 참조 (로그인 후에만 호출됨 — currentUser 보장) ---------- */
  function _uid() {
    const u = firebase.auth().currentUser;
    if (!u) throw new Error("로그인이 필요합니다.");
    return u.uid;
  }
  function daysCol() {
    return firebase.firestore().collection("users").doc(_uid()).collection("days");
  }
  // 날짜와 무관한 학습 노트장 — 노트 하나당 문서 하나
  function notebookCol() {
    return firebase.firestore().collection("users").doc(_uid()).collection("notebook");
  }
  // 폴더 목록 메타 (단일 문서)
  function folderDoc() {
    return firebase.firestore().collection("users").doc(_uid()).collection("notebookMeta").doc("folders");
  }

  /* ---------- 유틸 ---------- */
  function uid() {
    return "t_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
  }
  function todayStr(d) {
    d = d || new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  function emptyDay(date) {
    return { date: date, wakeNote: "", tasks: [], notes: [], feedback: "", tomorrowPlan: "", updatedAt: 0, carriedDone: false };
  }
  function newNote(title) {
    return { id: uid(), title: (title || "").trim(), body: "", updatedAt: 0 };
  }
  // 날짜와 무관한 학습 노트(노트장). day.notes 의 포스트잇과는 별개 컬렉션.
  function newStandaloneNote(folderId) {
    const t = Date.now();
    return { id: uid(), title: "", body: "", folderId: folderId || null, tags: [], pinned: false, createdAt: t, updatedAt: t };
  }
  function newFolder(name) {
    return { id: "f_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 6), name: (name || "").trim() };
  }
  // 직전 기록일의 '미완료' 할 일을 오늘로 가져올 목록 계산 (순수 함수 — I/O 없음, 앱·위젯 공용).
  //  · 'date' 이전(=과거)의 '내용 있는 날' 중 가장 최근 하루만 본다 (사이에 빈 날이 있으면 건너뜀).
  //  · 완료(done)한 일은 가져오지 않는다. 이월분은 새 id의 일반 할 일(Big3 해제·미완료)로 만든다.
  function computeCarry(allDays, date) {
    const prev = (allDays || [])
      .filter((d) => d && d.date < date && d.tasks && d.tasks.length)
      .sort((a, b) => (a.date < b.date ? 1 : -1))[0];
    if (!prev) return [];
    return prev.tasks
      .filter((t) => !t.done)
      .map((t) => { const n = newTask(t.text); n.category = t.category || ""; n.tags = (t.tags || []).slice(); return n; });
  }

  // 오늘(day)에 '직전 기록일의 미완료'를 한 번 합친 결과를 계산 (순수 함수 — I/O 없음, 앱·위젯 공용).
  //  · 이미 이월한 날(carriedDone)은 그대로 둔다 → 합친 걸 지우거나 완료해도 되살아나지 않는다.
  //  · 오늘에 같은 이름(text)이 이미 있으면 그 항목은 다시 붙이지 않는다(중복 방지).
  //  · 가져올 게 없어도 mark=true 로 '오늘 이월 끝' 표시를 켜, 그날은 더 시도하지 않는다(하루 한 번).
  function planCarryMerge(day, allDays, date) {
    const tasks = (day && day.tasks) || [];
    if (day && day.carriedDone) return { tasks: tasks.slice(), added: 0, mark: false };
    const existing = new Set(tasks.map((t) => (t.text || "").trim()));
    const toAdd = computeCarry(allDays, date).filter((t) => !existing.has((t.text || "").trim()));
    return { tasks: tasks.concat(toAdd), added: toAdd.length, mark: true };
  }

  function newTask(text) {
    return {
      id: uid(),
      text: (text || "").trim(),
      category: "",          // (레거시) 단일 배칭 태그 — 하위호환 유지
      tags: [],              // #으로 입력하는 다중 태그
      status: "do",          // do | delete | delegate | defer
      isBig3: false,
      done: false,
      plannedStart: null,    // 타임라인 슬롯 인덱스 (null = 미배치)
      plannedDur: 1,         // 30분 블록 수
      actualMin: null,       // 회고 때 수동 입력
      note: ""               // 작업별 세부 메모 (멀티라인)
    };
  }

  /* ---------- IndexedDB ---------- */
  function open() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_DAYS)) {
          db.createObjectStore(STORE_DAYS, { keyPath: "date" });
        }
        if (!db.objectStoreNames.contains(STORE_META)) {
          db.createObjectStore(STORE_META, { keyPath: "key" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  function tx(storeName, mode) {
    return _db.transaction(storeName, mode).objectStore(storeName);
  }
  function reqP(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function metaGet(key) {
    const row = await reqP(tx(STORE_META, "readonly").get(key));
    return row ? row.value : undefined;
  }
  async function metaSet(key, value) {
    await reqP(tx(STORE_META, "readwrite").put({ key, value }));
  }

  /* ---------- 공개 API ---------- */
  const Store = {
    todayStr,
    newTask,
    newNote,
    newStandaloneNote,
    newFolder,
    emptyDay,
    computeCarry,
    planCarryMerge,

    /* 오늘을 처음 열 때 직전 기록일의 '미완료' 할 일을 '한 번' 합쳐 저장한다 (앱·위젯 공용).
       오늘에 이미 할 일이 있어도 그 아래에 합친다. 합치면 carriedDone 표시를 켜 그날은 다시 안 한다
       → 합친 걸 지우거나 완료해도 되살아나지 않고, 여러 번 열어도 중복이 쌓이지 않는다.
       어느 창(앱/위젯)이 먼저 켜지든 같은 규칙으로 동작. 반환 {day, carried}. */
    async carryOverOnce(date) {
      const day = await this.getDay(date);
      if (date !== todayStr() || day.carriedDone) return { day, carried: 0 };
      const all = await this.getAllDays();
      // 저장 직전 재확인 — 그 사이 다른 창이 이미 합쳤으면(carriedDone) 건드리지 않는다(중복 이월 방지).
      const fresh = await this.getDay(date);
      if (fresh.carriedDone) return { day: fresh, carried: 0 };
      const plan = planCarryMerge(fresh, all, date);
      if (!plan.mark) return { day: fresh, carried: 0 };
      fresh.tasks = plan.tasks;
      fresh.carriedDone = true;
      await this.saveDay(fresh);
      return { day: fresh, carried: plan.added };
    },

    async init() {
      _db = await open();
      // 영구 저장 요청(자동 정리 방지)
      try {
        if (navigator.storage && navigator.storage.persist) {
          await navigator.storage.persist();
        }
      } catch (_) {}
      // 이전에 연결한 디스크 파일 핸들 복원
      try {
        const h = await metaGet("fileHandle");
        if (h) _fileHandle = h;
      } catch (_) {}
      return true;
    },

    async getDay(date) {
      const snap = await daysCol().doc(date).get();
      // 항상 정규화: 구버전/수동편집 문서에 tasks 등이 없어도 안전하게 보장
      return snap.exists ? normalizeDay(Object.assign({ date }, snap.data())) : emptyDay(date);
    },

    async saveDay(day) {
      day.updatedAt = Date.now();
      await daysCol().doc(day.date).set(day);
      this._scheduleMirror();
      return day;
    },

    async getAllDays() {
      const snap = await daysCol().get();
      // 문서 id(date)로 보강 + 정규화 → 검색/이월/내보내기에서 tasks 누락으로 인한 크래시 방지
      const all = snap.docs.map((d) => normalizeDay(Object.assign({ date: d.id }, d.data())));
      all.sort((a, b) => (a.date < b.date ? -1 : 1));
      return all;
    },

    /* 주어진 날짜 배열만 병렬 조회 (주간 뷰용 — 컬렉션 풀스캔 회피) */
    async getDays(dates) {
      return Promise.all(dates.map((d) => this.getDay(d)));
    },

    /* 해당 월에 '내용이 있는' 날짜 set 반환 (달력 점 표시용) */
    async getMonthMarks(year, month /* 0-based */) {
      const all = await this.getAllDays();
      const prefix = `${year}-${String(month + 1).padStart(2, "0")}`;
      const marks = {};
      for (const d of all) {
        if (d.date.startsWith(prefix) && hasContent(d)) marks[d.date] = true;
      }
      return marks;
    },

    /* 텍스트 검색 (할일/기상메모/회고) */
    async search(qRaw) {
      const q = (qRaw || "").trim().toLowerCase();
      if (!q) return [];
      const all = await this.getAllDays();
      const hits = [];
      for (const d of all) {
        const inTasks = d.tasks.filter((t) => t.text.toLowerCase().includes(q) || (t.note && t.note.toLowerCase().includes(q)));
        const inNotes = (d.notes || []).filter((n) => (n.title || "").toLowerCase().includes(q) || (n.body || "").toLowerCase().includes(q));
        const inWake = d.wakeNote && d.wakeNote.toLowerCase().includes(q);
        const inFb = d.feedback && d.feedback.toLowerCase().includes(q);
        if (inTasks.length || inNotes.length || inWake || inFb) {
          hits.push({ date: d.date, tasks: inTasks, notes: inNotes, wake: inWake ? d.wakeNote : "", feedback: inFb ? d.feedback : "" });
        }
      }
      return hits.reverse(); // 최신 우선
    },

    /* ---------- 노트장 (날짜와 무관한 학습 노트) ---------- */
    async getNotes() {
      const snap = await notebookCol().get();
      return snap.docs.map((d) => normalizeNote(Object.assign({ id: d.id }, d.data())));
    },
    async saveNote(note) {
      note.updatedAt = Date.now();
      if (!note.createdAt) note.createdAt = note.updatedAt;
      await notebookCol().doc(note.id).set(normalizeNote(note));
      this._scheduleMirror();
      return note;
    },
    async deleteNote(id) {
      await notebookCol().doc(id).delete();
      this._scheduleMirror();
    },
    async getFolders() {
      const snap = await folderDoc().get();
      const data = snap.exists ? snap.data() : null;
      return data && Array.isArray(data.folders) ? data.folders : [];
    },
    async saveFolders(folders) {
      await folderDoc().set({ folders: Array.isArray(folders) ? folders : [] });
      this._scheduleMirror();
      return folders;
    },

    /* ---------- 내보내기 / 불러오기 ---------- */
    async exportAll() {
      const [days, notes, folders] = await Promise.all([this.getAllDays(), this.getNotes(), this.getFolders()]);
      return { app: "elon-diary", version: EXPORT_VERSION, exportedAt: new Date().toISOString(), days, notes, folders };
    },

    async importAll(obj, opts) {
      opts = opts || {};
      if (!obj || !Array.isArray(obj.days)) throw new Error("올바른 백업 파일이 아닙니다.");
      const days = obj.days.filter((d) => d && d.date);
      const notes = Array.isArray(obj.notes) ? obj.notes.filter((n) => n && n.id) : [];
      // 안전: 클라우드 데이터를 절대 일괄 삭제하지 않는다. 키 기준 덮어쓰기(머지)만 한다.
      let batch = firebase.firestore().batch();
      let inBatch = 0, total = 0;
      const flush = async () => { if (inBatch) { await batch.commit(); batch = firebase.firestore().batch(); inBatch = 0; } };
      for (const d of days) {
        batch.set(daysCol().doc(d.date), normalizeDay(d));
        inBatch++; total++;
        if (inBatch === 450) await flush();   // Firestore 배치 한도 500 미만으로 분할
      }
      for (const n of notes) {
        const nn = normalizeNote(n);
        batch.set(notebookCol().doc(nn.id), nn);
        inBatch++;
        if (inBatch === 450) await flush();
      }
      await flush();
      // 폴더 메타도 함께 복원 (배열이면 통째로 덮어쓰기)
      if (Array.isArray(obj.folders)) await folderDoc().set({ folders: obj.folders });
      this._scheduleMirror();
      return total;
    },

    async downloadExport() {
      const data = await this.exportAll();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `elon-diary-backup_${todayStr()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },

    /* <input type=file> 로 불러오기 (모든 브라우저) */
    async importFromFileInput(file, merge) {
      const text = await file.text();
      const obj = JSON.parse(text);
      return this.importAll(obj, { merge: !!merge });
    },

    /* ---------- 디스크 파일 자동 저장 (File System Access) ---------- */
    fileSupported() {
      return typeof global.showSaveFilePicker === "function";
    },
    fileConnected() {
      return !!_fileHandle;
    },
    async fileName() {
      return _fileHandle ? _fileHandle.name : "";
    },

    /* 새 파일을 만들어 연결 (자동 저장 시작) */
    async connectNewFile() {
      if (!this.fileSupported()) throw new Error("이 브라우저는 파일 자동저장을 지원하지 않습니다. (크롬/엣지 PC 권장)");
      const handle = await global.showSaveFilePicker({
        suggestedName: "elon-diary.json",
        types: [{ description: "JSON", accept: { "application/json": [".json"] } }]
      });
      _fileHandle = handle;
      await metaSet("fileHandle", handle);
      await this.mirrorToFile(true);
      return handle.name;
    },

    /* 기존 파일을 열어 연결 + 그 내용으로 복원 */
    async openExistingFile() {
      if (typeof global.showOpenFilePicker !== "function") throw new Error("이 브라우저는 파일 열기를 지원하지 않습니다.");
      const [handle] = await global.showOpenFilePicker({
        types: [{ description: "JSON", accept: { "application/json": [".json"] } }]
      });
      const file = await handle.getFile();
      const text = await file.text();
      let count = 0;
      if (text.trim()) {
        const obj = JSON.parse(text);
        count = await this.importAll(obj, { merge: false });
      }
      _fileHandle = handle;
      await metaSet("fileHandle", handle);
      return { name: handle.name, count };
    },

    async _verifyPermission(handle) {
      const opts = { mode: "readwrite" };
      if ((await handle.queryPermission(opts)) === "granted") return true;
      if ((await handle.requestPermission(opts)) === "granted") return true;
      return false;
    },

    _scheduleMirror() {
      if (!_fileHandle) return;
      clearTimeout(_mirrorTimer);
      _mirrorTimer = setTimeout(() => this.mirrorToFile().catch(() => {}), 800);
    },

    /* 현재 전체 데이터를 연결된 파일에 기록 */
    async mirrorToFile(force) {
      if (!_fileHandle) return false;
      try {
        if (force) {
          if (!(await this._verifyPermission(_fileHandle))) return false;
        } else {
          if ((await _fileHandle.queryPermission({ mode: "readwrite" })) !== "granted") return false;
        }
        const data = await this.exportAll();
        const writable = await _fileHandle.createWritable();
        await writable.write(JSON.stringify(data, null, 2));
        await writable.close();
        return true;
      } catch (e) {
        console.warn("파일 저장 실패:", e);
        return false;
      }
    },

    async disconnectFile() {
      _fileHandle = null;
      await metaSet("fileHandle", null);
    }
  };

  /* ---------- 내부 정규화 ---------- */
  function normalizeDay(d) {
    const day = Object.assign(emptyDay(d.date), d);
    day.tasks = (d.tasks || []).map((t) => Object.assign(newTask(""), t));
    day.notes = Array.isArray(day.notes) ? day.notes : [];
    return day;
  }
  // 손상/구버전 노트 문서 안전화 — 누락 필드 기본값 보장
  function normalizeNote(n) {
    const note = Object.assign(newStandaloneNote(null), n);
    note.title = typeof note.title === "string" ? note.title : "";
    note.body = typeof note.body === "string" ? note.body : "";
    note.folderId = note.folderId || null;
    note.tags = Array.isArray(note.tags) ? note.tags.filter((t) => typeof t === "string") : [];
    note.pinned = !!note.pinned;
    note.createdAt = note.createdAt || note.updatedAt || Date.now();
    note.updatedAt = note.updatedAt || note.createdAt;
    return note;
  }
  function hasContent(d) {
    return (d.tasks && d.tasks.length) || (d.wakeNote && d.wakeNote.trim()) || (d.feedback && d.feedback.trim());
  }

  global.Store = Store;
})(typeof window !== "undefined" ? window : globalThis);
