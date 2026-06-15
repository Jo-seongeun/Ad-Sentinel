import { createClient } from '@/utils/supabase/server';
import ActiveDashboardClientUI from './ActiveDashboardClientUI';

export default async function ActiveDashboardPage() {
    const supabase = await createClient();

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

    // 4. Fetch Meta Token
    const { data: metaSetting } = await supabase
        .from('platform_settings')
        .select('access_token')
        .eq('platform', 'META')
        .single();
    const token = metaSetting?.access_token;

    // 5. Fetch Live Campaigns from Meta
    let liveCampaigns: any[] = [];
    if (token && accountIds.length > 0) {
        try {
            const promises = accountIds.map(async (actId) => {
                // 예산 소진율 계산을 위해 예산·날짜·누적 지출액 필드 추가
                const fields = [
                    'id', 'name', 'objective', 'effective_status', 'status',
                    'daily_budget', 'lifetime_budget',
                    'start_time', 'stop_time',
                    'insights.date_preset(lifetime){spend}',   // 캠페인 시작일 기준 누적 지출액
                ].join(',');
                const url = `https://graph.facebook.com/v19.0/${actId.startsWith('act_') ? actId : `act_${actId}`}/campaigns?fields=${fields}&limit=50&access_token=${token}`;
                const res = await fetch(url, { cache: 'no-store' });
                if (res.ok) {
                    const json = await res.json();
                    return (json.data || []).map((c: any) => ({ ...c, account_id: actId }));
                }
                return [];
            });
            const results = await Promise.all(promises);
            // ACTIVE 캠페인만 필터링해서 전달
            liveCampaigns = results.flat().filter((c: any) => c.effective_status === 'ACTIVE');
        } catch (error) {
            console.error('Failed to fetch live campaigns', error);
        }
    }

    // Mock KPIs
    const kpis = [
        { title: '오늘의 총 지출액', value: '₩1,245,000', change: '+12.5%', isPositive: true, icon: 'DollarSign' },
        { title: '총 노출수 (Imp)', value: '842.5K', change: '+5.2%', isPositive: true, icon: 'Users' },
        { title: '클릭수 (Clicks)', value: '12,405', change: '-1.2%', isPositive: false, icon: 'MousePointerClick' },
        { title: '실시간 통합 ROAS', value: '342%', change: '+18.4%', isPositive: true, icon: 'TrendingUp' }
    ];

    return (
        <ActiveDashboardClientUI
            kpis={kpis}
            liveCampaigns={liveCampaigns}
            recentAudits={recentAudits || []}
        />
    );
}
