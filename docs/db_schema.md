# 🛡️ Ad-Sentinel Database Schema (v1.0)

### 1. User & Auth Mart
- **users**: 사용자 정보 및 권한
  - `user_id` (PK), `email`, `role` (ADMIN/MANAGER/MEMBER), `team_id` (FK)
- **teams**: 부서/팀 정보
  - `team_id` (PK), `team_name`
- **team_account_map**: 팀별 광고 계정 매핑
  - `mapping_id` (PK), `team_id`, `platform` (META/GOOGLE), `ad_account_id`

### 2. Plan Mart (Source of Truth)
- **planned_campaigns**: 구글 시트에서 수집된 기획안
  - `plan_id` (PK), `campaign_name`, `adset_name`, `budget_plan`, `start_date`, `end_date`, `landing_url`
  - `version_no`, `is_active` (최신여부), `sync_at` (동기화시간)

### 3. Actual Mart (Live Data)
- **live_campaign_settings**: 매체 API 실시간 세팅값
  - `live_id` (PK), `ad_account_id`, `platform`, `remote_campaign_id`, `live_budget`, `live_url`
  - `last_fetched_at`

### 4. Audit Mart (Log)
- **audit_logs**: 검수 결과 및 변경 이력
  - `audit_id` (PK), `plan_id`, `live_id`, `issue_type`, `severity`, `diff_payload` (JSON), `is_resolved`