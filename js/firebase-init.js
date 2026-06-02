/* =========================================================================
 * firebase-init.js — Firebase 앱 초기화 + Firestore 오프라인 퍼시스턴스
 *  compat SDK 로드 직후, 다른 모든 스크립트보다 먼저 실행되어야 함.
 * ====================================================================== */
(function () {
  "use strict";
  firebase.initializeApp(window.FIREBASE_CONFIG);

  const db = firebase.firestore();
  // undefined 필드가 섞여도 set()이 거부되지 않도록(조용한 저장 실패 방지). 어떤 Firestore 호출보다 먼저 1회.
  db.settings({ ignoreUndefinedProperties: true });

  // 오프라인 퍼시스턴스: 로컬 캐시로 오프라인 동작 + 기기 간 동기화
  // (어떤 Firestore 호출보다 먼저 1회만 실행)
  db.enablePersistence({ synchronizeTabs: true })
    .catch(function (err) {
      // failed-precondition: 여러 탭 동시 열림 / unimplemented: 미지원 브라우저
      console.warn("Firestore persistence 미활성:", err && err.code);
    });
})();
