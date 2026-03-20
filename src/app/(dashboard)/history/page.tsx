export default function HistoryPage() {
    return (
        <div className="animate-in fade-in duration-500">
            <h2 className="text-2xl font-bold tracking-tight mb-2">검수 히스토리</h2>
            <p className="text-zinc-500 dark:text-zinc-400 mb-8">과거의 오차 발생 내역과 조치 이력을 확인합니다.</p>

            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 text-center text-zinc-500 border-dashed">
                검수 히스토리 콘텐츠 영역 (Audit logs 테이블 연동 예정)
            </div>
        </div>
    );
}
