'use server';

import { createClient } from '@/utils/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';

// Service Role 클라이언트 — RLS 우회 (team_account_map 쓰기 전용)
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

export async function assignAccountsAction(teamId: string, accounts: { id: string, platform: 'META' | 'GOOGLE' }[]) {
    await requireAdmin();

    const accountIds = accounts.map(a => a.id);

    // 1. 기존 매핑 삭제 (한 계정은 하나의 팀에만 속할 수 있음)
    await adminClient.from('team_account_map').delete().in('ad_account_id', accountIds);

    // 2. 새 매핑 삽입
    const payloads = accounts.map(acc => ({
        team_id: teamId,
        platform: acc.platform,
        ad_account_id: acc.id
    }));

    const { error } = await adminClient.from('team_account_map').insert(payloads);
    if (error) {
        console.error('Assign Error:', error);
        throw new Error(error.message);
    }

    revalidatePath('/settings/accounts');
}

export async function unassignAccountsAction(accountIds: string[]) {
    await requireAdmin();

    const { error } = await adminClient.from('team_account_map').delete().in('ad_account_id', accountIds);
    if (error) {
        console.error('Unassign Error:', error);
        throw new Error(error.message);
    }

    revalidatePath('/settings/accounts');
}
