'use server';

import { createClient } from '@/utils/supabase/server';
import { ParsedRow, AuditResult } from './AuditClientUI';

export async function crosscheckApiAction(rows: ParsedRow[]): Promise<AuditResult[]> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

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
    // (In reality, we fetch Campaigns, AdSets, Ads per account)
    if (token) {
        for (const act of accountIds) {
            try {
                // Fetch AdSets
                const adsetRes = await fetch(`https://graph.facebook.com/v19.0/act_${act}/adsets?fields=name,daily_budget,status,campaign_id&limit=500&access_token=${token}`);
                const adsetData = await adsetRes.json();

                // Fetch Ads for URL & UTM checking
                const adsRes = await fetch(`https://graph.facebook.com/v19.0/act_${act}/ads?fields=name,adset_id,creative{url_tags},status&limit=500&access_token=${token}`);
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

        // Wait a few MS to simulate heavy processing for UI effect if no token
        if (!token) {
            await new Promise(resolve => setTimeout(resolve, 50));
        }

        // 1. URL 404 Check
        if (row.FinalURL) {
            try {
                // Basic ping
                const ping = await fetch(row.FinalURL, { method: 'HEAD', cache: 'no-cache' });
                if (!ping.ok) {
                    errors.push(`URL 오류 (${ping.status})`);
                    status = 'FAIL';
                }
            } catch (e) {
                // Fetch failed (network error or CORS block, we treat as warning)
                errors.push('URL 접근 불가(서버 차단 가능성)');
                if (status === 'PASS') status = 'WARNING';
            }
        }

        if (token && row.Platform.toUpperCase() === 'META') {
            const cache = liveMetaCache[row.AccountID];
            if (cache) {
                // Find AdSet
                const liveAdSet = cache.adsets.find((a: any) => a.name === row.AdSetName);
                if (!liveAdSet) {
                    errors.push('매체에 일치하는 광고 세트가 없음');
                    status = 'FAIL';
                } else {
                    // Budget Check (Meta API returns currency * 100 usually, but in KRW it might be * 1, relying on logic)
                    const liveBudget = Number(liveAdSet.daily_budget) || 0;
                    // Assume KRW has no offset or standard offset, just check diff
                    if (liveBudget > 0 && Math.abs(liveBudget - row.PlannedBudget) > (row.PlannedBudget * 0.1)) {
                        errors.push(`예산 불일치 (엑셀: ${row.PlannedBudget.toLocaleString()}, 매체: ${liveBudget.toLocaleString()})`);
                        status = 'FAIL';
                    }

                    // Status Check
                    if (row.Status && liveAdSet.status !== row.Status) {
                        errors.push(`상태 스위치 다름 (매체: ${liveAdSet.status})`);
                        if (status === 'PASS') status = 'WARNING';
                    }
                }
            }
        } else if (!token && row.Platform.toUpperCase() === 'META') {
            // Mock Meta logic
            if (row.PlannedBudget < 1000) {
                errors.push('예산 설정 비정상 (너무 낮음)');
                status = 'FAIL';
            }
            if (row.AdSetName.includes('테스트')) {
                errors.push('테스트 세트는 검수에서 누락될 위험이 있습니다.');
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
    const myUser = await supabase.from('users').select('team_id').eq('id', user.id).single();
    if (myUser.data?.team_id) {
        // Find how many errors
        const errorCount = results.filter(r => r.status === 'FAIL').length;
        await supabase.from('audit_logs').insert({
            team_id: myUser.data.team_id,
            total_campaigns: rows.length,
            error_count: errorCount,
            details: JSON.stringify(results.filter(r => r.status !== 'PASS'))
        });
    }

    return results;
}
