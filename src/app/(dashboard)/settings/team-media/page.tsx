import { createClient } from '@/utils/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import TeamMediaClientUI, { ConnectedAccount } from './TeamMediaClientUI';
import { AlertCircle, Link2Off } from 'lucide-react';

// Service Role 클라이언트 — team_account_map 및 platform_settings 조회용
const adminClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function TeamMediaPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    // 현재 유저의 team_id 조회
    const { data: myUser } = await supabase
        .from('users')
        .select('team_id, teams(name)')
        .eq('id', user.id)
        .single();

    const teamId = myUser?.team_id;
    const teamName = (myUser?.teams as any)?.name || '내 팀';

    // 팀 미소속 처리
    if (!teamId) {
        return (
            <div className="flex flex-col items-center justify-center h-full py-24 text-center">
                <Link2Off className="w-16 h-16 text-zinc-300 dark:text-zinc-700 mb-4" />
                <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">소속 팀이 없습니다</h2>
                <p className="text-sm text-zinc-500">관리자에게 팀 배정을 요청해주세요.</p>
            </div>
        );
    }

    // 현재 팀에 할당된 매핑 전체 조회 (RLS 우회)
    const { data: mappings } = await adminClient
        .from('team_account_map')
        .select('ad_account_id, platform')
        .eq('team_id', teamId);

    const metaMappedIds = new Set((mappings || []).filter(m => m.platform === 'META').map(m => m.ad_account_id));
    const googleMappedIds = new Set((mappings || []).filter(m => m.platform === 'GOOGLE').map(m => m.ad_account_id));

    const accounts: ConnectedAccount[] = [];
    const errors: string[] = [];

    // ── Meta 계정 이름 조회 ──────────────────────────────────────────
    if (metaMappedIds.size > 0) {
        const { data: metaSetting } = await adminClient
            .from('platform_settings')
            .select('access_token, business_id')
            .eq('platform', 'META')
            .single();

        if (metaSetting?.access_token) {
            try {
                const fetchAll = async (url: string): Promise<any[]> => {
                    let next: string | null = url;
                    const results: any[] = [];
                    while (next) {
                        const res: Response = await fetch(next, { cache: 'no-store' });
                        const json: any = await res.json();
                        if (json.error) break;
                        if (json.data) results.push(...json.data);
                        next = json.paging?.next || null;
                        if (results.length > 5000) break;
                    }
                    return results;
                };

                const token = metaSetting.access_token;
                const bmId = metaSetting.business_id;
                const endpoints = [
                    `https://graph.facebook.com/v19.0/me/adaccounts?fields=name,account_id&limit=500&access_token=${token}`,
                ];
                if (bmId) {
                    endpoints.push(`https://graph.facebook.com/v19.0/${bmId}/client_ad_accounts?fields=name,account_id&limit=500&access_token=${token}`);
                    endpoints.push(`https://graph.facebook.com/v19.0/${bmId}/owned_ad_accounts?fields=name,account_id&limit=500&access_token=${token}`);
                }

                const all: any[] = [];
                for (const ep of endpoints) all.push(...await fetchAll(ep));

                const seen = new Set<string>();
                for (const acc of all) {
                    if (seen.has(acc.id) || !metaMappedIds.has(acc.id)) continue;
                    seen.add(acc.id);
                    accounts.push({ id: acc.id, name: acc.name || acc.id, platform: 'META' });
                }

                // API에서 찾지 못한 항목은 ID만으로 추가
                for (const id of metaMappedIds) {
                    if (!seen.has(id)) {
                        accounts.push({ id, name: id, platform: 'META' });
                    }
                }
            } catch {
                for (const id of metaMappedIds) {
                    accounts.push({ id, name: id, platform: 'META' });
                }
            }
        } else {
            for (const id of metaMappedIds) {
                accounts.push({ id, name: id, platform: 'META' });
            }
            errors.push('Meta API 토큰이 설정되지 않아 계정명을 불러올 수 없습니다.');
        }
    }

    // ── Google Ads 계정 이름 조회 ────────────────────────────────────
    if (googleMappedIds.size > 0) {
        const { data: googleSetting } = await adminClient
            .from('platform_settings')
            .select('*')
            .eq('platform', 'GOOGLE_ADS')
            .single();

        if (googleSetting?.refresh_token) {
            try {
                const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
                    method: 'POST',
                    cache: 'no-store',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({
                        client_id: googleSetting.app_id.trim(),
                        client_secret: googleSetting.app_secret.trim(),
                        refresh_token: googleSetting.refresh_token.trim(),
                        grant_type: 'refresh_token',
                    }).toString(),
                });
                const tokenData = await tokenRes.json();
                if (!tokenData.access_token) throw new Error('Google 토큰 발급 실패');

                const mccId = googleSetting.business_id?.replace(/-/g, '') || '';
                const devToken = googleSetting.access_token?.trim() || '';
                const query = `
                    SELECT customer_client.id, customer_client.descriptive_name
                    FROM customer_client
                    WHERE customer_client.status = 'ENABLED' AND customer_client.hidden = FALSE
                `;
                const googleRes = await fetch(`https://googleads.googleapis.com/v22/customers/${mccId}/googleAds:searchStream`, {
                    method: 'POST',
                    cache: 'no-store',
                    headers: {
                        'developer-token': devToken,
                        'Authorization': `Bearer ${tokenData.access_token}`,
                        'login-customer-id': mccId,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ query }),
                });

                if (googleRes.ok) {
                    const streamData = await googleRes.json();
                    const seen = new Set<string>();
                    for (const chunk of streamData) {
                        for (const row of (chunk.results || [])) {
                            const cid = String(row.customerClient?.id);
                            if (!cid || seen.has(cid) || !googleMappedIds.has(cid)) continue;
                            seen.add(cid);
                            accounts.push({
                                id: cid,
                                name: row.customerClient?.descriptiveName || cid,
                                platform: 'GOOGLE',
                            });
                        }
                    }
                    for (const id of googleMappedIds) {
                        if (!seen.has(id)) accounts.push({ id, name: id, platform: 'GOOGLE' });
                    }
                } else {
                    for (const id of googleMappedIds) accounts.push({ id, name: id, platform: 'GOOGLE' });
                }
            } catch {
                for (const id of googleMappedIds) accounts.push({ id, name: id, platform: 'GOOGLE' });
            }
        } else {
            for (const id of googleMappedIds) accounts.push({ id, name: id, platform: 'GOOGLE' });
            errors.push('Google Ads 토큰이 설정되지 않아 계정명을 불러올 수 없습니다.');
        }
    }

    return (
        <div className="animate-in fade-in duration-500 flex flex-col h-[calc(100vh-6rem)]">
            <div className="mb-6 flex-shrink-0">
                <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 mb-1">
                    팀 연결 매체 확인
                </h1>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    <span className="font-medium text-indigo-600 dark:text-indigo-400">{teamName}</span> 팀에 현재 연결된 광고 계정 목록입니다.
                </p>
                {errors.map((e, i) => (
                    <div key={i} className="mt-3 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 p-3 rounded-lg text-sm flex items-start gap-2 border border-amber-200 dark:border-amber-800">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        {e}
                    </div>
                ))}
            </div>

            <TeamMediaClientUI accounts={accounts} teamName={teamName} />
        </div>
    );
}
