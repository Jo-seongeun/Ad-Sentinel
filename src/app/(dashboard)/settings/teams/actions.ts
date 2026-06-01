'use server';

import { createClient } from '@/utils/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';

// Service Role 클라이언트 — RLS 우회 (teams 테이블 쓰기 전용)
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
        throw new Error('Forbidden: Admin only');
    }
}

export async function createTeamAction(name: string) {
    await requireAdmin();
    const { error } = await adminClient.from('teams').insert({ name });
    if (error) throw new Error(error.message);
    revalidatePath('/settings/teams');
}

export async function updateTeamAction(id: string, name: string) {
    await requireAdmin();
    const { error } = await adminClient.from('teams').update({ name }).eq('id', id);
    if (error) throw new Error(error.message);
    revalidatePath('/settings/teams');
}

export async function deleteTeamAction(id: string) {
    await requireAdmin();
    const { error } = await adminClient.from('teams').delete().eq('id', id);
    if (error) throw new Error(error.message);
    revalidatePath('/settings/teams');
    revalidatePath('/settings/accounts'); // Keep mappings updated
}
