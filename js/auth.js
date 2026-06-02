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
      // 백업 메뉴에 계정 이메일 표시 + 로그아웃 버튼 연결 (요소 있으면)
      const emailEl = document.getElementById("account-email");
      if (emailEl) emailEl.textContent = user.email || "";
      const soBtn = document.getElementById("signout-btn");
      if (soBtn) soBtn.onclick = window.signOutIronbox;
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
