-- Migration: Add refresh_token to platform_settings
-- 이 스크립트를 Supabase SQL Editor 에 복사하여 실행해주세요.

ALTER TABLE public.platform_settings
ADD COLUMN IF NOT EXISTS refresh_token TEXT;
