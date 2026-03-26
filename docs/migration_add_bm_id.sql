-- 플랫폼 설정 테이블에 Business ID (BM ID) 필드 추가
ALTER TABLE public.platform_settings ADD COLUMN IF NOT EXISTS business_id TEXT;
