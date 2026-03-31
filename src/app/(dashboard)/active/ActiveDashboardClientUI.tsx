'use client';

import { useState } from 'react';
import {
    Activity, ArrowUpRight, ArrowDownRight, DollarSign, MousePointerClick,
    TrendingUp, Users, AlertTriangle, CheckCircle2, BarChart3, Clock, AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';

export default function ActiveDashboardClientUI({
    kpis,
    liveCampaigns,
    recentAudits
}: {
    kpis: any[];
    liveCampaigns: any[];
    recentAudits: any[];
}) {
    const [activeTab, setActiveTab] = useState<'meta' | 'google'>('meta');

    return (
        <div className="space-y-6 max-w-7xl animate-in fade-in duration-500 pb-12">
            <div className="relative overflow-hidden bg-gradient-to-r from-indigo-600 to-violet-600 rounded-2xl shadow-lg p-8 text-white">
                <div className="relative z-10">
                    <h1 className="text-3xl font-bold tracking-tight mb-2">실시간 대시보드</h1>
                    <p className="text-indigo-100 text-lg opacity-90 max-w-2xl">
                        팀에 매핑된 Meta 광고 계정의 라이브 캠페인과 최근 검수 내역을 한눈에 파악하세요.
                    </p>
                </div>
                <div className="absolute right-0 top-0 opacity-10 transform translate-x-1/3 -translate-y-1/4">
                    <BarChart3 className="w-64 h-64" />
                </div>
            </div>

            <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-px">
                <button
                    onClick={() => setActiveTab('meta')}
                    className={`px-6 py-3 font-semibold text-sm border-b-2 transition-colors ${activeTab === 'meta' ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400' : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
                >
                    Meta (Facebook/Instagram)
                </button>
                <button
                    onClick={() => setActiveTab('google')}
                    className={`px-6 py-3 font-semibold text-sm border-b-2 transition-colors ${activeTab === 'google' ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400' : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
                >
                    Google Ads
                </button>
            </div>

            {activeTab === 'google' ? (
                <div className="flex flex-col items-center justify-center p-20 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-center">
                    <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 text-blue-500 rounded-2xl flex items-center justify-center mb-4">
                        <BarChart3 className="w-8 h-8" />
                    </div>
                    <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Google Ads 연동 준비 중</h2>
                    <p className="text-zinc-500 dark:text-zinc-400 mt-2 max-w-sm">
                        Google Ads API 승인 후 업데이트 예정입니다.
                    </p>
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {kpis.map((kpi, index) => {
                            const Icon = kpi.icon === 'DollarSign' ? DollarSign : kpi.icon === 'Users' ? Users : kpi.icon === 'MousePointerClick' ? MousePointerClick : TrendingUp;
                            return (
                                <div key={index} className="bg-white dark:bg-zinc-900 rounded-xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-sm relative overflow-hidden group">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-lg group-hover:scale-110 transition-transform">
                                            <Icon className="w-6 h-6" />
                                        </div>
                                    </div>
                                    <h3 className="text-zinc-500 dark:text-zinc-400 text-sm font-medium">{kpi.title}</h3>
                                    <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 mt-1">{kpi.value.toLocaleString()}</p>
                                    <div className="absolute -bottom-4 -right-4 opactity-5 text-indigo-100 dark:text-zinc-800 transform rotate-12 group-hover:rotate-0 transition-transform duration-500 z-0 opacity-10">
                                        <Icon className="w-24 h-24" />
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden flex flex-col h-96">
                            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 shrink-0">
                                <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                                    팀 매핑 라이브 캠페인
                                    <span className="bg-indigo-100 text-indigo-700 text-[10px] px-2 py-0.5 rounded-full uppercase font-bold tracking-wider">Live</span>
                                </h2>
                            </div>
                            <div className="flex-1 overflow-y-auto custom-scrollbar">
                                <table className="w-full text-sm text-left">
                                    <thead className="text-xs text-zinc-500 dark:text-zinc-400 uppercase bg-zinc-50 dark:bg-zinc-900/60 font-semibold border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-10">
                                        <tr>
                                            <th className="px-6 py-4">계정 ID</th>
                                            <th className="px-6 py-4">캠페인 명</th>
                                            <th className="px-6 py-4">목적 (Objective)</th>
                                            <th className="px-6 py-4 text-center">동작 상태</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                                        {liveCampaigns.length === 0 && (
                                            <tr><td colSpan={4} className="px-6 py-8 text-center text-zinc-500">연결된 라이브 캠페인이 없습니다.</td></tr>
                                        )}
                                        {liveCampaigns.map((camp) => (
                                            <tr key={camp.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                                                <td className="px-6 py-4 font-mono text-zinc-500 text-xs">{camp.account_id?.replace('act_', '')}</td>
                                                <td className="px-6 py-4">
                                                    <div className="font-medium text-zinc-900 dark:text-zinc-100">{camp.name}</div>
                                                    <div className="text-[10px] text-zinc-400 font-mono mt-0.5">{camp.id}</div>
                                                </td>
                                                <td className="px-6 py-4 text-zinc-600 dark:text-zinc-400 text-xs">{camp.objective}</td>
                                                <td className="px-6 py-4 text-center">
                                                    {camp.effective_status === 'ACTIVE' ? (
                                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"><CheckCircle2 className="w-3 h-3" /> ACTIVE</span>
                                                    ) : camp.effective_status === 'PAUSED' ? (
                                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">PAUSED</span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400">{camp.effective_status}</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
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
