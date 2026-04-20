-- 1. 디버깅용 개별 메타 데이터 저장 테이블 생성 (플랫폼과 무관)
CREATE TABLE IF NOT EXISTS public.campaign_settings_check (
    id SERIAL PRIMARY KEY,
    campaign_id TEXT,
    currency TEXT,
    campaign_name TEXT,
    campaign_daily_budget BIGINT,
    campaign_lifetime_budget BIGINT,
    campaign_start_time TEXT,
    campaign_stop_time TEXT,
    adset_id TEXT,
    adset_name TEXT,
    adset_daily_budget BIGINT,
    adset_lifetime_budget BIGINT,
    account_id TEXT,
    campaign_objective TEXT,
    campaign_buying_type TEXT,
    ad_id TEXT,
    ad_name TEXT,
    landing_url TEXT,
    utm_parameters TEXT,
    effective_status TEXT,
    adset_optimization_goal TEXT,
    adset_billing_event TEXT,
    adset_pixel_id TEXT,
    adset_custom_event_type TEXT,
    adset_targeting JSONB,
    scraped_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. 해당 테이블은 완전히 독립적인 테스트용이므로 RLS를 해제하거나 모두 허용으로 만듭니다.
ALTER TABLE public.campaign_settings_check DISABLE ROW LEVEL SECURITY;
