-- 1. 사용자 테이블에 full_name 컬럼 추가
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS full_name TEXT;

-- 2. 회원가입 시 raw_user_meta_data 에서 full_name 을 추출하여 저장하도록 트리거 함수 수정
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, role, full_name)
  VALUES (
    new.id, 
    new.email, 
    'GUEST', 
    new.raw_user_meta_data->>'full_name'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- (트리거 재연결 불필요 - 함수 내용만 덮어씀)
