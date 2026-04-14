'use client';

import { useState, useRef } from 'react';
import * as xlsx from 'xlsx';
import { UploadCloud, CheckCircle2, AlertCircle, Loader2, Download, ShieldCheck } from 'lucide-react';
import { crosscheckApiAction } from './actions';

export interface ParsedRow {
    Platform: string;
    Team: string;
    AccountID: string;
    // Campaign
    CampaignName: string;
    Objective: string;
    Currency: string;
    CampaignBudget: number;
    BuyingType: string;
    // AdSet
    AdSetName: string;
    AdSetBudgetType: string;
    AdSetBudget: number;
    StartDate: string;
    EndDate: string;
    Targeting: string;
    Optimization: string;
    BillingEvent: string;
    PixelEvent: string;
    // Ad
    AdName: string;
    FinalURL: string;
    UTMParameters: string;
    CTA: string;
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
    const [isDragOver, setIsDragOver] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const downloadTemplate = (e: React.MouseEvent) => {
        e.stopPropagation(); // 드래그 앤 드롭 클릭 이벤트 방지
        const headers = [
            '매체', '팀명', '계정 ID',
            '캠페인명', '캠페인 목적', '통화', '캠페인 예산', '구매 유형',
            '광고 세트명', '세트 예산 유형', '세트 예산', '시작일', '종료일', '타겟팅 요약', '최적화 목표', '과금 기준', '픽셀/이벤트',
            '광고명', '랜딩 URL', 'UTM 파라미터', 'CTA 버튼'
        ];

        const mockData1 = [
            'Meta', teamName || '소속 팀명 입력', '1234567890',
            '24년_봄_프로모션', 'OUTCOME_SALES', 'KRW', '', 'AUCTION',
            '세트_A_타겟', '일일 예산', '50000', '2024-04-01', '2024-04-30', 'KR, 25-44', 'CONVERSIONS', 'IMPRESSIONS', 'Purchase',
            '이미지_소재_1', 'https://example.com/spring', 'utm_source=fb&utm_medium=cpa', 'SHOP_NOW'
        ];
        const mockData2 = [
            'Google', teamName || '소속 팀명 입력', '123-456-7890',
            '브랜드_검색', 'TRAFFIC', 'USD', '1000000', '',
            '그룹_브랜드', '일일 예산', '10000', '2024-04-01', '9999-12-31', 'KR, All', 'CLICKS', 'CPC', 'Click',
            '효율업_소재', 'https://example.com', 'utm_source=google&utm_medium=cpc', 'LEARN_MORE'
        ];

        const wb = xlsx.utils.book_new();

        // 1. Data Sheet
        const wsData = xlsx.utils.aoa_to_sheet([headers, mockData1, mockData2]);
        xlsx.utils.book_append_sheet(wb, wsData, '미디어믹스_기본양식');

        // 2. Reference Sheet (Meta API Data Dictionary)
        const referenceHeaders = ['항목명', '입력 가능한 값 (Meta API 기준) / 설명'];
        const referenceData = [
            ['통화 (Currency)', 'KRW, USD, JPY 등 ISO 4217 표준 통화 코드 (대문자 입력 권장)'],
            ['캠페인 목적 (Objective)', 'OUTCOME_SALES (판매), OUTCOME_LEADS (리드), OUTCOME_TRAFFIC (트래픽), OUTCOME_ENGAGEMENT (참여), OUTCOME_AWARENESS (인지도), OUTCOME_APP_PROMOTION (앱 홍보)'],
            ['구매 유형 (Buying Type)', 'AUCTION (경매), RESERVE (도달 및 빈도)'],
            ['타겟팅 요약', '자유 양식 (예: KR, 25-44세, 여성) - API의 복잡한 타겟팅 JSON과 직관적으로 비교하기 위한 메모 용도'],
            ['최적화 목표 (Optimization)', 'CONVERSIONS (전환), LINK_CLICKS (링크 클릭), IMPRESSIONS (노출), REACH (도달), LANDING_PAGE_VIEWS (랜딩 페이지 조회), THRUPLAY (동영상 조회)'],
            ['과금 기준 (Billing Event)', 'IMPRESSIONS (노출), LINK_CLICKS (링크 클릭), THRUPLAY (동영상 조회)'],
            ['픽셀/이벤트 (Event)', 'Purchase (구매), Lead (리드), AddToCart (장바구니 담기), ViewContent (콘텐츠 조회) 등 표준 이벤트명 및 맞춤 이벤트명']
        ];
        const wsRef = xlsx.utils.aoa_to_sheet([referenceHeaders, ...referenceData]);

        // Adjust column widths for better readability in the reference sheet
        wsRef['!cols'] = [{ wch: 25 }, { wch: 120 }];

        xlsx.utils.book_append_sheet(wb, wsRef, '입력 가이드(옵션값)');

        xlsx.writeFile(wb, 'Ad-Sentinel_표준_미디어믹스_템플릿.xlsx');
    };

