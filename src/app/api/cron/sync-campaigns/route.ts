import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { syncTeamCampaigns } from '@/utils/syncCampaigns';

// 매 1시간마다 호출되는 Cron 엔드포인트
export async function GET(request: Request) {
    // 보안 검증: Vercel Cron에서 온 요청인지 확인 (옵션)
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const adminSupabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        // 연동된 계정이 있는 모든 팀 목록 조회 (team_account_map에서 중복 제거)
        const { data: teams, error } = await adminSupabase
            .from('team_account_map')
            .select('team_id');
            
        if (error || !teams) {
            throw new Error('Failed to fetch teams');
        }

        const uniqueTeamIds = Array.from(new Set(teams.map(t => t.team_id)));
        
        console.log(`[Cron Sync] Found ${uniqueTeamIds.length} teams to sync.`);

        // 모든 팀에 대해 동기화 백그라운드 실행
        const results = await Promise.allSettled(
            uniqueTeamIds.map(teamId => syncTeamCampaigns(teamId))
        );

        const summary = results.map((result, index) => {
            const teamId = uniqueTeamIds[index];
            if (result.status === 'fulfilled') {
                return { teamId, status: 'success', data: result.value };
            } else {
                return { teamId, status: 'error', reason: result.reason };
            }
        });

        return NextResponse.json({ success: true, summary });
    } catch (e: any) {
        console.error('[Cron Sync] Global error:', e);
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}
