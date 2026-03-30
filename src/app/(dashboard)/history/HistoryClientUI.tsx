'use client';

import React, { useState } from 'react';
import { format } from 'date-fns';
import { AlertCircle, ChevronDown, ChevronRight, CheckCircle2 } from 'lucide-react';
import { AuditResult } from '../audit/AuditClientUI';

export default function HistoryClientUI({ logs, isAdmin }: { logs: any[], isAdmin: boolean }) {
    const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

    const toggleRow = (id: string) => {
        setExpandedLogId(expandedLogId === id ? null : id);
    };

    return (
        <div className="overflow-x-auto flex-1 h-full">
            <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-zinc-50 dark:bg-zinc-900/80 text-zinc-500 dark:text-zinc-400 sticky top-0 border-b border-zinc-200 dark:border-zinc-800 z-10">
                    <tr>
                        <th className="px-6 py-4 font-medium w-10"></th>
                        <th className="px-6 py-4 font-medium">검수 시각</th>
                        {isAdmin && <th className="px-6 py-4 font-medium">소속 팀</th>}
                        <th className="px-6 py-4 font-medium text-center">총 검수 모수</th>
                        <th className="px-6 py-4 font-medium text-center">발견된 오류 결함</th>
                        <th className="px-6 py-4 font-medium">상태</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {logs.length === 0 && (
                        <tr>
                            <td colSpan={isAdmin ? 6 : 5} className="px-6 py-12 text-center text-zinc-500">
                                아직 진행된 검수 이력이 없습니다. [실시간 검수 센터]에서 진단을 시작해 보세요.
                            </td>
                        </tr>
                    )}
                    {logs.map((log) => {
                        const isExpanded = expandedLogId === log.id;
                        const errorCount = log.error_count || 0;
                        const isPerfect = errorCount === 0;

                        // Default to empty array if parsing fails
                        let details: AuditResult[] = [];
                        if (log.details) {
                            try {
                                details = typeof log.details === 'string' ? JSON.parse(log.details) : log.details;
                            } catch (e) {
                                console.error('Details parse error', e);
                            }
                        }

                        return (
                            <React.Fragment key={log.id}>
                                <tr
                                    onClick={() => toggleRow(log.id)}
                                    className={`hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer ${isExpanded ? 'bg-zinc-50 dark:bg-zinc-800/80' : ''}`}
                                >
                                    <td className="px-6 py-4 text-zinc-400">
                                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                    </td>
                                    <td className="px-6 py-4 text-zinc-700 dark:text-zinc-300 font-mono text-xs">
                                        {format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss')}
                                    </td>
                                    {isAdmin && (
                                        <td className="px-6 py-4 font-medium text-zinc-900 dark:text-zinc-100">
                                            {log.teams?.name || '미상 팀'}
                                        </td>
                                    )}
                                    <td className="px-6 py-4 text-center font-semibold text-zinc-600 dark:text-zinc-400">
                                        {log.total_campaigns}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${isPerfect ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30' : 'bg-rose-50 text-rose-600 dark:bg-rose-900/30'}`}>
                                            {errorCount}건
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        {isPerfect ? (
                                            <span className="flex items-center gap-1 text-emerald-600 text-xs font-bold"><CheckCircle2 className="w-4 h-4" /> NORMAL</span>
                                        ) : (
                                            <span className="flex items-center gap-1 text-rose-600 text-xs font-bold"><AlertCircle className="w-4 h-4" /> ISSUE DETECTED</span>
                                        )}
                                    </td>
                                </tr>

                                {/* Expanded Details Row */}
                                {isExpanded && (
                                    <tr>
                                        <td colSpan={isAdmin ? 6 : 5} className="p-0 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30">
                                            <div className="p-6">
                                                <h4 className="font-semibold text-sm mb-4 text-zinc-900 dark:text-zinc-100">검수 상세 결과 리포트</h4>
                                                {details.length === 0 ? (
                                                    <div className="p-4 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm text-zinc-500 text-center">
                                                        발견된 치명적 오류나 경고 사항이 없습니다. 완벽하게 연동되었습니다! 🎉
                                                    </div>
                                                ) : (
                                                    <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
                                                        <table className="w-full text-left text-xs whitespace-nowrap">
                                                            <thead className="bg-zinc-100 dark:bg-zinc-800/80 text-zinc-500">
                                                                <tr>
                                                                    <th className="px-4 py-2 font-medium">캠페인 명</th>
                                                                    <th className="px-4 py-2 font-medium">세트/그룹 명</th>
                                                                    <th className="px-4 py-2 font-medium">판정</th>
                                                                    <th className="px-4 py-2 font-medium">오류 사유</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                                                                {details.map((d, i) => (
                                                                    <tr key={i} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
                                                                        <td className="px-4 py-3 font-semibold text-zinc-700 dark:text-zinc-300">{d.CampaignName}</td>
                                                                        <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{d.AdSetName}</td>
                                                                        <td className="px-4 py-3">
                                                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${d.status === 'FAIL' ? 'bg-rose-100 text-rose-700' : 'bg-orange-100 text-orange-700'}`}>
                                                                                {d.status}
                                                                            </span>
                                                                        </td>
                                                                        <td className="px-4 py-3 text-rose-500 font-medium">
                                                                            {d.errors?.join(', ')}
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </React.Fragment>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
