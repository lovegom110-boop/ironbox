/* 서비스워커 — 앱 셸 오프라인 캐시 (데이터는 캐시하지 않음, IndexedDB/파일에만 저장) */
const CACHE = "elon-diary-v39";
const SHELL = [
  "./",
  "./index.html",
  "./widget.html",
  "./widget.webmanifest",
  "./css/style.css",
  "./css/widget.css",
  "./js/widget.js",
  "./js/firebase-config.js",
  "./js/firebase-init.js",
  "./js/store.js",
  "./js/timebox.js",
  "./js/calendar.js",
  "./js/gcal.js",
  "./js/weekview.js",
  "./js/lib/marked.min.js",
  "./js/lib/purify.min.js",
  "./js/lib/easymde.min.js",
  "./js/lib/easymde.min.css",
  "./js/lib/toastui-editor-all.min.js",
  "./js/lib/toastui-editor.min.css",
  "./js/notes.js",
  "./js/notebook-format.js",
  "./js/notebook.js",
  "./js/app.js",
  "./js/auth.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/maskable-512.png",
  "./icons/favicon-32.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  // 앱 셸: 캐시 우선, 네트워크 폴백 + 캐시 갱신
  e.respondWith(
    caches.match(req).then((cached) => {
      const fetched = fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === "basic") {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || fetched;
    })
  );
});
