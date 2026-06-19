import { createClient } from '@/utils/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import ActiveDashboardClientUI from './ActiveDashboardClientUI';

export default async function ActiveDashboardPage() {
    const supabase = await createClient();

    const adminSupabase = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. Get user team
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return <div>Auth required</div>;

    const { data: myUser } = await supabase.from('users').select('team_id, role').eq('id', user.id).single();
    const teamId = myUser?.team_id;
    const role = myUser?.role;
    const isAdmin = role === 'SUPER_ADMIN' || role === 'ADMIN';

    if (!teamId && !isAdmin) {
        return <div className="p-8 text-center text-zinc-500">소속된 팀이 없습니다. 관리자에게 문의하세요.</div>;
    }

    // 2. Fetch Recent Audits for the team (Top 5)
    let auditQuery = supabase
        .from('audit_logs')
        .select('id, created_at, total_campaigns, error_count')
        .order('created_at', { ascending: false })
        .limit(5);

    if (!isAdmin) {
        auditQuery = auditQuery.eq('team_id', teamId);
    }
    const { data: recentAudits } = await auditQuery;

    // 3. Fetch Team's Meta Accounts
    let mappingQuery = supabase
        .from('team_account_map')
        .select('ad_account_id, platform')
        .ilike('platform', '%meta%');

    if (!isAdmin) {
        mappingQuery = mappingQuery.eq('team_id', teamId);
    }

    const { data: mappings, error: mappingError } = await mappingQuery;

    if (mappingError) console.error('Team Mapping Error:', mappingError);

    const accountIds = mappings?.map(m => m.ad_account_id) || [];

    // 4. Fetch Live Campaigns from Cache DB
    let liveCampaigns: any[] = [];
    let liveGoogleCampaigns: any[] = [];
    
    let cacheQuery = supabase
        .from('live_campaign_cache')
        .select('*');
        
    if (!isAdmin) {
        cacheQuery = cacheQuery.eq('team_id', teamId);
    }
    
    const { data: cachedData, error: cacheError } = await cacheQuery;
    if (cacheError) console.error('[Dashboard] Cache fetch error:', cacheError);
    
    if (cachedData) {
        liveCampaigns = cachedData.filter(c => c.platform === 'META');
        liveGoogleCampaigns = cachedData.filter(c => c.platform === 'GOOGLE');
    }

    // 5. Fetch Team Sync Status
    let syncStatusQuery = supabase
        .from('team_sync_status')
        .select('*');
        
    if (!isAdmin) {
        syncStatusQuery = syncStatusQuery.eq('team_id', teamId);
    }
    
    const { data: syncStatuses } = await syncStatusQuery;
    const teamSyncStatus = syncStatuses?.find(s => s.team_id === teamId) || null;

    return (
        <ActiveDashboardClientUI
            teamId={teamId}
            teamSyncStatus={teamSyncStatus}
            liveCampaigns={liveCampaigns}
            liveGoogleCampaigns={liveGoogleCampaigns}
            recentAudits={recentAudits || []}
        />
    );
}
