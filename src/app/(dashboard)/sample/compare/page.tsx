'use client';

import { useState } from 'react';
import {
    Lock, Clock, Activity, BarChart3, UploadCloud, BookOpen, Sparkles, RefreshCw,
    Loader2, FileText, RotateCcw, X, Eye, ToggleLeft, Layers, Info, AlertCircle
} from 'lucide-react';

type RequiredType = '필수' | '조건부' | '선택';

interface ColumnMeta {
    no: number;
    name: string;
    required: RequiredType;
    description: string;
}

const COLUMN_META: ColumnMeta[] = [
    { no: 1,  name: '매체',            required: '필수',   description: 'Meta 또는 Google Ads 입력' },
    { no: 2,  name: '팀명',            required: '필수',   description: '소속 팀명 (예: 퍼포먼스팀)' },
    { no: 3,  name: '계정 ID',         required: '필수',   description: '매체 광고 계정 ID (숫자 그대로 입력)' },
    { no: 4,  name: '캠페인 ID',       required: '선택',   description: '비워두면 캠페인명 기준으로 조회' },
    { no: 5,  name: '캠페인명',        required: '필수',   description: '실제 매체에 등록된 캠페인 이름' },
    { no: 6,  name: '통화',            required: '필수',   description: 'ISO 4217 코드 (KRW, USD, JPY 등)' },
    { no: 7,  name: '캠페인 일 예산',  required: '조건부', description: '캠페인 예산(8번)과 둘 중 하나 필수' },
    { no: 8,  name: '캠페인 예산',     required: '조건부', description: '캠페인 일 예산(7번)과 둘 중 하나 필수' },
    { no: 9,  name: '시작일',          required: '필수',   description: 'YYYY-MM-DD 형식 (예: 2024-04-01)' },
    { no: 10, name: '종료일',          required: '필수',   description: 'YYYY-MM-DD 형식 (예: 2024-04-30)' },
    { no: 11, name: '광고 세트명',     required: '필수',   description: '실제 매체에 등록된 광고 세트/그룹명' },
    { no: 12, name: '광고 세트 일 예산', required: '조건부', description: '광고 세트 예산(13번)과 둘 중 하나' },
    { no: 13, name: '광고 세트 예산',  required: '조건부', description: '광고 세트 일 예산(12번)과 둘 중 하나' },
    { no: 14, name: '캠페인 목적',     required: '필수',   description: 'API 코드 또는 한글 기입 (예: 트래픽 / OUTCOME_TRAFFIC)' },
    { no: 15, name: '구매 유형',       required: '필수',   description: 'API 코드 또는 한글 기입 (예: 경매 / AUCTION)' },
    { no: 16, name: '광고명',          required: '선택',   description: '광고 소재명 (없어도 검수 가능)' },
    { no: 17, name: '랜딩 URL',        required: '선택',   description: '광고 클릭 시 이동되는 랜딩 페이지 URL' },
    { no: 18, name: 'UTM 파라미터',    required: '선택',   description: 'utm_source=fb&utm_medium=cpa 형식' },
    { no: 19, name: '최적화 목표',     required: '필수',   description: 'API 코드 또는 한글 기입 (예: 전환 / CONVERSIONS)' },
    { no: 20, name: '과금 기준',       required: '필수',   description: 'API 코드 또는 한글 기입 (예: 노출 / IMPRESSIONS)' },
    { no: 21, name: '픽셀/이벤트',     required: '선택',   description: '픽셀 ID 또는 이벤트 이름 입력' },
    { no: 22, name: '이벤트 유형',     required: '선택',   description: '표준 이벤트명 또는 사용자 지정 이벤트명 입력' },
];

interface AuditDetail {
    excel: string;
    api: string;
    status: 'PASS' | 'FAIL';
    message?: string;
}

interface PlacementUrlDetail {
    placement: string;
    excel: string;
    api: string;
    status: 'PASS' | 'FAIL';
    message?: string;
}

interface MockAuditResult {
    id: number;
    platform: string;
    campaignName: string;
    adName: string;
    status: 'PASS' | 'FAIL' | 'WARNING';
    campaignBudget: AuditDetail;
    startDate: AuditDetail;
    headline: AuditDetail;
    body: AuditDetail;
    cta: AuditDetail;
    placementUrls: PlacementUrlDetail[];
}

