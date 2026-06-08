# IRONBOX 위젯 — 설치파일(.msi/.exe) 만들기

이 폴더는 위젯을 **윈도우 설치파일**로 만드는 Tauri 프로젝트입니다.
앱 창은 **배포된 `widget.html`(원격 https 주소)** 를 불러옵니다 → 그래서 **구글 로그인이 정상**이고,
위젯 디자인을 고쳐도 **다시 안 구워도** 됩니다(배포만 갱신).

---

## ★ 공통 사전작업 (딱 두 가지)

### 1) 위젯을 배포해서 주소 확보
새 위젯 파일들(`widget.html`, `css/widget.css`, `js/widget.js`, `widget.webmanifest`, 수정된 `sw.js`)을
깃에 올려 배포 → `https://<내앱>/widget.html` 이 열리는지 확인.

### 2) 주소 설정 — ✅ 이미 채워둠 (`https://ironbox-six.vercel.app`)
아래 두 곳이 이미 시영님 주소로 채워져 있습니다(사이트가 cleanUrls라 위젯은 `/widget` 으로 로드):
- `src-tauri/tauri.conf.json` → `windows[0].url` = `https://ironbox-six.vercel.app/widget`
- `src-tauri/capabilities/widget.json` → `remote.urls` = `https://ironbox-six.vercel.app`

> 주소가 바뀌면 위 두 곳만 고치면 됩니다.

---

## 방법 ① 클라우드에서 굽기 (추천 · 내 PC에 Rust 설치 불필요)
깃허브가 대신 윈도우 설치파일을 만들어 줍니다. 회사망 빌드 문제 없음.

1. 위 사전작업(주소 교체) 한 `desktop/` 폴더와 `.github/workflows/build-widget.yml` 을 **깃에 push**.
2. GitHub 저장소 → **Actions** 탭 → **"IRONBOX 위젯 설치파일 빌드"** 선택 → **Run workflow** 클릭.
3. 5~10분 뒤 초록불 → 그 실행 페이지 맨 아래 **Artifacts → `ironbox-widget-windows-installer`** 다운로드(zip).
4. zip 안의 **`.msi`(또는 `*-setup.exe`)** 더블클릭 → 설치 → 시작메뉴 "IRONBOX 위젯" 실행.

> 팁: `widget-v1` 같은 태그를 push하면 자동으로도 빌드돼요.

## 방법 ② 내 PC에서 굽기 (인터넷 되는 PC, Rust 설치 가능할 때)
0. 준비물(1회): **Node.js**(LTS), **Rust**(https://rustup.rs), **Visual Studio C++ Build Tools**("Desktop development with C++"), WebView2(윈11 기본 탑재).
1. 위 사전작업(주소 교체) 완료.
2. 이 `desktop/` 폴더에서:
   ```
   npm install
   npm run tauri -- icon ../icons/icon-512.png
   npm run build
   ```
3. 설치파일 위치:
   - `src-tauri/target/release/bundle/msi/*.msi`
   - `src-tauri/target/release/bundle/nsis/*-setup.exe`
4. (미리보기만) `npm run dev`

---

## 막히면 (자주 나오는 것만)
- **창의 ─ / ✕ 버튼이 안 먹어요** → `Alt + F4` 로 닫기.
  계속 그러면 `tauri.conf.json` 의 `"decorations": false` → `true` 로(윈도우 기본 닫기 버튼 생김).
- **로그인 화면에서 안 넘어가요** → ① `url` 이 진짜 배포 https 주소인지, ② Firebase 콘솔 →
  Authentication → 설정 → **승인된 도메인**에 그 도메인이 있는지(웹앱이 이미 그 도메인이면 OK).
- **빌드가 버전 차이로 에러** → 빈 폴더에서 `npm create tauri-app@latest` 로 기본 틀을 새로 만든 뒤,
  이 폴더의 `tauri.conf.json`(창 설정)·`capabilities/widget.json`·`src/main.rs`의 shell 플러그인 줄·
  `Cargo.toml`의 `tauri-plugin-shell` 줄만 옮기면 됩니다.
- **Actions 빌드가 빨간불** → 그 실행의 로그를 복사해 주시면 원인 잡아드릴게요.

> 위젯에서 체크/추가한 건 같은 계정이라 웹·폰에 반영됩니다(웹앱 화면은 새로고침 시 반영).
