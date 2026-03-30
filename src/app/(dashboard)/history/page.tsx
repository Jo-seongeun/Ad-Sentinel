import { createClient } from '@/utils/supabase/server';
import { History, Search, Filter } from 'lucide-react';
import HistoryClientUI from './HistoryClientUI';

export default async function HistoryPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    // Fetch user details for team
    const { data: myUser } = await supabase.from('users').select('*, teams(name)').eq('id', user.id).single();
    if (!myUser) return null;

    const isAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(myUser.role);

    // Fetch logs (if Admin, fetch all, else fetch only own team)
    let query = supabase.from('audit_logs').select('*, teams(name)').order('created_at', { ascending: false }).limit(100);

    if (!isAdmin && myUser.team_id) {
        query = query.eq('team_id', myUser.team_id);
    }

    const { data: logs } = await query;

    return (
        <div className="space-y-6 flex flex-col h-[calc(100vh-4rem)]">
            <header className="flex justify-between items-end flex-shrink-0 mb-2">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
                        <History className="w-6 h-6 text-indigo-500" />
                        검수 히스토리
                    </h1>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                        이전에 진행한 매체 크로스 체크(검수) 내역을 확인하고 에러 상세 정보를 추적합니다.
                    </p>
                </div>
            </header>

            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl flex-1 overflow-hidden flex flex-col shadow-sm">
                <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 flex items-center justify-between shrink-0">
                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                        검수 내역 (최근 100건)
                    </h3>
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                            <input
                                type="text"
                                placeholder="기록 검색..."
                                className="pl-9 pr-3 py-1.5 text-sm rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 outline-none focus:ring-2 focus:ring-indigo-500 w-48"
                            />
                        </div>
                        <button className="p-1.5 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                            <Filter className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                <HistoryClientUI logs={logs || []} isAdmin={isAdmin} />
            </div>
        </div>
    );
}
