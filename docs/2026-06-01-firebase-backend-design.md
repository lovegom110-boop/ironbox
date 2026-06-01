# IRONBOX — 1차 백엔드 전환 설계 (Firebase)

> 작성일: 2026-06-01 · 확정일: 2026-06-02 · 상태: **확정 (구현 계획 착수)**
> 범위: **Phase 1만** — Auth + Firestore + 보안규칙 + 내 데이터 이관.
> 결제·유료티어·멀티유저 온보딩은 **이 문서 범위 밖**(별도 후속 단계).

## ✅ 확정된 결정 (2026-06-02)
- **목표**: 다기기 동기화 + 백업 + 멀티유저(각자 격리) + 정식 계정 기반 서비스 — 전부 포함
- **멀티유저 모델**: 각자 자기만의 다이어리(`users/{uid}` 격리), 공유/팀 기능은 비범위
- **오프라인 전략**: A — Firestore 단독(오프라인 퍼시스턴스 ON)
- **인증**: Google 로그인만
- **Calendar OAuth**: Phase 1에서는 Firebase Auth와 분리 유지
- **로컬 백업 기능(디스크 JSON / export·import)**: 유지(클라우드와 별개 안전망)
- **마이그레이션 전 백업**: 완료 — 커밋 `e45e0c7`, `backup/pre-firebase` 브랜치 + `pre-firebase-backup` 태그 (origin 푸시됨)

---

## 1. 목표와 배경

### 왜 하는가
- (현재 통증) 데이터가 **IndexedDB**라 기기마다 따로 논다 → 폰/PC 동기화 안 됨. 브라우저 캐시 삭제 시 손실 위험.
- (미래 포석) 언젠가 수익화하려면 "사용자별 계정 + 클라우드 데이터"가 **무조건 전제**다.

### Phase 1의 성공 기준
1. Google 로그인으로 본인 계정 생성
2. 기존 IndexedDB/JSON 데이터가 **누락·손상 없이** 내 계정으로 이관됨
3. 폰·PC 어디서 열어도 같은 다이어리가 보임 (동기화)
4. 오프라인에서도 기존처럼 동작 (PWA 유지)
5. 보안규칙으로 **내 데이터는 나만** 읽고 쓸 수 있음
6. 남이 가입해도 데이터가 안 섞이는 구조 (멀티유저 *준비*만 — 온보딩 완성도는 후속)

### 명시적 비범위 (Out of Scope)
- 결제 / 구독 / 유료 티어 / Stripe → **만들지 않는다** (YAGNI)
- 가입 유도 UI, 마케팅, 가격 설계
- 팀/공유 기능

---

## 2. 현재 구조 (As-Is)

| 항목 | 현재 |
|---|---|
| 배포 | Vercel 정적 (바닐라 HTML/CSS/JS, 빌드 없음) |
| 저장 | IndexedDB `elonDiary` (`days` 스토어, keyPath `date`) + `meta` 스토어 |
| 백업 | File System Access(PC 크롬/엣지 로컬 JSON 파일) + 수동 JSON export/import |
| 인증 | 없음 |
| 외부 연동 | Google Calendar OAuth (client ID는 localStorage) |
| 데이터 계층 | `js/store.js` 에 **깔끔한 Store API로 이미 추상화됨** ← 핵심 자산 |

### 현재 데이터 모델
```
day = {
  date: "YYYY-MM-DD",   // 고유 키
  wakeNote: string,
  tasks: [ {
    id, text, category,
    status: "do|delete|delegate|defer",
    isBig3: bool, done: bool,
    plannedStart: int|null, plannedDur: int, actualMin: int|null
  } ],
  feedback: string,
  tomorrowPlan: string,
  updatedAt: number     // epoch ms (last-write-wins용으로 이미 존재 👍)
}
```

### 이관이 쉬운 이유
- `date`가 이미 **고유 키** → Firestore 문서 ID로 그대로 사용
- 관계/중첩 없는 평평한 구조, 데이터량 작음(연 ~365문서)
- `store.js`에 `exportAll()`(→`{days:[...]}` JSON), `importAll()` 이미 존재
- `updatedAt` 필드가 이미 있어 동기화 충돌 시 last-write-wins 적용 가능

