'use client';

import { useState, useRef } from 'react';
import * as xlsx from 'xlsx';
import { UploadCloud, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { crosscheckApiAction } from './actions';

export interface ParsedRow {
    Platform: string;
    Team: string;
    AccountID: string;
    CampaignName: string;
    Objective: string;
    BudgetType: string;
    AdSetName: string;
    PlannedBudget: number;
    StartDate: string;
    EndDate: string;
    Optimization: string;
    FinalURL: string;
    SourceMedium: string;
    UTMCampaign: string;
    PixelEvent: string;
}

export interface AuditResult {
    rowId: number;
    CampaignName: string;
    AdSetName: string;
    status: 'PASS' | 'FAIL' | 'WARNING';
    errors: string[];
}

export default function AuditClientUI({ teamId, teamName }: { teamId?: string, teamName?: string }) {
    const [rows, setRows] = useState<ParsedRow[]>([]);
    const [isParsing, setIsParsing] = useState(false);
    const [isAuditing, setIsAuditing] = useState(false);
    const [results, setResults] = useState<AuditResult[] | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsParsing(true);
        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = xlsx.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];

                // Assuming Excel has headers in the first row matching the Korean names:
                // 매체 | 팀명 | 광고 계정 ID | 캠페인명 | 캠페인 목적 | 예산 유형 | 광고 세트/그룹명 | 집행 예산 | 시작일 | 종료일 | 최적화 목표 | 랜딩 페이지 URL | UTM 소스/매체 | UTM 캠페인 | 전환 픽셀 ID/이벤트
                const data: any[] = xlsx.utils.sheet_to_json(ws);

                const mappedData: ParsedRow[] = data.map(item => ({
                    Platform: item['매체'] || '',
                    Team: item['팀명'] || '',
                    AccountID: item['광고 계정 ID']?.toString() || '',
                    CampaignName: item['캠페인명'] || '',
                    Objective: item['캠페인 목적'] || '',
                    BudgetType: item['예산 유형'] || '',
                    AdSetName: item['광고 세트/그룹명'] || '',
                    PlannedBudget: Number(item['집행 예산']) || 0,
                    StartDate: item['시작일'] || '',
                    EndDate: item['종료일'] || '',
                    Optimization: item['최적화 목표'] || '',
                    FinalURL: item['랜딩 페이지 URL'] || '',
                    SourceMedium: item['UTM 소스/매체'] || '',
                    UTMCampaign: item['UTM 캠페인'] || '',
                    PixelEvent: item['전환 픽셀 ID/이벤트'] || ''
                }));

                setRows(mappedData);
                setResults(null);
            } catch (error) {
                console.error('Excel Parsing Error:', error);
                alert('엑셀 파일을 읽는 중 오류가 발생했습니다. 양식이 맞는지 확인해주세요.');
            } finally {
                setIsParsing(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const handleAudit = async () => {
        if (rows.length === 0) return;
        setIsAuditing(true);
        try {
            // Call server action to crosscheck Live API
            const auditRes = await crosscheckApiAction(rows);
            setResults(auditRes);
        } catch (error) {
            console.error('Audit Error:', error);
            alert('실시간 검수 중 서버 오류가 발생했습니다.');
        } finally {
            setIsAuditing(false);
        }
    };

    return (
        <div className="flex-1 overflow-hidden flex flex-col gap-4">
            {rows.length === 0 ? (
                <div
                    className="flex-1 border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl bg-zinc-50 dark:bg-zinc-900/50 flex items-center justify-center flex-col gap-4 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-900"
                    onClick={() => fileInputRef.current?.click()}
                    style={{ cursor: 'pointer' }}
                >
                    <div className="p-4 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 rounded-full">
                        <UploadCloud className="w-10 h-10" />
                    </div>
                    <div className="text-center">
                        <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">미디어믹스 엑셀 파일 업로드</h3>
                        <p className="text-sm text-zinc-500 mt-2 max-w-sm mx-auto">
                            드래그 앤 드롭 하거나 영역을 클릭하여 엑셀(.xlsx) 파일을 업로드해주세요. 양식은 15개의 표준 컬럼을 준수해야 합니다.
                        </p>
                    </div>
                    <input
                        type="file"
                        accept=".xlsx, .xls"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        className="hidden"
                    />
                </div>
            ) : (
                <div className="flex flex-col h-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
                    {/* Toolbar */}
                    <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-zinc-50/50 dark:bg-zinc-900/40 shrink-0">
                        <div>
                            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
                                엑셀 데이터 분석 완료
                            </h3>
                            <p className="text-xs text-zinc-500 mt-0.5">총 {rows.length}개의 광고 세트/그룹 행이 파싱되었습니다.</p>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => { setRows([]); setResults(null); }}
                                className="px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition-colors"
                            >
                                다시 올리기
                            </button>
                            <button
                                onClick={handleAudit}
                                disabled={isAuditing}
                                className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                            >
                                {isAuditing ? <><Loader2 className="w-4 h-4 animate-spin" /> Live 매체 크로스 체크 중...</> : <><ShieldCheck className="w-4 h-4" /> 매체 연동 검수 시작</>}
                            </button>
                        </div>
                    </div>

                    {/* Table View */}
                    <div className="overflow-x-auto flex-1 p-0 m-0 relative">
                        {isAuditing && (
                            <div className="absolute inset-0 z-20 bg-white/60 dark:bg-black/60 backdrop-blur-[2px] flex items-center justify-center">
                                <div className="text-center bg-white dark:bg-zinc-800 p-6 rounded-xl shadow-xl border border-zinc-200 dark:border-zinc-700 flex flex-col items-center">
                                    <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mb-3" />
                                    <h3 className="font-bold text-zinc-900 dark:text-zinc-100">API 연동 검수 중...</h3>
                                    <p className="text-sm text-zinc-500 mt-1">Meta 및 Google Ads 서버와 통신하여 실시간 데이터를 대조하고 있습니다.</p>
                                </div>
                            </div>
                        )}
                        <table className="w-full text-left text-xs whitespace-nowrap">
                            <thead className="bg-zinc-100 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-400 sticky top-0 border-b border-zinc-200 dark:border-zinc-800 z-10 shadow-sm">
                                <tr>
                                    <th className="px-4 py-3 font-medium text-center">No</th>
                                    <th className="px-4 py-3 font-medium">검수 결과</th>
                                    <th className="px-4 py-3 font-medium">매체</th>
                                    <th className="px-4 py-3 font-medium">캠페인 명</th>
                                    <th className="px-4 py-3 font-medium">세트/그룹 명</th>
                                    <th className="px-4 py-3 font-medium">계정 ID</th>
                                    <th className="px-4 py-3 font-medium text-right">집행 예산</th>
                                    <th className="px-4 py-3 font-medium">랜딩 URL</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                                {rows.map((row, i) => {
                                    const res = results?.find(r => r.rowId === i);
                                    return (
                                        <tr key={i} className={`hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors ${res?.status === 'FAIL' ? 'bg-rose-50/50 dark:bg-rose-900/10' : res?.status === 'WARNING' ? 'bg-orange-50/30' : ''}`}>
                                            <td className="px-4 py-3 text-center text-zinc-500 font-mono">{i + 1}</td>
                                            <td className="px-4 py-3">
                                                {!results ? (
                                                    <span className="text-zinc-400">- 대기 -</span>
                                                ) : res?.status === 'PASS' ? (
                                                    <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold bg-emerald-100 dark:bg-emerald-900/30 px-2 py-0.5 rounded-full"><CheckCircle2 className="w-3 h-3" /> PASS</span>
                                                ) : res?.status === 'FAIL' ? (
                                                    <span className="inline-flex items-center gap-1 text-rose-600 font-semibold bg-rose-100 dark:bg-rose-900/30 px-2 py-0.5 rounded-full"><AlertCircle className="w-3 h-3" /> FAIL</span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 text-orange-600 font-semibold bg-orange-100 dark:bg-orange-900/30 px-2 py-0.5 rounded-full"><AlertCircle className="w-3 h-3" /> WARN</span>
                                                )}
                                                {res?.errors && res.errors.length > 0 && (
                                                    <div className="mt-1 text-[10px] text-rose-500 max-w-[200px] truncate" title={res.errors.join(', ')}>
                                                        {res.errors[0]} {res.errors.length > 1 && `외 ${res.errors.length - 1}개 오류`}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${row.Platform?.toLowerCase().includes('meta') ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>
                                                    {row.Platform || '미상'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 font-semibold text-zinc-900 dark:text-zinc-200 max-w-[200px] truncate" title={row.CampaignName}>{row.CampaignName}</td>
                                            <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300 max-w-[200px] truncate" title={row.AdSetName}>{row.AdSetName}</td>
                                            <td className="px-4 py-3 text-zinc-500 font-mono">{row.AccountID}</td>
                                            <td className="px-4 py-3 text-right font-medium text-emerald-600 dark:text-emerald-400">
                                                {row.PlannedBudget.toLocaleString()}
                                            </td>
                                            <td className="px-4 py-3 text-zinc-500 max-w-[200px] truncate" title={row.FinalURL}>
                                                <a href={row.FinalURL} target="_blank" rel="noreferrer" className="hover:text-indigo-500 underline">{row.FinalURL}</a>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
