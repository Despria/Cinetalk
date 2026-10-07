# 영화 커뮤니티 서비스(CineTalk) — 에이전트 참고용 문서

> React + TypeScript + Vite SPA + json-server REST API 로 구성된 영화 리뷰 커뮤니티.
> labport(학생 실습 플랫폼) 정적 빌드 + 단일 서버 배포 환경에 맞춰져 있다.
> 이 문서는 새 세션 에이전트가 코드 전체를 다시 읽기 전 빠르게 맥락을 잡기 위한 요약이다.

---

## 1. 개요

- **정체**: 영화 목록 → 상세 → 리뷰 작성/삭제, 좋아요/찜, 베스트 랭킹, 영화 등록/수정/삭제, 관리자 권한 관리를 갖춘 커뮤니티.
- **기술 스택**: React 18, TypeScript, react-router-dom v6, Vite 5 (build), json-server 0.17 (REST API + 정적 서빙 통합 서버).
- **테마**: 다크 시네마 테마(전역 CSS 변수 `--card`, `--primary`, `--gold` 등). 모바일/데스크톱 반응형(기준 1000px).

### 공개 주소
- `https://aisw-apps.kopoctc.kr/g/kopo10/react-project/`
- 브라우저에서 바로 접근. labport 프록시가 `<base href>` 를 주입하므로 상대경로(base "./") 사용이 필수.

---

## 2. 실행 / 배포 (labport 규칙)

| 항목 | 값 |
|---|---|
| 실행 | `bash start_server.sh` (재실행도 동일) |
| 서버 파일 | `server.cjs` (json-server + express 통합, `package.json`의 `"start": "node server.cjs"`) |
| 바인딩 | `0.0.0.0` + 환경변수 `PORT` (start_server.sh 가 10000~19999 빈 포트 할당) |
| 정적 산출물 | `dist/` (빌드 후 서버가 서빙) |
| 빌드 | `npm run build` (`tsc -b && vite build`, base "./") |
| 개발 | `npm run dev` (vite, `/api`·`/upload` → 127.0.0.1:3001 json-server 프록시, CORS 회피) |

### 핵심 계약 (절대 위반 금지)
- **`server.cjs` 는 `process.env.PORT` + `0.0.0.0` 바인딩 필수**. (외부 공개 안 됨)
- **포스터 업로드(`POST /upload`)**: 외부 이미지 URL을 받아 서버에서 `curl`(HTTP 프록시 자동 적용)로 다운로드 → `public/posters/` + `dist/posters/`에 저장 → 로컬 경로 반환. Node http 모듈은 외부 인터넷이 안 되므로 curl 위임이 필수.
- `start_server.sh`는 폴더 내용을 보고 실행 방식을 자동 판별(`package.json` → node). 직접 고치지 말 것(재생성됨).
- **코드 수정 후**: 프론트는 `npm run build` + 서버 재시작. 서버 로직 수정은 재시작만.

### 서버 재시작 패턴 (이 세션에서 자주 쓴 명령)
```bash
if [ -f server.pid ]; then kill "$(cat server.pid)" 2>/dev/null; rm -f server.pid; fi
sleep 1; bash start_server.sh
```

---

## 3. 디렉토리 구조

