import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { syncTeamCampaigns } from '@/utils/syncCampaigns';

// 수동 동기화 (Sync Now) 엔드포인트
export async function POST(request: Request) {
    try {
        const supabase = await createClient();
        
        // 인증 확인
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { teamId } = body;

        if (!teamId) {
            return NextResponse.json({ error: 'teamId is required' }, { status: 400 });
        }

        // 권한 검증 (해당 유저가 해당 팀인지 확인)
        const { data: myUser } = await supabase.from('users').select('team_id, role').eq('id', user.id).single();
        const isAdmin = myUser?.role === 'SUPER_ADMIN' || myUser?.role === 'ADMIN';

        if (!isAdmin && myUser?.team_id !== teamId) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // 동기화 실행
        const result = await syncTeamCampaigns(teamId);

        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 500 });
        }

        return NextResponse.json({ success: true, count: result.count });

    } catch (e: any) {
        console.error('[Sync API] Global error:', e);
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}