    const processFile = (file: File) => {
        setIsParsing(true);
        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = xlsx.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];

                // Mapping 20 columns with formatted strings for Dates
                const data: any[] = xlsx.utils.sheet_to_json(ws, { raw: false, dateNF: 'yyyy-mm-dd' });

                // For safety, remove any whitespace from number strings before parsing
                const parseBudget = (val: any) => {
                    if (!val) return 0;
                    let str = String(val).replace(/,/g, '').trim();

                    // Handle "만" keyword (e.g., "120만" -> 1200000)
                    if (str.includes('만')) {
                        const numPart = Number(str.replace(/만/g, '').replace(/원/g, '').replace(/[^0-9.]/g, ''));
                        return numPart * 10000;
                    }

                    // Remove all non-numeric characters except dot
                    const cleanVal = str.replace(/[^0-9.]/g, '');
                    return Number(cleanVal) || 0;
                };

                const mappedData: ParsedRow[] = data.map(item => ({
                    Platform: item['매체'] || '',
                    Team: item['팀명'] || '',
                    AccountID: item['계정 ID']?.toString() || item['광고 계정 ID']?.toString() || '',
                    CampaignName: item['캠페인명'] || '',
                    Objective: item['캠페인 목적'] || '',
                    Currency: item['통화'] || 'KRW',
                    CampaignBudget: parseBudget(item['캠페인 예산']),
                    BuyingType: item['구매 유형'] || '',
                    AdSetName: item['광고 세트명'] || item['광고 세트/그룹명'] || '',
                    AdSetBudgetType: item['세트 예산 유형'] || item['예산 유형'] || '',
                    AdSetBudget: parseBudget(item['세트 예산']) || parseBudget(item['집행 예산']) || 0,
                    StartDate: item['시작일'] || '',
                    EndDate: item['종료일'] || '',
                    Targeting: item['타겟팅 요약'] || '',
                    Optimization: item['최적화 목표'] || '',
                    BillingEvent: item['과금 기준'] || '',
                    PixelEvent: item['픽셀/이벤트'] || item['전환 픽셀 ID/이벤트'] || '',
                    AdName: item['광고명'] || '',
                    FinalURL: item['랜딩 URL'] || item['랜딩 페이지 URL'] || '',
                    UTMParameters: item['UTM 파라미터'] || item['UTM 캠페인'] || '',
                    CTA: item['CTA 버튼'] || ''
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

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) processFile(file);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file) processFile(file);
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
                    className={`flex-1 border-2 border-dashed rounded-xl flex items-center justify-center flex-col gap-6 transition-all ${isDragOver ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 shadow-inner' : 'border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50 hover:bg-zinc-100 dark:hover:bg-zinc-900'}`}
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    style={{ cursor: 'pointer' }}
                >
                    <div className="text-center flex flex-col items-center gap-3">
                        <div className="p-4 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 rounded-full">
                            <UploadCloud className="w-10 h-10" />
                        </div>
                        <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mt-2">미디어믹스 엑셀 파일 업로드</h3>
                        <p className="text-sm text-zinc-500 max-w-sm mx-auto">
                            드래그 앤 드롭 하거나 영역을 클릭하여 엑셀(.xlsx) 파일을 업로드해주세요. 양식은 15개의 표준 컬럼을 준수해야 합니다.
                        </p>
                    </div>

                    <button
                        onClick={downloadTemplate}
                        className="mt-2 text-sm font-semibold flex items-center gap-2 px-4 py-2 border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-700 transition"
                    >
                        <Download className="w-4 h-4" />
                        기본 엑셀 양식 템플릿 다운로드
                    </button>

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
                                    <th className="px-4 py-3 font-medium">캠페인 목적</th>
                                    <th className="px-4 py-3 font-medium">캠페인 예산</th>
                                    <th className="px-4 py-3 font-medium">구매 유형</th>
                                    <th className="px-4 py-3 font-medium bg-zinc-200/50 dark:bg-zinc-700/50">세트/그룹 명</th>
                                    <th className="px-4 py-3 font-medium bg-zinc-200/50 dark:bg-zinc-700/50 text-right">세트 예산</th>
                                    <th className="px-4 py-3 font-medium bg-zinc-200/50 dark:bg-zinc-700/50">시작일</th>
                                    <th className="px-4 py-3 font-medium bg-zinc-200/50 dark:bg-zinc-700/50">종료일</th>
                                    <th className="px-4 py-3 font-medium bg-zinc-200/50 dark:bg-zinc-700/50">타겟팅 요약</th>
                                    <th className="px-4 py-3 font-medium bg-zinc-200/50 dark:bg-zinc-700/50">최적화 목표</th>
                                    <th className="px-4 py-3 font-medium">랜딩 URL</th>
                                    <th className="px-4 py-3 font-medium">UTM 파라미터</th>
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
                                            <td className="px-4 py-3 font-semibold text-zinc-900 dark:text-zinc-200 max-w-[150px] truncate" title={row.CampaignName}>{row.CampaignName}</td>
                                            <td className="px-4 py-3 text-zinc-500 max-w-[100px] truncate">{row.Objective}</td>
                                            <td className="px-4 py-3 text-right font-medium text-zinc-600 dark:text-zinc-400">
                                                <span className="text-[10px] text-zinc-400 mr-1">{row.Currency}</span>
                                                {row.CampaignBudget > 0 ? row.CampaignBudget.toLocaleString() : '-'}
                                            </td>
                                            <td className="px-4 py-3 text-zinc-500 font-mono text-[10px]">{row.BuyingType}</td>

                                            <td className="px-4 py-3 text-indigo-700 dark:text-indigo-300 font-medium max-w-[150px] truncate bg-zinc-50/50 dark:bg-zinc-800/30" title={row.AdSetName}>{row.AdSetName}</td>
                                            <td className="px-4 py-3 text-right font-bold text-emerald-600 dark:text-emerald-400 bg-zinc-50/50 dark:bg-zinc-800/30">
                                                <span className="text-[10px] text-emerald-600/50 dark:text-emerald-400/50 mr-1">{row.Currency}</span>
                                                {row.AdSetBudget.toLocaleString()}
                                            </td>
                                            <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400 text-[10px] bg-zinc-50/50 dark:bg-zinc-800/30">{row.StartDate}</td>
                                            <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400 text-[10px] bg-zinc-50/50 dark:bg-zinc-800/30">{row.EndDate}</td>
                                            <td className="px-4 py-3 text-zinc-500 max-w-[150px] truncate text-[10px] bg-zinc-50/50 dark:bg-zinc-800/30" title={row.Targeting}>{row.Targeting}</td>
                                            <td className="px-4 py-3 text-zinc-500 max-w-[100px] truncate text-[10px] bg-zinc-50/50 dark:bg-zinc-800/30">{row.Optimization}</td>

                                            <td className="px-4 py-3 text-zinc-500 max-w-[150px] truncate" title={row.FinalURL}>
                                                <a href={row.FinalURL} target="_blank" rel="noreferrer" className="hover:text-indigo-500 underline">{row.FinalURL}</a>
                                            </td>
                                            <td className="px-4 py-3 text-zinc-500 font-mono text-[10px] max-w-[150px] truncate" title={row.UTMParameters}>{row.UTMParameters}</td>
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
