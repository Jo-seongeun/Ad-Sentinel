'use client';

import { useState, useRef, useEffect } from 'react';
import * as xlsx from 'xlsx';
import { UploadCloud, CheckCircle2, AlertCircle, Loader2, Download, ShieldCheck, BookOpen, X, ExternalLink } from 'lucide-react';
import { crosscheckApiAction } from './actions';

// ─── 22개 컬럼 메타데이터 ───────────────────────────────────────────────────
type RequiredType = '필수' | '조건부' | '선택';

interface ColumnMeta {
    no: number;
    name: string;
    required: RequiredType;
    needsDictionary: boolean;
    description: string;
}

const COLUMN_META: ColumnMeta[] = [
    { no: 1,  name: '매체',            required: '필수',   needsDictionary: false, description: 'Meta 또는 Google Ads 입력' },
    { no: 2,  name: '팀명',            required: '필수',   needsDictionary: false, description: '소속 팀명 (예: 퍼포먼스팀)' },
    { no: 3,  name: '계정 ID',         required: '필수',   needsDictionary: false, description: '매체 광고 계정 ID (숫자 그대로 입력)' },
    { no: 4,  name: '캠페인 ID',       required: '선택',   needsDictionary: false, description: '비워두면 캠페인명 기준으로 조회' },
    { no: 5,  name: '캠페인명',        required: '필수',   needsDictionary: false, description: '실제 매체에 등록된 캠페인 이름' },
    { no: 6,  name: '통화',            required: '필수',   needsDictionary: false, description: 'ISO 4217 코드 (KRW, USD, JPY 등)' },
    { no: 7,  name: '캠페인 일 예산',  required: '조건부', needsDictionary: false, description: '캠페인 예산(8번)과 둘 중 하나 필수' },
    { no: 8,  name: '캠페인 예산',     required: '조건부', needsDictionary: false, description: '캠페인 일 예산(7번)과 둘 중 하나 필수' },
    { no: 9,  name: '시작일',          required: '필수',   needsDictionary: false, description: 'YYYY-MM-DD 형식 (예: 2024-04-01)' },
    { no: 10, name: '종료일',          required: '필수',   needsDictionary: false, description: 'YYYY-MM-DD 형식 (예: 2024-04-30)' },
    { no: 11, name: '광고 세트명',     required: '필수',   needsDictionary: false, description: '실제 매체에 등록된 광고 세트/그룹명' },
    { no: 12, name: '광고 세트 일 예산', required: '조건부', needsDictionary: false, description: '광고 세트 예산(13번)과 둘 중 하나' },
    { no: 13, name: '광고 세트 예산',  required: '조건부', needsDictionary: false, description: '광고 세트 일 예산(12번)과 둘 중 하나' },
    { no: 14, name: '캠페인 목적',     required: '필수',   needsDictionary: true,  description: 'API 코드 또는 한글 기입 (예: 트래픽 / OUTCOME_TRAFFIC)' },
    { no: 15, name: '구매 유형',       required: '필수',   needsDictionary: true,  description: 'API 코드 또는 한글 기입 (예: 경매 / AUCTION)' },
    { no: 16, name: '광고명',          required: '선택',   needsDictionary: false, description: '광고 소재명 (없어도 검수 가능)' },
    { no: 17, name: '랜딩 URL',        required: '선택',   needsDictionary: false, description: '광고 클릭 시 이동되는 랜딩 페이지 URL' },
    { no: 18, name: 'UTM 파라미터',    required: '선택',   needsDictionary: false, description: 'utm_source=fb&utm_medium=cpa 형식' },
    { no: 19, name: '최적화 목표',     required: '필수',   needsDictionary: true,  description: 'API 코드 또는 한글 기입 (예: 전환 / CONVERSIONS)' },
    { no: 20, name: '과금 기준',       required: '필수',   needsDictionary: true,  description: 'API 코드 또는 한글 기입 (예: 노출 / IMPRESSIONS)' },
    { no: 21, name: '픽셀/이벤트',     required: '선택',   needsDictionary: false, description: '픽셀 ID 또는 이벤트 이름 입력' },
    { no: 22, name: '이벤트 유형',     required: '선택',   needsDictionary: true,  description: '표준 이벤트명 기입 (예: Purchase, Lead)' },
];


