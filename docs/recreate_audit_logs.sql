-- Drop the old table if it exists (warning: deletes old logs, but they weren't saving anyway)
DROP TABLE IF EXISTS public.audit_logs;

-- Recreate the audit_logs table with the new schema used by Phase 15 & 16
CREATE TABLE public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
    total_campaigns INTEGER NOT NULL,
    error_count INTEGER NOT NULL,
    details JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Re-enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view and insert logs for their own team
CREATE POLICY "Audit logs restricted by team"
ON public.audit_logs FOR ALL
TO authenticated
USING (team_id = public.current_user_team_id())
WITH CHECK (team_id = public.current_user_team_id());

-- Policy: Admins can view all audit logs
CREATE POLICY "Admins can view all audit logs"
ON public.audit_logs FOR SELECT
TO authenticated
USING ( public.is_admin() );
