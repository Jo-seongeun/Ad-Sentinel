-- 1. Create a secure function to check if the current user is an admin
-- Using SECURITY DEFINER allows this function to bypass RLS, avoiding infinite recursion.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role IN ('SUPER_ADMIN', 'ADMIN')
  );
$$;

-- 2. Grant Admins permission to SELECT all users
-- This allows admins to see GUESTs and members of other teams in the dashboard
DROP POLICY IF EXISTS "Admins can view all users" ON public.users;
CREATE POLICY "Admins can view all users"
ON public.users FOR SELECT
TO authenticated
USING ( public.is_admin() );

-- 3. (Optional but recommended) Grant Admins permission to SELECT all teams
-- So admins can assign users to any team
DROP POLICY IF EXISTS "Admins can view all teams" ON public.teams;
CREATE POLICY "Admins can view all teams"
ON public.teams FOR SELECT
TO authenticated
USING ( public.is_admin() );