export interface ParsedRow {
    Platform: string;
    Team: string;
    AccountID: string;
    CampaignID: string;
    CampaignName: string;
    Currency: string;
    CampaignDailyBudget: number;
    CampaignLifetimeBudget: number;
    StartDate: string;
    EndDate: string;
    AdSetName: string;
    AdSetDailyBudget: number;
    AdSetLifetimeBudget: number;
    CampaignObjective: string;
    CampaignBuyingType: string;
    AdName: string;
    LandingURL: string;
    UTMParameters: string;
    AdSetOptimizationGoal: string;
    AdSetBillingEvent: string;
    PixelID: string;
    CustomEventType: string;
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


    const downloadTemplate = () => {
        const headers = [
            '매체', '팀명', '계정 ID',
            '캠페인 ID', '캠페인명', '통화', '캠페인 일 예산', '캠페인 예산', '시작일', '종료일',
            '광고 세트명', '광고 세트 일 예산', '광고 세트 예산',
            '캠페인 목적', '구매 유형', '광고명', '랜딩 URL', 'UTM 파라미터',
            '최적화 목표', '과금 기준', '픽셀/이벤트', '이벤트 유형'
        ];

        const mockData1 = [
            'Meta', teamName || '소속 팀명 입력', '1777607596977990',
            '120456789012', '24년_봄_프로모션_캠페인', 'KRW', '500000', '10000000', '2024-04-01', '2024-04-30',
            '세트_A_타겟', '', '2000000',
            'OUTCOME_SALES', 'AUCTION', '이미지_소재_1', 'https://example.com/spring', 'utm_source=fb&utm_medium=cpa',
            'CONVERSIONS', 'IMPRESSIONS', '123456789', 'Purchase'
        ];
        const mockData2 = [
            'Meta', teamName || '소속 팀명 입력', '1777607596977990',
            '', '24년_가을_프로모션_캠페인', 'KRW', '', '20000000', '2024-09-01', '2024-09-30',
            '세트_B_타겟', '50000', '',
            'OUTCOME_TRAFFIC', 'AUCTION', '참여유도_소재_A', 'https://example.com/fall', 'utm_source=fb&utm_medium=cpc',
            'LINK_CLICKS', 'IMPRESSIONS', '', ''
        ];

        const wb = xlsx.utils.book_new();

        // 1. Data Sheet
        const wsData = xlsx.utils.aoa_to_sheet([headers, mockData1, mockData2]);

        // Apply number and date formatting to cells
        const range = xlsx.utils.decode_range(wsData['!ref'] || 'A1:V3');
        for (let r = range.s.r; r <= range.e.r; r++) {
            if (r === 0) continue; // Skip header row

            for (let c = range.s.c; c <= range.e.c; c++) {
                const cellRef = xlsx.utils.encode_cell({ r, c });
                const cell = wsData[cellRef];
                if (!cell) continue;

                // Numeric columns: 캠페인 일 예산 (G/6), 캠페인 예산 (H/7), 광고 세트 일 예산 (L/11), 광고 세트 예산 (M/12)
                if (c === 6 || c === 7 || c === 11 || c === 12) {
                    if (cell.v !== '' && cell.v !== null && cell.v !== undefined) {
                        const numVal = Number(cell.v);
                        if (!isNaN(numVal)) {
                            cell.t = 'n';
                            cell.v = numVal;
                            cell.z = '#,##0'; // Thousands separator format
                        }
                    }
                }

                // Date columns: 시작일 (I/8), 종료일 (J/9)
                if (c === 8 || c === 9) {
                    if (cell.v) {
                        const dateStr = String(cell.v).trim();
                        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
                            // Convert YYYY-MM-DD string to actual Date object
                            const dateObj = new Date(dateStr + 'T00:00:00');
                            cell.t = 'd';
                            cell.v = dateObj;
                            cell.z = 'yyyy-mm-dd'; // Standard date format in Excel
                        }
                    }
                }
            }
        }

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