const MOCK_AUDIT_RESULTS: MockAuditResult[] = [
    {
        id: 1,
        platform: 'Google',
        campaignName: '2607_핑거요_7/2-7/31_VVC',
        adName: '핑거요_메인_영상_A',
        status: 'PASS',
        campaignBudget: { excel: '₩500,000 (일 예산)', api: '₩500,000 (일 예산)', status: 'PASS' },
        startDate: { excel: '2026-07-02', api: '2026-07-02', status: 'PASS' },
        headline: { excel: '스마트한 손가락 운동, 핑거요', api: '스마트한 손가락 운동, 핑거요', status: 'PASS' },
        body: { excel: '하루 10분, 건강한 손을 위한 첫걸음 핑거요와 함께하세요.', api: '하루 10분, 건강한 손을 위한 첫걸음 핑거요와 함께하세요.', status: 'PASS' },
        cta: { excel: '지금 가입하기', api: '지금 가입하기', status: 'PASS' },
        placementUrls: [
            { placement: '구글 YouTube 피드', excel: 'https://fingeryo.com/main?utm_source=google&utm_medium=video', api: 'https://fingeryo.com/main?utm_source=google&utm_medium=video', status: 'PASS' }
        ]
    },
    {
        id: 2,
        platform: 'Meta',
        campaignName: 'HQ-MS-Seeding_MS_TV_DE_26_Q3_HSAD_OLED-G6-Banner',
        adName: 'OLED-G6_Space_4x5',
        status: 'FAIL',
        campaignBudget: { excel: '₩1,500,000 (총 예산)', api: '₩1,000,000 (총 예산)', status: 'FAIL', message: '예산 차이 ₩500,000 감지' },
        startDate: { excel: '2026-07-01', api: '2026-07-01', status: 'PASS' },
        headline: { excel: 'OLED evo G6: Space Innovation', api: 'OLED evo G6: Innovation Space', status: 'FAIL', message: '헤드라인 문구 상이' },
        body: { excel: '독보적인 화질, 공간을 혁신하는 OLED evo G6를 만나보세요.', api: '독보적인 화질, 공간을 혁신하는 OLED evo G6를 만나보세요.', status: 'PASS' },
        cta: { excel: '더 알아보기', api: '더 알아보기', status: 'PASS' },
        placementUrls: [
            { placement: '페이스북 피드', excel: 'https://www.lg.com/de/g6?utm_source=facebook&utm_medium=feed', api: 'https://www.lg.com/de/g6?utm_source=facebook&utm_medium=feed', status: 'PASS' },
            { placement: '인스타그램 피드', excel: 'https://www.lg.com/de/g6?utm_source=instagram&utm_medium=feed', api: 'https://www.lg.com/de/g6?utm_source=instagram&utm_medium=feed', status: 'PASS' }
        ]
    },
    {
        id: 3,
        platform: 'Meta',
        campaignName: 'HQ-MS-Seeding_MS_TV_DE_26_Q3_HSAD_OLED-G6-Video',
        adName: 'OLED-G6_Motion_16x9',
        status: 'WARNING',
        campaignBudget: { excel: '₩2,000,000 (총 예산)', api: '₩2,000,000 (총 예산)', status: 'PASS' },
        startDate: { excel: '2026-07-01', api: '2026-07-01', status: 'PASS' },
        headline: { excel: 'OLED evo G6: Motion Quality', api: 'OLED evo G6: Motion Quality', status: 'PASS' },
        body: { excel: '초고화질로 생동감을 더하는 무한 대조비.', api: '초고화질로 생동감을 더하는 무한 대조비.', status: 'PASS' },
        cta: { excel: '더 알아보기', api: '지금 구매하기', status: 'FAIL', message: '행동유도(CTA) 버튼 문구 불일치' },
        placementUrls: [
            { placement: '페이스북 피드', excel: 'https://www.lg.com/de/g6?utm_source=facebook&utm_medium=feed', api: 'https://www.lg.com/de/g6?utm_source=facebook&utm_medium=feed', status: 'PASS' },
            { placement: '인스타그램 스토리', excel: 'https://www.lg.com/de/g6?utm_source=instagram&utm_medium=story', api: 'https://www.lg.com/de/g6?utm_source=facebook&utm_medium=story', status: 'FAIL', message: '인스타그램 스토리에 페이스북 UTM 매핑됨' }
        ]
    }
];

