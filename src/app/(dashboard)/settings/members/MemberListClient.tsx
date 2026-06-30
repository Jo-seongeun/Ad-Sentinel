'use client';

import { useState } from 'react';
import { UserCog, Search, Save } from 'lucide-react';
import { updateMemberAction, updateMembersBulkAction, deleteMemberAction, resetMemberPasswordAction } from './actions';
import DeleteButton from './DeleteButton';

export default function MemberListClient({ members, isAdmin, myUserId, teams }: { members: any[], isAdmin: boolean, myUserId: string, teams: any[] }) {
    const [searchTerm, setSearchTerm] = useState('');
    const [edits, setEdits] = useState<{ [userId: string]: { role: string; teamId: string; fullName: string } }>({});
    const [isSaving, setIsSaving] = useState(false);

    const handleResetPassword = async (userId: string, email: string) => {
        const newPassword = prompt(`[${email}] 사용자의 새로운 비밀번호를 입력해주세요 (최소 6자 이상):`);
        if (newPassword === null) return; // 취소
        
        const pwdTrimmed = newPassword.trim();
        if (pwdTrimmed.length < 6) {
            alert('비밀번호는 최소 6자 이상이어야 합니다.');
            return;
        }

        if (!confirm(`정말로 [${email}] 사용자의 비밀번호를 변경하시겠습니까?`)) return;

        setIsSaving(true);
        try {
            const res = await resetMemberPasswordAction(userId, pwdTrimmed);
            if (res.success) {
                alert('비밀번호가 성공적으로 재설정되었습니다.');
            } else {
                alert(`비밀번호 재설정 실패: ${res.message || '알 수 없는 오류가 발생했습니다.'}`);
            }
        } catch (err: any) {
            alert(`오류: ${err.message || '네트워크 오류가 발생했습니다.'}`);
        } finally {
            setIsSaving(false);
        }
    };

    const filteredMembers = members?.filter(member => {
        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();
        
        const emailMatch = member.email?.toLowerCase().includes(term);
        const nameMatch = member.full_name?.toLowerCase().includes(term);
        const teamMatch = member.teams?.name?.toLowerCase().includes(term);
        const roleMatch = member.role?.toLowerCase().includes(term);

        return emailMatch || nameMatch || teamMatch || roleMatch;
    });

    const handleFieldChange = (userId: string, field: 'role' | 'teamId' | 'fullName', value: string, memberOriginal: any) => {
        setEdits(prev => {
            const currentEdit = prev[userId] || {
                role: memberOriginal.role,
                teamId: memberOriginal.team_id || '',
                fullName: memberOriginal.full_name || ''
            };
            const newEdit = { ...currentEdit, [field]: value };
            
            const isSameAsOriginal = 
                newEdit.role === memberOriginal.role &&
                newEdit.teamId === (memberOriginal.team_id || '') &&
                newEdit.fullName === (memberOriginal.full_name || '');

            if (isSameAsOriginal) {
                const updated = { ...prev };
                delete updated[userId];
                return updated;
            }
            return { ...prev, [userId]: newEdit };
        });
    };

    const handleSaveSingle = async (userId: string, memberOriginal: any) => {
        const editState = edits[userId];
        if (!editState) {
            alert('변경된 내용이 없습니다.');
            return;
        }
        setIsSaving(true);
        try {
            const formData = new FormData();
            formData.append('userId', userId);
            formData.append('role', editState.role);
            formData.append('teamId', editState.teamId);
            formData.append('fullName', editState.fullName);

            const res = await updateMemberAction(formData);
            if (res.success) {
                alert('수정되었습니다.');
                setEdits(prev => {
                    const updated = { ...prev };
                    delete updated[userId];
                    return updated;
                });
            } else {
                alert(`에러: ${res.message || '수정에 실패했습니다.'}`);
            }
        } catch (err: any) {
            alert(`오류: ${err.message || '네트워크 오류가 발생했습니다.'}`);
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveAll = async () => {
        const editKeys = Object.keys(edits);
        if (editKeys.length === 0) return;
        
        setIsSaving(true);
        try {
            const payload = editKeys.map(userId => ({
                userId,
                role: edits[userId].role,
                teamId: edits[userId].teamId,
                fullName: edits[userId].fullName
            }));

            const res = await updateMembersBulkAction(payload);
            if (res.success) {
                alert('전체 수정되었습니다.');
                setEdits({});
            } else {
                alert(`에러: ${res.message || '일괄 수정에 실패했습니다.'}`);
            }
        } catch (err: any) {
            alert(`오류: ${err.message || '네트워크 오류가 발생했습니다.'}`);
        } finally {
            setIsSaving(false);
        }
    };

    const hasChanges = Object.keys(edits).length > 0;

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
                
                <div className="flex items-center gap-3">
                    {isAdmin && (
                        <button
                            onClick={handleSaveAll}
                            disabled={!hasChanges || isSaving}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-all ${
                                hasChanges && !isSaving
                                    ? 'bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer transform hover:-translate-y-0.5'
                                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-600 cursor-not-allowed'
                            }`}
                        >
                            <Save className="w-3.5 h-3.5" />
                            전체 수정
                            {hasChanges && (
                                <span className="ml-0.5 bg-indigo-500 text-white text-[10px] w-4.5 h-4.5 rounded-full flex items-center justify-center font-bold">
                                    {Object.keys(edits).length}
                                </span>
                            )}
                        </button>
                    )}

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
            </div>
            <div className="overflow-x-auto flex-1">
                <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-zinc-50 dark:bg-zinc-900/50 text-zinc-500 dark:text-zinc-400 sticky top-0 border-b border-zinc-200 dark:border-zinc-800 z-10">
                        <tr>
                            <th className="px-3.5 py-3.5 font-medium">이메일</th>
                            <th className="px-3.5 py-3.5 font-medium">사용자 명</th>
                            <th className="px-3.5 py-3.5 font-medium">가입일시</th>
                            <th className="px-3.5 py-3.5 font-medium">역할</th>
                            <th className="px-3.5 py-3.5 font-medium">소속 팀</th>
                            {isAdmin && <th className="px-3.5 py-3.5 font-medium text-right">관리</th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 relative z-0">
                        {filteredMembers?.map((member) => {
                            const editState = edits[member.id];
                            const isChanged = editState !== undefined;
                            const currentFullName = isChanged ? editState.fullName : (member.full_name || '');
                            const currentRole = isChanged ? editState.role : member.role;
                            const currentTeamId = isChanged ? editState.teamId : (member.team_id || '');

                            return (
                                <tr 
                                    key={member.id} 
                                    className={`transition-colors border-l-2 ${
                                        isChanged 
                                            ? 'bg-amber-50/40 dark:bg-amber-950/10 border-l-amber-500' 
                                            : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50 border-l-transparent'
                                    }`}
                                >
                                    <td className="px-3.5 py-3">
                                        <div className="flex items-center gap-2">
                                            <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400 flex items-center justify-center text-xs font-semibold">
                                                {currentFullName ? currentFullName.charAt(0) : member.email?.charAt(0).toUpperCase()}
                                            </div>
                                            <span className="font-medium text-zinc-900 dark:text-zinc-100">{member.email}</span>
                                        </div>
                                    </td>
                                    <td className="px-3.5 py-3 font-medium text-zinc-700 dark:text-zinc-300">
                                        {isAdmin && member.id !== myUserId ? (
                                            <div className="flex gap-1.5 items-center">
                                                <input 
                                                    type="text" 
                                                    value={currentFullName} 
                                                    placeholder="이름 입력" 
                                                    onChange={(e) => handleFieldChange(member.id, 'fullName', e.target.value, member)}
                                                    className="p-1 text-xs font-medium border rounded bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 outline-none w-20 text-zinc-700 dark:text-zinc-300 focus:border-indigo-500" 
                                                />
                                                <button 
                                                    onClick={() => handleSaveSingle(member.id, member)}
                                                    disabled={!isChanged || isSaving}
                                                    className={`text-xs font-semibold px-1.5 py-1 rounded border transition-colors ${
                                                        isChanged && !isSaving
                                                            ? 'text-amber-700 bg-amber-50 border-amber-200 hover:bg-amber-100 dark:text-amber-400 dark:bg-amber-950/20 dark:border-amber-900/50'
                                                            : 'text-zinc-400 dark:text-zinc-600 bg-zinc-50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 cursor-not-allowed'
                                                    }`}
                                                >
                                                    수정
                                                </button>
                                            </div>
                                        ) : (
                                            member.full_name || <span className="text-zinc-400 italic text-xs font-normal">미입력</span>
                                        )}
                                    </td>
                                    <td className="px-3.5 py-3 text-zinc-500">
                                        {new Date(member.created_at).toLocaleDateString()}
                                    </td>
                                    <td className="px-3.5 py-3">
                                        {isAdmin && member.id !== myUserId ? (
                                            <div className="flex gap-1.5 items-center">
                                                <select 
                                                    value={currentRole} 
                                                    onChange={(e) => handleFieldChange(member.id, 'role', e.target.value, member)}
                                                    className="p-1 text-xs font-medium border rounded bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 outline-none text-zinc-700 dark:text-zinc-300 focus:border-indigo-500"
                                                >
                                                    <option value="GUEST">GUEST (미승인)</option>
                                                    <option value="MEMBER">MEMBER</option>
                                                    <option value="TEAM_MANAGER">TEAM_MANAGER</option>
                                                    <option value="ADMIN">ADMIN</option>
                                                    <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                                                </select>
                                                <button 
                                                    onClick={() => handleSaveSingle(member.id, member)}
                                                    disabled={!isChanged || isSaving}
                                                    className={`text-xs font-semibold px-1.5 py-1 rounded border transition-colors ${
                                                        isChanged && !isSaving
                                                            ? 'text-amber-700 bg-amber-50 border-amber-200 hover:bg-amber-100 dark:text-amber-400 dark:bg-amber-950/20 dark:border-amber-900/50'
                                                            : 'text-zinc-400 dark:text-zinc-600 bg-zinc-50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 cursor-not-allowed'
                                                    }`}
                                                >
                                                    수정
                                                </button>
                                            </div>
                                        ) : (
                                            <span className="inline-block px-2 py-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded text-xs font-semibold border border-zinc-200 dark:border-zinc-700">
                                                {member.role}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-3.5 py-3">
                                        {isAdmin && member.id !== myUserId ? (
                                            <div className="flex gap-1.5 items-center">
                                                <select 
                                                    value={currentTeamId} 
                                                    onChange={(e) => handleFieldChange(member.id, 'teamId', e.target.value, member)}
                                                    className="p-1 text-xs font-medium border rounded bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 outline-none text-zinc-700 dark:text-zinc-300 focus:border-indigo-500 max-w-[110px]"
                                                >
                                                    <option value="">미배정 (소속 없음)</option>
                                                    {teams?.map(t => (
                                                        <option key={t.id} value={t.id}>{t.name}</option>
                                                    ))}
                                                </select>
                                                <button 
                                                    onClick={() => handleSaveSingle(member.id, member)}
                                                    disabled={!isChanged || isSaving}
                                                    className={`text-xs font-semibold px-1.5 py-1 rounded border transition-colors ${
                                                        isChanged && !isSaving
                                                            ? 'text-amber-700 bg-amber-50 border-amber-200 hover:bg-amber-100 dark:text-amber-400 dark:bg-amber-950/20 dark:border-amber-900/50'
                                                            : 'text-zinc-400 dark:text-zinc-600 bg-zinc-50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 cursor-not-allowed'
                                                    }`}
                                                >
                                                    수정
                                                </button>
                                            </div>
                                        ) : (
                                            <span className="text-zinc-600 dark:text-zinc-400">
                                                {member.teams?.name || <span className="text-rose-500 font-medium text-xs">미할당</span>}
                                            </span>
                                        )}
                                    </td>
                                    {isAdmin && (
                                        <td className="px-3.5 py-3 text-right">
                                            {member.id !== myUserId ? (
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleResetPassword(member.id, member.email)}
                                                        className="text-xs font-semibold px-2 py-1 rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 bg-white hover:bg-zinc-50 dark:bg-zinc-950 dark:hover:bg-zinc-900 transition-colors flex items-center gap-1 shrink-0"
                                                    >
                                                        <span>🔑 재설정</span>
                                                    </button>
                                                    <form action={deleteMemberAction} className="shrink-0">
                                                        <input type="hidden" name="userId" value={member.id} />
                                                        <DeleteButton />
                                                    </form>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-zinc-400 font-medium px-2">(본인)</span>
                                            )}
                                        </td>
                                    )}
                                </tr>
                            );
                        })}
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