                const parseDate = (val: any) => {
                    if (!val) return '';
                    if (typeof val === 'number') {
                        // Excel serial date bug (1900 leap year)
                        const utc_days = Math.floor(val - 25569);
                        const dateObj = new Date(utc_days * 86400 * 1000);
                        return dateObj.toISOString().split('T')[0];
                    }
                    if (typeof val === 'string') {
                        // Sometimes the raw mode skips formatting but sends it as a string
                        if (!isNaN(Number(val)) && Number(val) > 10000) {
                            const utc_days = Math.floor(Number(val) - 25569);
                            const dateObj = new Date(utc_days * 86400 * 1000);
                            return dateObj.toISOString().split('T')[0];
                        }
                        // Handle slash dates like "3/31/26" or "2026/04/13"
                        if (val.includes('/')) {
                            const parts = val.split('/');
                            if (parts.length === 3) {
                                let y = parts[2];
                                let m = parts[0];
                                let d = parts[1];
                                // if first part is YYYY
                                if (parts[0].length === 4) {
                                    y = parts[0]; m = parts[1]; d = parts[2];
                                } else if (parts[2].length === 2) {
                                    // if year is YY, assume 2000s
                                    y = '20' + parts[2];
                                }
                                return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
                            }
                        }
                    }
                    return String(val).trim();
                };

                const mappedData: ParsedRow[] = data.map(item => ({
                    Platform: item['매체'] || '',
                    Team: item['팀명'] || '',
                    AccountID: item['계정 ID']?.toString() || '',
                    CampaignID: item['캠페인 ID']?.toString() || '',
                    CampaignName: item['캠페인명'] || '',
                    Currency: item['통화'] || '',
                    CampaignDailyBudget: parseBudget(item['캠페인 일 예산']),
                    CampaignLifetimeBudget: parseBudget(item['캠페인 예산']),
                    StartDate: parseDate(item['시작일']),
                    EndDate: parseDate(item['종료일']),
                    AdSetName: item['광고 세트명'] || item['광고 세트/그룹명'] || '',
                    AdSetDailyBudget: parseBudget(item['광고 세트 일 예산']),
                    AdSetLifetimeBudget: parseBudget(item['광고 세트 예산']),
                    CampaignObjective: item['캠페인 목적'] || '',
                    CampaignBuyingType: item['구매 유형'] || '',
                    AdName: item['광고명'] || '',
                    LandingURL: item['랜딩 URL'] || '',
                    UTMParameters: item['UTM 파라미터'] || '',
                    AdSetOptimizationGoal: item['최적화 목표'] || '',
                    AdSetBillingEvent: item['과금 기준'] || '',
                    PixelID: item['픽셀/이벤트']?.toString() || '',
                    CustomEventType: item['이벤트 유형'] || ''
                }));

