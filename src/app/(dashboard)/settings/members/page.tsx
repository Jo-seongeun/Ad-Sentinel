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
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl flex-1 overflow-hidden flex flex-col">
                <div className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30">
                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                        <UserCog className="w-4 h-4 text-emerald-500" />
                        가입된 사용자 목록
                        <span className="bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 py-0.5 px-2 rounded-full text-xs ml-2">
                            {members?.length || 0}
                        </span>
                    </h3>
                </div>
                <div className="overflow-x-auto flex-1">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-zinc-50 dark:bg-zinc-900/50 text-zinc-500 dark:text-zinc-400 sticky top-0 border-b border-zinc-200 dark:border-zinc-800 z-10">
                            <tr>
                                <th className="px-6 py-4 font-medium">이메일</th>
                                <th className="px-6 py-4 font-medium">사용자 명</th>
                                <th className="px-6 py-4 font-medium">가입일시</th>
                                <th className="px-6 py-4 font-medium">역할</th>
                                <th className="px-6 py-4 font-medium">소속 팀</th>
                                {isAdmin && <th className="px-6 py-4 font-medium text-right">관리</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 relative z-0">
                            {members?.map((member) => (
                                <tr key={member.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400 flex items-center justify-center text-xs font-semibold">
                                                {member.full_name ? member.full_name.charAt(0) : member.email?.charAt(0).toUpperCase()}
                                            </div>
                                            <span className="font-medium text-zinc-900 dark:text-zinc-100">{member.email}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 font-medium text-zinc-700 dark:text-zinc-300">
                                        {member.full_name || <span className="text-zinc-400 italic text-xs font-normal">미입력</span>}
                                    </td>
                                    <td className="px-6 py-4 text-zinc-500">
                                        {new Date(member.created_at).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-4">
                                        {isAdmin && member.id !== myUser.id ? (
                                            <form action={updateMemberAction} className="flex gap-2 items-center">
                                                <input type="hidden" name="userId" value={member.id} />
                                                <input type="hidden" name="teamId" value={member.team_id || ''} />
                                                <select name="role" defaultValue={member.role} className="p-1.5 text-xs font-medium border rounded bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 outline-none text-zinc-700 dark:text-zinc-300">
                                                    <option value="GUEST">GUEST (미승인)</option>
                                                    <option value="MEMBER">MEMBER</option>
                                                    <option value="TEAM_MANAGER">TEAM_MANAGER</option>
                                                    <option value="ADMIN">ADMIN</option>
                                                    <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                                                </select>
                                                <button type="submit" className="text-xs font-semibold text-indigo-600 border border-indigo-200 bg-indigo-50 px-2 py-1.5 rounded hover:bg-indigo-100 dark:border-indigo-800/50 dark:bg-indigo-900/20 dark:hover:bg-indigo-900/40 transition-colors">
                                                    수정
                                                </button>
                                            </form>
                                        ) : (
                                            <span className="inline-block px-2 py-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded text-xs font-semibold border border-zinc-200 dark:border-zinc-700">
                                                {member.role}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        {isAdmin && member.id !== myUser.id ? (
                                            <form action={updateMemberAction} className="flex gap-2 items-center">
                                                <input type="hidden" name="userId" value={member.id} />
                                                <input type="hidden" name="role" value={member.role} />
                                                <select name="teamId" defaultValue={member.team_id || ''} className="p-1.5 text-xs font-medium border rounded bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 outline-none text-zinc-700 dark:text-zinc-300">
                                                    <option value="">미배정 (소속 없음)</option>
                                                    {teams?.map(t => (
                                                        <option key={t.id} value={t.id}>{t.name}</option>
                                                    ))}
                                                </select>
                                                <button type="submit" className="text-xs font-semibold text-indigo-600 border border-indigo-200 bg-indigo-50 px-2 py-1.5 rounded hover:bg-indigo-100 dark:border-indigo-800/50 dark:bg-indigo-900/20 dark:hover:bg-indigo-900/40 transition-colors">
                                                    수정
                                                </button>
                                            </form>
                                        ) : (
                                            <span className="text-zinc-600 dark:text-zinc-400">
                                                {member.teams?.name || <span className="text-rose-500 font-medium text-xs">미할당</span>}
                                            </span>
                                        )}
                                    </td>
                                    {isAdmin && (
                                        <td className="px-6 py-4 text-right">
                                            {member.id !== myUser.id ? (
                                                <form action={deleteMemberAction}>
                                                    <input type="hidden" name="userId" value={member.id} />
                                                    <DeleteButton />
                                                </form>
                                            ) : (
                                                <span className="text-xs text-zinc-400 font-medium px-2">(본인)</span>
                                            )}
                                        </td>
                                    )}
                                </tr>
                            ))}
                            {members?.length === 0 && (
                                <tr>
                                    <td colSpan={isAdmin ? 5 : 4} className="px-6 py-12 text-center text-zinc-500">
                                        표시할 멤버가 없습니다.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