export default function UIComparePage() {
    const [auditState, setAuditState] = useState<'upload' | 'loading' | 'results'>('results');
    const [loadingProgress, setLoadingProgress] = useState(0);
    const [loadingLog, setLoadingLog] = useState('');
    
    // UI Compare States
    const [selectedDesignOption, setSelectedDesignOption] = useState<'A' | 'B'>('A');
    const [activeDrawerRow, setActiveDrawerRow] = useState<MockAuditResult | null>(MOCK_AUDIT_RESULTS[1]);
    const [optionBToggleMode, setOptionBToggleMode] = useState<'simple' | 'detail'>('simple');

    const runAuditSimulation = () => {
        setAuditState('loading');
        setLoadingProgress(0);
        setLoadingLog('📂 통합 표준 미디어믹스(Excel) 파싱 중...');
        
        const logs = [
            { pct: 25, log: '🔑 Meta Ads API 호출 중... (act_1267556304705160)' },
            { pct: 55, log: '🔑 Google Ads API 호출 중... (MCC: 186-506-8142)' },
            { pct: 80, log: '🔍 미디어믹스 세팅 값 vs 매체 라이브 세팅 정밀 대조 중...' },
            { pct: 100, log: '✨ 크로스 체크 분석 완료. 분석 결과서를 생성합니다.' }
        ];

        let index = 0;
        const interval = setInterval(() => {
            if (index < logs.length) {
                setLoadingProgress(logs[index].pct);
                setLoadingLog(logs[index].log);
                index++;
            } else {
                clearInterval(interval);
                setTimeout(() => {
                    setAuditState('results');
                    setActiveDrawerRow(MOCK_AUDIT_RESULTS[1]);
                }, 600);
            }
        }, 600);
    };

    const resetAudit = () => {
        setAuditState('upload');
        setLoadingProgress(0);
        setLoadingLog('');
        setActiveDrawerRow(null);
    };

    return (
        <div className="space-y-6 pb-16 animate-in fade-in duration-500 relative">
            {/* Header */}
            <div className="pb-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-950 dark:text-zinc-50 flex items-center gap-2">
                        🎨 다중 URL 검수 UI 설계안 비교 검토
                    </h1>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                        다중 지면별 URL/UTM 및 소재 상세 대조 결과(ver2)를 화면에 렌더링하는 두 가지 대안을 비교하고 의사결정하기 위한 전용 테스트베드 페이지입니다.
                    </p>
                </div>
                <a 
                    href="/sample" 
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-xl text-xs font-bold transition-all border border-zinc-200 dark:border-zinc-800 shrink-0"
                >
                    ◀ 게스트 체험관 돌아가기
                </a>
            </div>

            {/* Compare Selector Banner */}
            <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-2xl p-6 shadow-md flex flex-col md:flex-row items-center justify-between gap-6 border border-indigo-950">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-indigo-400" />
                        <h3 className="text-base font-bold">💡 검수 결과 UI 설계안 비교 (대안 A vs 대안 B)</h3>
                    </div>
                    <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
                        상세 검수 항목이 늘어남에 따라 발생할 수 있는 테이블 복잡성 문제를 해결하기 위한 두 가지 인터랙션 설계안입니다. 
                        직접 클릭하고 화면을 조작하여 실제 서비스 적용 시의 사용성을 검토해보세요.
                    </p>
                </div>
                <div className="flex items-center gap-2 bg-slate-800/80 p-1.5 rounded-xl border border-slate-700/60 shadow-inner shrink-0">
                    <button
                        onClick={() => { setSelectedDesignOption('A'); setActiveDrawerRow(MOCK_AUDIT_RESULTS[1]); }}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                            selectedDesignOption === 'A'
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : 'text-slate-400 hover:text-slate-200'
                        }`}
                    >
                        <Layers className="w-3.5 h-3.5" />
                        대안 A (우측 Drawer)
                    </button>
                    <button
                        onClick={() => { setSelectedDesignOption('B'); setActiveDrawerRow(null); }}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                            selectedDesignOption === 'B'
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : 'text-slate-400 hover:text-slate-200'
                        }`}
                    >
                        <ToggleLeft className="w-3.5 h-3.5" />
                        대안 B (간편/상세 토글)
                    </button>
                </div>
            </div>

            {auditState === 'upload' && (
                <div className="border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-2xl p-12 bg-zinc-50/50 dark:bg-zinc-900/40 text-center flex flex-col items-center justify-center min-h-[300px]">
                    <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center mb-4">
                        <UploadCloud className="w-6 h-6" />
                    </div>
                    <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">검수 시뮬레이터 준비 완료</h3>
                    <p className="text-xs text-zinc-400 mt-1 mb-6 max-w-sm">
                        비교용 샘플 데이터를 다시 주입하여 정합성 대조 프로세스를 시뮬레이션할 수 있습니다.
                    </p>
                    <button
                        onClick={runAuditSimulation}
                        className="flex items-center justify-center gap-2 py-2.5 px-6 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-md transition-all hover:scale-[1.02]"
                    >
                        ✨ 시뮬레이션 실행 및 데이터 로드
                    </button>
                </div>
            )}

            {auditState === 'loading' && (
                <div className="min-h-[300px] border border-zinc-200 dark:border-zinc-800 rounded-2xl flex flex-col items-center justify-center bg-zinc-50/30 dark:bg-zinc-900/30 p-8">
                    <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-4" />
                    <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">정합성 검증 시뮬레이션 중...</h3>
                    <div className="w-full max-w-md bg-zinc-200 dark:bg-zinc-800 h-1 rounded-full overflow-hidden mt-6 mb-4">
                        <div className="h-full bg-indigo-600 rounded-full transition-all duration-300" style={{ width: `${loadingProgress}%` }}></div>
                    </div>
                    <div className="bg-zinc-900 text-zinc-200 font-mono text-[10px] p-3 rounded-lg w-full max-w-md border border-zinc-800 h-20 overflow-y-auto">
                        {loadingLog}
                    </div>
                </div>
            )}

            {auditState === 'results' && (
                <div className="space-y-6">
                    {/* Summary Info */}
                    <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 rounded-full flex items-center justify-center flex-shrink-0">
                                <AlertCircle className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">정합성 검수 결과 (모의 테스트 데이터)</h3>
                                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">총 3개 광고 검수 완료 (불일치 2건, 정상 1건)</p>
                            </div>
                        </div>
                        <button 
                            onClick={resetAudit}
                            className="flex items-center gap-1.5 py-2 px-3 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 rounded-xl text-xs font-semibold text-zinc-700 dark:text-zinc-300 transition-colors shrink-0"
                        >
                            <RotateCcw className="w-3.5 h-3.5" />
                            초기 상태로 변경
                        </button>
                    </div>

                    {/* ──────────────────────────────────────────────────────── */}
                    {/* RENDERING: 대안 A (점진적 공개 - Drawer 방식) */}
                    {/* ──────────────────────────────────────────────────────── */}
                    {selectedDesignOption === 'A' && (
                        <div className="space-y-4">
                            <div className="p-4 bg-indigo-50/50 dark:bg-indigo-950/10 border border-indigo-100 dark:border-indigo-900/30 rounded-xl text-xs text-indigo-700 dark:text-indigo-400 leading-relaxed flex items-start gap-2">
                                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                                <div>
                                    <span className="font-bold">대안 A (우측 Drawer 방식)의 작동 원리:</span>
                                    <p className="mt-1">
                                        1. 메인 결과 테이블은 ver1 사양으로 유지하여 가로 폭이 깔끔하며 가로 스크롤이 발생하지 않습니다.<br />
                                        2. 광고의 세부 셋팅(헤드라인, 본문 카피, 행동유도, 지면별 맞춤 URL 등)은 행을 클릭하거나 <strong>[상세 보기]</strong> 버튼을 누르면 우측에서 슬라이드 오픈되는 **상세 서랍(Drawer)**을 통해 독립적으로 대조합니다.
                                    </p>
                                    <p className="mt-2 font-semibold text-indigo-800 dark:text-indigo-300">👉 표에서 광고 행을 클릭하여 우측 상세 서랍의 내용이 변경되는지 테스트해보세요.</p>
                                </div>
                            </div>

                            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
                                <table className="w-full text-xs text-left">
                                    <thead className="text-[10px] text-zinc-500 uppercase bg-zinc-50 dark:bg-zinc-900/60 font-semibold border-b border-zinc-200 dark:border-zinc-800">
                                        <tr>
                                            <th className="px-4 py-3 text-center w-12">#</th>
                                            <th className="px-4 py-3 w-20">매체</th>
                                            <th className="px-4 py-3 w-56">캠페인명</th>
                                            <th className="px-4 py-3 w-40">광고 소재명</th>
                                            <th className="px-4 py-3 text-center w-24">상태</th>
                                            <th className="px-4 py-3 text-center w-24">액션</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                                        {MOCK_AUDIT_RESULTS.map((row) => (
                                            <tr 
                                                key={row.id} 
                                                onClick={() => setActiveDrawerRow(row)}
                                                className={`hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-all cursor-pointer ${
                                                    activeDrawerRow?.id === row.id 
                                                        ? 'bg-indigo-50/20 dark:bg-indigo-950/10 border-l-4 border-l-indigo-600' 
                                                        : ''
                                                }`}
                                            >
                                                <td className="px-4 py-3 text-center font-mono text-zinc-400">{row.id}</td>
                                                <td className="px-4 py-3 font-semibold">{row.platform}</td>
                                                <td className="px-4 py-3 font-medium text-zinc-800 dark:text-zinc-200 truncate max-w-[220px]">{row.campaignName}</td>
                                                <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{row.adName}</td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold ${
                                                        row.status === 'PASS' 
                                                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' 
                                                            : row.status === 'FAIL'
                                                                ? 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400'
                                                                : 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'
                                                    }`}>
                                                        {row.status === 'PASS' ? '일치' : row.status === 'FAIL' ? '불일치' : '경고'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); setActiveDrawerRow(row); }}
                                                        className="inline-flex items-center gap-1 py-1 px-2.5 bg-zinc-100 hover:bg-indigo-50 hover:text-indigo-600 dark:bg-zinc-800 dark:hover:bg-indigo-950/30 text-zinc-700 dark:text-zinc-300 rounded font-bold transition-all text-[10px]"
                                                    >
                                                        <Eye className="w-3 h-3" /> 상세 보기
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* ──────────────────────────────────────────────────────── */}
                    {/* RENDERING: 대안 B (간편/상세 뷰 토글 방식) */}
                    {/* ──────────────────────────────────────────────────────── */}
                    {selectedDesignOption === 'B' && (
                        <div className="space-y-4">
                            <div className="p-4 bg-amber-50/50 dark:bg-amber-950/10 border border-amber-100 dark:border-amber-900/30 rounded-xl text-xs text-amber-800 dark:text-amber-400 leading-relaxed flex items-start gap-2">
                                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                                <div>
                                    <span className="font-bold">대안 B (간편/상세 토글 방식)의 작동 원리:</span>
                                    <p className="mt-1">
                                        1. 우측 상단의 토글 스위치로 테이블에 렌더링할 정보의 단계를 직접 조절합니다.<br />
                                        2. **[상세 소재 검수 뷰]**로 전환하면 헤드라인 대조, 본문 카피 대조, CTA 버튼, 지면별 다중 URL 등 ver2의 모든 컬럼이 테이블 내부 컬럼으로 가로방향으로 병렬 확장됩니다.
                                    </p>
                                    <p className="mt-2 font-semibold text-amber-800 dark:text-amber-300">👉 우측 상단의 토글 스위치를 전환하여 테이블 컬럼이 가로로 확장되고 스크롤바가 생기는 사용성을 테스트해보세요.</p>
                                </div>
                            </div>

                            {/* View Toggle Controller */}
                            <div className="flex justify-end items-center gap-2">
                                <span className="text-xs font-semibold text-zinc-500">뷰 모드 설정:</span>
                                <div className="flex bg-zinc-100 dark:bg-zinc-800 p-0.5 rounded-lg border border-zinc-200 dark:border-zinc-700">
                                    <button
                                        onClick={() => setOptionBToggleMode('simple')}
                                        className={`px-3 py-1 text-[11px] font-bold rounded-md transition-all ${
                                            optionBToggleMode === 'simple'
                                                ? 'bg-white dark:bg-zinc-700 text-zinc-800 dark:text-zinc-100 shadow-sm'
                                                : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                                        }`}
                                    >
                                        간편 검수 뷰 (ver1)
                                    </button>
                                    <button
                                        onClick={() => setOptionBToggleMode('detail')}
                                        className={`px-3 py-1 text-[11px] font-bold rounded-md transition-all ${
                                            optionBToggleMode === 'detail'
                                                ? 'bg-white dark:bg-zinc-700 text-zinc-800 dark:text-zinc-100 shadow-sm'
                                                : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                                        }`}
                                    >
                                        상세 소재 검수 뷰 (ver2)
                                    </button>
                                </div>
                            </div>

                            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-x-auto custom-scrollbar">
                                <table className="w-full text-xs text-left min-w-[800px]">
                                    <thead className="text-[10px] text-zinc-500 uppercase bg-zinc-50 dark:bg-zinc-900/60 font-semibold border-b border-zinc-200 dark:border-zinc-800">
                                        <tr>
                                            <th className="px-4 py-3 text-center w-12 sticky left-0 bg-zinc-50 dark:bg-zinc-900/60">#</th>
                                            <th className="px-4 py-3 w-20 sticky left-12 bg-zinc-50 dark:bg-zinc-900/60">매체</th>
                                            <th className="px-4 py-3 w-48">캠페인명</th>
                                            <th className="px-4 py-3 w-32">광고 소재명</th>
                                            
                                            {optionBToggleMode === 'detail' && (
                                                <>
                                                    <th className="px-4 py-3 w-48">헤드라인 대조 (계획 vs API)</th>
                                                    <th className="px-4 py-3 w-48">본문 카피 대조 (계획 vs API)</th>
                                                    <th className="px-4 py-3 w-36">행동유도(CTA) 버튼</th>
                                                    <th className="px-4 py-3 w-64">지면별 맞춤 URL 매핑 결과</th>
                                                </>
                                            )}

                                            <th className="px-4 py-3 text-center w-24">상태</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                                        {MOCK_AUDIT_RESULTS.map((row) => (
                                            <tr key={row.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                                                <td className="px-4 py-3 text-center font-mono text-zinc-400 sticky left-0 bg-white dark:bg-zinc-900">{row.id}</td>
                                                <td className="px-4 py-3 font-semibold sticky left-12 bg-white dark:bg-zinc-900">{row.platform}</td>
                                                <td className="px-4 py-3 font-medium text-zinc-800 dark:text-zinc-200 truncate max-w-[180px]">{row.campaignName}</td>
                                                <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{row.adName}</td>
                                                
                                                {optionBToggleMode === 'detail' && (
                                                    <>
                                                        <td className="px-4 py-3">
                                                            <div className={`p-1.5 rounded text-[10px] ${row.headline.status === 'FAIL' ? 'bg-rose-50 text-rose-800 dark:bg-rose-950/20 dark:text-rose-400 border border-rose-200' : 'bg-zinc-50 dark:bg-zinc-800/40 text-zinc-600 dark:text-zinc-300'}`}>
                                                                <div>계획: {row.headline.excel}</div>
                                                                <div className="mt-0.5">실체: {row.headline.api}</div>
                                                                {row.headline.status === 'FAIL' && <span className="text-[8px] font-bold block mt-1 text-rose-600 dark:text-rose-400">❌ {row.headline.message}</span>}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 max-w-[200px]">
                                                            <div className="p-1.5 rounded text-[10px] bg-zinc-50 dark:bg-zinc-800/40 text-zinc-600 dark:text-zinc-300 truncate" title={`계획: ${row.body.excel}\n실체: ${row.body.api}`}>
                                                                <div>계획: {row.body.excel}</div>
                                                                <div className="mt-0.5">실체: {row.body.api}</div>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <div className={`p-1.5 rounded text-[10px] ${row.cta.status === 'FAIL' ? 'bg-rose-50 text-rose-800 dark:bg-rose-950/20 dark:text-rose-400 border border-rose-200' : 'bg-zinc-50 dark:bg-zinc-800/40 text-zinc-600 dark:text-zinc-300'}`}>
                                                                <div>계획: {row.cta.excel}</div>
                                                                <div className="mt-0.5">실체: {row.cta.api}</div>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <div className="space-y-1.5 max-h-24 overflow-y-auto custom-scrollbar">
                                                                {row.placementUrls.map((pUrl, pIdx) => (
                                                                    <div key={pIdx} className={`p-1 rounded text-[9px] leading-tight ${
                                                                        pUrl.status === 'FAIL'
                                                                            ? 'bg-rose-50 dark:bg-rose-950/20 text-rose-800 dark:text-rose-400 border border-rose-100'
                                                                            : 'bg-emerald-50 dark:bg-emerald-950/10 text-emerald-800 dark:text-emerald-400'
                                                                    }`}>
                                                                        <div className="font-bold flex justify-between">
                                                                            <span>[{pUrl.placement}]</span>
                                                                            <span>{pUrl.status === 'PASS' ? '✅ 일치' : '❌ 오류'}</span>
                                                                        </div>
                                                                        <div className="truncate mt-0.5" title={`계획: ${pUrl.excel}\n실제: ${pUrl.api}`}>
                                                                            URL: {pUrl.excel}
                                                                        </div>
                                                                        {pUrl.status === 'FAIL' && (
                                                                            <div className="font-semibold text-[8px] mt-0.5 text-rose-600 dark:text-rose-400">{pUrl.message}</div>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </td>
                                                    </>
                                                )}

                                                <td className="px-4 py-3 text-center">
                                                    <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold ${
                                                        row.status === 'PASS' 
                                                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' 
                                                            : row.status === 'FAIL'
                                                                ? 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400'
                                                                : 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'
                                                    }`}>
                                                        {row.status === 'PASS' ? '일치' : row.status === 'FAIL' ? '불일치' : '경고'}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ──────────────────────────────────────────────────────── */}
            {/* OPTION A: Slide-out Right Drawer Overlay */}
            {/* ──────────────────────────────────────────────────────── */}
            {selectedDesignOption === 'A' && activeDrawerRow && (
                <>
                    <div 
                        className="fixed inset-0 bg-black/40 backdrop-blur-xs z-40 transition-opacity animate-in fade-in"
                        onClick={() => setActiveDrawerRow(null)}
                    ></div>
                    
                    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[480px] bg-white dark:bg-zinc-950 border-l border-zinc-200 dark:border-zinc-800 shadow-2xl p-6 overflow-y-auto flex flex-col justify-between transition-all duration-300 animate-in slide-in-from-right">
                        <div className="space-y-6">
                            <div className="flex items-start justify-between pb-4 border-b border-zinc-200 dark:border-zinc-800">
                                <div>
                                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded-full w-fit">
                                        <Sparkles className="w-3 h-3" /> ver2 소재 정밀 검수 리포트
                                    </div>
                                    <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-50 mt-2 truncate max-w-[340px]">
                                        {activeDrawerRow.adName}
                                    </h2>
                                    <p className="text-[10px] text-zinc-400 font-mono mt-0.5 truncate max-w-[340px]">
                                        {activeDrawerRow.campaignName}
                                    </p>
                                </div>
                                <button 
                                    onClick={() => setActiveDrawerRow(null)}
                                    className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Section 1: Budget and Dates */}
                            <div className="space-y-3">
                                <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">1. 캠페인 기본 설정 대조</h3>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className={`p-3 rounded-xl border text-xs ${
                                        activeDrawerRow.campaignBudget.status === 'FAIL' 
                                            ? 'bg-rose-50/40 dark:bg-rose-950/10 border-rose-200 dark:border-rose-900/30' 
                                            : 'bg-zinc-50/50 dark:bg-zinc-900/30 border-zinc-200 dark:border-zinc-800'
                                    }`}>
                                        <span className="text-[10px] text-zinc-400 block mb-1">💰 캠페인 예산</span>
                                        <div className="font-semibold text-zinc-800 dark:text-zinc-200">계획: {activeDrawerRow.campaignBudget.excel}</div>
                                        <div className="text-zinc-600 dark:text-zinc-400 mt-0.5">실제: {activeDrawerRow.campaignBudget.api}</div>
                                        {activeDrawerRow.campaignBudget.status === 'FAIL' && (
                                            <span className="text-[9px] font-bold text-rose-600 dark:text-rose-400 block mt-1.5">
                                                ⚠️ {activeDrawerRow.campaignBudget.message}
                                            </span>
                                        )}
                                    </div>
                                    <div className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30 text-xs">
                                        <span className="text-[10px] text-zinc-400 block mb-1">📅 캠페인 시작일</span>
                                        <div className="font-semibold text-zinc-800 dark:text-zinc-200">계획: {activeDrawerRow.startDate.excel}</div>
                                        <div className="text-zinc-600 dark:text-zinc-400 mt-0.5">실제: {activeDrawerRow.startDate.api}</div>
                                        <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 block mt-1.5">✅ 정상 일치</span>
                                    </div>
                                </div>
                            </div>

                            {/* Section 2: Creative Copy */}
                            <div className="space-y-3">
                                <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">2. 광고 소재 카피 대조</h3>
                                <div className="space-y-3">
                                    <div className={`p-3.5 rounded-xl border text-xs space-y-1 ${
                                        activeDrawerRow.headline.status === 'FAIL' 
                                            ? 'bg-rose-50/40 dark:bg-rose-950/10 border-rose-200 dark:border-rose-900/30' 
                                            : 'bg-zinc-50/50 dark:bg-zinc-900/30 border-zinc-200 dark:border-zinc-800'
                                    }`}>
                                        <span className="text-[10px] text-zinc-400 block font-semibold">✍️ 헤드라인 문구</span>
                                        <div className="font-semibold text-zinc-800 dark:text-zinc-200">계획: {activeDrawerRow.headline.excel}</div>
                                        <div className="text-zinc-600 dark:text-zinc-400">실제: {activeDrawerRow.headline.api}</div>
                                        {activeDrawerRow.headline.status === 'FAIL' && (
                                            <span className="text-[9px] font-bold text-rose-600 dark:text-rose-400 block mt-1 font-mono">
                                                [불일치] {activeDrawerRow.headline.message}
                                            </span>
                                        )}
                                    </div>

                                    <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30 text-xs space-y-1">
                                        <span className="text-[10px] text-zinc-400 block font-semibold">📝 기본 본문 카피</span>
                                        <div className="font-semibold text-zinc-800 dark:text-zinc-200 leading-relaxed">계획: {activeDrawerRow.body.excel}</div>
                                        <div className="text-zinc-600 dark:text-zinc-400 leading-relaxed">실제: {activeDrawerRow.body.api}</div>
                                        <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 block mt-1">✅ 정상 일치</span>
                                    </div>

                                    <div className={`p-3.5 rounded-xl border text-xs space-y-1 ${
                                        activeDrawerRow.cta.status === 'FAIL' 
                                            ? 'bg-rose-50/40 dark:bg-rose-950/10 border-rose-200 dark:border-rose-900/30' 
                                            : 'bg-zinc-50/50 dark:bg-zinc-900/30 border-zinc-200 dark:border-zinc-800'
                                    }`}>
                                        <span className="text-[10px] text-zinc-400 block font-semibold">🖱️ 행동유도(CTA) 버튼</span>
                                        <div className="font-semibold text-zinc-800 dark:text-zinc-200">계획: {activeDrawerRow.cta.excel}</div>
                                        <div className="text-zinc-600 dark:text-zinc-400">실제: {activeDrawerRow.cta.api}</div>
                                        {activeDrawerRow.cta.status === 'FAIL' && (
                                            <span className="text-[9px] font-bold text-rose-600 dark:text-rose-400 block mt-1 font-mono">
                                                [불일치] {activeDrawerRow.cta.message}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Section 3: Placement Specific URLs */}
                            <div className="space-y-3">
                                <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
                                    🔗 3. 노출 지면별 맞춤 URL & UTM 검수
                                </h3>
                                <div className="space-y-2">
                                    {activeDrawerRow.placementUrls.map((pUrl, pIdx) => (
                                        <div 
                                            key={pIdx} 
                                            className={`p-3.5 rounded-xl border text-xs ${
                                                pUrl.status === 'FAIL'
                                                    ? 'bg-rose-50/30 dark:bg-rose-950/10 border-rose-200 dark:border-rose-900/40 shadow-xs'
                                                    : 'bg-emerald-50/30 dark:bg-emerald-950/5 border-emerald-200 dark:border-emerald-900/30'
                                            }`}
                                        >
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="font-bold text-zinc-800 dark:text-zinc-200">
                                                    📍 {pUrl.placement}
                                                </span>
                                                <span className={`px-2 py-0.5 rounded text-[8px] font-bold ${
                                                    pUrl.status === 'PASS'
                                                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400'
                                                        : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-400'
                                                }`}>
                                                    {pUrl.status === 'PASS' ? '정합성 일치 (PASS)' : 'UTM 불일치 (FAIL)'}
                                                </span>
                                            </div>
                                            <div className="space-y-1.5 font-mono text-[9px] break-all leading-normal">
                                                <div>
                                                    <span className="text-zinc-400 font-semibold inline-block w-8">계획:</span> 
                                                    <span className="text-zinc-700 dark:text-zinc-300">{pUrl.excel}</span>
                                                </div>
                                                <div>
                                                    <span className="text-zinc-400 font-semibold inline-block w-8">실제:</span> 
                                                    <span className={`${pUrl.status === 'FAIL' ? 'text-rose-600 dark:text-rose-400 font-semibold' : 'text-zinc-700 dark:text-zinc-300'}`}>{pUrl.api}</span>
                                                </div>
                                            </div>
                                            {pUrl.status === 'FAIL' && (
                                                <div className="text-[9px] text-rose-600 dark:text-rose-400 font-bold mt-2.5 bg-rose-50 dark:bg-rose-900/10 p-1.5 rounded border border-rose-100 dark:border-rose-900/20">
                                                    ⚠️ {pUrl.message}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 shrink-0 mt-6">
                            <button
                                onClick={() => setActiveDrawerRow(null)}
                                className="w-full py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-950 rounded-xl text-xs font-bold transition-colors"
                            >
                                검수 리포트 확인 완료
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
