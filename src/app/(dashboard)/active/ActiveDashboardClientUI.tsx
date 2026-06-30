'use client';

import { useState } from 'react';
import {
    Activity, ArrowUpRight, ArrowDownRight, DollarSign, MousePointerClick,
    TrendingUp, Users, AlertTriangle, CheckCircle2, BarChart3, Clock, AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';

export default function ActiveDashboardClientUI({
    teamId,
    teamSyncStatus,
    liveCampaigns,
    liveGoogleCampaigns,
    recentAudits
}: {
    teamId?: string;
    teamSyncStatus?: any;
    liveCampaigns: any[];
    liveGoogleCampaigns: any[];
    recentAudits: any[];
}) {
    const [activeTab, setActiveTab] = useState<'meta' | 'google'>('meta');
    const [selectedStatus, setSelectedStatus] = useState<'all' | 'over' | 'under' | 'normal'>('all');
    const [isSyncing, setIsSyncing] = useState(false);

    const nowMs = Date.now();

    const calcBurn = (budget: number, spend: number, startT: string, stopT: string) => {
        const burnRate = budget > 0 ? Math.round((spend / budget) * 10000) / 100 : null;
        let timeProgress: number | null = null;
        if (startT && stopT) {
            const s = new Date(startT).getTime(), e = new Date(stopT).getTime();
            if (e > s) timeProgress = Math.min(100, Math.max(0, Math.round(((nowMs - s) / (e - s)) * 100)));
        }
        let burnStatus: 'normal' | 'under' | 'over' | 'unknown' = 'unknown';
        if (burnRate !== null && timeProgress !== null) {
            const d = burnRate - timeProgress;
            burnStatus = d > 15 ? 'over' : d < -15 ? 'under' : 'normal';
        }
        return { burnRate, timeProgress, burnStatus };
    };

    const processedMeta = liveCampaigns.map(c => {
        const { burnRate, timeProgress, burnStatus } = calcBurn(c.budget, c.spend, c.start_date, c.end_date);
        return { ...c, burnRate, timeProgress, burnStatus };
    });

    const processedGoogle = liveGoogleCampaigns.map(c => {
        const { burnRate, timeProgress, burnStatus } = calcBurn(c.budget, c.spend, c.start_date, c.end_date);
        return { ...c, burnRate, timeProgress, burnStatus };
    });

    const targetCampaigns = activeTab === 'google' ? processedGoogle : processedMeta;

    const filteredTargetCampaigns = targetCampaigns.filter(c => {
        if (selectedStatus === 'all') return true;
        return c.burnStatus === selectedStatus;
    });

    const totalCount = targetCampaigns.length;
    const overCount = targetCampaigns.filter(c => c.burnStatus === 'over').length;
    const underCount = targetCampaigns.filter(c => c.burnStatus === 'under').length;
    const normalCount = targetCampaigns.filter(c => c.burnStatus === 'normal').length;

    const handleSync = async () => {
        if (!teamId) return;
        setIsSyncing(true);
        try {
            const res = await fetch('/api/sync/team', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ teamId })
            });
            if (res.ok) {
                window.location.reload();
            } else {
                const text = await res.text();
                alert(`동기화 실패 (HTTP ${res.status}): ${text}`);
                setIsSyncing(false);
            }
        } catch (e: any) {
            alert(`동기화 예외 발생: ${e.message}`);
            setIsSyncing(false);
        }
    };

    const handleTabChange = (tab: 'meta' | 'google') => {
        setActiveTab(tab);
        setSelectedStatus('all');
    };

    return (
        <div className="space-y-6 max-w-7xl animate-in fade-in duration-500 pb-12">
            <div className="relative overflow-hidden bg-gradient-to-r from-indigo-600 to-violet-600 rounded-2xl shadow-lg p-8 text-white">
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight mb-2">실시간 대시보드</h1>
                        <p className="text-indigo-100 text-lg opacity-90 max-w-2xl">
                            팀에 매핑된 Meta 및 Google 광고 계정의 라이브 캠페인과 최근 검수 내역을 한눈에 파악하세요.
                        </p>
                    </div>
                    {teamId && (
                        <div className="flex flex-col items-end gap-2 shrink-0">
                            <button
                                onClick={handleSync}
                                disabled={isSyncing}
                                className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg backdrop-blur-sm transition-all disabled:opacity-50"
                            >
                                <svg className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                <span className="font-semibold text-sm">{isSyncing ? '동기화 중...' : '실시간 동기화'}</span>
                            </button>
                            {teamSyncStatus && (
                                <div className="text-xs text-indigo-200">
                                    마지막 동기화: {format(new Date(teamSyncStatus.last_synced_at), 'MM월 dd일 HH:mm')}
                                </div>
                            )}
                        </div>
                    )}
                </div>
                <div className="absolute right-0 top-0 opacity-10 transform translate-x-1/3 -translate-y-1/4">
                    <BarChart3 className="w-64 h-64" />
                </div>
            </div>

            {teamSyncStatus?.sync_status === 'ERROR' && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 shrink-0" />
                    <p className="text-sm font-medium">⚠️ 현재 토큰 연동 오류로 최근 데이터 동기화가 중단되었습니다.</p>
                </div>
            )}

            <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-px">
                <button
                    onClick={() => handleTabChange('meta')}
                    className={`px-6 py-3 font-semibold text-sm border-b-2 transition-colors ${activeTab === 'meta' ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400' : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
                >
                    Meta (Facebook/Instagram)
                </button>
                <button
                    onClick={() => handleTabChange('google')}
                    className={`px-6 py-3 font-semibold text-sm border-b-2 transition-colors ${activeTab === 'google' ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400' : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
                >
                    Google Ads
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-2">
                <div 
                    onClick={() => setSelectedStatus('all')}
                    className={`cursor-pointer rounded-xl p-5 border shadow-sm flex flex-col justify-center transition-all hover:-translate-y-1 hover:shadow-md ${
                        selectedStatus === 'all'
                            ? 'bg-indigo-50/40 dark:bg-indigo-950/20 border-indigo-500/70 dark:border-indigo-800 ring-2 ring-indigo-500/20'
                            : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800'
                    }`}
                >
                    <span className="text-zinc-500 text-xs font-medium mb-2">📊 전체 라이브 캠페인</span>
                    <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 flex items-baseline gap-1">
                        {totalCount} <span className="text-xs font-normal text-zinc-500">건</span>
                    </div>
                </div>
                <div 
                    onClick={() => setSelectedStatus('over')}
                    className={`cursor-pointer rounded-xl p-5 border shadow-sm flex flex-col justify-center relative overflow-hidden transition-all hover:-translate-y-1 hover:shadow-md ${
                        selectedStatus === 'over'
                            ? 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-500/70 dark:border-rose-800 ring-2 ring-rose-500/20'
                            : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800'
                    }`}
                >
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-rose-500"></div>
                    <span className="text-zinc-500 text-xs font-medium mb-2 pl-1">🚨 예산 과소진</span>
                    <div className="text-2xl font-bold text-rose-600 dark:text-rose-400 flex items-baseline gap-1 pl-1">
                        {overCount} <span className="text-xs font-normal text-zinc-500">건</span>
                    </div>
                </div>
                <div 
                    onClick={() => setSelectedStatus('under')}
                    className={`cursor-pointer rounded-xl p-5 border shadow-sm flex flex-col justify-center relative overflow-hidden transition-all hover:-translate-y-1 hover:shadow-md ${
                        selectedStatus === 'under'
                            ? 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-500/70 dark:border-amber-800 ring-2 ring-amber-500/20'
                            : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800'
                    }`}
                >
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500"></div>
                    <span className="text-zinc-500 text-xs font-medium mb-2 pl-1">⚠️ 예산 미소진</span>
                    <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 flex items-baseline gap-1 pl-1">
                        {underCount} <span className="text-xs font-normal text-zinc-500">건</span>
                    </div>
                </div>
                <div 
                    onClick={() => setSelectedStatus('normal')}
                    className={`cursor-pointer rounded-xl p-5 border shadow-sm flex flex-col justify-center relative overflow-hidden transition-all hover:-translate-y-1 hover:shadow-md ${
                        selectedStatus === 'normal'
                            ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-500/70 dark:border-emerald-800 ring-2 ring-emerald-500/20'
                            : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800'
                    }`}
                >
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500"></div>
                    <span className="text-zinc-500 text-xs font-medium mb-2 pl-1">✅ 정상 소진</span>
                    <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 flex items-baseline gap-1 pl-1">
                        {normalCount} <span className="text-xs font-normal text-zinc-500">건</span>
                    </div>
                </div>
            </div>

            {activeTab === 'google' ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden flex flex-col h-96">
                        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 shrink-0">
                            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                                팀 매핑 라이브 캠페인
                                <span className="bg-blue-100 text-blue-700 text-[10px] px-2 py-0.5 rounded-full uppercase font-bold tracking-wider">Google</span>
                                {selectedStatus === 'all' && <span className="text-xs font-semibold px-2 py-0.5 bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 rounded">전체</span>}
                                {selectedStatus === 'over' && <span className="text-xs font-semibold px-2 py-0.5 bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400 rounded">예산 과소진</span>}
                                {selectedStatus === 'under' && <span className="text-xs font-semibold px-2 py-0.5 bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 rounded">예산 미소진</span>}
                                {selectedStatus === 'normal' && <span className="text-xs font-semibold px-2 py-0.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 rounded">정상 소진</span>}
                                <span className="ml-auto text-xs font-normal text-blue-600 dark:text-blue-400">ENABLED {filteredTargetCampaigns.length}행 / {processedGoogle.length}행</span>
                            </h2>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-zinc-500 dark:text-zinc-400 uppercase bg-zinc-50 dark:bg-zinc-900/60 font-semibold border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-10">
                                    <tr>
                                        <th className="px-4 py-4">계정 ID</th>
                                        <th className="px-4 py-4">캠페인명</th>
                                        <th className="px-4 py-4 text-center">동작 상태</th>
                                        <th className="px-4 py-4 text-center">예산 소진율(%)</th>
                                        <th className="px-4 py-4 text-center">예산 소진 상태</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                                    {filteredTargetCampaigns.length === 0 && (
                                        <tr><td colSpan={5} className="px-6 py-8 text-center text-zinc-500">조건에 부합하는 ENABLED 캠페인이 없습니다.</td></tr>
                                    )}
                                    {filteredTargetCampaigns.map((camp, idx) => {
                                        const burnBadge = (() => {
                                            if (camp.burnStatus === 'normal') return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">● 정상</span>;
                                            if (camp.burnStatus === 'under') return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">▼ 미소진</span>;
                                            if (camp.burnStatus === 'over') return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400">▲ 과소진</span>;
                                            return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">— 기간 미설정</span>;
                                        })();
                                        const burnRateDisplay = (() => {
                                            if (camp.burnRate === null) return <span className="text-zinc-400 text-xs">예산 미설정</span>;
                                            const pct = Math.min(camp.burnRate, 100);
                                            const barColor = camp.burnStatus === 'over' ? 'bg-rose-500' : camp.burnStatus === 'under' ? 'bg-amber-400' : camp.burnStatus === 'normal' ? 'bg-emerald-500' : 'bg-blue-400';
                                            return (
                                                <div className="flex flex-col items-center gap-1 w-full min-w-[80px]">
                                                    <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-200">{camp.burnRate.toFixed(1)}%</span>
                                                    <div className="w-full h-1.5 bg-zinc-100 dark:bg-zinc-700 rounded-full overflow-hidden">
                                                        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
                                                    </div>
                                                    {camp.timeProgress !== null && (
                                                        <span className="text-[9px] text-zinc-400">기간 진행률 {camp.timeProgress}%</span>
                                                    )}
                                                </div>
                                            );
                                        })();
                                        return (
                                            <tr key={`g-${camp.campaign_id || camp.id}-${idx}`} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                                                <td className="px-4 py-4 font-mono text-zinc-500 text-xs">{camp.account_id}</td>
                                                <td className="px-4 py-4">
                                                    <div className="font-medium text-zinc-900 dark:text-zinc-100 text-xs leading-snug line-clamp-2 max-w-[240px]">{camp.campaign_name}</div>
                                                    <div className="text-[10px] text-zinc-400 font-mono mt-0.5">{camp.campaign_id}</div>
                                                </td>
                                                <td className="px-4 py-4 text-center">
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400">
                                                        <CheckCircle2 className="w-3 h-3" /> ENABLED
                                                    </span>
                                                </td>
                                                <td className="px-4 py-4 text-center">{burnRateDisplay}</td>
                                                <td className="px-4 py-4 text-center">{burnBadge}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col h-96">
                        <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 shrink-0 gap-2">
                            <Clock className="w-5 h-5 text-indigo-500" /> 최근 실시간 검수 내역
                        </h2>
                        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                            {recentAudits.length === 0 && (
                                <div className="text-center text-zinc-500 text-sm mt-10">최근 진행된 검수가 없습니다.</div>
                            )}
                            {recentAudits.map(audit => (
                                <div key={audit.id} className="p-3 rounded-lg border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40 hover:border-indigo-200 dark:hover:border-indigo-900 transition-colors">
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="text-[10px] text-zinc-400 font-mono">{format(new Date(audit.created_at), 'MM/dd HH:mm')}</span>
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${audit.error_count === 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                            {audit.error_count === 0 ? 'PASS' : `${audit.error_count} FAIL`}
                                        </span>
                                    </div>
                                    <p className="text-xs text-zinc-600 dark:text-zinc-400">총 {audit.total_campaigns}개 검증 완료</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden flex flex-col h-96">
                            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 shrink-0">
                                <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                                    팀 매핑 라이브 캠페인
                                    <span className="bg-indigo-100 text-indigo-700 text-[10px] px-2 py-0.5 rounded-full uppercase font-bold tracking-wider">Meta</span>
                                    {selectedStatus === 'all' && <span className="text-xs font-semibold px-2 py-0.5 bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 rounded">전체</span>}
                                    {selectedStatus === 'over' && <span className="text-xs font-semibold px-2 py-0.5 bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400 rounded">예산 과소진</span>}
                                    {selectedStatus === 'under' && <span className="text-xs font-semibold px-2 py-0.5 bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 rounded">예산 미소진</span>}
                                    {selectedStatus === 'normal' && <span className="text-xs font-semibold px-2 py-0.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 rounded">정상 소진</span>}
                                    <span className="ml-auto text-xs font-normal text-emerald-600 dark:text-emerald-400">ACTIVE {filteredTargetCampaigns.length}행 / {processedMeta.length}행</span>
                                </h2>
                            </div>
                            <div className="flex-1 overflow-y-auto custom-scrollbar">
                                <table className="w-full text-sm text-left">
                                    <thead className="text-xs text-zinc-500 dark:text-zinc-400 uppercase bg-zinc-50 dark:bg-zinc-900/60 font-semibold border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-10">
                                        <tr>
                                            <th className="px-4 py-4">계정 ID</th>
                                                <th className="px-4 py-4">
                                                    <div className="flex flex-col gap-0.5">
                                                        <span>캠페인명 (*광고세트명)</span>
                                                        <span className="text-[9px] text-zinc-400 dark:text-zinc-500 font-normal normal-case">*예산 기준이 광고 세트(ABO)인 경우 구분 표시</span>
                                                    </div>
                                                </th>
                                                <th className="px-4 py-4 text-center">동작 상태</th>
                                                <th className="px-4 py-4 text-center">예산 소진율(%)</th>
                                                <th className="px-4 py-4 text-center">예산 소진 상태</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                                            {filteredTargetCampaigns.length === 0 && (
                                                <tr><td colSpan={5} className="px-6 py-8 text-center text-zinc-500">조건에 부합하는 ACTIVE 캠페인이 없습니다.</td></tr>
                                            )}
                                            {filteredTargetCampaigns.map((camp, idx) => {
                                            // ── 예산 소진 상태 뱃지 ──
                                            const burnBadge = (() => {
                                                if (camp.burnStatus === 'normal') return (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                                                        ● 정상
                                                    </span>
                                                );
                                                if (camp.burnStatus === 'under') return (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
                                                        ▼ 미소진
                                                    </span>
                                                );
                                                if (camp.burnStatus === 'over') return (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400">
                                                        ▲ 과소진
                                                    </span>
                                                );
                                                // unknown: stop_time 없는 캠페인 (상시 운영 등)
                                                return (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                                                        — 기간 미설정
                                                    </span>
                                                );
                                            })();

                                            // ── 예산 소진율 표시 (바 + 숫자) ──
                                            const burnRateDisplay = (() => {
                                                if (camp.burnRate === null) return <span className="text-zinc-400 text-xs">예산 미설정</span>;
                                                const pct = Math.min(camp.burnRate, 100);
                                                const barColor =
                                                    camp.burnStatus === 'over' ? 'bg-rose-500' :
                                                        camp.burnStatus === 'under' ? 'bg-amber-400' :
                                                            camp.burnStatus === 'normal' ? 'bg-emerald-500' :
                                                                'bg-indigo-400';
                                                return (
                                                    <div className="flex flex-col items-center gap-1 w-full min-w-[80px]">
                                                        <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-200">{camp.burnRate.toFixed(1)}%</span>
                                                        <div className="w-full h-1.5 bg-zinc-100 dark:bg-zinc-700 rounded-full overflow-hidden">
                                                            <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
                                                        </div>
                                                        {camp.timeProgress !== null && (
                                                            <span className="text-[9px] text-zinc-400">기간 진행률 {camp.timeProgress}%</span>
                                                        )}
                                                    </div>
                                                );
                                            })();

                                            return (
                                                <tr key={`camp-${camp.campaign_id || camp.id}-${idx}`} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                                                    <td className="px-4 py-4 font-mono text-zinc-500 text-xs">{camp.account_id?.replace('act_', '')}</td>
                                                    <td className="px-4 py-4">
                                                        <div className="font-medium text-zinc-900 dark:text-zinc-100 text-xs leading-snug line-clamp-2 max-w-[240px]">{camp.campaign_name}</div>
                                                        <div className="text-[10px] text-zinc-400 font-mono mt-0.5">{camp.campaign_id}</div>
                                                    </td>
                                                    <td className="px-4 py-4 text-center">
                                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                                                            <CheckCircle2 className="w-3 h-3" /> ACTIVE
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-4 text-center">{burnRateDisplay}</td>
                                                    <td className="px-4 py-4 text-center">{burnBadge}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col h-96">
                            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 shrink-0 gap-2">
                                <Clock className="w-5 h-5 text-indigo-500" /> 최근 실시간 검수 내역
                            </h2>
                            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                                {recentAudits.length === 0 && (
                                    <div className="text-center text-zinc-500 text-sm mt-10">최근 진행된 검수가 없습니다.</div>
                                )}
                                {recentAudits.map(audit => (
                                    <div key={audit.id} className="p-3 rounded-lg border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40 hover:border-indigo-200 dark:hover:border-indigo-900 transition-colors">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="text-[10px] text-zinc-400 font-mono">{format(new Date(audit.created_at), 'MM/dd HH:mm')}</span>
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${audit.error_count === 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                                {audit.error_count === 0 ? 'PASS' : `${audit.error_count} FAIL`}
                                            </span>
                                        </div>
                                        <p className="text-xs text-zinc-600 dark:text-zinc-400">총 {audit.total_campaigns}개 검증 완료</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
