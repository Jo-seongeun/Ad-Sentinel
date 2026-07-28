'use client';

import { useState, useRef, useEffect } from 'react';
import * as xlsx from 'xlsx';
import { UploadCloud, CheckCircle2, AlertCircle, Loader2, Download, ShieldCheck, BookOpen, X, ExternalLink, Map, Eye } from 'lucide-react';
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
    { no: 1, name: '매체', required: '필수', needsDictionary: false, description: 'Meta 또는 Google Ads 입력' },
    { no: 2, name: '팀명', required: '필수', needsDictionary: false, description: '소속 팀명 (예: 퍼포먼스팀)' },
    { no: 3, name: '계정 ID', required: '필수', needsDictionary: false, description: '매체 광고 계정 ID (숫자 그대로 입력)' },
    { no: 4, name: '캠페인 ID', required: '선택', needsDictionary: false, description: '비워두면 캠페인명 기준으로 조회' },
    { no: 5, name: '캠페인명', required: '필수', needsDictionary: false, description: '실제 매체에 등록된 캠페인 이름' },
    { no: 6, name: '통화', required: '필수', needsDictionary: false, description: 'ISO 4217 코드 (KRW, USD, JPY 등)' },
    { no: 7, name: '캠페인 일 예산', required: '조건부', needsDictionary: false, description: '캠페인 예산(8번)과 둘 중 하나 필수' },
    { no: 8, name: '캠페인 예산', required: '조건부', needsDictionary: false, description: '캠페인 일 예산(7번)과 둘 중 하나 필수' },
    { no: 9, name: '시작일', required: '필수', needsDictionary: false, description: 'YYYY-MM-DD 형식 (예: 2024-04-01)' },
    { no: 10, name: '종료일', required: '필수', needsDictionary: false, description: 'YYYY-MM-DD 형식 (예: 2024-04-30)' },
    { no: 11, name: '광고 세트명', required: '필수', needsDictionary: false, description: '실제 매체에 등록된 광고 세트/그룹명' },
    { no: 12, name: '광고 세트 일 예산', required: '조건부', needsDictionary: false, description: '광고 세트 예산(13번)과 둘 중 하나' },
    { no: 13, name: '광고 세트 예산', required: '조건부', needsDictionary: false, description: '광고 세트 일 예산(12번)과 둘 중 하나' },
    { no: 14, name: '캠페인 목적', required: '필수', needsDictionary: true, description: 'API 코드 또는 한글 기입 (예: 트래픽 / OUTCOME_TRAFFIC)' },
    { no: 15, name: '구매 유형', required: '필수', needsDictionary: true, description: 'API 코드 또는 한글 기입 (예: 경매 / AUCTION)' },
    { no: 16, name: '광고명', required: '선택', needsDictionary: false, description: '광고 소재명 (없어도 검수 가능)' },
    { no: 17, name: '헤드라인', required: '선택', needsDictionary: false, description: '[소재 검수 ver2] 소재 헤드라인 문구. API 실제 등록값과 대조합니다.' },
    { no: 18, name: '본문 카피', required: '선택', needsDictionary: false, description: '[소재 검수 ver2] 소재 기본 본문 카피. API 실제 등록값과 대조합니다.' },
    { no: 19, name: '행동유도(CTA)', required: '선택', needsDictionary: false, description: '[소재 검수 ver2] CTA 버튼 유형 (예: 더 알아보기 / 지금 가입하기).' },
    { no: 20, name: '랜딩 URL', required: '선택', needsDictionary: false, description: '지면별 URL 구분 시 줄바꿈(Alt+Enter) 사용. 예: [페이스북 (피드)] https://... — 매체 사전 지면 가이드 참고' },
    { no: 21, name: 'UTM 파라미터', required: '선택', needsDictionary: false, description: '지면별 UTM도 줄바꿈 구분 가능. utm_source=fb&utm_medium=cpa 형식' },
    { no: 22, name: '최적화 목표', required: '필수', needsDictionary: true, description: 'API 코드 또는 한글 기입 (예: 전환 / CONVERSIONS)' },
    { no: 23, name: '과금 기준', required: '필수', needsDictionary: true, description: 'API 코드 또는 한글 기입 (예: 노출 / IMPRESSIONS)' },
    { no: 24, name: '픽셀/이벤트', required: '선택', needsDictionary: false, description: '픽셀 ID 또는 이벤트 이름 입력' },
    { no: 25, name: '이벤트 유형', required: '선택', needsDictionary: false, description: '표준 이벤트명 또는 사용자 지정 이벤트명 입력' },
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
    Headline: string;
    BodyCopy: string;
    CTA: string;
    LandingURL: string;
    UTMParameters: string;
    AdSetOptimizationGoal: string;
    AdSetBillingEvent: string;
    PixelID: string;
    CustomEventType: string;
}

export interface FieldDiff {
    excelVal: string;
    apiVal: string;
    matched: boolean;
    status?: 'PASS' | 'FAIL' | 'WARNING';
    message?: string;
    isNoExcelInput?: boolean;
}

