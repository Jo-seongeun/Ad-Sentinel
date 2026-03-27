import { createClient } from '@/utils/supabase/server';
import { FolderGit2 } from 'lucide-react';
import TeamsClientUI, { Team } from './TeamsClientUI';

export default async function TeamsManagementPage() {
    const supabase = await createClient();

    // Fetch teams
    const { data: teamsData, error } = await supabase
        .from('teams')
        .select('*')
        .order('created_at', { ascending: true });

    const teams: Team[] = teamsData || [];

    return (
        <div className="space-y-6 max-w-4xl pb-10 animate-in fade-in duration-500">
            <header>
                <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
                    <FolderGit2 className="w-6 h-6 text-indigo-500" />
                    팀 계정 관리
                </h1>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                    신규 대행사 또는 부서를 팀으로 등록하고 이름을 관리합니다. 생성된 팀은 멤버 관리 및 매체 연결에 사용됩니다.
                </p>
            </header>

            <TeamsClientUI initialTeams={teams} />
        </div>
    );
}
