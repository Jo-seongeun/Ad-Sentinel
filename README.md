# Ad-Sentinel (애드센티널)

**Ad-Sentinel**은 광고 기획안과 실제 매체에 세팅된 데이터를 실시간으로 비교 검수하여, 예산 누수나 세팅 오류를 방지하는 **광고 운영 자동 검수 대시보드**입니다. 

## 🎯 주요 목적 (Core Purpose)
디지털 광고 캠페인 운영 시, 담당자가 엑셀로 기획한 예산, 랜딩 URL, UTM 파라미터 등의 정보가 실제 매체(예: Meta Ads)에 정확히 세팅되었는지 **크로스 체크**하는 프로세스를 자동화합니다. 이를 통해 사람의 실수(Human Error)로 발생할 수 있는 막대한 금전적 손실이나 데이터 추적 오류를 사전에 차단합니다.

## ✨ 주요 기능 (Key Features)
1. **실시간 검수 센터 (Real-time Audit Center)**
   - 엑셀(xlsx) 기획안 파일 드래그 앤 드롭 업로드 지원
   - 타겟팅 요약, CBO(캠페인 예산) vs ABO(세트 예산), 과금 기준, 최적화 목표 등 세부 필드 검증
   - 매체 API(Meta Graph API)를 호출하여 기획안 데이터와 Live 데이터의 글자 단위 불일치 검수 (랜딩 URL, UTM 등)
   - 결과에 따른 직관적인 상태 뱃지 (PASS / WARNING / FAIL) 제공

2. **검수 히스토리 (Audit History)**
   - 과거 검수 내역 및 발생했던 오류, 에러 로그 영구 기록
   - 남은 오류 내역을 일괄 해소할 수 있는 "오류 내역 All Pass" 기능 통해 히스토리 트래킹 편의성 강화

3. **팀/사용자 및 권한 설정 (Settings & Admin)**
   - Supabase Auth 및 RLS(Row Level Security)를 이용한 완벽한 데이터 격리 및 권한 관리(SUPER_ADMIN, ADMIN, USER)
   - 팀원 추가, 삭제 및 소속 관리
   - 매체 연동 관리: Meta 등 각 매체별 API 플랫폼 토큰을 DB에 안전하게 암호화 보관 및 로컬 `.env` 환경 Fallback 지원

## 🛠 기술 스택 (Tech Stack)
- **Framework:** Next.js (App Router), React
- **Styling:** Tailwind CSS, Lucide React (Icons)
- **Database & Auth:** Supabase (PostgreSQL, Row Level Security)
- **Utilities:** `xlsx` (Excel Parsing), `date-fns` (Date Formatting)

---

## 🚀 Getting Started (개발 서버 실행 및 설정)

먼저 로컬 환경 변수(`.env.local`)를 설정합니다:
```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
META_ACCESS_TOKEN=your_meta_token_for_local_testing
```

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