                // ── Fill-down (값 승계) ──────────────────────────────────────────
                // 캠페인/세트 레벨 공통 필드: 원본 Raw 셀이 비어있으면 위 행 값을 승계
                // 광고명·랜딩URL·UTM은 광고 단위 고유값 → 승계 제외
                //
                // 승계 필드 → 원본 Excel 헤더명 매핑
                const FILL_DOWN_MAP: { field: keyof ParsedRow; header: string }[] = [
                    { field: 'Platform',               header: '매체' },
                    { field: 'Team',                   header: '팀명' },
                    { field: 'AccountID',              header: '계정 ID' },
                    { field: 'CampaignID',             header: '캠페인 ID' },
                    { field: 'CampaignName',           header: '캠페인명' },
                    { field: 'Currency',               header: '통화' },
                    { field: 'CampaignDailyBudget',    header: '캠페인 일 예산' },
                    { field: 'CampaignLifetimeBudget', header: '캠페인 예산' },
                    { field: 'StartDate',              header: '시작일' },
                    { field: 'EndDate',                header: '종료일' },
                    { field: 'CampaignObjective',      header: '캠페인 목적' },
                    { field: 'CampaignBuyingType',     header: '구매 유형' },
                    { field: 'AdSetName',              header: '광고 세트명' },
                    { field: 'AdSetDailyBudget',       header: '광고 세트 일 예산' },
                    { field: 'AdSetLifetimeBudget',    header: '광고 세트 예산' },
                    { field: 'AdSetOptimizationGoal',  header: '최적화 목표' },
                    { field: 'AdSetBillingEvent',      header: '과금 기준' },
                    { field: 'PixelID',                header: '픽셀/이벤트' },
                    { field: 'CustomEventType',        header: '이벤트 유형' },
                    // ↓ 승계 제외: AdName, LandingURL, UTMParameters (광고 단위 고유값)
                ];

                for (let i = 1; i < mappedData.length; i++) {
                    for (const { field, header } of FILL_DOWN_MAP) {
                        // 원본 Raw 데이터 기준으로 "진짜 빈 칸"인지 판별
                        // — 숫자 0을 명시적으로 입력한 경우는 승계하지 않음
                        const rawVal = data[i][header];
                        const isTrulyBlank = rawVal === undefined || rawVal === null || rawVal === '';
                        if (isTrulyBlank) {
                            (mappedData[i] as any)[field] = (mappedData[i - 1] as any)[field];
                        }
                    }
                }
                // ────────────────────────────────────────────────────────────────

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

    // 매체 사전 필요 컬럼 목록
    const dictColumns = COLUMN_META.filter(c => c.needsDictionary);

