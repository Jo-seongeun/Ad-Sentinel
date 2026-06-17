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
                // date_preset=lifetime 대신 명시적 time_range 사용 (Meta API async 이슈 회피)
                // Meta insights API: 최대 37개월 이전까지만 조회 가능 → 36개월 전으로 동적 계산
                const sinceDate = new Date();
                sinceDate.setMonth(sinceDate.getMonth() - 36);
                const insightTimeRange = JSON.stringify({
                    since: sinceDate.toISOString().slice(0, 10),
                    until: new Date().toISOString().slice(0, 10),
                });
                const campSpendMap: Record<string, number> = {};
                try {
                    const p = new URLSearchParams({
                        level: 'campaign',
                        fields: 'campaign_id,spend',
                        time_range: insightTimeRange,
                        limit: '500',
                        access_token: token,
                    });
                    const r = await fetch(`https://graph.facebook.com/v19.0/${actPrefix}/insights?${p}`, { cache: 'no-store' });
                    if (r.ok) {
                        const j = await r.json();
                        console.log(`[Dashboard][${actPrefix}] Campaign Insights rows: ${j.data?.length ?? 0}, error: ${j.error?.message ?? 'none'}`);
                        if (j.data?.[0]) console.log(`[Dashboard] Sample spend row:`, JSON.stringify(j.data[0]));
                        for (const row of (j.data || [])) campSpendMap[row.campaign_id] = Number(row.spend || 0);
                    } else {
                        const errBody = await r.text();
                        console.error(`[Dashboard] Campaign Insights HTTP ${r.status}:`, errBody.slice(0, 300));
                    }
                } catch (e) { console.warn(`[Dashboard] Campaign Insights failed:`, e); }

                // ── 4단계: 광고 세트 레벨 spend (ABO용) ──
                const adsetSpendMap: Record<string, number> = {};
                try {
                    const p = new URLSearchParams({
                        level: 'adset',
                        fields: 'adset_id,spend',
                        time_range: insightTimeRange,
                        limit: '500',
                        access_token: token,
                    });
                    const r = await fetch(`https://graph.facebook.com/v19.0/${actPrefix}/insights?${p}`, { cache: 'no-store' });
                    if (r.ok) {
                        const j = await r.json();
                        console.log(`[Dashboard][${actPrefix}] Adset Insights rows: ${j.data?.length ?? 0}, error: ${j.error?.message ?? 'none'}`);
                        for (const row of (j.data || [])) adsetSpendMap[row.adset_id] = Number(row.spend || 0);
                    } else {
                        const errBody = await r.text();
                        console.error(`[Dashboard] Adset Insights HTTP ${r.status}:`, errBody.slice(0, 300));
                    }
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

    // ── 6. Google Ads 라이브 캠페인 조회 ──
    let liveGoogleCampaigns: any[] = [];
    try {
        // 6-1. 팀에 매핑된 Google Ads 계정 조회
        let googleMappingQuery = supabase
            .from('team_account_map')
            .select('ad_account_id')
            .ilike('platform', '%google%');
        if (!isAdmin) googleMappingQuery = googleMappingQuery.eq('team_id', teamId);
        const { data: googleMappings } = await googleMappingQuery;
        const googleAccountIds = googleMappings?.map(m => m.ad_account_id.replace(/[^0-9]/g, '')).filter(Boolean) || [];

        // 6-2. Google Ads API 자격증명 조회
        const { data: googleSettings } = await supabase
            .from('platform_settings')
            .select('app_id, app_secret, refresh_token, access_token, business_id')
            .eq('platform', 'GOOGLE_ADS')
            .single();

        const devToken = (googleSettings?.access_token || '').trim();
        const mccId = (googleSettings?.business_id || '').replace(/-/g, '');

        // 6-3. OAuth access_token 발급
        let googleAccessToken: string | null = null;
        if (googleSettings?.refresh_token) {
            try {
                const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({
                        client_id: googleSettings.app_id?.trim() || '',
                        client_secret: googleSettings.app_secret?.trim() || '',
                        refresh_token: googleSettings.refresh_token?.trim() || '',
                        grant_type: 'refresh_token',
                    }).toString(),
                });
                const tokenJson = await tokenRes.json();
                googleAccessToken = tokenJson.access_token || null;
            } catch (e) {
                console.error('[Dashboard] Google token error:', e);
            }
        }

        if (googleAccessToken && devToken && googleAccountIds.length > 0) {
            const nowMs = Date.now();

            const gaqlHeaders: Record<string, string> = {
                'Authorization': `Bearer ${googleAccessToken}`,
                'developer-token': devToken,
                'Content-Type': 'application/json',
            };
            if (mccId) gaqlHeaders['login-customer-id'] = mccId;

            const calcBurnGoogle = (budgetMicros: number, costMicros: number, startDate: string, endDate: string) => {
                const budget = budgetMicros / 1_000_000;
                const spend = costMicros / 1_000_000;
                const burnRate = budget > 0 ? Math.round((spend / budget) * 10000) / 100 : null;
                let timeProgress: number | null = null;
                if (startDate && endDate) {
                    const s = new Date(startDate).getTime();
                    const e = new Date(endDate).getTime();
                    if (e > s) timeProgress = Math.min(100, Math.max(0, Math.round(((nowMs - s) / (e - s)) * 100)));
                }
                let burnStatus: 'normal' | 'under' | 'over' | 'unknown' = 'unknown';
                if (burnRate !== null && timeProgress !== null) {
                    const d = burnRate - timeProgress;
                    burnStatus = d > 15 ? 'over' : d < -15 ? 'under' : 'normal';
                }
                return { burnRate, timeProgress, burnStatus, spend: Math.round(spend) };
            };

            const fetchCampaigns = async (targetId: string): Promise<any[]> => {
                const query = `
                    SELECT
                        campaign.id,
                        campaign.name,
                        campaign.status,
                        campaign.start_date,
                        campaign.end_date,
                        campaign.advertising_channel_type,
                        campaign_budget.amount_micros,
                        campaign_budget.total_amount_micros,
                        metrics.cost_micros
                    FROM campaign
                    WHERE campaign.status = 'ENABLED'
                    LIMIT 500
                `;
                try {
                    const res = await fetch(
                        `https://googleads.googleapis.com/v22/customers/${targetId}/googleAds:searchStream`,
                        { method: 'POST', headers: gaqlHeaders, body: JSON.stringify({ query }) }
                    );
                    if (!res.ok) {
                        const errBody = await res.text();
                        if (errBody.includes('REQUESTED_METRICS_FOR_MANAGER')) {
                            // MCC 계정인 경우 하위 클라이언트 계정을 자동 조회 후 재시도
                            const clientQuery = `SELECT customer_client.id FROM customer_client WHERE customer_client.manager = FALSE AND customer_client.status = 'ENABLED'`;
                            const clientRes = await fetch(
                                `https://googleads.googleapis.com/v22/customers/${targetId}/googleAds:searchStream`,
                                { method: 'POST', headers: gaqlHeaders, body: JSON.stringify({ query: clientQuery }) }
                            );
                            if (!clientRes.ok) return [];
                            const clientChunks = await clientRes.json();
                            const leafIds: string[] = [];
                            for (const chunk of clientChunks) {
                                for (const r of (chunk.results || [])) {
                                    if (r.customerClient?.id) leafIds.push(String(r.customerClient.id));
                                }
                            }
                            const leafPromises = leafIds.map(id => fetchCampaigns(id));
                            const leafResults = await Promise.all(leafPromises);
                            return leafResults.flat();
                        }
                        console.error(`[Dashboard] Google Ads API Error for ${targetId} (HTTP ${res.status}):\n${errBody}`);
                        return [];
                    }
                    const chunks = await res.json();
                    if (!Array.isArray(chunks)) return [];

                    const rows: any[] = [];
                    for (const chunk of chunks) {
                        for (const r of (chunk.results || [])) {
                            const camp = r.campaign || {};
                            const budget = r.campaignBudget || {};
                            const metrics = r.metrics || {};

                            if (camp.endDate && new Date(camp.endDate).getTime() < nowMs) continue;

                            const budgetMicros = Number(budget.totalAmountMicros || 0) || Number(budget.amountMicros || 0);
                            const costMicros = Number(metrics.costMicros || 0);
                            const { burnRate, timeProgress, burnStatus, spend } = calcBurnGoogle(
                                budgetMicros, costMicros, camp.startDate, camp.endDate
                            );

                            rows.push({
                                rowType: 'campaign',
                                id: camp.id,
                                account_id: targetId,
                                name: camp.name,
                                adsetName: null,
                                effective_status: 'ENABLED',
                                channelType: camp.advertisingChannelType,
                                spend, rawBudget: Math.round(budgetMicros / 1_000_000),
                                burnRate, timeProgress, burnStatus,
                            });
                        }
                    }
                    return rows;
                } catch (e) {
                    console.error(`[Dashboard] Google Ads fetch error for ${targetId}:`, e);
                    return [];
                }
            };

            const googlePromises = googleAccountIds.map(custId => fetchCampaigns(custId));

            const googleResults = await Promise.all(googlePromises);
            liveGoogleCampaigns = googleResults.flat();
        }
    } catch (e) {
        console.error('[Dashboard] Google Ads section error:', e);
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
            liveGoogleCampaigns={liveGoogleCampaigns}
            recentAudits={recentAudits || []}
        />
    );
}
