import { createClient } from '@/utils/supabase/server';
import { ShieldCheck } from 'lucide-react';
import AuditClientUI from './AuditClientUI';

export default async function AuditPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    // Fetch user details for team
    const { data: myUser } = await supabase.from('users').select('*, teams(name)').eq('id', user.id).single();

    return (
        <div className="space-y-6 flex flex-col h-[calc(100vh-4rem)]">
            <header className="flex justify-between items-end flex-shrink-0 mb-2">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
                        <ShieldCheck className="w-6 h-6 text-indigo-500" />
                        실시간 검수 센터
                    </h1>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                        통합 표준 미디어믹스(Excel)를 업로드하여 매체에 세팅된 라이브 데이터와 실시간으로 크로스 체크합니다.
                    </p>
                </div>
            </header>

            <AuditClientUI teamId={myUser?.team_id} teamName={myUser?.teams?.name} />
        </div>
    );
}
