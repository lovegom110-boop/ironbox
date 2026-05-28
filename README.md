# ⏱ IRONBOX — 타임박스 플래너

> **IRONBOX** = 아이언맨(일론 머스크 별명) + 타임**BOX**

일론 머스크식 시간관리를 반영한 **개인 다이어리 PWA**.
아침에 머릿속을 비우고(Brain Dump), 꼭 필요한 일만 골라(4D), 같은 일끼리 묶어(배칭), 오늘의 핵심 3개를 정하고(Big 3), 30분 블록에 배치한 뒤(Time Box), 저녁에 돌아봅니다(Feedback · Plan vs Actual).

## 핵심 기능
- ☀️ **기상 직후 할 일** 메모 (매일 직접 입력)
- 🧠 **Brain Dump** — 할 일 빠르게 쏟아내기
- ✅🕓🤝🗑 **4D 정리** — Do / Defer / Delegate / Delete ("이거 꼭 해야 하나?")
- 🏷 **배칭(태그)** — 같은 성격의 일 묶기
- ⭐ **Big 3** — 오늘의 핵심 3가지
- 🗓 **30분 타임박스** — 할 일을 타임라인 블록에 배치 (클릭 선택 → 칸 클릭)
- 🌙 **회고 + Plan vs Actual** — 블록별 실제 시간 입력, 계획 대비 비교
- 📅 **달력 + 검색** — 과거 다이어리 열람·검색

## 🔒 데이터 & 프라이버시
- 모든 데이터는 **사용자 기기에만** 저장됩니다. **서버로 전송하지 않습니다.**
- 1차 저장: 브라우저 **IndexedDB**
- 영구 백업(권장, 크롬/엣지 PC): 메뉴 → **“디스크 파일에 자동저장 연결”** → 지정한 `.json` 파일에 변경 시마다 자동 기록
  - 그 파일을 **Google Drive/OneDrive 동기화 폴더**에 두면 자동 클라우드 백업 + 기기 간 공유 (내용은 여전히 본인만 소유)
- 어디서나 백업: 메뉴 → **JSON 내보내기 / 불러오기**

> ⚠️ 브라우저 “쿠키 및 사이트 데이터 삭제” 시 IndexedDB도 지워질 수 있습니다.
> 중요한 기록은 **디스크 파일 자동저장**이나 **JSON 백업**을 꼭 사용하세요.

## 로컬 실행
서비스워커/PWA는 `file://`에서 동작하지 않으므로 간단한 로컬 서버로 엽니다.

```bash
# 이 폴더에서
python -m http.server 8000
# 브라우저에서 http://localhost:8000 접속
```
또는 VS Code의 **Live Server** 확장 사용.

## ▲ Vercel 배포
정적 사이트라 빌드가 필요 없습니다.

- **방법 A (GitHub 연동)**: 이 폴더를 GitHub 저장소로 올리고 → Vercel에서 New Project → Import → (Framework: Other, 빌드 명령 없음) → Deploy
- **방법 B (CLI)**:
  ```bash
  npm i -g vercel
  vercel        # 이 폴더에서 실행, 안내 따라 배포
  vercel --prod # 프로덕션 배포
  ```

배포 후 HTTPS URL에서 **PWA 설치**(주소창의 설치 아이콘)로 PC·모바일 홈에 추가할 수 있습니다.

## 폴더 구조
```
index.html
css/style.css
js/
 ├─ store.js     # IndexedDB + 디스크 파일 + 백업
 ├─ timebox.js   # 30분 타임라인
 ├─ calendar.js  # 월간 달력
 └─ app.js       # 메인 컨트롤러
manifest.json    # PWA
sw.js            # 서비스워커(오프라인)
icons/
vercel.json
```

## 향후 확장(로드맵)
- 고정 루틴 템플릿, 더 강력한 검색/태그 필터
- (선택) 사용자 본인 클라우드 동기화 또는 E2E 암호화 동기화
- 네이티브: 같은 코드를 **Tauri**(PC) / **Capacitor**(모바일)로 감싸 배포
