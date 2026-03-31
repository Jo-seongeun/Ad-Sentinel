'use server';

import { createClient } from '@/utils/supabase/server';
import { ParsedRow, AuditResult } from './AuditClientUI';

export async function crosscheckApiAction(rows: ParsedRow[]): Promise<AuditResult[]> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Fetch User Team and Role
    const { data: myUser } = await supabase
        .from('users')
        .select('role, team_id, teams(name)')
        .eq('id', user.id)
        .single();

    const isAdmin = myUser?.role === 'SUPER_ADMIN' || myUser?.role === 'ADMIN';
    const myTeamName = (myUser?.teams as any)?.name;

    // Fetch Meta Token
    const { data: tokenData } = await supabase
        .from('platform_settings')
        .select('*')
        .eq('id', 'META')
        .single();

    const token = tokenData?.access_token;

    // Group rows by AccountID for efficiency
    const accountIds = [...new Set(rows.map(r => r.AccountID).filter(Boolean))];
    const liveMetaCache: Record<string, any> = {};

    // If token exists, we fetch exactly what they need from Meta Graph API
    if (token) {
        for (const act of accountIds) {
            try {
                // Fetch AdSets
                const adsetRes = await fetch(`https://graph.facebook.com/v19.0/act_${act}/adsets?fields=name,daily_budget,lifetime_budget,status,campaign_id,optimization_goal,billing_event,promoted_object&limit=500&access_token=${token}`);
                const adsetData = await adsetRes.json();

                // Fetch Ads for URL & UTM checking
                const adsRes = await fetch(`https://graph.facebook.com/v19.0/act_${act}/ads?fields=name,adset_id,creative{url_tags,object_story_spec},status&limit=500&access_token=${token}`);
                const adsData = await adsRes.json();

                liveMetaCache[act] = { adsets: adsetData.data || [], ads: adsData.data || [] };
            } catch (error) {
                console.error(`Meta API Error for Act ${act}:`, error);
                liveMetaCache[act] = { adsets: [], ads: [] };
            }
        }
    }

    const results: AuditResult[] = [];

    // Process Each Row
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const errors: string[] = [];
        let status: 'PASS' | 'FAIL' | 'WARNING' = 'PASS';

        // 0. Team Permission Check
        if (!isAdmin && row.Team !== myTeamName) {
            errors.push(`타 팀 데이터 접근 불가 (선언된 팀: ${row.Team || '없음'})`);
            status = 'FAIL';
        }

        // Wait a few MS to simulate heavy processing for UI effect if no token
        if (!token) {
            await new Promise(resolve => setTimeout(resolve, 50));
        }

        // 1. URL 404 Check
        if (status !== 'FAIL' && row.FinalURL) {
            try {
                // Basic ping
                const ping = await fetch(row.FinalURL, { method: 'HEAD', cache: 'no-cache' });
                if (!ping.ok) {
                    errors.push(`URL 상태 오류 (${ping.status})`);
                    status = 'FAIL';
                }
            } catch (e) {
                // Fetch failed (network error or CORS block, we treat as warning)
                errors.push('URL 접근 불안정(서버 봇 차단 가능성)');
                if (status === 'PASS') status = 'WARNING';
            }
        }

        if (status !== 'FAIL' && token && row.Platform.toUpperCase() === 'META') {
            const cache = liveMetaCache[row.AccountID];
            if (cache) {
                // Find AdSet
                const liveAdSet = cache.adsets.find((a: any) => a.name === row.AdSetName);
                if (!liveAdSet) {
                    errors.push('매체에 일치하는 광고 세트가 없음');
                    status = 'FAIL';
                } else {
                    // Budget Check
                    const liveBudget = Number(liveAdSet.daily_budget) || Number(liveAdSet.lifetime_budget) || 0;
                    if (liveBudget > 0 && Math.abs(liveBudget - row.AdSetBudget) > (row.AdSetBudget * 0.1)) {
                        errors.push(`예산 불일치 (기획안: ${row.AdSetBudget.toLocaleString()}, 매체: ${liveBudget.toLocaleString()})`);
                        status = 'FAIL';
                    }

                    // Optimization & Billing
                    if (row.Optimization && liveAdSet.optimization_goal !== row.Optimization) {
                        errors.push(`최적화 목표 불일치 (매체: ${liveAdSet.optimization_goal})`);
                        status = 'FAIL';
                    }
                    if (row.BillingEvent && liveAdSet.billing_event !== row.BillingEvent) {
                        errors.push(`과금 기준 불일치 (매체: ${liveAdSet.billing_event})`);
                        status = 'FAIL';
                    }
                }
            }
        } else if (status !== 'FAIL' && !token && row.Platform.toUpperCase() === 'META') {
            // Mock Meta logic
            if (row.AdSetBudget < 1000) {
                errors.push('세트 예산이 비정상적으로 낮습니다.');
                status = 'FAIL';
            }
            if (!row.UTMParameters) {
                errors.push('UTM 파라미터가 누락되었습니다.');
                if (status === 'PASS') status = 'WARNING';
            }
        }

        results.push({
            rowId: i,
            CampaignName: row.CampaignName,
            AdSetName: row.AdSetName,
            status,
            errors,
        });
    }

    // Insert Audit History to DB
    if (myUser?.team_id) {
        // Find how many errors
        const errorCount = results.filter(r => r.status === 'FAIL').length;
        await supabase.from('audit_logs').insert({
            team_id: myUser.team_id,
            total_campaigns: rows.length,
            error_count: errorCount,
            details: JSON.stringify(results.filter(r => r.status !== 'PASS'))
        });
    }

    return results;
}
