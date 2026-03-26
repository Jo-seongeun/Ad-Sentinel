import { createClient } from '@/utils/supabase/server';
import AccountMappingClientUI, { AdAccount, Team } from './AccountMappingClientUI';
import { AlertCircle } from 'lucide-react';

export default async function AccountMappingPage() {
    const supabase = await createClient();

    // 1. Fetch real teams from DB
    const { data: teamsData } = await supabase.from('teams').select('id, name');
    const teams: Team[] = teamsData || [];

    // 2. Fetch existing mappings from DB
    const { data: mappingsData } = await supabase.from('team_account_map').select('*');
    const mappings = mappingsData || [];

    // 3. Fetch Meta Access Token
    const { data: metaSetting } = await supabase.from('platform_settings').select('access_token').eq('platform', 'META').single();
    const metaToken = metaSetting?.access_token;

    let initialAccounts: AdAccount[] = [];
    let metaApiError = null;

    // 4. Fetch ALL Meta Ad Accounts from Live API (Handling Cursor Pagination)
    if (metaToken) {
        try {
            let nextUrl: string | null = `https://graph.facebook.com/v19.0/me/adaccounts?fields=name,account_id&limit=500&access_token=${metaToken}`;
            let fetchedCount = 0;

            while (nextUrl) {
                const response = await fetch(nextUrl, { cache: 'no-store' });
                const metaData: any = await response.json();

                if (metaData.error) {
                    metaApiError = metaData.error.message;
                    break;
                }

                if (metaData.data && Array.isArray(metaData.data)) {
                    fetchedCount += metaData.data.length;
                    metaData.data.forEach((acc: any) => {
                        const mappedInfo = mappings.find(m => m.ad_account_id === acc.id && m.platform === 'META');
                        initialAccounts.push({
                            id: acc.id,
                            name: acc.name || `Meta Account (${acc.account_id})`,
                            platform: 'META',
                            assignedTeamId: mappedInfo ? mappedInfo.team_id : null
                        });
                    });
                }

                // Protect against infinite loops or excessive API calls (e.g. capping at 10,000 to prevent timeouts)
                if (fetchedCount > 10000) break;

                // Get the next page URL
                nextUrl = metaData.paging?.next || null;
            }
        } catch (e: any) {
            metaApiError = e.message;
        }
    } else {
        metaApiError = "Meta API 토큰이 설정되지 않았습니다. 매체 연동 관리 메뉴에서 먼저 설정해주세요.";
    }

    // Include existing Database mappings that might be GOOGLE or other platforms, or Meta accounts we lost access to
    // But for this MVP, we mainly rely on live Meta accounts and append any GOOGLE mock data if needed.
    // Let's add Google Mock Data so the UI isn't completely empty if Meta fails, just to demonstrate multi-platform UI
    initialAccounts.push(
        { id: 'act_g_101', name: 'Google 검색어 확장 그룹 A', platform: 'GOOGLE', assignedTeamId: mappings.find(m => m.ad_account_id === 'act_g_101')?.team_id || null },
        { id: 'act_g_102', name: 'Google PMax 캠페인 테스트 계정', platform: 'GOOGLE', assignedTeamId: mappings.find(m => m.ad_account_id === 'act_g_102')?.team_id || null }
    );

    return (
        <div className="animate-in fade-in duration-500 h-[calc(100vh-6rem)] flex flex-col">
            <div className="mb-6">
                <h2 className="text-2xl font-bold tracking-tight mb-2">연결 계정 관리</h2>
                <p className="text-zinc-500 dark:text-zinc-400">BM 및 API 토큰에 연결된 실제 광고 계정을 각 팀 공간에 실시간으로 할당하거나 해제합니다.</p>
                {metaApiError && (
                    <div className="mt-3 bg-red-50 dark:bg-rose-900/20 text-red-700 dark:text-rose-400 p-3 rounded-lg text-sm flex items-start gap-2 border border-red-200 dark:border-rose-800">
                        <AlertCircle className="w-5 h-5 shrink-0" />
                        <div>
                            <strong>Meta API 연동 오류:</strong> {metaApiError}
                        </div>
                    </div>
                )}
            </div>

            <AccountMappingClientUI initialAccounts={initialAccounts} teams={teams} />
        </div>
    );
}
