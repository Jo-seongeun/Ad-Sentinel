'use client';

import { useState } from 'react';
import { Search, Cable, MonitorSmartphone } from 'lucide-react';

export interface ConnectedAccount {
    id: string;
    name: string;
    platform: 'META' | 'GOOGLE';
}

interface Props {
    accounts: ConnectedAccount[];
    teamName: string;
}

type PlatformFilter = 'ALL' | 'META' | 'GOOGLE';

export default function TeamMediaClientUI({ accounts, teamName }: Props) {
    const [platformFilter, setPlatformFilter] = useState<PlatformFilter>('ALL');
    const [searchQuery, setSearchQuery] = useState('');

    const metaCount = accounts.filter(a => a.platform === 'META').length;
    const googleCount = accounts.filter(a => a.platform === 'GOOGLE').length;

    const filtered = accounts.filter(acc => {
        if (platformFilter !== 'ALL' && acc.platform !== platformFilter) return false;
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            if (!acc.name.toLowerCase().includes(q) && !acc.id.toLowerCase().includes(q)) return false;
        }
        return true;
    });

    return (
        <div className="flex-1 flex flex-col bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm min-h-0">

            {/* 헤더: 필터 탭 + 카운트 */}
            <div className="flex-shrink-0 border-b border-zinc-200 dark:border-zinc-800">
                {/* 플랫폼 탭 */}
                <div className="flex items-center gap-1 px-4 pt-4 pb-0">
                    {([
                        { key: 'ALL', label: '전체', count: accounts.length },
                        { key: 'META', label: 'Meta Ads', count: metaCount },
                        { key: 'GOOGLE', label: 'Google Ads', count: googleCount },
                    ] as { key: PlatformFilter; label: string; count: number }[]).map(tab => {
                        const isActive = platformFilter === tab.key;
                        const activeClass =
                            tab.key === 'META' ? 'border-blue-500 text-blue-600 dark:text-blue-400' :
                            tab.key === 'GOOGLE' ? 'border-green-500 text-green-600 dark:text-green-400' :
                            'border-indigo-500 text-indigo-600 dark:text-indigo-400';

                        return (
                            <button
                                key={tab.key}
                                onClick={() => setPlatformFilter(tab.key)}
                                className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
                                    isActive
                                        ? `${activeClass} bg-transparent`
                                        : 'border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
                                }`}
                            >
                                {tab.label}
                                <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${
                                    isActive
                                        ? tab.key === 'META' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                                        : tab.key === 'GOOGLE' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                                        : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
                                        : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300'
                                }`}>
                                    {tab.count}
                                </span>
                            </button>
                        );
                    })}
                </div>

                {/* 검색 */}
                <div className="px-4 py-3">
                    <div className="relative max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                        <input
                            type="text"
                            placeholder="계정명 또는 ID 검색..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 text-sm bg-zinc-100 dark:bg-zinc-800 border border-transparent focus:border-indigo-400 focus:bg-white dark:focus:bg-zinc-900 rounded-lg outline-none transition-colors"
                        />
                    </div>
                </div>
            </div>

            {/* 계정 목록 */}
            <div className="flex-1 overflow-y-auto p-4">
                {filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full py-16 text-center">
                        <MonitorSmartphone className="w-12 h-12 text-zinc-300 dark:text-zinc-700 mb-4" />
                        {accounts.length === 0 ? (
                            <>
                                <p className="font-medium text-zinc-900 dark:text-zinc-100 mb-1">연결된 광고 계정이 없습니다</p>
                                <p className="text-sm text-zinc-500">관리자에게 광고 계정 연결을 요청해주세요.</p>
                            </>
                        ) : (
                            <>
                                <p className="font-medium text-zinc-900 dark:text-zinc-100 mb-1">검색 결과가 없습니다</p>
                                <p className="text-sm text-zinc-500">다른 검색어를 입력하거나 필터를 변경해보세요.</p>
                            </>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {filtered.map(acc => (
                            <div
                                key={`${acc.platform}-${acc.id}`}
                                className="flex items-start gap-3 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:border-indigo-200 dark:hover:border-indigo-800/50 hover:shadow-sm transition-all bg-white dark:bg-zinc-900"
                            >
                                {/* 플랫폼 아이콘 */}
                                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                    acc.platform === 'META'
                                        ? 'bg-blue-100 dark:bg-blue-900/30'
                                        : 'bg-green-100 dark:bg-green-900/30'
                                }`}>
                                    {acc.platform === 'META' ? (
                                        <svg viewBox="0 0 24 24" className="w-5 h-5 fill-[#0668E1]">
                                            <path d="M23.998 12c0-6.628-5.372-12-11.999-12C5.372 0 0 5.372 0 12c0 5.988 4.388 10.954 10.124 11.852v-8.384H7.078v-3.468h3.046V9.356c0-3.008 1.792-4.669 4.533-4.669 1.313 0 2.686.234 2.686.234v2.953H15.83c-1.49 0-1.955.925-1.955 1.874V12h3.328l-.532 3.468h-2.796v8.384c5.736-.898 10.124-5.864 10.124-11.852z" />
                                        </svg>
                                    ) : (
                                        <Cable className="w-5 h-5 text-green-600 dark:text-green-400" />
                                    )}
                                </div>

                                {/* 계정 정보 */}
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate" title={acc.name}>
                                        {acc.name}
                                    </p>
                                    <p className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 mt-0.5 truncate">
                                        ID: {acc.id}
                                    </p>
                                    <span className={`inline-block mt-1.5 text-[10px] font-bold px-2 py-0.5 rounded ${
                                        acc.platform === 'META'
                                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                                            : 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                                    }`}>
                                        {acc.platform === 'META' ? 'Meta Ads' : 'Google Ads'}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* 하단 요약 */}
            {filtered.length > 0 && (
                <div className="flex-shrink-0 px-4 py-3 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30">
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                        <Cable className="w-3.5 h-3.5" />
                        <span className="font-semibold text-zinc-700 dark:text-zinc-300">{teamName}</span> 팀 연결 계정 총
                        <span className="font-semibold text-indigo-600 dark:text-indigo-400">{accounts.length}개</span>
                        {platformFilter !== 'ALL' && (
                            <span>중 <span className="font-semibold text-zinc-700 dark:text-zinc-300">{filtered.length}개</span> 표시 중</span>
                        )}
                    </p>
                </div>
            )}
        </div>
    );
}
