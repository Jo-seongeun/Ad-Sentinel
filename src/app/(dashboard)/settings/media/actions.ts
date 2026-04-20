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
    const refreshToken = formData.get('refreshToken') as string;

    const { error } = await supabase
        .from('platform_settings')
        .upsert({
            platform,
            app_id: appId,
            app_secret: appSecret,
            access_token: accessToken,
            business_id: businessId || null,
            refresh_token: refreshToken || null,
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

export async function testGoogleConnectionAction(
    appId: string,
    appSecret: string,
    refreshToken: string,
    developerToken: string,
    businessId: string
): Promise<{ valid: boolean; message: string }> {
    if (!appId || !appSecret || !refreshToken || !developerToken) {
        return { valid: false, message: 'Google 연동에 필요한 필수 정보(Client ID, Secret, Refresh Token, Developer Token)가 부족합니다.' };
    }

    try {
        // 1. Get short-lived access token using refresh_token
        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            cache: 'no-store',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: appId.trim(),
                client_secret: appSecret.trim(),
                refresh_token: refreshToken.trim(),
                grant_type: 'refresh_token',
            }).toString(),
        });

        const tokenText = await tokenRes.text();
        let tokenData;
        try {
            tokenData = JSON.parse(tokenText);
        } catch (e) {
            console.error('Token Error HTML:', tokenText);
            return { valid: false, message: `Access Token 파싱 실패 (${tokenRes.status}) - 데이터가 JSON 형식이 아닙니다.` };
        }

        if (!tokenRes.ok || !tokenData.access_token) {
            return { valid: false, message: `Access Token 발급 실패: ${tokenData.error_description || tokenData.error}` };
        }

        const currentAccessToken = tokenData.access_token;

        // 2. Ping Google Ads API (List Accessible Customers)
        const adsRes = await fetch('https://googleads.googleapis.com/v18/customers:listAccessibleCustomers', {
            method: 'GET',
            cache: 'no-store',
            headers: {
                'Authorization': `Bearer ${currentAccessToken}`,
                'developer-token': developerToken.trim(),
            },
        });

        const adsText = await adsRes.text();
        let adsData;
        try {
            adsData = JSON.parse(adsText);
        } catch (e) {
            console.error('Google Ads Error HTML:', adsText);
            return { valid: false, message: `Google Ads API 응답 파싱 실패 (${adsRes.status}) - 잘못된 엔드포인트 또는 식별자 오류일 수 있습니다.` };
        }

        if (adsData.error) {
            return { valid: false, message: `Google Ads API 오류: ${adsData.error.message}` };
        }

        // Extract customer Resource Names (e.g. customers/1234567890)
        let customers = adsData.resourceNames || [];
        if (customers.length === 0) {
            return { valid: true, message: '🚀 인증은 성공했으나, 접근 가능한 Google Ads 고객(계정)이 없습니다.' };
        }

        // Just display up to 3 numbers
        const niceNames = customers.map((c: string) => c.replace('customers/', '')).slice(0, 3).join(', ');
        const extra = customers.length > 3 ? ` 외 ${customers.length - 3}개` : '';

        return { valid: true, message: `🚀 정상 연결 성공! 접근 가능 계정: ${niceNames}${extra}` };
    } catch (err: any) {
        return { valid: false, message: '서버 에러: ' + err.message };
    }
}