```
src/
├── App.tsx                  # 최상위. 라우팅 + 인증 상태(currentUser) + 세션 복원
├── api/                     # REST API 래퍼 (http.ts 공통 fetch)
│   ├── http.ts              #   BASE_URL = DEV?"/api":BASE_URL("/"), join/GET/POST/PATCH/DELETE
│   ├── movieApi.ts          #   movies CRUD
│   ├── reviewApi.ts         #   reviews (getReviewsByMovie+_expand=user 조인, create/delete)
│   ├── userApi.ts           #   users (조회/생성/권한변경 updateUserAuthority)
│   ├── likeApi.ts           #   likes (좋아요/찜 토글)
│   └── uploadApi.ts         #   POST /upload (외부 URL → 포스터 저장)
├── interfaces/              # 타입 정의
│   ├── Movie.ts             #   rating은 폼 입력 폐지(신규=0). 표시는 리뷰 평균 사용
│   ├── Review.ts            #   rating 1~5, user? 조인(nickname)
│   ├── User.ts              #   authority?: boolean (true=관리자)
│   └── Like.ts              #   LikeType = "like" | "favorite"
├── components/
│   ├── Header/              #   네비(홈/베스트/등록) + 관리자면 "관리" 메뉴
│   ├── HeroBanner/          #   홈 상단 히어로
│   ├── MovieGrid/           #   카드 그리드 (auto-fill, 모바일 minmax 180px)
│   ├── MovieCard/           #   카드: 포스터/제목/★평균평점/장르/좋아요·찜
│   ├── ReviewCard/          #   리뷰 카드 (canDelete = 본인 || 관리자)
│   └── Modal/               #   범용 모달 (small/medium/large/fullscreen, ESC/overlay 닫기, body 스크롤 잠금)
├── modals/                  # 인증/리뷰 작성 관련 모달
│   ├── LoginModal/          #   form onSubmit → 엔터 제출 지원
│   ├── SignupModal/
│   ├── ReviewWriteModal/    #   별점 + 내용
│   └── *ResultModal/        #   결과 알림 / 삭제 확인(confirmMode)
├── pages/
│   ├── Home/                #   메인. 영화 목록 + 필터/정렬 + 상세 모달 + 평균평점 산출
│   ├── Best/                #   랭킹(평점/리뷰/좋아요순) — 평점은 평균 사용
│   ├── MovieForm/           #   등록(/new) + 수정(/edit/:id, 관리자만). 평점 입력란 없음
│   ├── MovieDetail/         #   상세 모달 (DetailPoster/DetailInfo/ReviewList)
│   ├── Admin/               #   관리자 페이지(사용자 권한 토글). admin·본인 회수 불가
│   └── NotFound/
└── App.css / index.css      # 전역 스타일
```

`db.json` — json-server 데이터. 컬렉션: `movies`, `users`, `reviews`, `likes`.

---

## 4. 핵심 데이터 흐름

### 인증 / 세션
- `App.tsx`가 `currentUser: User | null` 을 **메모리**로 보유. prop 으로 하위로 흐름.
- **세션 복원(새로고침 유지)**: 로그인 성공 시 `localStorage["cinetalk.session.userId"]` 에 **userId(숫자)만** 저장. 마운트 시 `getUser(userId)` 로 복원. **비밀번호/loginId는 절대 저장 안 함**. 복원 중(`restoring`)엔 라우트 평가 전 대기(관리자 라우트 오작동 방지).
- 로그인: `getUserByLoginId` → password 비교.
- 회원가입: 중복 체크 → createUser.

### 평점 (중요 — 최근 변경)
- **MovieForm의 평점 입력란은 폐지**됨. 신규 영화는 `rating: 0` 저장.
- 표시/정렬은 **리뷰 rating의 산술평균** 사용. `Home.loadReviewStats()`가 영화별 리뷰를 전부 fetch하며 count + avg + hasAvg(리뷰 0개 여부) 산출 → `avgRatings`/`hasAvg` Map → `MovieGrid`→`MovieCard`로 전달. `Best`도 동일.
- 리뷰 0개면 `★ -`.

### 좋아요 / 찜
- `likes` 컬렉션(type: "like"|"favorite"). `likeApi.toggleLike` 로 추가/제거.

### 관리자(authority)
- `User.authority === true` 면 관리자.
- **슈퍼관리자**: `db.json`에 미리 생성된 `loginId:"admin"` (authority:true). 비번 `admin1234`. → **이 계정과 본인(로그인 중인 관리자)은 권한 회수 불가**(`Admin.tsx`의 `isProtected`).
- 관리자 권한: **모든 리뷰 삭제**(ReviewCard `canDelete`), **영화 삭제/수정**(상세 모달 버튼).
- 라우트 보호: `/edit/:id`, `/admin` 은 `currentUser?.authority` 아니면 `<Navigate to="/" />`.

### 영화 삭제 즉시 갱신
- `MovieDetailModal`에서 영화 삭제 → `onDataChanged` → `Home.reloadData()` 가 `getMovies()` + `getLikes()` + `loadReviewStats()` 모두 재fetch → 카드 즉시 사라짐.

---

## 5. 주요 UI/레이아웃 규칙 (수정 시 주의)

