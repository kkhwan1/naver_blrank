# Naver Blog Rank Tracker

네이버 블로그 순위 추적 및 분석 애플리케이션입니다.

## 주요 기능

- **키워드 순위 측정**: 네이버 블로그에서 특정 키워드의 순위를 실시간으로 측정
- **스마트블록 추적**: 네이버 스마트블록 내 순위 변화 모니터링
- **통계 분석**: 키워드별 순위 트렌드 및 성과 분석
- **사용자 관리**: 관리자 및 일반 사용자 계정 시스템
- **그룹 관리**: 키워드 그룹별 관리 및 분석
- **실시간 알림**: 순위 변화 알림 및 리포트

## 기술 스택

### Frontend
- **React 18** with TypeScript
- **Vite** for build tooling
- **Tailwind CSS** for styling
- **React Query** for data fetching
- **Wouter** for routing
- **date-fns** for date formatting

### Backend
- **Node.js** with TypeScript
- **Express.js** for web framework
- **Passport.js** for authentication
- **bcrypt** for password hashing
- **express-session** for session management

### Database
- **PostgreSQL** (Supabase)
- **Drizzle ORM** for database operations

### APIs
- **Naver Search API** for blog search
- **Naver SearchAd API** for keyword statistics
- **HTML Parsing** for rank measurement

## 환경 변수

`.env.example` 파일을 참조하여 다음 환경 변수를 설정하세요:

```env
DATABASE_URL=postgresql://postgres.your-project-ref:your-password@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres
SESSION_SECRET=your-strong-session-secret-key-change-in-production
USE_HTTPS=true
COOKIE_DOMAIN=
NODE_ENV=production
```

## 설치 및 실행

### 개발 환경

1. 저장소 클론:
```bash
git clone https://github.com/kkhwan1/naver_blrank.git
cd naver_blrank
```

2. 의존성 설치:
```bash
npm install
```

3. 환경 변수 설정:
```bash
cp .env.example .env
# .env 파일을 편집하여 실제 값으로 설정
```

4. 개발 서버 실행:
```bash
npm run dev
```

### 프로덕션 빌드

1. 빌드:
```bash
npm run build
```

2. 프로덕션 서버 실행:
```bash
npm start
```

## 배포

이 프로젝트는 **Vercel**을 통해 배포됩니다.

### Vercel 배포 과정

1. GitHub 저장소에 코드 푸시
2. Vercel 대시보드에서 프로젝트 생성
3. GitHub 저장소 연결
4. 환경 변수 설정
5. 자동 배포

### 관리자 계정

배포 후 다음 관리자 계정으로 로그인할 수 있습니다:

- **계정 1**: `lee.kkhwan@gmail.com` / `test123`
- **계정 2**: `keywordsolution` / `test123`

## 프로젝트 구조

```
naver_blrank/
├── client/                 # React 클라이언트 코드
│   ├── src/
│   │   ├── components/     # React 컴포넌트
│   │   ├── pages/          # 페이지 컴포넌트
│   │   ├── lib/            # 유틸리티 및 설정
│   │   └── main.tsx        # 앱 진입점
├── server/                 # Node.js 서버 코드
│   ├── auth.ts             # 인증 설정
│   ├── index.ts            # 서버 진입점
│   ├── routes.ts           # API 라우트
│   ├── storage.ts          # 데이터베이스 작업
│   └── scheduler.ts        # 스케줄링 작업
├── shared/                 # 공유 타입 및 스키마
│   └── schema.ts           # 데이터베이스 스키마
├── dist/                   # 빌드 출력
├── vercel.json             # Vercel 설정
├── .env.example            # 환경 변수 예시
└── README.md               # 프로젝트 문서
```

## API 엔드포인트

### 인증
- `POST /api/login` - 사용자 로그인
- `POST /api/logout` - 사용자 로그아웃
- `GET /api/user` - 현재 사용자 정보

### 키워드 관리
- `GET /api/keywords` - 키워드 목록 조회
- `POST /api/keywords` - 키워드 추가
- `DELETE /api/keywords/:id` - 키워드 삭제
- `POST /api/measure/:id` - 키워드 측정 실행

### 측정 데이터
- `GET /api/measurements/:keywordId` - 측정 데이터 조회
- `GET /api/rank-trend` - 순위 트렌드 조회

## 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다.

## 기여하기

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 문의

프로젝트에 대한 문의사항이 있으시면 이슈를 생성해 주세요.
