-- Create ENUM types
CREATE TYPE platform_type AS ENUM ('META', 'GOOGLE');

-- 1. teams
CREATE TABLE public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. users (References auth.users in Supabase)
CREATE TABLE public.users (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL PRIMARY KEY,
  email TEXT,
  team_id UUID REFERENCES public.teams(id),
  role TEXT DEFAULT 'MEMBER', -- 'SUPER_ADMIN', 'MANAGER', 'MEMBER'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Trigger Function to create user profile upon Supabase Auth trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, role)
  VALUES (new.id, new.email, 'MEMBER');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger attached to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Function to get current user's team id
CREATE OR REPLACE FUNCTION public.current_user_team_id()
RETURNS UUID
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT team_id FROM public.users WHERE id = auth.uid();
$$;

-- 3. team_account_map
CREATE TABLE public.team_account_map (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  platform TEXT CHECK (platform IN ('META', 'GOOGLE')),
  ad_account_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 4. planned_campaigns
CREATE TABLE public.planned_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES public.teams(id) NOT NULL,
  campaign_name TEXT NOT NULL,
  adset_name TEXT NOT NULL,
  ad_name TEXT NOT NULL,
  budget_plan NUMERIC NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  landing_url TEXT NOT NULL,
  utm_parameters TEXT,
  platform platform_type NOT NULL,
  ad_account_id TEXT NOT NULL,
  version_no INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sync_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. live_campaign_settings
CREATE TABLE public.live_campaign_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES public.teams(id) NOT NULL,
  platform platform_type NOT NULL,
  ad_account_id TEXT NOT NULL,
  remote_campaign_id TEXT NOT NULL,
  live_budget NUMERIC,
  live_url TEXT,
  last_fetched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. audit_logs
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES public.teams(id) NOT NULL,
  plan_id UUID REFERENCES public.planned_campaigns(id),
  live_id UUID REFERENCES public.live_campaign_settings(id),
  issue_type TEXT NOT NULL, 
  severity TEXT NOT NULL,
  diff_payload JSONB,
  is_resolved BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS POLICIES

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_account_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planned_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_campaign_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- users policy (Users can see their own data, and colleagues in the same team)
CREATE POLICY "Users can view their own team members"
ON public.users FOR SELECT
TO authenticated
USING (team_id = current_user_team_id() OR id = auth.uid());

CREATE POLICY "Users can update their own profile"
ON public.users FOR UPDATE
TO authenticated
USING (id = auth.uid());

CREATE POLICY "Users can view their own team"
ON public.teams FOR SELECT
TO authenticated
USING (id = current_user_team_id());

CREATE POLICY "Ad account mappings restricted by team"
ON public.team_account_map FOR ALL
TO authenticated
USING (team_id = current_user_team_id());

CREATE POLICY "Planned campaigns restricted by team"
ON public.planned_campaigns FOR ALL
TO authenticated
USING (team_id = current_user_team_id());

CREATE POLICY "Live campaign settings restricted by team"
ON public.live_campaign_settings FOR ALL
TO authenticated
USING (team_id = current_user_team_id());

CREATE POLICY "Audit logs restricted by team"
ON public.audit_logs FOR ALL
TO authenticated
USING (team_id = current_user_team_id());
