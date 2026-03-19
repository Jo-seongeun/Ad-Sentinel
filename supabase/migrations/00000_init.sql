-- Create ENUM types
CREATE TYPE platform_type AS ENUM ('META', 'GOOGLE');
CREATE TYPE user_role AS ENUM ('ADMIN', 'MANAGER', 'MEMBER');

-- 1. teams
CREATE TABLE teams (
  team_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. users (References auth.users in Supabase)
CREATE TABLE users (
  user_id UUID PRIMARY KEY, -- should reference auth.users(id) in a real setup, but keeping it simple for MVP
  email TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'MEMBER',
  team_id UUID REFERENCES teams(team_id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Function to get current user's team id
CREATE OR REPLACE FUNCTION current_user_team_id()
RETURNS UUID
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT team_id FROM users WHERE user_id = auth.uid();
$$;

-- 3. team_account_map
CREATE TABLE team_account_map (
  mapping_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(team_id) NOT NULL,
  platform platform_type NOT NULL,
  ad_account_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. planned_campaigns
CREATE TABLE planned_campaigns (
  plan_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(team_id) NOT NULL,
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
CREATE TABLE live_campaign_settings (
  live_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(team_id) NOT NULL,
  platform platform_type NOT NULL,
  ad_account_id TEXT NOT NULL,
  remote_campaign_id TEXT NOT NULL,
  live_budget NUMERIC,
  live_url TEXT,
  last_fetched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. audit_logs
CREATE TABLE audit_logs (
  audit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(team_id) NOT NULL,
  plan_id UUID REFERENCES planned_campaigns(plan_id),
  live_id UUID REFERENCES live_campaign_settings(live_id),
  issue_type TEXT NOT NULL, -- e.g. BUDGET_MISMATCH, URL_404, UTM_MISSING
  severity TEXT NOT NULL, -- WARNING, CRITICAL
  diff_payload JSONB,
  is_resolved BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS POLICIES

ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_account_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE planned_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_campaign_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- users policy (Users can see their own data, and colleagues in the same team)
CREATE POLICY "Users can view their own team members"
ON users FOR SELECT
TO authenticated
USING (team_id = current_user_team_id() OR user_id = auth.uid());

CREATE POLICY "Users can view their own team"
ON teams FOR SELECT
TO authenticated
USING (team_id = current_user_team_id());

CREATE POLICY "Ad account mappings restricted by team"
ON team_account_map FOR ALL
TO authenticated
USING (team_id = current_user_team_id());

CREATE POLICY "Planned campaigns restricted by team"
ON planned_campaigns FOR ALL
TO authenticated
USING (team_id = current_user_team_id());

CREATE POLICY "Live campaign settings restricted by team"
ON live_campaign_settings FOR ALL
TO authenticated
USING (team_id = current_user_team_id());

CREATE POLICY "Audit logs restricted by team"
ON audit_logs FOR ALL
TO authenticated
USING (team_id = current_user_team_id());
