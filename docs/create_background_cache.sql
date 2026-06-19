-- 1. live_campaign_cache 테이블 생성
CREATE TABLE IF NOT EXISTS public.live_campaign_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
    platform TEXT CHECK (platform IN ('META', 'GOOGLE')),
    account_id TEXT NOT NULL,
    campaign_id TEXT NOT NULL,
    campaign_name TEXT NOT NULL,
    effective_status TEXT NOT NULL,
    spend NUMERIC DEFAULT 0,
    budget NUMERIC DEFAULT 0,
    start_date TEXT,
    end_date TEXT,
    last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(team_id, platform, campaign_id)
);

-- 2. team_sync_status 테이블 생성
CREATE TABLE IF NOT EXISTS public.team_sync_status (
    team_id UUID PRIMARY KEY REFERENCES public.teams(id) ON DELETE CASCADE,
    last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    sync_status TEXT DEFAULT 'SUCCESS', -- 'SUCCESS' 또는 'ERROR'
    error_message TEXT
);

-- 3. RLS(Row Level Security) 활성화
ALTER TABLE public.live_campaign_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_sync_status ENABLE ROW LEVEL SECURITY;

-- 4. RLS 정책 설정
-- 사용자는 자신이 속한 팀의 캠페인 캐시 데이터만 조회할 수 있습니다.
DROP POLICY IF EXISTS "Users can view their team's campaign cache" ON public.live_campaign_cache;
CREATE POLICY "Users can view their team's campaign cache"
ON public.live_campaign_cache FOR SELECT
TO authenticated
USING (team_id = public.current_user_team_id() OR public.is_admin());

-- 사용자는 자신이 속한 팀의 동기화 상태만 조회할 수 있습니다.
DROP POLICY IF EXISTS "Users can view their team's sync status" ON public.team_sync_status;
CREATE POLICY "Users can view their team's sync status"
ON public.team_sync_status FOR SELECT
TO authenticated
USING (team_id = public.current_user_team_id() OR public.is_admin());

-- 참고: 이 테이블들에 대한 INSERT/UPDATE/DELETE 작업은 서버(adminSupabase Service Role Key)에서만 수행되므로,
-- 일반 인증된 사용자들을 위한 변경(수정/삭제) 권한 정책은 추가하지 않습니다.
