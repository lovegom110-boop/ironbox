/* =========================================================================
 * auth.js — 구글 로그인 게이트 + 헤더 계정 아바타
 *  로그인 성공 시에만 App.boot() 호출. 미로그인 시 게이트 오버레이 표시.
 * ====================================================================== */
(function () {
  "use strict";
  const gate = document.getElementById("auth-gate");
  const btn = document.getElementById("google-signin");
  const errEl = document.getElementById("auth-error");
  const accountBtn = document.getElementById("account-btn");
  const accountMenu = document.getElementById("account-menu");
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

  // 헤더 아바타 드롭다운 토글
  if (accountBtn && accountMenu) {
    accountBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      accountMenu.hidden = !accountMenu.hidden;
    });
    document.addEventListener("click", function (e) {
      if (!e.target.closest(".account-wrap")) accountMenu.hidden = true;
    });
  }

  function paintAccount(user) {
    const emailEl = document.getElementById("account-email");
    if (emailEl) emailEl.textContent = user.email || "";
    const soBtn = document.getElementById("signout-btn");
    if (soBtn) soBtn.onclick = window.signOutIronbox;
    if (accountBtn) {
      if (user.photoURL) {
        accountBtn.style.backgroundImage = "url('" + user.photoURL + "')";
        accountBtn.textContent = "";
      } else {
        const base = (user.displayName || user.email || "?").trim();
        accountBtn.textContent = (base[0] || "?").toUpperCase();
      }
    }
  }

  firebase.auth().onAuthStateChanged(function (user) {
    if (user) {
      gate.hidden = true;
      paintAccount(user);
      if (!booted) {
        booted = true;
        window.App.boot();   // 앱 시작 (Store.init은 currentUser.uid 사용)
      }
    } else {
      gate.hidden = false;
    }
  });

  window.signOutIronbox = function () {
    firebase.auth().signOut();
    location.reload();
  };
})();