    return (
        <div className="flex-1 overflow-hidden flex flex-col gap-4">
            {rows.length === 0 ? (
                /* ── 빈 상태: 좌우 분할 인라인 레이아웃 ── */
                <div className="flex-1 flex gap-4 overflow-hidden min-h-0">

                    {/* ── 좌측: 업로드 존 + 다운로드 버튼 ── */}
                    <div className="w-72 shrink-0 flex flex-col gap-3">
                        {/* 업로드 드래그 존 */}
                        <div
                            className={`flex-1 border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-4 p-6 transition-all cursor-pointer ${
                                isDragOver
                                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 shadow-inner'
                                    : 'border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50 hover:bg-zinc-100 dark:hover:bg-zinc-900'
                            }`}
                            onClick={() => fileInputRef.current?.click()}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                        >
                            <div className="p-3 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 rounded-full">
                                <UploadCloud className="w-8 h-8" />
                            </div>
                            <div className="text-center">
                                <p className="text-sm font-bold text-zinc-800 dark:text-zinc-100">엑셀 파일 업로드</p>
                                <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                                    클릭 또는 드래그 앤 드롭으로<br />파일을 올려주세요
                                </p>
                                <p className="text-[11px] text-zinc-400 mt-2">.xlsx / .xls</p>
                            </div>
                            {isParsing && (
                                <div className="flex items-center gap-2 text-indigo-600 text-xs">
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    파일 분석 중...
                                </div>
                            )}
                        </div>

                        {/* 템플릿 다운로드 버튼 */}
                        <button
                            onClick={(e) => { e.stopPropagation(); downloadTemplate(); }}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
                        >
                            <Download className="w-4 h-4" />
                            기본 엑셀 양식 템플릿 다운로드
                        </button>

                        {/* 매체 사전 바로가기 */}
                        <a
                            href="/dictionary"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 text-amber-700 dark:text-amber-400 rounded-xl hover:bg-amber-100 dark:hover:bg-amber-950/50 transition-colors"
                        >
                            <BookOpen className="w-4 h-4" />
                            매체 사전에서 예시값 확인
                            <ExternalLink className="w-3.5 h-3.5" />
                        </a>

                        <input
                            type="file"
                            accept=".xlsx, .xls"
                            ref={fileInputRef}
                            onChange={handleFileUpload}
                            className="hidden"
                        />
                    </div>

                    {/* ── 우측: 컬럼 가이드 인라인 표시 ── */}
                    <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm">
                        {/* 헤더 */}
                        <div className="px-5 py-3.5 border-b border-zinc-200 dark:border-zinc-800 shrink-0 flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-600">
                                    <Download className="w-3.5 h-3.5" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">22개 표준 컬럼 가이드</h3>
                                    <p className="text-[11px] text-zinc-400 mt-0.5">템플릿 작성 전 필수 여부를 확인하세요</p>
                                </div>
                            </div>
                            {/* 범례 */}
                            <div className="hidden lg:flex items-center gap-3 text-[11px] text-zinc-400">
                                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-400" />필수</span>
                                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" />조건부</span>
                                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-zinc-300" />선택</span>
                                <span className="flex items-center gap-1"><BookOpen className="w-3 h-3 text-amber-500" />사전 참고</span>
                            </div>
                        </div>

                        {/* 매체 사전 배너 */}
                        <div className="mx-4 mt-3 mb-1 shrink-0 flex items-center gap-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-lg px-3.5 py-2.5">
                            <BookOpen className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                            <p className="text-xs text-amber-700 dark:text-amber-400 flex-1">
                                <span className="font-bold">🔖 사전 참고</span> 표시 컬럼은 입력값 범위가 정해져 있습니다.
                                <span className="ml-1">
                                    {dictColumns.map((c, i) => (
                                        <span key={c.no} className="font-semibold text-amber-800 dark:text-amber-300">
                                            {c.name}{i < dictColumns.length - 1 ? ', ' : ''}
                                        </span>
                                    ))}
                                </span>
                            </p>
                            <a
                                href="/dictionary"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="shrink-0 inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors whitespace-nowrap"
                            >
                                매체 사전 열기 <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                        </div>

                        {/* 컬럼 테이블 */}
                        <div className="flex-1 overflow-y-auto min-h-0 px-4 pb-3 mt-2">
                            <table className="w-full text-left border-collapse text-sm">
                                <thead>
                                    <tr className="bg-zinc-100 dark:bg-zinc-800/80 text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                                        <th className="px-3 py-2.5 w-8 text-center sticky top-0 bg-zinc-100 dark:bg-zinc-800/80">#</th>
                                        <th className="px-3 py-2.5 sticky top-0 bg-zinc-100 dark:bg-zinc-800/80">컬럼명</th>
                                        <th className="px-3 py-2.5 text-center w-20 sticky top-0 bg-zinc-100 dark:bg-zinc-800/80">필수 여부</th>
                                        <th className="px-3 py-2.5 sticky top-0 bg-zinc-100 dark:bg-zinc-800/80">설명</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                    {COLUMN_META.map((col) => (
                                        <tr
                                            key={col.no}
                                            className={`transition-colors ${
                                                col.needsDictionary
                                                    ? 'bg-amber-50/60 dark:bg-amber-950/20 hover:bg-amber-50 dark:hover:bg-amber-950/30'
                                                    : 'bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800/40'
                                            }`}
                                        >
                                            <td className="px-3 py-2 text-center text-xs font-mono text-zinc-400">{col.no}</td>
                                            <td className="px-3 py-2">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className={`font-semibold text-xs ${
                                                        col.needsDictionary ? 'text-amber-800 dark:text-amber-300' : 'text-zinc-800 dark:text-zinc-200'
                                                    }`}>
                                                        {col.name}
                                                    </span>
                                                    {col.needsDictionary && (
                                                        <span className="inline-flex items-center gap-0.5 text-[9px] font-bold bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-700 rounded px-1 py-0.5">
                                                            <BookOpen className="w-2 h-2" />
                                                            사전 참고
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-3 py-2 text-center">
                                                {col.required === '필수' && (
                                                    <span className="inline-flex items-center justify-center text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
                                                        필수
                                                    </span>
                                                )}
                                                {col.required === '조건부' && (
                                                    <span className="inline-flex items-center justify-center text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                                                        조건부
                                                    </span>
                                                )}
                                                {col.required === '선택' && (
                                                    <span className="inline-flex items-center justify-center text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                                                        선택
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-3 py-2 text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                                                {col.description}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
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
                                    <th className="px-4 py-3 font-medium text-center bg-zinc-100 dark:bg-zinc-800/80">No</th>
                                    <th className="px-4 py-3 font-medium bg-zinc-100 dark:bg-zinc-800/80">검수 결과</th>
                                    <th className="px-4 py-3 font-medium bg-zinc-200/50 dark:bg-zinc-700/50">매체</th>
                                    <th className="px-4 py-3 font-medium bg-zinc-200/50 dark:bg-zinc-700/50">팀명</th>
                                    <th className="px-4 py-3 font-medium bg-zinc-200/50 dark:bg-zinc-700/50">계정 ID</th>
                                    <th className="px-4 py-3 font-medium bg-blue-50 dark:bg-blue-900/20">캠페인 ID</th>
                                    <th className="px-4 py-3 font-medium bg-blue-50 dark:bg-blue-900/20">캠페인명</th>
                                    <th className="px-4 py-3 font-medium bg-blue-50 dark:bg-blue-900/20 text-right">캠페인 일 예산</th>
                                    <th className="px-4 py-3 font-medium bg-blue-50 dark:bg-blue-900/20 text-right">캠페인 예산</th>
                                    <th className="px-4 py-3 font-medium bg-zinc-200/50 dark:bg-zinc-700/50">시작일</th>
                                    <th className="px-4 py-3 font-medium bg-zinc-200/50 dark:bg-zinc-700/50">종료일</th>
                                    <th className="px-4 py-3 font-medium bg-indigo-50 dark:bg-indigo-900/20">광고 세트명</th>
                                    <th className="px-4 py-3 font-medium bg-indigo-50 dark:bg-indigo-900/20 text-right">세트 일 예산</th>
                                    <th className="px-4 py-3 font-medium bg-indigo-50 dark:bg-indigo-900/20 text-right">세트 예산</th>
                                    <th className="px-4 py-3 font-medium bg-blue-50 dark:bg-blue-900/20">캠페인 목적</th>
                                    <th className="px-4 py-3 font-medium bg-blue-50 dark:bg-blue-900/20">구매 유형</th>
                                    <th className="px-4 py-3 font-medium bg-emerald-50 dark:bg-emerald-900/20">광고명</th>
                                    <th className="px-4 py-3 font-medium bg-emerald-50 dark:bg-emerald-900/20">랜딩 URL</th>
                                    <th className="px-4 py-3 font-medium bg-emerald-50 dark:bg-emerald-900/20">UTM 파라미터</th>
                                    <th className="px-4 py-3 font-medium bg-indigo-50 dark:bg-indigo-900/20">최적화 목표</th>
                                    <th className="px-4 py-3 font-medium bg-indigo-50 dark:bg-indigo-900/20">과금 기준</th>
                                    <th className="px-4 py-3 font-medium bg-indigo-50 dark:bg-indigo-900/20">픽셀/이벤트</th>
                                    <th className="px-4 py-3 font-medium bg-indigo-50 dark:bg-indigo-900/20">이벤트 유형</th>
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
                                            <td className="px-4 py-3 font-medium text-zinc-800 dark:text-zinc-200 truncate max-w-[100px]" title={row.Team}>{row.Team}</td>
                                            <td className="px-4 py-3 font-mono text-zinc-500 text-[10px]">{row.AccountID}</td>
                                            <td className="px-4 py-3 font-mono text-zinc-400 text-[10px] bg-blue-50/20 dark:bg-blue-900/10">{row.CampaignID || '-'}</td>
                                            <td className="px-4 py-3 font-semibold text-zinc-900 dark:text-zinc-200 max-w-[150px] truncate bg-blue-50/20 dark:bg-blue-900/10" title={row.CampaignName}>{row.CampaignName}</td>
                                            <td className="px-4 py-3 text-right font-medium text-zinc-600 dark:text-zinc-400 bg-blue-50/20 dark:bg-blue-900/10">
                                                {row.CampaignDailyBudget > 0 ? row.CampaignDailyBudget.toLocaleString() : '-'}
                                            </td>
                                            <td className="px-4 py-3 text-right font-medium text-zinc-600 dark:text-zinc-400 bg-blue-50/20 dark:bg-blue-900/10">
                                                {row.CampaignLifetimeBudget > 0 ? row.CampaignLifetimeBudget.toLocaleString() : '-'}
                                            </td>
                                            <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400 text-[10px] bg-zinc-50/50 dark:bg-zinc-800/30">{row.StartDate}</td>
                                            <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400 text-[10px] bg-zinc-50/50 dark:bg-zinc-800/30">{row.EndDate}</td>

                                            <td className="px-4 py-3 text-indigo-700 dark:text-indigo-300 font-medium max-w-[150px] truncate bg-indigo-50/20 dark:bg-indigo-900/10" title={row.AdSetName}>{row.AdSetName}</td>
                                            <td className="px-4 py-3 text-right font-medium text-zinc-600 dark:text-zinc-400 bg-indigo-50/20 dark:bg-indigo-900/10">
                                                {row.AdSetDailyBudget > 0 ? row.AdSetDailyBudget.toLocaleString() : '-'}
                                            </td>
                                            <td className="px-4 py-3 text-right font-medium text-zinc-600 dark:text-zinc-400 bg-indigo-50/20 dark:bg-indigo-900/10">
                                                {row.AdSetLifetimeBudget > 0 ? row.AdSetLifetimeBudget.toLocaleString() : '-'}
                                            </td>

                                            <td className="px-4 py-3 text-zinc-500 max-w-[100px] truncate bg-blue-50/20 dark:bg-blue-900/10">{row.CampaignObjective}</td>
                                            <td className="px-4 py-3 text-zinc-500 font-mono text-[10px] bg-blue-50/20 dark:bg-blue-900/10">{row.CampaignBuyingType}</td>

                                            <td className="px-4 py-3 font-semibold text-zinc-900 dark:text-zinc-200 max-w-[150px] truncate bg-emerald-50/20 dark:bg-emerald-900/10">{row.AdName}</td>
                                            <td className="px-4 py-3 text-zinc-500 max-w-[150px] truncate bg-emerald-50/20 dark:bg-emerald-900/10" title={row.LandingURL}>
                                                <a href={row.LandingURL} target="_blank" rel="noreferrer" className="hover:text-indigo-500 underline">{row.LandingURL}</a>
                                            </td>
                                            <td className="px-4 py-3 text-zinc-500 font-mono text-[10px] max-w-[150px] truncate bg-emerald-50/20 dark:bg-emerald-900/10" title={row.UTMParameters}>{row.UTMParameters}</td>

                                            <td className="px-4 py-3 text-zinc-500 max-w-[100px] truncate text-[10px] bg-indigo-50/20 dark:bg-indigo-900/10">{row.AdSetOptimizationGoal}</td>
                                            <td className="px-4 py-3 text-zinc-500 font-mono text-[10px] bg-indigo-50/20 dark:bg-indigo-900/10">{row.AdSetBillingEvent}</td>
                                            <td className="px-4 py-3 text-zinc-500 font-mono text-[10px] bg-indigo-50/20 dark:bg-indigo-900/10">{row.PixelID}</td>
                                            <td className="px-4 py-3 text-zinc-500 font-mono text-[10px] bg-indigo-50/20 dark:bg-indigo-900/10">{row.CustomEventType}</td>
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
