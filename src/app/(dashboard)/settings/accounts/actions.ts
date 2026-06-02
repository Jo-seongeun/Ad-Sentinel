'use server';

import { createClient } from '@/utils/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';

// Service Role 클라이언트 — RLS 우회 (DB 쓰기 전용)
const adminClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function requireAdmin() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthorized');
    const { data: adminData } = await supabase.from('users').select('role').eq('id', user.id).single();
    if (!adminData || !['SUPER_ADMIN', 'ADMIN'].includes(adminData.role)) {
        throw new Error('Forbidden');
    }
}

/**
 * 선택한 광고 계정들을 특정 팀에 추가 할당합니다.
 * 기존에 다른 팀에 이미 할당된 매핑은 유지됩니다 (다수 팀 동시 할당 지원).
 * 동일한 (team_id, ad_account_id, platform) 조합은 중복 삽입하지 않습니다.
 */
export async function assignAccountsAction(teamId: string, accounts: { id: string, platform: 'META' | 'GOOGLE' }[]) {
    await requireAdmin();

    const payloads = accounts.map(acc => ({
        team_id: teamId,
        platform: acc.platform,
        ad_account_id: acc.id
    }));

    // UPSERT: (team_id, ad_account_id, platform) 복합 유니크 키 기준으로 충돌 시 무시
    // 이미 할당된 경우 중복 삽입 없이 안전하게 처리됩니다.
    const { error } = await adminClient
        .from('team_account_map')
        .upsert(payloads, { onConflict: 'team_id,ad_account_id,platform', ignoreDuplicates: true });

    if (error) {
        console.error('Assign Error:', error);
        throw new Error(error.message);
    }

    revalidatePath('/settings/accounts');
}

/**
 * 특정 팀에서 선택한 광고 계정들의 매핑을 해제합니다.
 * 다른 팀의 매핑은 그대로 유지됩니다.
 */
export async function unassignAccountsAction(teamId: string, accountIds: string[]) {
    await requireAdmin();

    const { error } = await adminClient
        .from('team_account_map')
        .delete()
        .eq('team_id', teamId)
        .in('ad_account_id', accountIds);

    if (error) {
        console.error('Unassign Error:', error);
        throw new Error(error.message);
    }

    revalidatePath('/settings/accounts');
}
