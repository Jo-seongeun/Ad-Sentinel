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

    // 5. Fetch Live ACTIVE Campaigns from Meta (4단계: 캠페인 → 광고세트 → spend(캠페인) → spend(세트))
    let liveCampaigns: any[] = [];
    if (token && accountIds.length > 0) {
        try {
            const promises = accountIds.map(async (actId) => {
                const actPrefix = actId.startsWith('act_') ? actId : `act_${actId}`;
                const nowMs = Date.now();

                // ── 공통 소진율 계산 헬퍼 ──
                const calcBurn = (budget: number, spend: number, startT: string, stopT: string) => {
                    const burnRate = budget > 0 ? Math.round((spend / budget) * 10000) / 100 : null;
                    let timeProgress: number | null = null;
                    if (startT && stopT) {
                        const s = new Date(startT).getTime(), e = new Date(stopT).getTime();
                        if (e > s) timeProgress = Math.min(100, Math.max(0, Math.round(((nowMs - s) / (e - s)) * 100)));
                    }
                    let burnStatus: 'normal' | 'under' | 'over' | 'unknown' = 'unknown';
                    if (burnRate !== null && timeProgress !== null) {
                        const d = burnRate - timeProgress;
                        burnStatus = d > 15 ? 'over' : d < -15 ? 'under' : 'normal';
                    }
                    return { burnRate, timeProgress, burnStatus };
                };

                // ── 1단계: 캠페인 기본 정보 ──
                const campParams = new URLSearchParams({
                    fields: 'id,name,objective,effective_status,daily_budget,lifetime_budget,start_time,stop_time',
                    limit: '100',
                    access_token: token,
                });
                const campRes = await fetch(`https://graph.facebook.com/v19.0/${actPrefix}/campaigns?${campParams}`, { cache: 'no-store' });
                if (!campRes.ok) { console.error(`[Dashboard] Campaign API Error: ${campRes.status}`); return []; }
                const campJson = await campRes.json();
                if (campJson.error) { console.error(`[Dashboard] Campaign Error:`, campJson.error); return []; }

                const activeCampaigns = (campJson.data || []).filter((c: any) => {
                    if (c.effective_status !== 'ACTIVE') return false;
                    if (c.stop_time && new Date(c.stop_time).getTime() < nowMs) return false;
                    return true;
                });
                if (activeCampaigns.length === 0) return [];

                // ── 2단계: 광고 세트 조회 (name 포함 — ABO 행 생성용) ──
                const adsetsByCampaign: Record<string, any[]> = {};
                try {
                    const adsetParams = new URLSearchParams({
                        fields: 'id,name,campaign_id,daily_budget,lifetime_budget,start_time,end_time,effective_status',
                        filtering: JSON.stringify([{ field: 'campaign.effective_status', operator: 'IN', value: ['ACTIVE'] }]),
                        limit: '500',
                        access_token: token,
                    });
                    const adsetRes = await fetch(`https://graph.facebook.com/v19.0/${actPrefix}/adsets?${adsetParams}`, { cache: 'no-store' });
                    if (adsetRes.ok) {
                        const adsetJson = await adsetRes.json();
                        for (const a of (adsetJson.data || [])) {
                            if (!adsetsByCampaign[a.campaign_id]) adsetsByCampaign[a.campaign_id] = [];
                            adsetsByCampaign[a.campaign_id].push(a);
                        }
                    } else console.warn(`[Dashboard] Adset API skipped: ${adsetRes.status}`);
                } catch (e) { console.warn(`[Dashboard] Adset fetch failed:`, e); }

                // ── 3단계: 캠페인 레벨 spend (CBO용) ──
                const campSpendMap: Record<string, number> = {};
                try {
                    const p = new URLSearchParams({ level: 'campaign', fields: 'campaign_id,spend', date_preset: 'lifetime', access_token: token });
                    const r = await fetch(`https://graph.facebook.com/v19.0/${actPrefix}/insights?${p}`, { cache: 'no-store' });
                    if (r.ok) { const j = await r.json(); for (const row of (j.data || [])) campSpendMap[row.campaign_id] = Number(row.spend || 0); }
                } catch (e) { console.warn(`[Dashboard] Campaign Insights failed:`, e); }

                // ── 4단계: 광고 세트 레벨 spend (ABO용) ──
                const adsetSpendMap: Record<string, number> = {};
                try {
                    const p = new URLSearchParams({ level: 'adset', fields: 'adset_id,spend', date_preset: 'lifetime', access_token: token });
                    const r = await fetch(`https://graph.facebook.com/v19.0/${actPrefix}/insights?${p}`, { cache: 'no-store' });
                    if (r.ok) { const j = await r.json(); for (const row of (j.data || [])) adsetSpendMap[row.adset_id] = Number(row.spend || 0); }
                } catch (e) { console.warn(`[Dashboard] Adset Insights failed:`, e); }

                // ── 행 생성: CBO → 캠페인 1행 / ABO → 만료 안된 세트별 행 ──
                const rows: any[] = [];
                for (const c of activeCampaigns) {
                    const campBudget = Number(c.lifetime_budget || 0) || Number(c.daily_budget || 0);
                    const isCBO = campBudget > 0;

                    if (isCBO) {
                        // CBO: 캠페인 예산·기간·spend 기준
                        const spend = campSpendMap[c.id] || 0;
                        const { burnRate, timeProgress, burnStatus } = calcBurn(campBudget, spend, c.start_time, c.stop_time);
                        rows.push({
                            rowType: 'campaign', id: c.id, account_id: actId,
                            name: c.name, adsetName: null, effective_status: c.effective_status,
                            spend, rawBudget: campBudget, burnRate, timeProgress, burnStatus,
                        });
                    } else {
                        // ABO: 세트별 예산·기간·spend 기준, 만료 세트 제외
                        const adsets = (adsetsByCampaign[c.id] || []).filter(a => {
                            if (a.end_time && new Date(a.end_time).getTime() < nowMs) return false;
                            return true;
                        });
                        for (const a of adsets) {
                            const adsetBudget = Number(a.lifetime_budget || 0) || Number(a.daily_budget || 0);
                            const spend = adsetSpendMap[a.id] || 0;
                            const { burnRate, timeProgress, burnStatus } = calcBurn(adsetBudget, spend, a.start_time, a.end_time);
                            rows.push({
                                rowType: 'adset', id: c.id, adsetId: a.id, account_id: actId,
                                name: c.name, adsetName: a.name, effective_status: c.effective_status,
                                spend, rawBudget: adsetBudget, burnRate, timeProgress, burnStatus,
                            });
                        }
                    }
                }
                return rows;
            });

            const results = await Promise.all(promises);
            liveCampaigns = results.flat();
        } catch (error) {
            console.error('[Dashboard] Failed to fetch live campaigns:', error);
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
