'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

async function requireAdmin() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthorized');
    const { data: adminData } = await supabase.from('users').select('role').eq('id', user.id).single();
    if (!adminData || !['SUPER_ADMIN', 'ADMIN'].includes(adminData.role)) {
        throw new Error('Forbidden');
    }
    return supabase;
}

export async function assignAccountsAction(teamId: string, accounts: { id: string, platform: 'META' | 'GOOGLE' }[]) {
    const supabase = await requireAdmin();

    // UPSERT: Insert or do nothing if it already exists. Actually, we should just insert.
    // If an account is already mapped to another team, we should maybe UPDATE it.
    // Let's delete existing mappings for these accounts first so they are cleanly assigned to the new team.
    const accountIds = accounts.map(a => a.id);

    // 1. Delete old mappings for these specific ad accounts (an account can only belong to one team at a time)
    await supabase.from('team_account_map').delete().in('ad_account_id', accountIds);

    // 2. Insert new mappings
    const payloads = accounts.map(acc => ({
        team_id: teamId,
        platform: acc.platform,
        ad_account_id: acc.id
    }));

    const { error } = await supabase.from('team_account_map').insert(payloads);
    if (error) {
        console.error('Assign Error:', error);
        throw new Error(error.message);
    }

    revalidatePath('/settings/accounts');
}

export async function unassignAccountsAction(accountIds: string[]) {
    const supabase = await requireAdmin();

    const { error } = await supabase.from('team_account_map').delete().in('ad_account_id', accountIds);
    if (error) {
        console.error('Unassign Error:', error);
        throw new Error(error.message);
    }

    revalidatePath('/settings/accounts');
}
