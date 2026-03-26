-- 테이블 생성 (플랫폼별 외부 API 연동 키/토큰 등 저장)
CREATE TABLE IF NOT EXISTS public.platform_settings (
  platform TEXT PRIMARY KEY, -- 'META', 'GOOGLE' 등
  app_id TEXT,
  app_secret TEXT,
  access_token TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- RLS 정책 활성화
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- 관리자(SUPER_ADMIN, ADMIN)만 설정 값을 조회하고 업데이트할 수 있음
-- *주의: is_admin() 함수가 미리 존재해야 합니다. (이전 admin_rls_fix.sql 에서 생성함)
DROP POLICY IF EXISTS "Admins can manage platform settings" ON public.platform_settings;
CREATE POLICY "Admins can manage platform settings"
ON public.platform_settings FOR ALL
TO authenticated
USING ( public.is_admin() );

-- 기본 데이터 삽입 (선택 사항)
INSERT INTO public.platform_settings (platform) 
VALUES ('META') 
ON CONFLICT (platform) DO NOTHING;
