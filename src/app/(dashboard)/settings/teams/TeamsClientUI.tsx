'use client';

import { useState, useTransition } from 'react';
import { createTeamAction, updateTeamAction, deleteTeamAction } from './actions';
import { Plus, Edit2, Trash2, Check, X, Users } from 'lucide-react';

export interface Team {
    id: string;
    name: string;
}

export default function TeamsClientUI({ initialTeams }: { initialTeams: Team[] }) {
    const [teams, setTeams] = useState<Team[]>(initialTeams);
    const [isPending, startTransition] = useTransition();

    const [isCreating, setIsCreating] = useState(false);
    const [newTeamName, setNewTeamName] = useState('');

    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');

    const handleCreate = () => {
        if (!newTeamName.trim()) return;
        const tempId = Date.now().toString();
        setTeams([...teams, { id: tempId, name: newTeamName }]);
        setIsCreating(false);

        startTransition(async () => {
            try {
                await createTeamAction(newTeamName);
                window.location.reload(); // Refresh to get real UUID
            } catch (e) {
                alert('팀 생성 중 오류가 발생했습니다.');
                window.location.reload();
            }
        });
        setNewTeamName('');
    };

    const handleUpdate = (id: string) => {
        if (!editName.trim()) return;
        setTeams(teams.map(t => t.id === id ? { ...t, name: editName } : t));
        setEditingId(null);

        startTransition(async () => {
            try {
                await updateTeamAction(id, editName);
            } catch (e) {
                alert('팀 수정 중 오류가 발생했습니다.');
                window.location.reload();
            }
        });
    };

    const handleDelete = (id: string, name: string) => {
        if (!confirm(`'${name}' 팀을 정말 삭제하시겠습니까? 연결된 계정 데이터에 영향을 줄 수 있습니다.`)) return;

        setTeams(teams.filter(t => t.id !== id));

        startTransition(async () => {
            try {
                await deleteTeamAction(id);
            } catch (e) {
                alert('팀 삭제 중 오류가 발생했습니다.');
                window.location.reload();
            }
        });
    };

    return (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm relative">
            {isPending && (
                <div className="absolute inset-0 z-10 bg-white/50 dark:bg-zinc-900/50 flex items-center justify-center">
                    <span className="text-sm font-medium animate-pulse text-indigo-600">동기화 중...</span>
                </div>
            )}

            <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-zinc-50/50 dark:bg-zinc-900/40">
                <div>
                    <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                        <Users className="w-5 h-5 text-indigo-500" />
                        팀 목록
                    </h3>
                    <p className="text-xs text-zinc-500 mt-1">대시보드와 유저 그룹화에 기준이 되는 팀 목록입니다.</p>
                </div>
                {!isCreating && (
                    <button
                        onClick={() => setIsCreating(true)}
                        className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                        <Plus className="w-4 h-4" /> 팀 추가하기
                    </button>
                )}
            </div>

            <div className="p-6">
                <div className="space-y-3">
                    {/* Create Row */}
                    {isCreating && (
                        <div className="flex items-center gap-3 p-4 bg-indigo-50/50 dark:bg-indigo-900/20 border-2 border-indigo-200 dark:border-indigo-800/50 rounded-xl">
                            <input
                                autoFocus
                                type="text"
                                placeholder="생성할 팀 이름을 입력하세요 (예: 퍼포먼스 2팀)"
                                value={newTeamName}
                                onChange={e => setNewTeamName(e.target.value)}
                                className="flex-1 px-3 py-2 bg-white dark:bg-zinc-950 border border-indigo-200 dark:border-indigo-800 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                            <div className="flex items-center gap-2">
                                <button onClick={handleCreate} className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"><Check className="w-4 h-4" /></button>
                                <button onClick={() => setIsCreating(false)} className="p-2 bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-lg hover:bg-zinc-300 dark:hover:bg-zinc-700"><X className="w-4 h-4" /></button>
                            </div>
                        </div>
                    )}

                    {teams.map(team => (
                        <div key={team.id} className="flex items-center justify-between p-4 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:border-indigo-200 dark:hover:border-indigo-800/50 transition-colors group">
                            {editingId === team.id ? (
                                <div className="flex-1 flex items-center gap-3">
                                    <input
                                        autoFocus
                                        type="text"
                                        value={editName}
                                        onChange={e => setEditName(e.target.value)}
                                        className="flex-1 px-3 py-1.5 bg-white dark:bg-zinc-950 border border-indigo-300 dark:border-indigo-600 rounded-lg text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                    <button onClick={() => handleUpdate(team.id)} className="p-1.5 bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400 rounded hover:bg-indigo-200"><Check className="w-4 h-4" /></button>
                                    <button onClick={() => setEditingId(null)} className="p-1.5 bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 rounded hover:bg-zinc-200"><X className="w-4 h-4" /></button>
                                </div>
                            ) : (
                                <>
                                    <div className="flex-1">
                                        <h4 className="font-semibold text-zinc-900 dark:text-zinc-100">{team.name}</h4>
                                        <p className="text-[11px] font-mono text-zinc-400 mt-1">ID: {team.id}</p>
                                    </div>
                                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => { setEditingId(team.id); setEditName(team.name); }}
                                            className="p-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-400 dark:hover:bg-indigo-500/20 rounded-lg transition-colors"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(team.id, team.name)}
                                            className="p-2 bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-500/10 dark:text-rose-400 dark:hover:bg-rose-500/20 rounded-lg transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    ))}

                    {teams.length === 0 && !isCreating && (
                        <div className="text-center py-10 text-zinc-500 text-sm bg-zinc-50 dark:bg-zinc-900/30 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800">
                            초대된 팀이 없습니다. 먼저 새로운 팀을 생성해주세요.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
