import { createClient } from '@supabase/supabase-js';

// 공통 소진율 계산 헬퍼
export const calcBurn = (budget: number, spend: number, startT: string, stopT: string, nowMs: number) => {
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

export async function syncTeamCampaigns(teamId: string) {
    // Service Role Key를 사용하여 RLS 우회 (백그라운드 워커용)
    const adminSupabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    try {
        console.log(`[Sync] Starting sync for team ${teamId}`);
        const nowMs = Date.now();

        // 1. Fetch Team Mappings
        const { data: mappings } = await adminSupabase
            .from('team_account_map')
            .select('ad_account_id, platform')
            .eq('team_id', teamId);

        const metaAccountIds = mappings?.filter(m => m.platform.includes('META')).map(m => m.ad_account_id) || [];
        const googleAccountIds = mappings?.filter(m => m.platform.includes('GOOGLE')).map(m => m.ad_account_id.replace(/[^0-9]/g, '')).filter(Boolean) || [];

        let allRows: any[] = [];

        // 2. META 연동
        if (metaAccountIds.length > 0) {
            const { data: metaSetting } = await adminSupabase
                .from('platform_settings')
                .select('access_token')
                .eq('platform', 'META')
                .single();

            const token = metaSetting?.access_token;
            if (token) {
                const promises = metaAccountIds.map(async (actId) => {
                    const actPrefix = actId.startsWith('act_') ? actId : `act_${actId}`;
                    const rows: any[] = [];

                    // 1단계: 캠페인 기본 정보
                    const campParams = new URLSearchParams({
                        fields: 'id,name,objective,effective_status,daily_budget,lifetime_budget,start_time,stop_time',
                        limit: '100',
                        access_token: token,
                    });
                    const campRes = await fetch(`https://graph.facebook.com/v19.0/${actPrefix}/campaigns?${campParams}`, { cache: 'no-store' });
                    if (!campRes.ok) return [];
                    const campJson = await campRes.json();

                    const activeCampaigns = (campJson.data || []).filter((c: any) => {
                        if (c.effective_status !== 'ACTIVE') return false;
                        if (c.stop_time && new Date(c.stop_time).getTime() < nowMs) return false;
                        return true;
                    });
                    if (activeCampaigns.length === 0) return [];

                    // 2단계: 광고 세트 조회
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
                        }
                    } catch (e) { }

                    // 3단계: 캠페인 레벨 spend
                    const sinceDate = new Date();
                    sinceDate.setMonth(sinceDate.getMonth() - 36);// 대시보드 상 API에서 불러오고 저장할 데이터의 기간을 변경 시 이 부분의 숫자(36)를 원하시는 개월 수로 변경하시면 됩니다.
                    const insightTimeRange = JSON.stringify({
                        since: sinceDate.toISOString().slice(0, 10),
                        until: new Date().toISOString().slice(0, 10),
                    });
                    const campSpendMap: Record<string, number> = {};
                    try {
                        const p = new URLSearchParams({
                            level: 'campaign', fields: 'campaign_id,spend', time_range: insightTimeRange, limit: '500', access_token: token,
                        });
                        const r = await fetch(`https://graph.facebook.com/v19.0/${actPrefix}/insights?${p}`, { cache: 'no-store' });
                        if (r.ok) {
                            const j = await r.json();
                            for (const row of (j.data || [])) campSpendMap[row.campaign_id] = Number(row.spend || 0);
                        }
                    } catch (e) { }

                    // 4단계: 광고 세트 레벨 spend
                    const adsetSpendMap: Record<string, number> = {};
                    try {
                        const p = new URLSearchParams({
                            level: 'adset', fields: 'adset_id,spend', time_range: insightTimeRange, limit: '500', access_token: token,
                        });
                        const r = await fetch(`https://graph.facebook.com/v19.0/${actPrefix}/insights?${p}`, { cache: 'no-store' });
                        if (r.ok) {
                            const j = await r.json();
                            for (const row of (j.data || [])) adsetSpendMap[row.adset_id] = Number(row.spend || 0);
                        }
                    } catch (e) { }

                    // 행 생성
                    for (const c of activeCampaigns) {
                        const campBudget = Number(c.lifetime_budget || 0) || Number(c.daily_budget || 0);
                        const isCBO = campBudget > 0;

                        if (isCBO) {
                            const spend = campSpendMap[c.id] || 0;
                            rows.push({
                                team_id: teamId,
                                platform: 'META',
                                account_id: actId,
                                campaign_id: c.id,
                                campaign_name: c.name,
                                effective_status: c.effective_status,
                                spend,
                                budget: campBudget,
                                start_date: c.start_time || null,
                                end_date: c.stop_time || null
                            });
                        } else {
                            const adsets = (adsetsByCampaign[c.id] || []).filter(a => {
                                if (a.end_time && new Date(a.end_time).getTime() < nowMs) return false;
                                return true;
                            });
                            for (const a of adsets) {
                                const adsetBudget = Number(a.lifetime_budget || 0) || Number(a.daily_budget || 0);
                                const spend = adsetSpendMap[a.id] || 0;
                                rows.push({
                                    team_id: teamId,
                                    platform: 'META',
                                    account_id: actId,
                                    campaign_id: a.id, // 세트를 캠페인처럼 캐시에 삽입
                                    campaign_name: `${c.name} (${a.name})`,
                                    effective_status: c.effective_status,
                                    spend,
                                    budget: adsetBudget,
                                    start_date: a.start_time || null,
                                    end_date: a.end_time || null
                                });
                            }
                        }
                    }
                    return rows;
                });

                const results = await Promise.all(promises);
                allRows = allRows.concat(results.flat());
            }
        }

        // 3. GOOGLE 연동
        if (googleAccountIds.length > 0) {
            const { data: googleSettings } = await adminSupabase
                .from('platform_settings')
                .select('app_id, app_secret, refresh_token, access_token, business_id')
                .eq('platform', 'GOOGLE_ADS')
                .single();

            const devToken = (googleSettings?.access_token || '').trim();
            const mccId = (googleSettings?.business_id || '').replace(/-/g, '');
            let googleAccessToken = null;

            if (googleSettings?.refresh_token) {
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
            }

            if (googleAccessToken && devToken) {
                const gaqlHeaders: Record<string, string> = {
                    'Authorization': `Bearer ${googleAccessToken}`,
                    'developer-token': devToken,
                    'Content-Type': 'application/json',
                };
                if (mccId) gaqlHeaders['login-customer-id'] = mccId;

                const fetchGoogleCampaigns = async (targetId: string): Promise<any[]> => {
                    const query = `
                        SELECT
                            campaign.id, campaign.name, campaign.status, campaign.start_date, campaign.end_date,
                            campaign_budget.amount_micros, campaign_budget.total_amount_micros, metrics.cost_micros
                        FROM campaign WHERE campaign.status = 'ENABLED' LIMIT 500
                    `;
                    const res = await fetch(`https://googleads.googleapis.com/v22/customers/${targetId}/googleAds:searchStream`,
                        { method: 'POST', headers: gaqlHeaders, body: JSON.stringify({ query }) }
                    );

                    if (!res.ok) {
                        const errBody = await res.text();
                        if (errBody.includes('REQUESTED_METRICS_FOR_MANAGER')) {
                            // 하위 계정 재귀 조회
                            const clientQuery = `SELECT customer_client.id FROM customer_client WHERE customer_client.manager = FALSE AND customer_client.status = 'ENABLED'`;
                            const clientRes = await fetch(`https://googleads.googleapis.com/v22/customers/${targetId}/googleAds:searchStream`,
                                { method: 'POST', headers: gaqlHeaders, body: JSON.stringify({ query: clientQuery }) }
                            );
                            if (!clientRes.ok) return [];
                            const clientChunks = await clientRes.json();
                            const leafIds: string[] = [];
                            for (const chunk of clientChunks) {
                                for (const r of (chunk.results || [])) if (r.customerClient?.id) leafIds.push(String(r.customerClient.id));
                            }
                            const leafResults = await Promise.all(leafIds.map(id => fetchGoogleCampaigns(id)));
                            return leafResults.flat();
                        }
                        return [];
                    }

                    const chunks = await res.json();
                    const rows: any[] = [];
                    for (const chunk of chunks) {
                        for (const r of (chunk.results || [])) {
                            const camp = r.campaign || {};
                            const budget = r.campaignBudget || {};
                            const metrics = r.metrics || {};

                            if (camp.endDate && new Date(camp.endDate).getTime() < nowMs) continue;

                            let budgetMicros = Number(budget.totalAmountMicros || 0);
                            if (budgetMicros === 0 && budget.amountMicros) {
                                const dailyMicros = Number(budget.amountMicros);
                                if (camp.startDate && camp.endDate && camp.endDate !== '2037-12-30') {
                                    const s = new Date(camp.startDate).getTime(), e = new Date(camp.endDate).getTime();
                                    if (e >= s) budgetMicros = dailyMicros * (Math.floor((e - s) / (1000 * 60 * 60 * 24)) + 1);
                                }
                            }

                            const spendRaw = (Number(metrics.costMicros || 0) / 1_000_000);
                            const budgetRaw = (budgetMicros / 1_000_000);

                            rows.push({
                                team_id: teamId,
                                platform: 'GOOGLE',
                                account_id: targetId,
                                campaign_id: camp.id,
                                campaign_name: camp.name,
                                effective_status: 'ENABLED',
                                spend: Math.round(spendRaw),
                                budget: Math.round(budgetRaw),
                                start_date: camp.startDate || null,
                                end_date: camp.endDate || null
                            });
                        }
                    }
                    return rows;
                };

                const googlePromises = googleAccountIds.map(custId => fetchGoogleCampaigns(custId));
                const googleResults = await Promise.all(googlePromises);
                allRows = allRows.concat(googleResults.flat());
            }
        }

        // 4. DB 일괄 업데이트 (Transaction-like)
        // 기존 팀의 캐시 데이터 삭제
        await adminSupabase.from('live_campaign_cache').delete().eq('team_id', teamId);

        // 새로운 데이터 삽입
        if (allRows.length > 0) {
            await adminSupabase.from('live_campaign_cache').insert(allRows);
        }

        // 5. 성공 상태 업데이트
        await adminSupabase.from('team_sync_status').upsert({
            team_id: teamId,
            last_synced_at: new Date().toISOString(),
            sync_status: 'SUCCESS',
            error_message: null
        });

        console.log(`[Sync] Successfully synced ${allRows.length} campaigns for team ${teamId}`);
        return { success: true, count: allRows.length };

    } catch (error: any) {
        console.error(`[Sync] Error syncing team ${teamId}:`, error);
        // 에러 상태 업데이트
        await adminSupabase.from('team_sync_status').upsert({
            team_id: teamId,
            sync_status: 'ERROR',
            error_message: error?.message || 'Unknown sync error'
        });
        return { success: false, error: error?.message };
    }
}
