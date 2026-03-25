-- 1. 새로운 사용자가 가입할 때 자동으로 public.users 에 GUEST 로 생성되도록 하는 Trigger Function 수정
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, role)
  VALUES (new.id, new.email, 'GUEST');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. 이미 존재하는 Trigger가 있다면 덮어쓰기 위해 다시 연결
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 3. 슈퍼 관리자가 유저의 권한을 업데이트할 수 있도록 RLS(Row Level Security) 추가
CREATE POLICY "Admins can update user profiles"
ON public.users FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users AS me 
    WHERE me.id = auth.uid() AND me.role IN ('SUPER_ADMIN', 'ADMIN')
  )
);
