'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

// Reusable auth check
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

export async function savePlatformSettingsAction(formData: FormData): Promise<void> {
    const supabase = await requireAdmin();
    const platform = formData.get('platform') as string;
    const appId = formData.get('appId') as string;
    const appSecret = formData.get('appSecret') as string;
    const accessToken = formData.get('accessToken') as string;
    const businessId = formData.get('businessId') as string;

    const { error } = await supabase
        .from('platform_settings')
        .upsert({
            platform,
            app_id: appId,
            app_secret: appSecret,
            access_token: accessToken,
            business_id: businessId || null,
            updated_at: new Date().toISOString()
        });

    if (error) {
        console.error('Update Setting Error:', error);
        return;
    }
    revalidatePath('/settings/media');
}

export async function testMetaConnectionAction(token: string): Promise<{ valid: boolean; message: string }> {
    if (!token) return { valid: false, message: '저장된 토큰이 없습니다.' };

    // Server execution for security
    try {
        const res = await fetch(`https://graph.facebook.com/v19.0/me?access_token=${token}`, { cache: 'no-store' });
        const data = await res.json();

        if (data.error) {
            return { valid: false, message: data.error.message };
        }

        return { valid: true, message: `🚀 정상 연결 성공! (계정: ${data.name || data.id})` };
    } catch (err: any) {
        return { valid: false, message: '네트워크 또는 서버 오류: ' + err.message };
    }
}
