export default function MediaSettingsPage() {
    return (
        <div className="animate-in fade-in duration-500">
            <h2 className="text-2xl font-bold tracking-tight mb-2">매체 연동 관리</h2>
            <p className="text-zinc-500 dark:text-zinc-400 mb-8">Meta, Google Ads 매체 API 토큰 및 연결 상태를 관리합니다.</p>

            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 text-center text-zinc-500 border-dashed">
                매체 연동 관리 콘텐츠 영역 (API 토큰 발급 및 상태 확인)
            </div>
        </div>
    );
}
