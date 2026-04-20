'use client';

import { useState } from 'react';
import { testGoogleConnectionAction } from './actions';
import { RefreshCw } from 'lucide-react';

export default function TestGoogleButton({
    tokenInfo
}: {
    tokenInfo?: any
}) {
    const [loading, setLoading] = useState(false);

    const handleTest = async () => {
        if (!tokenInfo?.app_id || !tokenInfo?.app_secret || !tokenInfo?.refresh_token || !tokenInfo?.access_token) {
            alert('필수 정보(Client ID, Secret, Refresh Token, Developer Token)를 모두 입력하고 먼저 [저장] 버튼을 눌러주세요.');
            return;
        }

        setLoading(true);
        try {
            const result = await testGoogleConnectionAction(
                tokenInfo.app_id,
                tokenInfo.app_secret,
                tokenInfo.refresh_token,
                tokenInfo.access_token, // developer token
                tokenInfo.business_id || '' // mcc id
            );
            if (result.valid) {
                alert(result.message);
            } else {
                alert(`❌ 연결 실패\n내용: ${result.message}`);
            }
        } catch (e: any) {
            alert('알 수 없는 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <button
            type="button"
            onClick={handleTest}
            disabled={loading}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2 px-4 rounded-lg text-sm transition-colors disabled:opacity-50"
        >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? '테스트 중...' : '연동 테스트 (즉시 확인)'}
        </button>
    );
}
