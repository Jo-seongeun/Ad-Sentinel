'use client';

import { useState } from 'react';
import { ArrowRight, Check, Search, ShieldAlert, Cable } from 'lucide-react';

interface AdAccount {
    id: string;
    name: string;
    platform: 'META' | 'GOOGLE';
    assignedTeamId: string | null;
}

interface Team {
    id: string;
    name: string;
}

export default function AccountMappingPage() {
    // Mock Data
    const [teams] = useState<Team[]>([
        { id: 't1', name: '마케팅 A팀' },
        { id: 't2', name: '마케팅 B팀' },
        { id: 't3', name: '퍼포먼스랩' }
    ]);

    const [accounts, setAccounts] = useState<AdAccount[]>([
        { id: 'act_1001', name: 'Meta 브랜드 리타겟팅 옵티마이즈', platform: 'META', assignedTeamId: null },
        { id: 'act_1002', name: 'Meta 퍼포먼스 전환 (앱설치)', platform: 'META', assignedTeamId: 't1' },
        { id: 'act_1003', name: 'Google 검색어 확장 그룹 A', platform: 'GOOGLE', assignedTeamId: null },
        { id: 'act_1004', name: 'Google PMax 캠페인 테스트 계정', platform: 'GOOGLE', assignedTeamId: 't2' },
        { id: 'act_1005', name: 'Meta 세일즈 프로모션 03', platform: 'META', assignedTeamId: null }
    ]);

    const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(new Set());
    const [selectedTeam, setSelectedTeam] = useState<string | null>(null);

    const toggleAccountSelection = (id: string) => {
        const newSet = new Set(selectedAccounts);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedAccounts(newSet);
    };

    const selectAll = () => {
        const newSet = new Set(accounts.map(a => a.id));
        setSelectedAccounts(newSet);
    };

    const deselectAll = () => {
        setSelectedAccounts(new Set());
    };

    const handleAssign = () => {
        if (!selectedTeam || selectedAccounts.size === 0) return;

        setAccounts(prev =>
            prev.map(acc =>
                selectedAccounts.has(acc.id)
                    ? { ...acc, assignedTeamId: selectedTeam }
                    : acc
            )
        );
        setSelectedAccounts(new Set());

        // In real app, call supabase update here
        alert('계정 매핑이 성공적으로 업데이트 되었습니다!');
    };

    return (
        <div className="animate-in fade-in duration-500 h-[calc(100vh-6rem)] flex flex-col">
            <div className="mb-6">
                <h2 className="text-2xl font-bold tracking-tight mb-2">연결 계정 관리</h2>
                <p className="text-zinc-500 dark:text-zinc-400">BM 및 MCC에 연결된 광고 계정을 각 팀에 할당합니다.</p>
            </div>

            <div className="flex-1 flex gap-6 min-h-0">

                {/* Left Column: Accounts */}
                <div className="flex-1 flex flex-col bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
                    <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/20 flex items-center justify-between">
                        <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                            광고 계정 리스트
                            <span className="bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 py-0.5 px-2 rounded-full text-xs">
                                {accounts.length}
                            </span>
                        </h3>
                        <div className="flex gap-2 text-xs">
                            <button onClick={selectAll} className="text-indigo-600 hover:text-indigo-700 font-medium">전체선택</button>
                            <span className="text-zinc-300">|</span>
                            <button onClick={deselectAll} className="text-zinc-500 hover:text-zinc-700 font-medium">선택해제</button>
                        </div>
                    </div>
                    <div className="p-3 border-b border-zinc-200 dark:border-zinc-800">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                            <input
                                type="text"
                                placeholder="계정명 검색..."
                                className="w-full pl-9 pr-3 py-2 text-sm bg-zinc-100 dark:bg-zinc-800 border-transparent focus:bg-white dark:focus:bg-zinc-900 border focus:border-indigo-500 rounded-lg outline-none transition-colors"
                            />
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2">
                        <div className="space-y-1">
                            {accounts.map(acc => {
                                const isSelected = selectedAccounts.has(acc.id);
                                const assignedTeamStr = acc.assignedTeamId ? teams.find(t => t.id === acc.assignedTeamId)?.name : '미할당';

                                return (
                                    <div
                                        key={acc.id}
                                        onClick={() => toggleAccountSelection(acc.id)}
                                        className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors border ${isSelected
                                            ? 'bg-indigo-50 border-indigo-200 dark:bg-indigo-500/10 dark:border-indigo-500/30'
                                            : 'border-transparent hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                                            }`}
                                    >
                                        <div className="mt-0.5">
                                            <div className={`w-4 h-4 rounded border flex items-center justify-center ${isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-zinc-300 dark:border-zinc-600'}`}>
                                                {isSelected && <Check className="w-3 h-3" />}
                                            </div>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate flex items-center gap-2">
                                                {acc.name}
                                                {acc.platform === 'META' ? (
                                                    <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded capitalize">Meta</span>
                                                ) : (
                                                    <span className="text-[10px] font-bold bg-green-100 text-green-700 px-1.5 py-0.5 rounded capitalize">Google</span>
                                                )}
                                            </p>
                                            <p className="text-xs text-zinc-500 mt-1 flex items-center gap-1">
                                                ID: {acc.id} • {assignedTeamStr === '미할당' ? (
                                                    <span className="text-rose-500 font-medium">미할당</span>
                                                ) : (
                                                    <span>할당됨: {assignedTeamStr}</span>
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Middle: Control Arrow */}
                <div className="flex flex-col items-center justify-center gap-4 px-2">
                    <div className="text-center text-sm font-medium text-zinc-500">
                        <span className="bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 w-6 h-6 rounded-full inline-flex items-center justify-center mb-2">
                            {selectedAccounts.size}
                        </span>
                        <br />
                        선택됨
                    </div>
                    <button
                        onClick={handleAssign}
                        disabled={selectedAccounts.size === 0 || !selectedTeam}
                        className="w-12 h-12 rounded-full flex items-center justify-center text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-zinc-200 disabled:text-zinc-400 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-600 transition-colors shadow-sm"
                    >
                        <ArrowRight className="w-6 h-6" />
                    </button>
                </div>

                {/* Right Column: Teams */}
                <div className="flex-1 flex flex-col bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
                    <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/20">
                        <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                            팀 리스트
                            <span className="bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 py-0.5 px-2 rounded-full text-xs">
                                {teams.length}
                            </span>
                        </h3>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4">
                        <div className="space-y-3">
                            {teams.map(team => {
                                const isSelected = selectedTeam === team.id;
                                const teamAccountsCount = accounts.filter(a => a.assignedTeamId === team.id).length;

                                return (
                                    <div
                                        key={team.id}
                                        onClick={() => setSelectedTeam(team.id)}
                                        className={`p-4 rounded-xl border-2 transition-all cursor-pointer ${isSelected
                                            ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-500/10'
                                            : 'border-zinc-200 dark:border-zinc-700 hover:border-indigo-300 hover:shadow-sm'
                                            }`}
                                    >
                                        <div className="flex justify-between items-center mb-2">
                                            <h4 className={`font-semibold ${isSelected ? 'text-indigo-700 dark:text-indigo-400' : 'text-zinc-900 dark:text-zinc-100'}`}>
                                                {team.name}
                                            </h4>
                                            {isSelected && <Check className="w-5 h-5 text-indigo-600" />}
                                        </div>
                                        <div className="text-sm text-zinc-500 flex items-center gap-1.5">
                                            <Cable className="w-4 h-4" />
                                            연결된 계정: {teamAccountsCount}개
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {!selectedTeam && (
                            <div className="mt-8 p-4 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-lg flex gap-3 text-amber-800 dark:text-amber-400">
                                <ShieldAlert className="w-5 h-5 flex-shrink-0" />
                                <p className="text-sm font-medium">좌측에서 할당할 광고 계정을 선택한 뒤, 매핑할 팀을 선택하고 중앙의 화살표 버튼을 클릭하세요.</p>
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
}
