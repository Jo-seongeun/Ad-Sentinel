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

## 🗄 데이터베이스 스키마 (Core Data Structure)
Ad-Sentinel은 Supabase (PostgreSQL) 기반으로 구축되어 있으며, 주요 테이블은 다음과 같습니다. 해당 구조는 코어 비즈니스 로직과 강하게 결합되어 있으므로 임의 수정 시 주의가 필요합니다.

1. **`users`**: 사용자 계정 정보 (`auth.users`와 1:1 매핑) 및 팀 소속(`team_id`), 권한(`role: SUPER_ADMIN, ADMIN, MEMBER`) 관리
2. **`teams`**: 대행사 또는 부서 단위의 팀 그룹
3. **`team_account_map`**: 팀과 실제 매체(Meta/Google) 광고 계정(`ad_account_id`)을 매핑하는 N:M 연결 테이블
4. **`platform_settings`**: 팀별 또는 전역 매체 API 연동 정보 보관 (App ID, Secret, Refresh Token 등)
5. **`planned_campaigns` / `live_campaign_settings`**: 기획안(Excel) 데이터와 실제 매체(Live) 데이터 캐싱 및 이력 보관용
6. **`audit_logs`**: 실시간 검수 결과 오류/경고 발생 내역 및 해결(Resolved) 상태 추적
7. **`ad_enum_values`**: 각 매체(Meta, Google)의 캠페인 목적, 입찰 전략 등 열거형(Enum) 값과 한글 명칭, 설명이 매핑된 참조(Reference) 테이블

## 🏗 핵심 아키텍처 규칙 (Architecture Guidelines)
- **RLS (Row Level Security)**: Supabase RLS가 전면 적용되어 있습니다. 클라이언트 및 API Route(서버 액션)에서 일반 `supabase` 클라이언트를 사용할 경우 로그인한 유저의 소속 팀(`team_id`) 데이터만 조회/수정 가능합니다.
- **Service Role Bypass**: `teams` 생성이나 `team_account_map` 할당과 같이 RLS `INSERT/DELETE` 권한이 제한된 작업은 서버 액션(`use server`) 내에서 권한(`SUPER_ADMIN/ADMIN`) 검증 후, 별도의 `adminClient`(Service Role Key 사용)를 통해 처리합니다.
- **매체 연동 로직 (`actions.ts`)**: Meta Graph API 및 Google Ads API 통신은 보안상 철저하게 서버 환경(Server Actions)에서만 수행되며, Client-side에서는 호출 결과만 받아 UI를 렌더링합니다.
- **캐싱 및 상태**: React `useTransition`을 활용하여 UI Optimistic Updates와 서버 동기화를 매끄럽게 처리합니다.

---

*본 레포지토리는 Vercel을 통해 자동 배포 환경이 구축되어 있습니다.*

---

## 🔐 권한별 업무 리스트 (Role-based Access Control)

| 기능 / 메뉴 | 슈퍼 관리자 | 관리자 | 팀 관리자 | 팀원 | Guest |
|---|:---:|:---:|:---:|:---:|:---:|
| **[대시보드] 활성 캠페인 모니터링** | ✅ | ✅ | ✅ | ✅ | ❌ |
| **[실시간 검수 센터] Excel 업로드 및 교차 검수 실행** | ✅ | ✅ | ✅ | ✅ | ❌ |
| **[검수 히스토리] 검수 이력 조회** | ✅ | ✅ | ✅ | ✅ | ❌ |
| **[매체 관리] 매체 API 연동 관리** (Meta/Google 토큰 설정) | ✅ | ❌ | ❌ | ❌ | ❌ |
| **[매체 관리] 연결 계정 관리** (팀-광고계정 매핑/해제) | ✅ | ✅ | ❌ | ❌ | ❌ |
| **[사용자 관리] 가입 승인 관리** (Guest 신규 가입자 승인) | ✅ | ✅ | ❌ | ❌ | ❌ |
| **[사용자 관리] 팀 계정 관리** (팀 생성/수정/삭제) | ✅ | ✅ | ❌ | ❌ | ❌ |
| **[사용자 관리] 멤버 관리 - 페이지 접근** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **[사용자 관리] 멤버 관리 - 전체 멤버 조회** | ✅ | ✅ | ✅ (자기 팀만) | ❌ | ❌ |
| **[사용자 관리] 멤버 관리 - 멤버 초대** | ✅ | ✅ | ✅ (자기팀·MEMBER만) | ❌ | ❌ |
| **[사용자 관리] 멤버 관리 - 역할/팀 수정·삭제** | ✅ | ✅ | ❌ | ❌ | ❌ |

### 역할 요약

| 역할 | DB 값 | 특징 |
|---|---|---|
| **슈퍼 관리자** | `SUPER_ADMIN` | 모든 기능 접근 가능. **매체 API 토큰 설정 유일 권한자** |
| **관리자** | `ADMIN` | 시스템 전반 관리 (매체 API 설정 제외) |
| **팀 관리자** | `TEAM_MANAGER` | 검수 기능 + 자기 팀 멤버 초대 (역할은 MEMBER 고정) |
| **팀원** | `MEMBER` | 검수 관련 기능(대시보드/검수/히스토리)만 사용 가능 |
| **Guest** | `GUEST` | 로그인 가능하나 모든 기능 차단. 관리자 승인 대기 상태 |

> **RLS(행 수준 보안)** 적용: `TEAM_MANAGER` / `MEMBER`는 자신의 `team_id`에 속한 데이터만 DB에서 조회됩니다.