---

## 3. 목표 구조 (To-Be)

```
[브라우저 PWA (Vercel 그대로)]
      │
      ├─ Firebase Auth (Google 로그인)  → uid 획득
      │
      └─ Firestore  users/{uid}/days/{YYYY-MM-DD}   ← 다이어리 데이터
                     users/{uid}/meta/{key}          ← 설정 등
         (오프라인 퍼시스턴스 ON → 기존 오프라인 동작 유지)
```

- **배포는 Vercel 유지.** Firebase는 클라이언트 SDK로만 사용 (Firebase Hosting 불필요).
- Firestore **데이터 모델은 현재 `day` 객체 그대로** 저장 → 변환 거의 없음.
- 문서 경로에 `uid`가 들어가 사용자별 자동 격리.

### Firestore 구조
```
users/{uid}
  ├─ days/{date}     // day 객체 그대로 (date 필드 = 문서 ID)
  └─ meta/{key}      // { key, value } — 기존 meta 스토어 대응
```

> 참고: 파일 핸들(File System Access)은 기기 종속이라 Firestore로 옮기지 않음.
> JSON export/import와 디스크 백업 기능은 **그대로 유지**(클라우드와 별개의 안전망).

---

## 4. 핵심 설계 결정

### 4-1. Store 계층을 백엔드 교체 가능하게
현재 `js/store.js`가 이미 좋은 추상화라 **앱 코드(app.js 등)는 거의 안 건드린다.**
- 같은 공개 API(`init/getDay/saveDay/getAllDays/getMonthMarks/search/exportAll/importAll`)를 유지
- 내부 구현만 IndexedDB → Firestore로 교체 (또는 아래 4-2 하이브리드)
- 이렇게 하면 UI 코드 변경 최소화 + 롤백 쉬움

### 4-2. 오프라인 전략 — ⚠️ 확정 전 결정사항 (A vs B)
| | A. Firestore 단독 (오프라인 퍼시스턴스) | B. IndexedDB 로컬우선 + Firestore 동기화 |
|---|---|---|
| 방식 | 로컬 캐시를 Firestore SDK가 관리 | 기존 IndexedDB 유지 + 변경분을 Firestore에 sync |
| 장점 | 단순, 코드 적음, 동기화 SDK가 알아서 | 완전 오프라인 우선, 기존 코드 재활용 |
| 단점 | 첫 로드 시 네트워크 의존 약간 | 동기화/충돌 로직 직접 작성 → 복잡 |
| 추천 | **개인 앱엔 A 권장** (단순함이 이김) | 과한 견고함, 보통 불필요 |

→ **권장: A.** 단일 사용자가 여러 기기를 쓰는 시나리오는 Firestore 오프라인 퍼시스턴스 + `updatedAt` last-write-wins로 충분.

### 4-3. 인증 방식 — ⚠️ 확정 전 결정사항
- **권장: Google 로그인 우선** (이미 Calendar OAuth로 Google 생태계 사용 중 → 사용자 경험 일관)
- 이메일/비밀번호 로그인 추가 여부는 선택 (멀티유저 확장 시 고려, Phase 1엔 Google만으로 충분)
- 기존 Calendar OAuth와 **Firebase Auth는 별개 토큰**임에 유의 — 통합 가능하나 Phase 1에선 분리해도 무방.

### 4-4. 보안규칙 (필수)
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
→ 로그인한 본인(uid 일치)만 자기 데이터 접근. **이게 멀티유저 안전성의 핵심.**

> 보안 주의: Firebase 웹 config의 `apiKey`는 공개되어도 되는 값(비밀키 아님). 하지만 실제 키·인증정보는 코드/문서에 하드코딩하지 않고 환경변수/배포 설정으로 관리한다. 본 문서엔 placeholder만 사용.

---

## 5. 데이터 이관 계획 (내 데이터)

