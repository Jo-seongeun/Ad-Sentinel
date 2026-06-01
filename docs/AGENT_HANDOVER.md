# 🤖 Ad-Sentinel Agent Handover Document

새로운 Agent 환경에서 이 프로젝트(Ad-Sentinel)를 이어서 작업하기 위한 핵심 컨텍스트 가이드입니다. 이전 세션들에서 진행된 내용과 프로젝트의 현재 상태를 요약합니다.

## 📌 1. 프로젝트 개요 (Project Overview)
**Ad-Sentinel**은 Meta Ads 및 Google Ads의 실제 세팅 데이터와 기획안(Excel)의 데이터를 실시간으로 비교 검수(Cross-check)하는 사내용 대시보드입니다.
- **핵심 기능**: 캠페인/광고그룹/광고 단위의 예산, 랜딩 URL, UTM, 캠페인 목적 등의 불일치를 찾아내어 Human Error로 인한 리스크를 방지합니다.
- **주요 스택**: Next.js (App Router), React, Tailwind CSS, Supabase (PostgreSQL), Meta Graph API, Google Ads API.

## 🔄 2. 최근까지 진행된 핵심 작업 내용
1. **Meta Ads 및 Google Ads 연동 완료**
   - OAuth 기반 인증 및 `platform_settings` DB 저장/조회.
   - Excel 기획안 데이터를 파싱하여 Meta/Google API 응답(Live 데이터)과 1:1 교차 검수하는 메인 로직(`audit/actions.ts`) 완성.
   - 캠페인 ID 유무에 따른 스마트 매칭 로직 적용.

2. **광고 매체별 ENUM 값 DB화 (ad_enum_values)**
   - Meta 및 Google의 캠페인 목적, 입찰 전략(Buying Type), 최적화 목표 등의 영문 API 응답값을 한글명 및 설명과 매핑하는 `ad_enum_values` 테이블 신설.
   - 파이썬 스크립트(`fetch_ad_enum_values.py`)를 통해 공식 API 문서 기준 정적 매핑과 실제 라이브 계정 스캔 결과를 혼합하여 DB 구축 완료.

3. **팀 및 계정 매핑 (Team & Account Management)**
   - RLS(Row Level Security) 정책을 전면 적용.
   - `팀 생성` 및 `광고 계정 할당(팀-계정 매핑)` 시, `team_account_map` 테이블에 대한 INSERT/DELETE 권한 문제를 해결하기 위해 `adminClient`(Service Role Key)를 도입하여 서버 액션(`actions.ts`)에서 안전하게 DB를 조작하도록 개선.
   - 계정 할당 페이지 UI 개선: 팀 리스트와 할당된 계정 리스트를 상하(Vertical) 2열 구조로 변경하고, 팀 검색 기능을 추가.

## 🗄 3. 데이터베이스 (Supabase) 핵심 구조
- **`teams`**: 대행사/부서별 단위.
- **`users`**: 유저 계정 (`auth.users` 연동). `team_id`, `role` (SUPER_ADMIN, ADMIN, MEMBER) 포함.
- **`team_account_map`**: 특정 팀과 여러 매체의 광고 계정(`ad_account_id`)을 연결해주는 다대다 테이블.
- **`audit_logs`**: 실시간 검수 시 발생한 모든 문제 내역 이력 기록 테이블.
- **`ad_enum_values`**: 각 매체의 Enum(열거형) 값 번역 딕셔너리 테이블.

## ⚠️ 4. 신규 작업 시 주의사항 (Critical Constraints)
1. **DB RLS 정책 준수**:
   - 일반 클라이언트(`createClient()`)는 항상 **현재 로그인한 사용자의 `team_id`** 조건에 제약을 받습니다.
   - 어드민 전용 데이터 조작(팀 추가, 팀 간 계정 이동 등)은 반드시 `requireAdmin()`으로 권한 검사 후 `adminClient` (Service Role Key)를 사용해야 합니다.
2. **API 호출의 Server Side 캡슐화**:
   - Meta/Google API 액세스 토큰은 절대 클라이언트로 노출시키지 않습니다. API 호출은 모두 Server Actions 혹은 Route Handlers에서만 처리해야 합니다.
3. **환경 변수**:
   - 로컬 테스트 시 `.env.local` 에 `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` 등의 키가 반드시 세팅되어야 합니다.

---
> **다음 Agent 님께**: 위 내용과 `README.md`를 참고하여 사용자(USER)가 요청하는 신규 기능 추가 또는 버그 수정을 이어서 진행해 주시면 됩니다! 화이팅! 🚀
