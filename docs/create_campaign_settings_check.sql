-- 1. 디버깅용 개별 메타 데이터 저장 테이블 생성 (플랫폼과 무관)
CREATE TABLE IF NOT EXISTS public.campaign_settings_check (
    id              SERIAL PRIMARY KEY,
    -- [기본 식별 정보] Platform, Team, AccountID
    account_id      TEXT,                -- 계정 ID
    -- [캠페인 정보] CampaignID ~ EndDate
    campaign_id     TEXT,                -- 캠페인 ID
    campaign_name   TEXT,                -- 캠페인명
    currency        TEXT,                -- 통화
    campaign_daily_budget    BIGINT,     -- 캠페인 일 예산
    campaign_lifetime_budget BIGINT,     -- 캠페인 예산 (총액)
    campaign_start_time      TEXT,       -- 시작일
    campaign_stop_time       TEXT,       -- 종료일
    -- [광고 세트 정보] AdSetName ~ AdSetLifetimeBudget
    adset_id              TEXT,          -- 광고 세트 ID (내부용)
    adset_name            TEXT,          -- 광고 세트명
    adset_daily_budget    BIGINT,        -- 광고 세트 일 예산
    adset_lifetime_budget BIGINT,        -- 광고 세트 예산 (총액)
    -- [캠페인 설정] CampaignObjective, CampaignBuyingType
    campaign_objective    TEXT,          -- 캠페인 목적
    campaign_buying_type  TEXT,          -- 구매 유형
    -- [광고 소재 정보] AdName ~ UTMParameters
    ad_id             TEXT,              -- 광고 ID (내부용)
    ad_name           TEXT,              -- 광고명
    landing_url       TEXT,              -- 랜딩 URL
    utm_parameters    TEXT,              -- UTM 파라미터
    -- [광고 세트 최적화] AdSetOptimizationGoal ~ CustomEventType
    adset_optimization_goal  TEXT,       -- 최적화 목표
    adset_billing_event      TEXT,       -- 과금 기준
    adset_pixel_id           TEXT,       -- 픽셀/이벤트 ID
    adset_custom_event_type  TEXT,       -- 이벤트 유형
    -- [기타]
    adset_targeting   JSONB,             -- 타겟팅 정보 (JSON)
    effective_status  TEXT,              -- 활성화 상태
    scraped_at        TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. 해당 테이블은 완전히 독립적인 테스트용이므로 RLS를 해제하거나 모두 허용으로 만듭니다.
ALTER TABLE public.campaign_settings_check DISABLE ROW LEVEL SECURITY;
