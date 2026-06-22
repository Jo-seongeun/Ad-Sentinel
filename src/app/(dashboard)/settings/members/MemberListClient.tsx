'use client';

import { useState } from 'react';
import { UserCog, Search } from 'lucide-react';
import { updateMemberAction, deleteMemberAction } from './actions';
import DeleteButton from './DeleteButton';

export default function MemberListClient({ members, isAdmin, myUserId, teams }: { members: any[], isAdmin: boolean, myUserId: string, teams: any[] }) {
    const [searchTerm, setSearchTerm] = useState('');

    const filteredMembers = members?.filter(member => {
        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();
        
        const emailMatch = member.email?.toLowerCase().includes(term);
        const nameMatch = member.full_name?.toLowerCase().includes(term);
        const teamMatch = member.teams?.name?.toLowerCase().includes(term);
        const roleMatch = member.role?.toLowerCase().includes(term);

        return emailMatch || nameMatch || teamMatch || roleMatch;
    });

    return (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl flex-1 overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30 flex justify-between items-center flex-wrap gap-4">
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                    <UserCog className="w-4 h-4 text-emerald-500" />
                    가입된 사용자 목록
                    <span className="bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 py-0.5 px-2 rounded-full text-xs ml-2">
                        {filteredMembers?.length || 0}
                    </span>
                </h3>
                
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-4 w-4 text-zinc-400" />
                    </div>
                    <input
                        type="text"
                        placeholder="이메일, 이름, 팀, 역할 검색..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9 pr-4 py-1.5 text-sm rounded-lg bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 outline-none focus:border-indigo-500 transition-colors w-64 text-zinc-700 dark:text-zinc-300"
                    />
                </div>
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
                        {filteredMembers?.map((member) => (
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
                                    {isAdmin && member.id !== myUserId ? (
                                        <form action={updateMemberAction} className="flex gap-2 items-center">
                                            <input type="hidden" name="userId" value={member.id} />
                                            <input type="hidden" name="role" value={member.role} />
                                            <input type="hidden" name="teamId" value={member.team_id || ''} />
                                            <input type="text" name="fullName" defaultValue={member.full_name || ''} placeholder="이름 입력" className="p-1.5 text-xs font-medium border rounded bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 outline-none w-24 text-zinc-700 dark:text-zinc-300" />
                                            <button type="submit" className="text-xs font-semibold text-indigo-600 border border-indigo-200 bg-indigo-50 px-2 py-1.5 rounded hover:bg-indigo-100 dark:border-indigo-800/50 dark:bg-indigo-900/20 dark:hover:bg-indigo-900/40 transition-colors">
                                                수정
                                            </button>
                                        </form>
                                    ) : (
                                        member.full_name || <span className="text-zinc-400 italic text-xs font-normal">미입력</span>
                                    )}
                                </td>
                                <td className="px-6 py-4 text-zinc-500">
                                    {new Date(member.created_at).toLocaleDateString()}
                                </td>
                                <td className="px-6 py-4">
                                    {isAdmin && member.id !== myUserId ? (
                                        <form action={updateMemberAction} className="flex gap-2 items-center">
                                            <input type="hidden" name="userId" value={member.id} />
                                            <input type="hidden" name="teamId" value={member.team_id || ''} />
                                            <input type="hidden" name="fullName" value={member.full_name || ''} />
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
                                    {isAdmin && member.id !== myUserId ? (
                                        <form action={updateMemberAction} className="flex gap-2 items-center">
                                            <input type="hidden" name="userId" value={member.id} />
                                            <input type="hidden" name="role" value={member.role} />
                                            <input type="hidden" name="fullName" value={member.full_name || ''} />
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
                                        {member.id !== myUserId ? (
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
                        {filteredMembers?.length === 0 && (
                            <tr>
                                <td colSpan={isAdmin ? 6 : 5} className="px-6 py-12 text-center text-zinc-500">
                                    표시할 멤버가 없습니다.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
