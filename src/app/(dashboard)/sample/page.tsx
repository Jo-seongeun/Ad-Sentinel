import { Lock, Clock } from 'lucide-react';

export default function SampleDashboardPage() {
    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
            <div className="w-16 h-16 bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-500 rounded-full flex items-center justify-center mb-6">
                <Lock className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 mb-2">
                계정 승인 대기 중입니다
            </h1>
            <p className="text-zinc-500 max-w-md mx-auto mb-8">
                현재 GUEST 권한 상태입니다. 관리자가 소속 팀과 권한을 배정해 주면, 실제 대시보드 데이터에 접근할 수 있게 됩니다.
            </p>

            <div className="w-full max-w-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
                <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 flex justify-between items-center">
                    <h2 className="text-sm font-semibold flex items-center gap-2">
                        <Clock className="w-4 h-4 text-zinc-400" />
                        샘플 대시보드 미리보기
                    </h2>
                    <span className="text-xs bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 px-2 py-1 rounded font-medium">Sample Data</span>
                </div>
                <div className="p-6 opacity-50 blur-[2px] pointer-events-none select-none">
                    <div className="grid grid-cols-3 gap-4 mb-6">
                        <div className="h-24 bg-zinc-100 dark:bg-zinc-800 rounded-lg animate-pulse"></div>
                        <div className="h-24 bg-zinc-100 dark:bg-zinc-800 rounded-lg animate-pulse"></div>
                        <div className="h-24 bg-zinc-100 dark:bg-zinc-800 rounded-lg animate-pulse"></div>
                    </div>
                    <div className="h-64 bg-zinc-100 dark:bg-zinc-800 rounded-lg animate-pulse"></div>
                </div>
            </div>
        </div>
    );
}
