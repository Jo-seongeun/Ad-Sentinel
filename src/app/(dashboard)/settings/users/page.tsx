import { createClient } from '@/utils/supabase/server';
import { ShieldCheck, UserCheck } from 'lucide-react';
import { revalidatePath } from 'next/cache';

async function approveUser(formData: FormData) {
    'use server';
    const supabase = await createClient();
    const userId = formData.get('userId') as string;
    const role = formData.get('role') as string;
    const teamId = formData.get('teamId') as string;

    const payload: any = { role };
    if (teamId) payload.team_id = teamId;

    const { error } = await supabase.from('users').update(payload).eq('id', userId);
    if (error) {
        console.error('Error updating user:', error);
    }
    revalidatePath('/settings/users');
}

export default async function UserApprovalPage() {
    const supabase = await createClient();

    // Verify Admin rights again just in case
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: adminData } = await supabase.from('users').select('role').eq('id', user.id).single();
    if (adminData?.role !== 'SUPER_ADMIN' && adminData?.role !== 'ADMIN') {
        return <div className="p-8 text-rose-500 font-bold">권한이 부족합니다.</div>;
    }

    // Fetch Guests
    const { data: guests } = await supabase.from('users').select('*').eq('role', 'GUEST').order('created_at', { ascending: false });

    // Fetch Teams
    const { data: teams } = await supabase.from('teams').select('*').order('name', { ascending: true });

    return (
        <div className="space-y-6 flex flex-col h-[calc(100vh-4rem)]">
            <header className="flex justify-between items-end flex-shrink-0 mb-2">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
                        <UserCheck className="w-6 h-6 text-indigo-500" />
                        가입 승인 대기열
                    </h1>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                        GUEST 권한으로 대기 중인 신규 가입자들에게 팀과 역할을 배정하여 승인합니다.
                    </p>
                </div>
            </header>

            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl flex-1 overflow-hidden flex flex-col">
                <div className="overflow-x-auto flex-1">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-zinc-50 dark:bg-zinc-900/50 text-zinc-500 dark:text-zinc-400 sticky top-0 border-b border-zinc-200 dark:border-zinc-800">
                            <tr>
                                <th className="px-6 py-4 font-medium">이메일</th>
                                <th className="px-6 py-4 font-medium">사용자 명</th>
                                <th className="px-6 py-4 font-medium">가입일시</th>
                                <th className="px-6 py-4 font-medium text-right">상태 변경 & 승인</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                            {guests?.length === 0 && (
                                <tr>
                                    <td colSpan={3} className="px-6 py-12 text-center text-zinc-500">
                                        대기 중인 신규 가입자가 없습니다.
                                    </td>
                                </tr>
                            )}
                            {guests?.map((guest) => (
                                <tr key={guest.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400 flex items-center justify-center text-xs font-semibold">
                                                {guest.full_name ? guest.full_name.charAt(0) : guest.email?.charAt(0).toUpperCase()}
                                            </div>
                                            <span className="font-medium text-zinc-900 dark:text-zinc-100">{guest.email}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 font-medium text-zinc-700 dark:text-zinc-300">
                                        {guest.full_name || <span className="text-zinc-400 italic text-xs font-normal">미입력</span>}
                                    </td>
                                    <td className="px-6 py-4 text-zinc-500">
                                        {new Date(guest.created_at).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <form className="flex items-center justify-end gap-3">
                                            <input type="hidden" name="userId" value={guest.id} />
                                            <select name="role" required className="p-1.5 text-sm border rounded-lg bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 outline-none">
                                                <option value="MEMBER">MEMBER (팀원)</option>
                                                <option value="TEAM_MANAGER">TEAM_MANAGER (팀 관리자)</option>
                                                <option value="ADMIN">ADMIN (중간 관리자)</option>
                                                <option value="SUPER_ADMIN">SUPER_ADMIN (최고 관리자)</option>
                                            </select>
                                            <select name="teamId" className="p-1.5 text-sm border rounded-lg bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 outline-none">
                                                <option value="">미배정 (소속 없음)</option>
                                                {teams?.map(t => (
                                                    <option key={t.id} value={t.id}>{t.name}</option>
                                                ))}
                                            </select>
                                            <button
                                                formAction={approveUser}
                                                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold py-2 px-3 rounded-lg transition-colors flex items-center gap-1 inline-flex"
                                            >
                                                <ShieldCheck className="w-4 h-4" /> 가입 승인
                                            </button>
                                        </form>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