가장 안전한 1회성 절차:
1. 현재 앱에서 **JSON 백업 내보내기**(`downloadExport`) — 원본 안전 확보
2. Firebase 프로젝트 생성 + Auth(Google) + Firestore 활성화 + 보안규칙 배포
3. 새 Firestore Store 구현체로 앱 빌드 (Vercel 프리뷰 배포)
4. Google 로그인 → **import 화면에서 백업 JSON 업로드** → 각 `day`를 `users/{uid}/days/{date}`로 write
   - 기존 `importAll()` 로직 재사용 (대상만 Firestore로)
5. 검증: 날짜 수, 임의 날짜 내용, 검색·달력 마크가 기존과 일치하는지 대조
6. 폰에서 로그인해 같은 데이터 보이는지 확인 (동기화 검증)

**롤백**: 원본 IndexedDB와 JSON 백업이 그대로 남아 있으므로 언제든 복귀 가능. (이관은 복사이지 이동이 아님)

> ⚠️ 검증 전까지 기존 IndexedDB 데이터를 **삭제하지 않는다.**

---

## 6. 위험 요소 & 대응

| 위험 | 영향 | 대응 |
|---|---|---|
| 이관 중 데이터 누락 | 일기 손실 | 원본 보존 + 이관 후 건수/내용 대조, 검증 전 원본 미삭제 |
| 보안규칙 실수로 데이터 공개 | 프라이버시 | 규칙 우선 배포 + 에뮬레이터/테스트로 검증 |
| "서버 전송 없음" 포지션 포기 | 프라이버시 인식 | 의도된 트레이드오프(동기화 위해). README/문구 업데이트 |
| 오프라인 동작 저하 | UX | Firestore 퍼시스턴스 ON + 실제 오프라인 테스트 |
| Google OAuth(캘린더)와 Auth 혼선 | 로그인 꼬임 | Phase 1에선 두 흐름 분리 유지, 추후 통합 검토 |
| 무료 티어 초과 | 비용 | 개인 사용량은 무료 한도 내(아래) |

---

## 7. 비용 (개인 사용 기준)
- Firestore 무료 한도: 문서 읽기 5만/일, 쓰기 2만/일, 저장 1GiB.
- 다이어리는 하루 수십 read/write 수준 → **사실상 무료.**
- 사용자가 늘어 한도 초과 시 Blaze(종량제) 전환 — 그땐 이미 수익화 단계.

---

## 8. 작업 분해 (Phase 1 내부 순서)
1. Firebase 프로젝트/Auth/Firestore 셋업 + 보안규칙 배포
2. `store.js` → Firestore 구현체 작성 (공개 API 동일 유지, 오프라인 퍼시스턴스 ON)
3. 로그인 UI(Google) 추가 + 로그인 게이트
4. import 경로를 Firestore 대상으로 연결 (기존 importAll 재사용)
5. 내 데이터 이관 + 검증 + 폰 동기화 확인
6. README/CLAUDE.md 갱신("로컬 전용" → "클라우드 동기화"), 서비스워커 캐시 버전업

→ 각 단계는 구현 시 `writing-plans`로 상세 계획화.

---

## 9. 확정 전 결정사항 (구현 착수 전 답할 것) — ✅ 전부 확정 (2026-06-02)
- [x] **오프라인 전략**: A(Firestore 단독) ✅ 확정
- [x] **인증 범위**: Google만 ✅ 확정
- [x] **Calendar OAuth 통합 여부**: Phase 1에서 분리 유지 ✅ 확정
- [x] **기존 디스크 파일 백업 기능 유지 여부**: 유지 ✅ 확정

---

## 10. 다음 단계
1. 위 "확정 전 결정사항" 4개 확정
2. 확정되면 `writing-plans`로 단계 8을 실행 가능한 구현 계획으로 변환
3. 수익 모델은 **별도 브레인스토밍**으로 분리 (이 문서와 무관하게 진행 가능)

*관련 문서: [CLAUDE.md](../CLAUDE.md), [DESIGN.md](../DESIGN.md), [store.js](../js/store.js)*
