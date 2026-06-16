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

    // 5. Fetch Live ACTIVE Campaigns from Meta (with budget spend data)
    let liveCampaigns: any[] = [];
    if (token && accountIds.length > 0) {
        try {
            const promises = accountIds.map(async (actId) => {
                const actPrefix = actId.startsWith('act_') ? actId : `act_${actId}`;
                // insights.date_preset(lifetime){spend} → 캠페인 시작~현재까지 누적 지출
                const fields = `id,name,objective,effective_status,daily_budget,lifetime_budget,start_time,stop_time,insights.date_preset(lifetime){spend}`;
                const res = await fetch(
                    `https://graph.facebook.com/v19.0/${actPrefix}/campaigns?fields=${fields}&limit=100&access_token=${token}`,
                    { cache: 'no-store' }
                );
                if (!res.ok) return [];
                const json = await res.json();

                return (json.data || [])
                    // 1. ACTIVE 캠페인만 필터링
                    .filter((c: any) => c.effective_status === 'ACTIVE')
                    .map((c: any) => {
                        // 2. 예산 소진율 계산
                        // Meta API: lifetime/daily_budget은 최소 화폐 단위(KRW는 1원 단위)
                        // insights.spend는 계정 통화 기준 실제 금액(KRW는 원 단위)
                        const spend = Number(c.insights?.data?.[0]?.spend || 0);
                        const rawBudget = Number(c.lifetime_budget || 0) || Number(c.daily_budget || 0);
                        const burnRate = rawBudget > 0
                            ? Math.round((spend / rawBudget) * 10000) / 100  // 소수점 2자리 %
                            : null;

                        // 3. 기간 진행률 계산 (start_time ~ stop_time 기준)
                        let timeProgress: number | null = null;
                        if (c.start_time && c.stop_time) {
                            const now = Date.now();
                            const start = new Date(c.start_time).getTime();
                            const end   = new Date(c.stop_time).getTime();
                            if (end > start) {
                                timeProgress = Math.min(100, Math.max(0,
                                    Math.round(((now - start) / (end - start)) * 100)
                                ));
                            }
                        }

                        // 4. 예산 소진 상태 판정 (기간 진행률 ± 15% 오차 기준)
                        let burnStatus: 'normal' | 'under' | 'over' | 'unknown' = 'unknown';
                        if (burnRate !== null && timeProgress !== null) {
                            const diff = burnRate - timeProgress;
                            if      (diff >  15) burnStatus = 'over';
                            else if (diff < -15) burnStatus = 'under';
                            else                 burnStatus = 'normal';
                        }

                        return {
                            ...c,
                            account_id:   actId,
                            spend,
                            rawBudget,
                            burnRate,
                            timeProgress,
                            burnStatus,
                        };
                    });
            });
            const results = await Promise.all(promises);
            liveCampaigns = results.flat();
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
