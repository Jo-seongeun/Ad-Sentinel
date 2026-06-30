'use server';

import { createClient } from '@/utils/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';

// Require SERVICE_ROLE to manage users bypassing RLS
const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY! || ''
);

export async function inviteMemberAction(formData: FormData): Promise<void> {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
        console.error('Service Role Key가 환경변수에 설정되지 않아 이메일 초대 기능을 사용할 수 없습니다.');
        return;
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: adminData } = await supabase.from('users').select('role, team_id').eq('id', user.id).single();
    if (!adminData || !['SUPER_ADMIN', 'ADMIN', 'TEAM_MANAGER'].includes(adminData.role)) {
        console.error('권한이 부족합니다.');
        return;
    }

    const email = formData.get('email') as string;
    let targetRole = formData.get('role') as string;
    let targetTeamId = formData.get('teamId') as string;

    // Team Manager restriction: Can only invite as MEMBER strictly to their own team
    if (adminData.role === 'TEAM_MANAGER') {
        targetRole = 'MEMBER';
        targetTeamId = adminData.team_id;
    }

    // 1. Invite User
    const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email);
    if (error) {
        console.error('Invite Error:', error);
        return;
    }

    // 2. Wait for the DB trigger (handle_new_user) to insert the public.users row
    await new Promise(resolve => setTimeout(resolve, 800));

    // 3. Update their role and team in public.users
    if (data.user) {
        const userId = data.user.id;
        const payload: any = { role: targetRole };
        if (targetTeamId) payload.team_id = targetTeamId;

        await supabaseAdmin.from('users').update(payload).eq('id', userId);
    }

    revalidatePath('/settings/members');
}

export async function updateMemberAction(formData: FormData): Promise<{ success: boolean; message?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, message: '로그인이 필요합니다.' };

    const { data: adminData } = await supabase.from('users').select('role').eq('id', user.id).single();
    if (!adminData || !['SUPER_ADMIN', 'ADMIN'].includes(adminData.role)) {
        return { success: false, message: '이 수정 기능은 관리자만 사용할 수 있습니다.' };
    }

    const targetUserId = formData.get('userId') as string;
    const role = formData.get('role') as string;
    const teamId = formData.get('teamId') as string;
    const fullName = formData.get('fullName') as string | null;

    const payload: any = { role };
    // Empty string means unassigned
    payload.team_id = teamId ? teamId : null;

    // Only update full_name if it was provided in the form
    if (fullName !== null) {
        payload.full_name = fullName.trim() || null;
    }

    const { error } = await supabaseAdmin.from('users').update(payload).eq('id', targetUserId);
    if (error) {
        console.error('Update Error:', error);
        return { success: false, message: '수정 처리 중 에러가 발생했습니다.' };
    }

    revalidatePath('/settings/members');
    return { success: true };
}

export async function updateMembersBulkAction(updates: Array<{ userId: string; role: string; teamId: string; fullName: string | null }>): Promise<{ success: boolean; message?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, message: '로그인이 필요합니다.' };

    const { data: adminData } = await supabase.from('users').select('role').eq('id', user.id).single();
    if (!adminData || !['SUPER_ADMIN', 'ADMIN'].includes(adminData.role)) {
        return { success: false, message: '이 수정 기능은 관리자만 사용할 수 있습니다.' };
    }

    try {
        for (const update of updates) {
            const payload: any = { role: update.role };
            payload.team_id = update.teamId ? update.teamId : null;
            if (update.fullName !== null) {
                payload.full_name = update.fullName.trim() || null;
            }
            const { error } = await supabaseAdmin.from('users').update(payload).eq('id', update.userId);
            if (error) throw error;
        }
        revalidatePath('/settings/members');
        return { success: true };
    } catch (err: any) {
        console.error('Bulk Update Error:', err);
        return { success: false, message: err.message || '일괄 수정 중 오류가 발생했습니다.' };
    }
}

export async function deleteMemberAction(formData: FormData): Promise<void> {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
        console.error('Service Role Key가 환경변수에 설정되지 않아 회원 삭제 기능을 사용할 수 없습니다.');
        return;
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: adminData } = await supabase.from('users').select('role').eq('id', user.id).single();
    if (!adminData || !['SUPER_ADMIN', 'ADMIN'].includes(adminData.role)) {
        console.error('이 삭제 기능은 관리자만 사용할 수 있습니다.');
        return;
    }

    const targetUserId = formData.get('userId') as string;

    if (targetUserId === user.id) {
        console.error('자기 자신을 삭제할 수 없습니다.');
        return;
    }

    const { error } = await supabaseAdmin.auth.admin.deleteUser(targetUserId);
    if (error) {
        console.error('Delete Error:', error);
        return;
    }

    revalidatePath('/settings/members');
}