### MovieDetailModal 스크롤 (데스크톱 vs 모바일)
- **데스크톱(>1000px)**: 2컬럼 grid. `.detail-grid`를 **고정 높이 `calc(88vh - 72px)`**(모달 패딩 36×2 제외)로 두어 좌/우 패널 높이 일치 → 포스터가 리뷰에 끌려 늘어나지 않음, 상하 여백 대칭. 우측 패널만 `overflow-y:auto` + `min-height:0`(flex 컨테이너라 필수).
- **모바일(≤1000px)**: 1컬럼. grid 고정 높이 해제, 우측 패널 overflow 끔 → **모달 창(`.modal-large`) 자체가 스크롤** 담당.
- `.reviews-scroller`는 별도 max-height/overflow **없음**(단일 스크롤 원칙 — 이중 스크롤 금지).

### 모달 공통
- `Modal.tsx`: open 시 `document.body.style.overflow = "hidden"` (배경 스크롤 잠금), 닫힘 시 원복. ESC/overlay 닫기 옵션.

### 반응형 기준
- 브레이크포인트 `1000px`. 카드 그리드: 데스크톱 `minmax(260px,1fr)`, 모바일 `minmax(180px,1fr)`.

---

## 6. 데이터 스키마 (db.json)

```jsonc
movies  [{ id, title, poster, genre, director, actors, releaseDate, runningTime, rating(=0,미사용), slogan, plot }]
users   [{ id, loginId, password, nickname, authority? }]   // admin(id=7, authority:true) 내장
reviews [{ id, movieId, userId, rating(1~5), content, createdAt, updatedAt? }]
likes   [{ id, userId, movieId, type("like"|"favorite") }]
```

### 시드 계정 (db.json)
| loginId | 비번 | 권한 |
|---|---|---|
| `admin` | `admin1234` | 슈퍼관리자(회수 불가) |
| `cinephile`/`scifan`/`dreamer`/`critic` | `1234` | 일반 |
| `kopo10` | `1234` | 일반 |
| `test` | `test` | 일반 |

> json-server는 누구나 PATCH/DELETE 가능 → **보안은 프론트 게이팅만**으로 처리(과제 범위). 실서비스면 서버 검증 필요.

---

## 7. 진행 상황 (완료된 작업)

| # | 항목 | 상태 |
|---|---|---|
| 1 | MovieForm 평점 입력 폐지 + Home/Best 리뷰 평균 평점 산출·표시·정렬 | ✅ |
| 2 | MovieDetailModal 스크롤(모바일 단일 스크롤, 데스크톱 고정높이·상하정렬) + 모달 배경 스크롤 잠금 | ✅ |
| 3 | 관리자 기능: authority 필드 + admin 슈퍼계정, /admin 권한부여/회수(admin·본인 보호), 관리자 리뷰·영화 삭제, 영화 수정(/edit), 삭제 즉시 갱신 | ✅ |
| + | 새로고침 세션 유지(userId localStorage, 비밀번호 미저장) | ✅ |
| + | LoginModal 엔터키 제출 | ✅ |
| + | package.json `"start": "node server.cjs"` 추가 (404 원인 해결) | ✅ |

### 알려진 제약 / 메모
- **GitLab 푸시는 학생이 별도 진행** (`std-gitlab.kopoctc.kr/kopo101/portfolio_moviereview`). 현재 repo는 remote 없이 로컬 커밋(`57045c1`)까지 완료.
- 평점 산출이 영화별로 `getReviewsByMovie`를 N회 호출(N+1). 영화 수가 늘면 최적화 여지 있음(`/reviews` 1회 + 클라이언트 groupBy).
- 외부 이미지 다운로드는 curl 경유(프록시 환경). Node http 직접 호출 금지.

---

## 8. 에이전트 작업 시 빠른 참조

- **뭘 해야 할지 모르면**: 서버 상태부터 (`cat server.port`, `kill -0 $(cat server.pid)`). 죽었으면 `bash start_server.sh`.
- **프론트 수정 후**: 반드시 `npm run build` → 서버 재시작 → 브라우저 새로고침.
- **API 동작 점검**: `curl http://127.0.0.1:$(cat server.port)/movies` 등으로 직접 확인.
- **DB 직접 수정(db.json)**: 서버 재시작 필요(메모리 로드).
- **공통 fetch 경로**: `api/http.ts` 의 `join(BASE_URL, path)`. DEV=/api(프록시), BUILD=BASE_URL("./").
- 새 컴포넌트/페이지는 다크 테마 CSS 변수(`--card`, `--primary`, `--gold`, `--text-muted`) 재사용.
