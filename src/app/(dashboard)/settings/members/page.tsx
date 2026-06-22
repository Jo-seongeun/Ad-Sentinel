import { createClient } from '@/utils/supabase/server';
import { Users, Trash2, MailPlus, UserCog } from 'lucide-react';
import { inviteMemberAction, updateMemberAction, deleteMemberAction } from './actions';
import DeleteButton from './DeleteButton';

export default async function MembersPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: myUser } = await supabase.from('users').select('*').eq('id', user.id).single();
    const isAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(myUser?.role);

    // RLS filters: Admins get all users, Team Managers get only their team
    const { data: members } = await supabase.from('users').select('*, teams(name)').order('created_at', { ascending: false });

    // Admins can see all teams to assign users
    const { data: teams } = await supabase.from('teams').select('*').order('name', { ascending: true });

    return (
        <div className="space-y-6 flex flex-col h-[calc(100vh-4rem)]">
            <header className="flex justify-between items-end flex-shrink-0 mb-2">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
                        <Users className="w-6 h-6 text-indigo-500" />
                        멤버 관리
                    </h1>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                        {isAdmin ? '플랫폼 내 모든 사용자를 관리하고 새 멤버를 초대합니다.' : '우리 팀 멤버를 확인하고 새로운 팀원을 부서로 초대할 수 있습니다.'}
                    </p>
                </div>
            </header>

            {/* Invite Form */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 flex-shrink-0">
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2 mb-4">
                    <MailPlus className="w-4 h-4 text-indigo-500" />
                    새로운 이메일 초대
                </h3>
                <form action={inviteMemberAction} className="flex flex-wrap items-end gap-4">
                    <div className="flex-1 min-w-[200px]">
                        <label className="block text-xs font-medium text-zinc-500 mb-1">이메일 주소</label>
                        <input type="email" name="email" required placeholder="new.member@example.com" className="w-full text-sm rounded-lg bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-2 outline-none focus:border-indigo-500 transition-colors" />
                    </div>
                    {isAdmin && (
                        <>
                            <div className="w-48">
                                <label className="block text-xs font-medium text-zinc-500 mb-1">역할 (권한)</label>
                                <select name="role" required className="w-full text-sm rounded-lg bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-2 outline-none focus:border-indigo-500">
                                    <option value="MEMBER">MEMBER (팀원)</option>
                                    <option value="TEAM_MANAGER">TEAM_MANAGER (팀 관리자)</option>
                                    <option value="ADMIN">ADMIN (관리자)</option>
                                    <option value="SUPER_ADMIN">SUPER_ADMIN (최고 관리자)</option>
                                </select>
                            </div>
                            <div className="w-48">
                                <label className="block text-xs font-medium text-zinc-500 mb-1">소속 팀 (선택)</label>
                                <select name="teamId" className="w-full text-sm rounded-lg bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-2 outline-none focus:border-indigo-500">
                                    <option value="">미배정 (소속 없음)</option>
                                    {teams?.map(t => (
                                        <option key={t.id} value={t.id}>{t.name}</option>
                                    ))}
                                </select>
                            </div>
                        </>
                    )}
                    <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-lg text-sm transition-colors flex-shrink-0">
                        초대 발송
                    </button>
                    {!process.env.SUPABASE_SERVICE_ROLE_KEY && (
                        <p className="w-full text-xs text-rose-500 mt-2">
                            * 현재 프로젝트에 SUPABASE_SERVICE_ROLE_KEY가 설정되지 않아 실제 이메일 발송은 동작하지 않습니다. (.env 파일 확인)
                        </p>
                    )}
                </form>
            </div>

            {/* Users Table */}
            <MemberListClient 
                members={members || []} 
                isAdmin={isAdmin} 
                myUserId={myUser.id} 
                teams={teams || []} 
            />
        </div>
    );
}
