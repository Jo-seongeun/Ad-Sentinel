import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

async function fetchMockLiveData(platform: string, ad_account_id: string, token?: string) {
    // Returns mock live data with simulated discrepancies
    if (platform === 'META') {
        if (!token) throw new Error('Meta API 연동 토큰이 설정되지 않았거나 만료되었습니다. [매체 연동 관리] 메뉴에서 갱신해주세요.');
        return [
            {
                remote_campaign_id: 'meta_camp_1',
                campaign_name: 'Spring_Sale_2026',
                adset_name: 'Broad_Audience',
                ad_name: 'Video_V1',
                live_budget: 4500000, // Meta provides in cents/offset, so 4500000 means 45000 (10% diff from 50000)
                live_url: 'https://example.com/sale?utm_source=meta' // Missing utm_medium
            }
        ];
    } else if (platform === 'GOOGLE') {
        return [
            {
                remote_campaign_id: 'goog_camp_1',
                campaign_name: 'Search_Brand_2026',
                adset_name: 'Exact_Match',
                ad_name: 'Text_Ad_1',
                live_budget: 100000, // Exact match
                live_url: 'https://example.com/brand-404' // 404 URL format for testing
            }
        ];
    }
    return [];
}

async function checkUrl(url: string) {
    // For MVP mock 404 check
    if (url.includes('404')) return false;
    return true;
}

export async function POST(request: Request) {
    try {
        const { team_id } = await request.json();
        if (!team_id) return NextResponse.json({ error: 'team_id required' }, { status: 400 });

        const { data: activeCampaigns } = await supabase
            .from('planned_campaigns')
            .select('*')
            .eq('team_id', team_id)
            .eq('is_active', true);

        if (!activeCampaigns || activeCampaigns.length === 0) {
            return NextResponse.json({ message: 'No active campaigns found.' });
        }

        // Fetch dynamic platform tokens from database
        const { data: metaSetting } = await supabase.from('platform_settings').select('access_token').eq('platform', 'META').single();
        const metaToken = metaSetting?.access_token;

        const auditLogs = [];

        for (const plan of activeCampaigns) {
            const liveDataRows = await fetchMockLiveData(
                plan.platform,
                plan.ad_account_id,
                plan.platform === 'META' ? metaToken : undefined
            );

            const liveData = liveDataRows.find(
                (l) => l.campaign_name === plan.campaign_name &&
                    l.adset_name === plan.adset_name &&
                    l.ad_name === plan.ad_name
            );

            if (!liveData) continue; // Not live yet

            let adjustedLiveBudget = liveData.live_budget;

            // Meta API currency offset logic
            if (plan.platform === 'META') {
                adjustedLiveBudget = liveData.live_budget / 100;
            }

            // Check Budget > 10% diff
            const budgetDiffPercent = Math.abs(adjustedLiveBudget - plan.budget_plan) / plan.budget_plan;
            if (budgetDiffPercent >= 0.1) {
                auditLogs.push({
                    team_id,
                    plan_id: plan.plan_id,
                    issue_type: 'BUDGET_MISMATCH',
                    severity: 'WARNING',
                    diff_payload: { plan: plan.budget_plan, live: adjustedLiveBudget }
                });
            }

            // Check UTM
            if (plan.utm_parameters) {
                const requiredUtms = plan.utm_parameters.split('&').map((u: string) => u.split('=')[0]);
                for (const reqUtm of requiredUtms) {
                    if (!liveData.live_url.includes(reqUtm)) {
                        auditLogs.push({
                            team_id,
                            plan_id: plan.plan_id,
                            issue_type: 'UTM_MISSING',
                            severity: 'WARNING',
                            diff_payload: { missing: reqUtm, url: liveData.live_url }
                        });
                        break;
                    }
                }
            }

            // Check URL 404
            const isUrlValid = await checkUrl(liveData.live_url);
            if (!isUrlValid) {
                auditLogs.push({
                    team_id,
                    plan_id: plan.plan_id,
                    issue_type: 'URL_404',
                    severity: 'CRITICAL',
                    diff_payload: { url: liveData.live_url }
                });
            }
        }

        if (auditLogs.length > 0) {
            await supabase.from('audit_logs').insert(auditLogs);
        }

        return NextResponse.json({ message: 'Audit completed', issues_found: auditLogs.length });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