export interface AuditResult {
    rowId: number;
    CampaignName: string;
    AdSetName: string;
    status: 'PASS' | 'FAIL' | 'WARNING';
    errors: string[];
    fieldDiffs?: Record<string, FieldDiff>;
}

export default function AuditClientUI({ teamId, teamName }: { teamId?: string, teamName?: string }) {
    const [rows, setRows] = useState<ParsedRow[]>([]);
    const [isParsing, setIsParsing] = useState(false);
    const [isAuditing, setIsAuditing] = useState(false);
    const [results, setResults] = useState<AuditResult[] | null>(null);
    const [isDragOver, setIsDragOver] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [viewMode, setViewMode] = useState<'ver1' | 'ver2'>('ver1');
    const [showPlacementGuide, setShowPlacementGuide] = useState(false);
    const [activeDrawerRowIndex, setActiveDrawerRowIndex] = useState<number | null>(null);


    const downloadTemplate = () => {
        const headers = [
            '매체', '팀명', '계정 ID',
            '캠페인 ID', '캠페인명', '통화', '캠페인 일 예산', '캠페인 예산', '시작일', '종료일',
            '광고 세트명', '광고 세트 일 예산', '광고 세트 예산',
            '캠페인 목적', '구매 유형', '광고명',
            '헤드라인', '본문 카피', '행동유도(CTA)',
            '랜딩 URL', 'UTM 파라미터',
            '최적화 목표', '과금 기준', '픽셀/이벤트', '이벤트 유형'
        ];

        const mockData1 = [
            'Meta', teamName || '소속 팀명 입력', '1777607596977990',
            '120456789012', '24년_봄_프로모션_캠페인', 'KRW', '500000', '10000000', '2024-04-01', '2024-04-30',
            '세트_A_타겟', '', '2000000',
            'OUTCOME_SALES', 'AUCTION', '이미지_소재_1',
            '봄 프로모션 특가!', '지금 바로 확인하세요. 한정 수량 특가 판매 중.', '지금 쇼핑하기',
            '[기본 설정 / 페이스북 (피드)] https://example.com/spring', '[기본 설정 / 페이스북 (피드)] utm_source=fb&utm_medium=feed',
            'CONVERSIONS', 'IMPRESSIONS', '123456789', 'Purchase'
        ];
        const mockData2 = [
            'GOOGLE_ADS', teamName || '소속 팀명 입력', '1234567890',
            '', '24년_가을_프로모션_캠페인', 'KRW', '', '20000000', '2024-09-01', '2024-09-30',
            '세트_B_타겟', '50000', '',
            'OUTCOME_TRAFFIC', 'AUCTION', '참여유도_소재_A',
            '가을 이벤트', '특별한 가을을 만끽하세요.', '더 알아보기',
            'https://example.com/fall', 'utm_source=fb&utm_medium=cpc',
            'LINK_CLICKS', 'IMPRESSIONS', '', ''
        ];

        const wb = xlsx.utils.book_new();

        // 1. Data Sheet
        const wsData = xlsx.utils.aoa_to_sheet([headers, mockData1, mockData2]);

        // Apply number and date formatting to cells
        const range = xlsx.utils.decode_range(wsData['!ref'] || 'A1:Y3');
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
                    Headline: item['헤드라인'] || '',
                    BodyCopy: item['본문 카피'] || '',
                    CTA: item['행동유도(CTA)'] || '',
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
                    { field: 'Platform', header: '매체' },
                    { field: 'Team', header: '팀명' },
                    { field: 'AccountID', header: '계정 ID' },
                    { field: 'CampaignID', header: '캠페인 ID' },
                    { field: 'CampaignName', header: '캠페인명' },
                    { field: 'Currency', header: '통화' },
                    { field: 'CampaignDailyBudget', header: '캠페인 일 예산' },
                    { field: 'CampaignLifetimeBudget', header: '캠페인 예산' },
                    { field: 'StartDate', header: '시작일' },
                    { field: 'EndDate', header: '종료일' },
                    { field: 'CampaignObjective', header: '캠페인 목적' },
                    { field: 'CampaignBuyingType', header: '구매 유형' },
                    { field: 'AdSetName', header: '광고 세트명' },
                    { field: 'AdSetDailyBudget', header: '광고 세트 일 예산' },
                    { field: 'AdSetLifetimeBudget', header: '광고 세트 예산' },
                    { field: 'AdSetOptimizationGoal', header: '최적화 목표' },
                    { field: 'AdSetBillingEvent', header: '과금 기준' },
                    { field: 'PixelID', header: '픽셀/이벤트' },
                    { field: 'CustomEventType', header: '이벤트 유형' },
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

    const renderDiffCell = (
        excelValue: string | number | undefined,
        fieldKey: string,
        res: AuditResult | undefined,
        isNumberFormatter?: boolean
    ) => {
        const diff = res?.fieldDiffs?.[fieldKey];

        if (!res || !diff) {
            if (isNumberFormatter && typeof excelValue === 'number') {
                return excelValue > 0 ? excelValue.toLocaleString() : '-';
            }
            return <span className="truncate">{excelValue ? String(excelValue) : '-'}</span>;
        }

        const excelText = diff.excelVal || (isNumberFormatter && typeof excelValue === 'number' && excelValue > 0 ? excelValue.toLocaleString() : String(excelValue || '-'));
        const apiText = diff.apiVal || '-';

        // 1. 불일치 (기획안과 매체 값이 서로 다른 경우)
        if (!diff.matched) {
            return (
                <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-xs my-0.5 whitespace-normal min-w-[160px] max-w-[240px] shadow-sm">
                    <div className="text-[10px] font-bold text-rose-600 dark:text-rose-400 mb-1 flex items-center gap-1">
                        <span>❌ {diff.message || '불일치'}</span>
                    </div>
                    <div className="text-[11px] leading-tight space-y-1">
                        <div className="text-zinc-700 dark:text-zinc-300">
                            <span className="font-semibold text-zinc-500 dark:text-zinc-400">계획:</span> {excelText}
                        </div>
                        <div className="text-rose-700 dark:text-rose-300 font-semibold">
                            <span className="font-semibold text-rose-800 dark:text-rose-400">실제:</span> {apiText}
                        </div>
                    </div>
                </div>
            );
        }

        // 2. 엑셀 기획안에는 내용이 없고(-), 실제 매체 데이터에는 값이 존재하는 경우
        const isNoExcelInput = diff.isNoExcelInput || ((excelText === '-' || excelText === '미입력' || excelText === '') && apiText !== '-' && apiText !== '' && apiText !== '미세팅');
        if (isNoExcelInput) {
            return (
                <div className="py-1 text-xs whitespace-normal min-w-[140px] max-w-[220px]">
                    <div className="text-[11px] text-zinc-400 dark:text-zinc-500 leading-snug">
                        <span className="text-[10px] text-zinc-400 font-semibold">계획:</span> -
                    </div>
                    <div className="text-[10px] text-amber-600 dark:text-amber-400 font-medium leading-snug flex items-center gap-1 mt-0.5">
                        <span className="truncate"><span className="text-zinc-400">실제:</span> {apiText}</span>
                        <span className="text-[9px] bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 px-1 py-0.2 rounded font-bold shrink-0">➖ 업로드 내용 없음</span>
                    </div>
                </div>
            );
        }

        // 3. 기획안과 매체 데이터 둘 다 비어있는 경우
        if ((excelText === '-' || excelText === '') && (apiText === '-' || apiText === '' || apiText === '미세팅')) {
            return (
                <div className="py-1 text-xs whitespace-normal min-w-[100px]">
                    <div className="text-[11px] text-zinc-400 dark:text-zinc-500 leading-snug">
                        <span className="text-[10px] text-zinc-400 font-semibold">계획:</span> -
                    </div>
                    <div className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium leading-snug flex items-center gap-1 mt-0.5">
                        <span><span className="text-zinc-400">실제:</span> -</span>
                        <span className="text-[9px] bg-zinc-100 dark:bg-zinc-800 text-zinc-500 px-1 py-0.2 rounded font-bold shrink-0">미세팅</span>
                    </div>
                </div>
            );
        }

        // 4. 정상 일치
        return (
            <div className="py-1 text-xs whitespace-normal min-w-[140px] max-w-[220px]">
                <div className="text-[11px] text-zinc-700 dark:text-zinc-300 leading-snug">
                    <span className="text-[10px] text-zinc-400 font-semibold">계획:</span> {excelText}
                </div>
                <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium leading-snug flex items-center gap-1 mt-0.5">
                    <span><span className="text-zinc-400">실제:</span> {apiText}</span>
                    <span className="text-[9px] bg-emerald-100 dark:bg-emerald-950/60 px-1 py-0.2 rounded font-bold shrink-0">✓ 일치</span>
                </div>
            </div>
        );
    };

    const renderDrawerDiffCard = (
        label: string,
        fieldKey: string,
        res: AuditResult | undefined,
        row: ParsedRow,
        isNumberFormatter?: boolean
    ) => {
        const diff = res?.fieldDiffs?.[fieldKey];
        const rawExcel = (row as unknown as Record<string, unknown>)[fieldKey];
        const excelText = diff?.excelVal || (isNumberFormatter && typeof rawExcel === 'number' && rawExcel > 0 ? rawExcel.toLocaleString() : String(rawExcel || '-'));
        const apiText = diff?.apiVal || '-';

        const hasExcelText = excelText && excelText !== '-' && excelText !== '미입력' && excelText.trim() !== '';
        const hasApiText = apiText && apiText !== '-' && apiText !== '미확인' && apiText !== '미세팅' && apiText.trim() !== '';

        let badge = <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">✓ 일치</span>;
        let cardBg = 'bg-zinc-50 dark:bg-zinc-800/60 border-zinc-200 dark:border-zinc-700/80';

        // 1. 엑셀 기획안 데이터는 작성되어 있는데 실제 API 데이터가 미세팅/미확인인 경우 ➔ 무조건 ❌ 불일치!
        if (hasExcelText && !hasApiText) {
            badge = <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300">❌ 매체 미세팅 (불일치)</span>;
            cardBg = 'bg-rose-50/70 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800';
        }
        // 2. 백엔드 diff에서 matched가 false로 명시되어 있는 경우 ➔ ❌ 불일치!
        else if (diff && !diff.matched) {
            badge = <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300">❌ 불일치</span>;
            cardBg = 'bg-rose-50/70 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800';
        } 
        // 3. 엑셀 기획안은 비어있으나 매체 API에는 데이터가 설정되어 있는 경우 ➔ ➖ 업로드 내용 없음
        else if (diff?.isNoExcelInput || (!hasExcelText && hasApiText)) {
            badge = <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300">➖ 업로드 내용 없음</span>;
            cardBg = 'bg-amber-50/70 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800';
        }
        // 4. 둘 다 비어있는 경우 ➔ 미세팅
        else if (!hasExcelText && !hasApiText) {
            badge = <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">미세팅</span>;
            cardBg = 'bg-zinc-50 dark:bg-zinc-800/60 border-zinc-200 dark:border-zinc-700/80';
        }

        return (
            <div className={`p-3 rounded-xl border ${cardBg} transition-all space-y-2`}>
                <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">{label}</span>
                    {badge}
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-zinc-200/60 dark:border-zinc-700/60">
                    <div>
                        <span className="text-[10px] text-zinc-400 block font-semibold">계획 (Excel 기획안)</span>
                        <span className="font-mono text-zinc-800 dark:text-zinc-200 text-[11px] whitespace-pre-wrap break-all">{excelText}</span>
                    </div>
                    <div>
                        <span className="text-[10px] text-zinc-400 block font-semibold">실제 (Live API 데이터)</span>
                        <span className="font-mono text-indigo-600 dark:text-indigo-400 text-[11px] font-semibold whitespace-pre-wrap break-all">{apiText}</span>
                    </div>
                </div>
            </div>
        );
    };

    const activeRow = activeDrawerRowIndex !== null ? rows[activeDrawerRowIndex] : null;
    const activeRes = activeDrawerRowIndex !== null ? results?.find(r => r.rowId === activeDrawerRowIndex) : undefined;

    return (
        <div className="flex-1 overflow-hidden flex flex-col gap-4">
            {rows.length === 0 ? (
                /* ── 빈 상태: 좌우 분할 인라인 레이아웃 ── */
                <div className="flex-1 flex gap-4 overflow-hidden min-h-0">

                    {/* ── 좌측: 업로드 존 + 다운로드 버튼 ── */}
                    <div className="w-72 shrink-0 flex flex-col gap-3">
                        {/* 업로드 드래그 존 */}
                        <div
                            className={`flex-1 border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-4 p-6 transition-all cursor-pointer ${isDragOver
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
                        {/* 지면 가이드 파업 버튼 */}
                        <button
                            onClick={(e) => { e.stopPropagation(); setShowPlacementGuide(v => !v); }}
                            className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold border rounded-xl transition-colors ${showPlacementGuide
                                    ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300'
                                    : 'border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700'
                                }`}
                        >
                            <Map className="w-4 h-4" />
                            지면 가이드 {showPlacementGuide ? '닫기' : '보기'}
                        </button>

                        {showPlacementGuide && (
                            <div className="bg-white dark:bg-zinc-900 border border-indigo-200 dark:border-indigo-800/50 rounded-xl p-3 text-xs space-y-2 shadow-md">
                                <p className="font-bold text-indigo-700 dark:text-indigo-300 flex items-center gap-1">📌 엑셀 지면 키워드 초단본</p>
                                <div className="space-y-1">
                                    {[
                                        { kw: '기본 설정', api: 'facebook_feed' },
                                        { kw: '페이스북 (피드)', api: 'facebook_feed' },
                                        { kw: '페이스북 (스토리)', api: 'facebook_story' },
                                        { kw: '페이스북 (릴스)', api: 'facebook_reels' },
                                        { kw: '인스타그램 (스트림)', api: 'instagram_stream' },
                                        { kw: '인스타그램 (스토리)', api: 'instagram_story' },
                                        { kw: '인스타그램 (릴스)', api: 'instagram_reels' },
                                    ].map(({ kw, api }) => (
                                        <div key={kw} className="flex items-center gap-2">
                                            <code className="px-1.5 py-0.5 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 rounded font-mono text-[10px] border border-indigo-200 dark:border-indigo-800/50 whitespace-nowrap">{kw}</code>
                                            <span className="text-zinc-400">→</span>
                                            <code className="text-zinc-400 font-mono text-[10px] truncate">{api}</code>
                                        </div>
                                    ))}
                                </div>
                                <a href="/dictionary" target="_blank" rel="noopener noreferrer"
                                    className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-semibold hover:underline mt-1">
                                    <ExternalLink className="w-3 h-3" /> 전체 지면 가이드 보기
                                </a>
                            </div>
                        )}

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
                                    <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">25개 표준 컬럼 가이드</h3>
                                    <p className="text-[11px] text-zinc-400 mt-0.5">17~19번(소재 검수 ver2)은 선택 입력입니다</p>
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
                                            className={`transition-colors ${col.needsDictionary
                                                    ? 'bg-amber-50/60 dark:bg-amber-950/20 hover:bg-amber-50 dark:hover:bg-amber-950/30'
                                                    : 'bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800/40'
                                                }`}
                                        >
                                            <td className="px-3 py-2 text-center text-xs font-mono text-zinc-400">{col.no}</td>
                                            <td className="px-3 py-2">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className={`font-semibold text-xs ${col.needsDictionary ? 'text-amber-800 dark:text-amber-300' : 'text-zinc-800 dark:text-zinc-200'
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
                            <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-lg border border-zinc-200 dark:border-zinc-700">
                                <button onClick={() => setViewMode('ver1')}
                                    className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${viewMode === 'ver1'
                                            ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm'
                                            : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
                                        }`}>
                                    캠페인 세팅 내역서 (ver1)
                                </button>
                                <button onClick={() => setViewMode('ver2')}
                                    className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${viewMode === 'ver2'
                                            ? 'bg-indigo-600 text-white shadow-sm'
                                            : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
                                        }`}>
                                    소재 참조 세부 내역서 (ver2)
                                </button>
                            </div>
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
                        {/* 검수 결과가 있을 경우의 요약 테이블 (results) */}
                        {results ? (
                            <table className="w-full text-xs text-left">
                                <thead className="text-[11px] text-zinc-500 font-semibold bg-zinc-100 dark:bg-zinc-800/80 border-b border-zinc-200 dark:border-zinc-800 uppercase">
                                    <tr>
                                        <th className="px-4 py-3 text-center w-12">#</th>
                                        <th className="px-4 py-3">매체</th>
                                        <th className="px-4 py-3">팀명</th>
                                        <th className="px-4 py-3 font-mono">계정 ID</th>
                                        <th className="px-4 py-3">캠페인명</th>
                                        <th className="px-4 py-3">광고 세트명</th>
                                        <th className="px-4 py-3 text-center">검수 결과</th>
                                        <th className="px-4 py-3 text-center">상세</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                                    {rows.map((row, i) => {
                                        const res = results.find(r => r.rowId === i);
                                        return (
                                            <tr key={i} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                                                <td className="px-4 py-3 text-center font-mono text-zinc-400">{i + 1}</td>
                                                <td className="px-4 py-3">
                                                    <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${row.Platform?.toLowerCase().includes('meta') ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>
                                                        {row.Platform || '미상'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 font-medium text-zinc-800 dark:text-zinc-200">{row.Team}</td>
                                                <td className="px-4 py-3 font-mono text-zinc-500 text-[10px]">{row.AccountID}</td>
                                                <td className="px-4 py-3 font-semibold text-zinc-900 dark:text-zinc-100">{row.CampaignName}</td>
                                                <td className="px-4 py-3 text-indigo-600 dark:text-indigo-400 font-medium">{row.AdSetName}</td>
                                                <td className="px-4 py-3 text-center">
                                                    {res?.status === 'PASS' ? (
                                                        <span className="inline-flex items-center gap-1 text-emerald-600 font-bold bg-emerald-100 dark:bg-emerald-900/30 px-2.5 py-1 rounded-full text-xs shadow-sm"><CheckCircle2 className="w-3.5 h-3.5" /> PASS</span>
                                                    ) : res?.status === 'FAIL' ? (
                                                        <span className="inline-flex items-center gap-1 text-rose-600 font-bold bg-rose-100 dark:bg-rose-900/30 px-2.5 py-1 rounded-full text-xs shadow-sm"><AlertCircle className="w-3.5 h-3.5" /> FAIL</span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 text-orange-600 font-bold bg-orange-100 dark:bg-orange-900/30 px-2.5 py-1 rounded-full text-xs shadow-sm"><AlertCircle className="w-3.5 h-3.5" /> WARN</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <button
                                                        onClick={() => setActiveDrawerRowIndex(i)}
                                                        className="px-3 py-1 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded text-xs font-bold text-zinc-600 dark:text-zinc-400"
                                                    >
                                                        상세
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        ) : (
                            <table className="w-full text-left text-xs whitespace-nowrap">
                                <thead className="bg-zinc-100 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-400 sticky top-0 border-b border-zinc-200 dark:border-zinc-800 z-10 shadow-sm">
                                    <tr>
                                        <th className="px-4 py-3 font-medium text-center bg-zinc-100 dark:bg-zinc-800/80">No</th>
                                        <th className="px-4 py-3 font-medium bg-zinc-100 dark:bg-zinc-800/80 text-center">검수 결과</th>
                                        <th className="px-4 py-3 font-medium bg-zinc-200/50 dark:bg-zinc-700/50">매체</th>
                                        <th className="px-4 py-3 font-medium bg-zinc-200/50 dark:bg-zinc-700/50">팀명</th>
                                        <th className="px-4 py-3 font-medium bg-zinc-200/50 dark:bg-zinc-700/50">계정 ID</th>
                                        <th className="px-4 py-3 font-medium bg-blue-50 dark:bg-blue-900/20">캠페인 ID</th>
                                        <th className="px-4 py-3 font-medium bg-blue-50 dark:bg-blue-900/20">캠페인명</th>
                                        {viewMode === 'ver1' && <>
                                            <th className="px-4 py-3 font-medium bg-blue-50 dark:bg-blue-900/20 text-center">통화</th>
                                            <th className="px-4 py-3 font-medium bg-blue-50 dark:bg-blue-900/20 text-right">캠페인 일 예산</th>
                                            <th className="px-4 py-3 font-medium bg-blue-50 dark:bg-blue-900/20 text-right">캠페인 예산</th>
                                            <th className="px-4 py-3 font-medium bg-zinc-200/50 dark:bg-zinc-700/50">시작일</th>
                                            <th className="px-4 py-3 font-medium bg-zinc-200/50 dark:bg-zinc-700/50">종료일</th>
                                        </>}
                                        <th className="px-4 py-3 font-medium bg-indigo-50 dark:bg-indigo-900/20">광고 세트명</th>
                                        {viewMode === 'ver1' && <>
                                            <th className="px-4 py-3 font-medium bg-indigo-50 dark:bg-indigo-900/20 text-right">세트 일 예산</th>
                                            <th className="px-4 py-3 font-medium bg-indigo-50 dark:bg-indigo-900/20 text-right">세트 예산</th>
                                            <th className="px-4 py-3 font-medium bg-blue-50 dark:bg-blue-900/20">캠페인 목적</th>
                                            <th className="px-4 py-3 font-medium bg-blue-50 dark:bg-blue-900/20">구매 유형</th>
                                        </>}
                                        <th className="px-4 py-3 font-medium bg-emerald-50 dark:bg-emerald-900/20">광고명</th>
                                        {viewMode === 'ver2' && <>
                                            <th className="px-4 py-3 font-medium bg-violet-50 dark:bg-violet-900/20">헤드라인</th>
                                            <th className="px-4 py-3 font-medium bg-violet-50 dark:bg-violet-900/20">본문 카피</th>
                                            <th className="px-4 py-3 font-medium bg-violet-50 dark:bg-violet-900/20">CTA</th>
                                        </>}
                                        <th className="px-4 py-3 font-medium bg-emerald-50 dark:bg-emerald-900/20">랜딩 URL</th>
                                        <th className="px-4 py-3 font-medium bg-emerald-50 dark:bg-emerald-900/20">UTM 파라미터</th>
                                        <th className="px-4 py-3 font-medium bg-indigo-50 dark:bg-indigo-900/20">최적화 목표</th>
                                        <th className="px-4 py-3 font-medium bg-indigo-50 dark:bg-indigo-900/20">과금 기준</th>
                                        <th className="px-4 py-3 font-medium bg-indigo-50 dark:bg-indigo-900/20">픽셀/이벤트</th>
                                        <th className="px-4 py-3 font-medium bg-indigo-50 dark:bg-indigo-900/20">이벤트 유형</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                                    {rows.map((row, i) => (
                                        <tr key={i} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                                            <td className="px-4 py-3 text-center text-zinc-500 font-mono">{i + 1}</td>
                                            <td className="px-4 py-3 text-center">
                                                <span className="text-zinc-400 font-medium">- 대기 -</span>
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

                                            {viewMode === 'ver1' && <>
                                                <td className="px-4 py-3 text-center font-bold bg-blue-50/20 dark:bg-blue-900/10">{row.Currency || '-'}</td>
                                                <td className="px-4 py-3 text-right bg-blue-50/20 dark:bg-blue-900/10">{row.CampaignDailyBudget ? row.CampaignDailyBudget.toLocaleString() : '-'}</td>
                                                <td className="px-4 py-3 text-right bg-blue-50/20 dark:bg-blue-900/10">{row.CampaignLifetimeBudget ? row.CampaignLifetimeBudget.toLocaleString() : '-'}</td>
                                                <td className="px-4 py-3 bg-zinc-50/50 dark:bg-zinc-800/30">{row.StartDate || '-'}</td>
                                                <td className="px-4 py-3 bg-zinc-50/50 dark:bg-zinc-800/30">{row.EndDate || '-'}</td>
                                            </>}

                                            <td className="px-4 py-3 text-indigo-700 dark:text-indigo-300 font-medium max-w-[150px] truncate bg-indigo-50/20 dark:bg-indigo-900/10" title={row.AdSetName}>{row.AdSetName}</td>

                                            {viewMode === 'ver1' && <>
                                                <td className="px-4 py-3 text-right bg-indigo-50/20 dark:bg-indigo-900/10">{row.AdSetDailyBudget ? row.AdSetDailyBudget.toLocaleString() : '-'}</td>
                                                <td className="px-4 py-3 text-right bg-indigo-50/20 dark:bg-indigo-900/10">{row.AdSetLifetimeBudget ? row.AdSetLifetimeBudget.toLocaleString() : '-'}</td>
                                                <td className="px-4 py-3 bg-blue-50/20 dark:bg-blue-900/10">{row.CampaignObjective || '-'}</td>
                                                <td className="px-4 py-3 bg-blue-50/20 dark:bg-blue-900/10">{row.CampaignBuyingType || '-'}</td>
                                            </>}

                                            <td className="px-4 py-3 font-semibold text-zinc-900 dark:text-zinc-200 max-w-[150px] truncate bg-emerald-50/20 dark:bg-emerald-900/10">{row.AdName || '-'}</td>

                                            {viewMode === 'ver2' && <>
                                                <td className="px-4 py-3 max-w-[150px] truncate bg-violet-50/20 dark:bg-violet-900/10">{row.Headline || '-'}</td>
                                                <td className="px-4 py-3 max-w-[150px] truncate bg-violet-50/20 dark:bg-violet-900/10">{row.BodyCopy || '-'}</td>
                                                <td className="px-4 py-3 bg-violet-50/20 dark:bg-violet-900/10">{row.CTA || '-'}</td>
                                            </>}

                                            <td className="px-4 py-3 max-w-[150px] truncate bg-emerald-50/20 dark:bg-emerald-900/10">{row.LandingURL || '-'}</td>
                                            <td className="px-4 py-3 max-w-[150px] truncate bg-emerald-50/20 dark:bg-emerald-900/10">{row.UTMParameters || '-'}</td>

                                            <td className="px-4 py-3 bg-indigo-50/20 dark:bg-indigo-900/10">{row.AdSetOptimizationGoal || '-'}</td>
                                            <td className="px-4 py-3 bg-indigo-50/20 dark:bg-indigo-900/10">{row.AdSetBillingEvent || '-'}</td>
                                            <td className="px-4 py-3 bg-indigo-50/20 dark:bg-indigo-900/10">{row.PixelID || '-'}</td>
                                            <td className="px-4 py-3 bg-indigo-50/20 dark:bg-indigo-900/10">{row.CustomEventType || '-'}</td>
                                         </tr>
                                     ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}

            {/* ──────────────────────────────────────────────────────── */}
            {/* SLIDE-OVER DRAWER (우측 상세 서랍 팝업 - ver1 vs ver2 차별화 모달) */}
            {/* ──────────────────────────────────────────────────────── */}
            {activeRow && (
                <div 
                    className="fixed inset-0 z-[9999] overflow-hidden bg-black/60 backdrop-blur-xs flex justify-end animate-in fade-in duration-200"
                    onClick={() => setActiveDrawerRowIndex(null)}
                >
                    <div 
                        className="w-full max-w-2xl bg-white dark:bg-zinc-900 h-full shadow-2xl flex flex-col border-l border-zinc-200 dark:border-zinc-800 animate-in slide-in-from-right duration-300"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Drawer Header */}
                        <div className="p-5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/90 dark:bg-zinc-900/90">
                            <div>
                                <span className={`text-[11px] font-extrabold px-2.5 py-1 rounded-full ${
                                    viewMode === 'ver1' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300' : 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300'
                                }`}>
                                    {viewMode === 'ver1' ? '📌 ver1 캠페인 세팅 내역서 정밀 리포트' : '🎨 ver2 소재 참조 세부 내역서 정밀 리포트'}
                                </span>
                                <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-50 mt-2 flex items-center gap-2">
                                    {activeRow.AdName || activeRow.AdSetName}
                                </h3>
                                <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate max-w-lg mt-0.5 font-mono">
                                    캠페인: {activeRow.CampaignName} (계정 ID: {activeRow.AccountID})
                                </p>
                            </div>
                            <button
                                onClick={() => setActiveDrawerRowIndex(null)}
                                className="p-2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-xl hover:bg-zinc-200/50 dark:hover:bg-zinc-800 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Drawer Body - ver1 vs ver2 탭 모드별 핵심 정보 우선 배치 */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">

                            {/* 검수 알림 & 경고 배너 박스 (동명 캠페인 경고 메시지 포함) */}
                            {activeRes?.errors && activeRes.errors.length > 0 && (
                                <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 space-y-2 shadow-xs">
                                    <h4 className="text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                                        <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                                        검수 알림 & 스마트 경고 리포트 ({activeRes.errors.length}건)
                                    </h4>
                                    <ul className="space-y-1.5 pl-5 list-disc text-xs text-amber-900 dark:text-amber-200 font-medium">
                                        {activeRes.errors.map((err, idx) => (
                                            <li key={idx} className="leading-relaxed">{err}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* ── MODE 1: ver1 선택 시 (캠페인 및 예산/일정 중심 리포트) ── */}
                            {viewMode === 'ver1' ? (
                                <>
                                    <div className="space-y-3">
                                        <h4 className="text-xs font-extrabold text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5 border-b border-indigo-100 dark:border-indigo-900/50 pb-2">
                                            <span className="w-5 h-5 bg-indigo-600 text-white rounded-full text-[11px] flex items-center justify-center font-bold">1</span>
                                            [ver1 핵심] 캠페인 예산 / 일정 / 목적 설정 대조
                                        </h4>
                                        <div className="grid grid-cols-2 gap-3">
                                            {renderDrawerDiffCard('통화 (Currency)', 'Currency', activeRes, activeRow)}
                                            {renderDrawerDiffCard('시작일 (StartDate)', 'StartDate', activeRes, activeRow)}
                                            {renderDrawerDiffCard('종료일 (EndDate)', 'EndDate', activeRes, activeRow)}
                                            {renderDrawerDiffCard('캠페인 목적 (Objective)', 'CampaignObjective', activeRes, activeRow)}
                                            {renderDrawerDiffCard('구매 유형 (BuyingType)', 'CampaignBuyingType', activeRes, activeRow)}
                                            {renderDrawerDiffCard('캠페인 일 예산', 'CampaignDailyBudget', activeRes, activeRow, true)}
                                            {renderDrawerDiffCard('캠페인 총 예산', 'CampaignLifetimeBudget', activeRes, activeRow, true)}
                                            {renderDrawerDiffCard('세트 일 예산', 'AdSetDailyBudget', activeRes, activeRow, true)}
                                            {renderDrawerDiffCard('세트 총 예산', 'AdSetLifetimeBudget', activeRes, activeRow, true)}
                                        </div>
                                    </div>

                                    <div className="space-y-3 pt-2">
                                        <h4 className="text-xs font-bold text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5 border-b border-zinc-100 dark:border-zinc-800 pb-2">
                                            <span className="w-5 h-5 bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-full text-[11px] flex items-center justify-center font-bold">2</span>
                                            연동 타겟 및 소재 정보 보조 확인
                                        </h4>
                                        <div className="space-y-2">
                                            {renderDrawerDiffCard('랜딩 URL', 'LandingURL', activeRes, activeRow)}
                                            {renderDrawerDiffCard('UTM 파라미터', 'UTMParameters', activeRes, activeRow)}
                                        </div>
                                    </div>
                                </>
                            ) : (
                                /* ── MODE 2: ver2 선택 시 (광고 소재 문구 및 Multi-Placement URL/UTM 중심 리포트) ── */
                                <>
                                    <div className="space-y-3">
                                        <h4 className="text-xs font-extrabold text-violet-600 dark:text-violet-400 flex items-center gap-1.5 border-b border-violet-100 dark:border-violet-900/50 pb-2">
                                            <span className="w-5 h-5 bg-violet-600 text-white rounded-full text-[11px] flex items-center justify-center font-bold">1</span>
                                            [ver2 핵심] 광고 소재 문구 & 카피라이팅 1:1 대조
                                        </h4>
                                        <div className="space-y-3">
                                            {renderDrawerDiffCard('헤드라인 문구 (Headline)', 'Headline', activeRes, activeRow)}
                                            {renderDrawerDiffCard('기본 본문 카피 (BodyCopy)', 'BodyCopy', activeRes, activeRow)}
                                            {renderDrawerDiffCard('행동유도 (CTA 버튼)', 'CTA', activeRes, activeRow)}
                                        </div>
                                    </div>

                                    <div className="space-y-3 pt-2">
                                        <h4 className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 border-b border-emerald-100 dark:border-emerald-900/50 pb-2">
                                            <span className="w-5 h-5 bg-emerald-600 text-white rounded-full text-[11px] flex items-center justify-center font-bold">2</span>
                                            [ver2 핵심] 노출 지면별 맞춤 URL (`[지면명]`) & UTM / 픽셀 검수
                                        </h4>
                                        <div className="space-y-3">
                                            {renderDrawerDiffCard('Multi-Placement 랜딩 URL', 'LandingURL', activeRes, activeRow)}
                                            {renderDrawerDiffCard('UTM 파라미터', 'UTMParameters', activeRes, activeRow)}
                                        </div>
                                        <div className="grid grid-cols-2 gap-3 mt-3">
                                            {renderDrawerDiffCard('최적화 목표', 'AdSetOptimizationGoal', activeRes, activeRow)}
                                            {renderDrawerDiffCard('과금 기준', 'AdSetBillingEvent', activeRes, activeRow)}
                                            {renderDrawerDiffCard('픽셀 ID', 'PixelID', activeRes, activeRow)}
                                            {renderDrawerDiffCard('이벤트 유형', 'CustomEventType', activeRes, activeRow)}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Drawer Footer */}
                        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
                            <button
                                onClick={() => setActiveDrawerRowIndex(null)}
                                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-[0.99] cursor-pointer"
                            >
                                검수 리포트 확인 완료
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
