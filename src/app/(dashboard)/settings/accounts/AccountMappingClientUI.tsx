'use client';

import { useState, useTransition } from 'react';
import { ArrowRight, Check, Search, Unplug, Cable, FolderGit2 } from 'lucide-react';
import { assignAccountsAction, unassignAccountsAction } from './actions';

export interface AdAccount {
    id: string;
    name: string;
    platform: 'META' | 'GOOGLE';
    assignedTeamId: string | null;
}

export interface Team {
    id: string;
    name: string;
}

interface Props {
    initialAccounts: AdAccount[];
    teams: Team[];
}

export default function AccountMappingClientUI({ initialAccounts, teams }: Props) {
    const [accounts, setAccounts] = useState<AdAccount[]>(initialAccounts);
    const [isPending, startTransition] = useTransition();

    const [selectedLeftAccounts, setSelectedLeftAccounts] = useState<Set<string>>(new Set());
    const [selectedRightAccounts, setSelectedRightAccounts] = useState<Set<string>>(new Set());
    const [selectedTeam, setSelectedTeam] = useState<string | null>(null);

    const [leftPlatformFilter, setLeftPlatformFilter] = useState<'ALL' | 'META' | 'GOOGLE'>('ALL');
    const [leftSearchQuery, setLeftSearchQuery] = useState('');
    const [rightSearchQuery, setRightSearchQuery] = useState('');

    // Left Column (Accounts NOT assigned to the currently selected team)
    const leftFilteredAccounts = accounts.filter(acc => {
        if (selectedTeam && acc.assignedTeamId === selectedTeam) return false;
        if (leftPlatformFilter !== 'ALL' && acc.platform !== leftPlatformFilter) return false;
        if (leftSearchQuery && !acc.name.toLowerCase().includes(leftSearchQuery.toLowerCase()) && !acc.id.includes(leftSearchQuery)) return false;
        return true;
    });

    // Right Column (Accounts ASSIGNED to the currently selected team)
    const rightFilteredAccounts = accounts.filter(acc => {
        if (acc.assignedTeamId !== selectedTeam) return false;
        if (rightSearchQuery && !acc.name.toLowerCase().includes(rightSearchQuery.toLowerCase()) && !acc.id.includes(rightSearchQuery)) return false;
        return true;
    });

    const toggleLeftAccount = (id: string) => {
        const newSet = new Set(selectedLeftAccounts);
        if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
        setSelectedLeftAccounts(newSet);
    };

    const selectAllLeft = () => setSelectedLeftAccounts(new Set(leftFilteredAccounts.map(a => a.id)));
    const deselectAllLeft = () => setSelectedLeftAccounts(new Set());

    const toggleRightAccount = (id: string) => {
        const newSet = new Set(selectedRightAccounts);
        if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
        setSelectedRightAccounts(newSet);
    };

    const selectAllRight = () => setSelectedRightAccounts(new Set(rightFilteredAccounts.map(a => a.id)));
    const deselectAllRight = () => setSelectedRightAccounts(new Set());

    // SERVER ACTIONS
    const handleAssign = () => {
        if (!selectedTeam || selectedLeftAccounts.size === 0) return;

        const accountsToAssign = accounts
            .filter(a => selectedLeftAccounts.has(a.id))
            .map(a => ({ id: a.id, platform: a.platform }));

        // Optimistic UI update
        setAccounts(prev => prev.map(acc => selectedLeftAccounts.has(acc.id) ? { ...acc, assignedTeamId: selectedTeam } : acc));
        setSelectedLeftAccounts(new Set());

        startTransition(async () => {
            try {
                await assignAccountsAction(selectedTeam, accountsToAssign);
            } catch (e) {
                alert('할당 중 오류가 발생했습니다.');
                window.location.reload(); // Revert on failure
            }
        });
    };

    const handleUnassign = () => {
        if (selectedRightAccounts.size === 0) return;

        const idsToUnassign = Array.from(selectedRightAccounts);

        // Optimistic UI update
        setAccounts(prev => prev.map(acc => selectedRightAccounts.has(acc.id) ? { ...acc, assignedTeamId: null } : acc));
        setSelectedRightAccounts(new Set());

        startTransition(async () => {
            try {
                await unassignAccountsAction(idsToUnassign);
            } catch (e) {
                alert('연결 해제 중 오류가 발생했습니다.');
                window.location.reload(); // Revert on failure
            }
        });
    };

    return (
        <div className="flex-1 flex gap-4 min-h-0 relative">
            {isPending && (
                <div className="absolute inset-0 bg-white/50 dark:bg-zinc-900/50 z-10 flex items-center justify-center rounded-xl">
                    <div className="bg-white dark:bg-zinc-800 shadow-lg px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin"></div>
                        서버 동기화 중...
                    </div>
                </div>
            )}

            {/* LEFT COLUMN */}
            <div className="w-[30%] flex flex-col bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
                <div className="flex flex-col border-b border-zinc-200 dark:border-zinc-800">
                    <div className="flex items-center gap-2 p-2 bg-zinc-50/50 dark:bg-zinc-800/20">
                        <button onClick={() => { setLeftPlatformFilter('ALL'); deselectAllLeft(); }} className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors ${leftPlatformFilter === 'ALL' ? 'bg-white dark:bg-zinc-800 shadow-sm text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}>전체</button>
                        <button onClick={() => { setLeftPlatformFilter('META'); deselectAllLeft(); }} className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors ${leftPlatformFilter === 'META' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50' : 'text-zinc-500 hover:text-blue-600 dark:hover:text-blue-400'}`}>Meta API 연동완료</button>
                    </div>

                    <div className="p-3 flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                                배정 가능한 광고 계정
                                <span className="bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 py-0.5 px-2 rounded-full text-xs">{leftFilteredAccounts.length}</span>
                            </h3>
                            <div className="flex gap-2 text-xs">
                                <button onClick={selectAllLeft} className="text-indigo-600 hover:text-indigo-700 font-medium">전체선택</button>
                                <span className="text-zinc-300">|</span>
                                <button onClick={deselectAllLeft} className="text-zinc-500 hover:text-zinc-700 font-medium">선택해제</button>
                            </div>
                        </div>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                            <input type="text" placeholder="계정명 이름/ID 검색..." value={leftSearchQuery} onChange={e => setLeftSearchQuery(e.target.value)} className="w-full pl-9 pr-3 py-2 text-sm bg-zinc-100 dark:bg-zinc-800 border-transparent focus:bg-white dark:focus:bg-zinc-900 border focus:border-indigo-500 rounded-lg outline-none transition-colors" />
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {leftFilteredAccounts.map(acc => {
                        const isSelected = selectedLeftAccounts.has(acc.id);
                        const assignedTeamStr = acc.assignedTeamId ? teams.find(t => t.id === acc.assignedTeamId)?.name : '미할당';

                        return (
                            <div key={acc.id} onClick={() => toggleLeftAccount(acc.id)} className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors border ${isSelected ? 'bg-indigo-50 border-indigo-200 dark:bg-indigo-500/10 dark:border-indigo-500/30' : 'border-transparent hover:bg-zinc-50 dark:hover:bg-zinc-800/50'}`}>
                                <div className="mt-0.5">
                                    <div className={`w-4 h-4 rounded border flex items-center justify-center ${isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-zinc-300 dark:border-zinc-600'}`}>{isSelected && <Check className="w-3 h-3" />}</div>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate flex items-center gap-2">
                                        {acc.name}
                                        {acc.platform === 'META' ? <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded capitalize">Meta</span> : <span className="text-[10px] font-bold bg-green-100 text-green-700 px-1.5 py-0.5 rounded capitalize">Google</span>}
                                    </p>
                                    <p className="text-[11px] font-mono text-zinc-500 mt-1">ID: {acc.id}</p>
                                    <p className="text-xs mt-1">{assignedTeamStr === '미할당' ? <span className="text-zinc-400">(미할당)</span> : <span className="text-amber-600 dark:text-amber-500">할당됨: {assignedTeamStr}</span>}</p>
                                </div>
                            </div>
                        );
                    })}
                    {leftFilteredAccounts.length === 0 && <div className="text-center py-8 text-sm text-zinc-500">표시할 계정이 없습니다.</div>}
                </div>
            </div>

            {/* MIDDLE ARROW */}
            <div className="flex flex-col items-center justify-center gap-2 px-1">
                <button
                    onClick={handleAssign}
                    disabled={selectedLeftAccounts.size === 0 || !selectedTeam || isPending}
                    title="선택한 계정을 우측 팀으로 일괄 할당"
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-zinc-200 disabled:text-zinc-400 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-600 transition-colors shadow-sm"
                >
                    <ArrowRight className="w-5 h-5" />
                </button>
                <div className="text-[11px] font-medium text-zinc-500 text-center">{selectedLeftAccounts.size}개<br />매핑</div>
            </div>

            {/* MIDDLE COLUMN: Team List */}
            <div className="w-[30%] flex flex-col bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
                <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/20">
                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                        팀 리스트
                        <span className="bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 py-0.5 px-2 rounded-full text-xs">{teams.length}</span>
                    </h3>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {teams.map(team => {
                        const isSelected = selectedTeam === team.id;
                        const teamAccountsCount = accounts.filter(a => a.assignedTeamId === team.id).length;

                        return (
                            <div
                                key={team.id}
                                onClick={() => { setSelectedTeam(team.id); setSelectedRightAccounts(new Set()); }}
                                className={`p-4 rounded-xl border-2 transition-all cursor-pointer ${isSelected ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-500/10' : 'border-zinc-200 dark:border-zinc-700 hover:border-indigo-300 hover:shadow-sm'}`}
                            >
                                <div className="flex justify-between items-center mb-1">
                                    <h4 className={`font-semibold ${isSelected ? 'text-indigo-700 dark:text-indigo-400' : 'text-zinc-900 dark:text-zinc-100'}`}>{team.name}</h4>
                                    {isSelected && <ArrowRight className="w-5 h-5 text-indigo-600" />}
                                </div>
                                <div className="text-sm font-medium text-zinc-600 dark:text-zinc-400 flex items-center gap-1.5">
                                    <Cable className="w-4 h-4" /> 연결된 광고 계정: {teamAccountsCount}개
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* RIGHT COLUMN: Team's Accounts (Mapped) */}
            <div className="flex-1 flex flex-col bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
                {!selectedTeam ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-zinc-500">
                        <FolderGit2 className="w-12 h-12 text-zinc-300 dark:text-zinc-700 mb-4" />
                        <p className="font-medium text-zinc-900 dark:text-zinc-100 mb-2">DB에 등록된 실제 팀입니다.</p>
                        <p className="text-sm">가운데 팀 리스트에서 특정 팀을 선택하면<br />해당 팀에 성공적으로 매핑된 계정 목록 창이 활성화됩니다.</p>
                    </div>
                ) : (
                    <>
                        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-indigo-50/50 dark:bg-indigo-900/10 flex flex-col gap-3">
                            <div className="flex items-center justify-between">
                                <h3 className="font-semibold text-indigo-900 dark:text-indigo-100 flex items-center gap-2">
                                    <span className="text-indigo-600 dark:text-indigo-400">{teams.find(t => t.id === selectedTeam)?.name}</span> 연결된 계정
                                    <span className="bg-indigo-100 dark:bg-indigo-800 text-indigo-700 dark:text-indigo-300 py-0.5 px-2 rounded-full text-xs font-bold">{rightFilteredAccounts.length}</span>
                                </h3>
                                <div className="flex gap-2 text-xs">
                                    <button onClick={selectAllRight} className="text-indigo-600 hover:text-indigo-700 font-medium">전체선택</button>
                                    <span className="text-zinc-300">|</span>
                                    <button onClick={deselectAllRight} className="text-zinc-500 hover:text-zinc-700 font-medium">선택해제</button>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                                    <input type="text" placeholder="검색..." value={rightSearchQuery} onChange={e => setRightSearchQuery(e.target.value)} className="w-full pl-9 pr-3 py-2 text-sm bg-white dark:bg-zinc-800 border focus:border-indigo-500 border-zinc-200 dark:border-zinc-700 rounded-lg outline-none transition-colors" />
                                </div>
                                <button
                                    onClick={handleUnassign}
                                    disabled={selectedRightAccounts.size === 0 || isPending}
                                    className="px-3 py-2 bg-white dark:bg-zinc-800 border border-rose-200 dark:border-rose-800/50 text-rose-600 dark:text-rose-400 rounded-lg text-sm font-medium hover:bg-rose-50 dark:hover:bg-rose-900/20 disabled:opacity-50 transition-colors flex items-center gap-1.5 whitespace-nowrap"
                                >
                                    <Unplug className="w-4 h-4" /> 연결 해제 ({selectedRightAccounts.size})
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-2 space-y-1">
                            {rightFilteredAccounts.map(acc => {
                                const isSelected = selectedRightAccounts.has(acc.id);

                                return (
                                    <div key={acc.id} onClick={() => toggleRightAccount(acc.id)} className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors border ${isSelected ? 'bg-rose-50 border-rose-200 dark:bg-rose-500/10 dark:border-rose-500/30' : 'border-transparent hover:bg-zinc-50 dark:hover:bg-zinc-800/50'}`}>
                                        <div className="mt-0.5">
                                            <div className={`w-4 h-4 rounded border flex items-center justify-center ${isSelected ? 'bg-rose-600 border-rose-600 text-white' : 'border-zinc-300 dark:border-zinc-600'}`}>{isSelected && <Check className="w-3 h-3" />}</div>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate flex items-center gap-2">
                                                {acc.name}
                                                {acc.platform === 'META' ? <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded capitalize">Meta</span> : <span className="text-[10px] font-bold bg-green-100 text-green-700 px-1.5 py-0.5 rounded capitalize">Google</span>}
                                            </p>
                                            <p className="text-[11px] font-mono text-zinc-500 mt-1">ID: {acc.id}</p>
                                        </div>
                                    </div>
                                );
                            })}
                            {rightFilteredAccounts.length === 0 && <div className="text-center py-8 text-sm text-zinc-500">현재 이 팀에 할당된 계정이 없습니다.</div>}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
