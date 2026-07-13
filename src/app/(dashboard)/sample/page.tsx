'use client';

import { useState, useEffect } from 'react';
import {
    Lock, Clock, Activity, DollarSign, CheckCircle2, AlertTriangle, BarChart3,
    UploadCloud, BookOpen, ShieldCheck, ArrowUpRight, ArrowDownRight, RefreshCw,
    Info, Loader2, Sparkles, AlertCircle, FileText, Check, Play, RotateCcw, X, Eye, ToggleLeft, Layers
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

const MOCK_GOOGLE_CAMPAIGNS = [
    { id: '23907745097', name: '2607_핑거요_7/2-7/31_VVC', account: '1865068142', budget: 500000, spend: 191500, start: '2026-07-02', stop: '2026-07-31', burnRate: 38.3, timeProgress: 41, burnStatus: 'normal' },
    { id: '23982662351', name: '2607_슈퍼SOL_7/1-7/31_VVC_세로형', account: '1865068142', budget: 1000000, spend: 263000, start: '2026-07-01', stop: '2026-07-31', burnRate: 26.3, timeProgress: 41, burnStatus: 'normal' },
    { id: '23980908188', name: '2607_슈퍼SOL_7/1-7/31_커스텀 라인업', account: '1865068142', budget: 1500000, spend: 36000, start: '2026-07-01', stop: '2026-07-31', burnRate: 2.4, timeProgress: 41, burnStatus: 'under' },
    { id: '23980908190', name: '2607_슈퍼SOL_7/1-7/31_VVC_가로형', account: '1865068142', budget: 800000, spend: 260000, start: '2026-07-01', stop: '2026-07-31', burnRate: 32.5, timeProgress: 41, burnStatus: 'normal' },
    { id: '23907745100', name: '2607_핑거요_7/2-7/31_Search', account: '1865068142', budget: 200000, spend: 196400, start: '2026-07-02', stop: '2026-07-31', burnRate: 98.2, timeProgress: 41, burnStatus: 'over' },
];

const MOCK_META_CAMPAIGNS = [
    { id: '120249891184880233', name: 'HQ-MS-Seeding_MS_TV_DE_26_Q3_HSAD_OLED-G6-Banner_lg.com_awareness_facebook', account: '1267556304705160', budget: 1500000, spend: 678000, start: '2026-07-01', stop: '2026-07-31', burnRate: 45.2, timeProgress: 41, burnStatus: 'normal' },
    { id: '120249891184890233', name: 'HQ-MS-Seeding_MS_TV_DE_26_Q3_HSAD_OLED-G6-Video_lg.com_awareness_instagram', account: '1267556304705160', budget: 2000000, spend: 242000, start: '2026-07-01', stop: '2026-07-31', burnRate: 12.1, timeProgress: 41, burnStatus: 'under' },
    { id: '120249891184899999', name: 'HQ-MS-Seeding_MS_TV_DE_26_Q3_HSAD_OLED-G6-Carousel_lg.com_awareness_facebook', account: '1267556304705160', budget: 1000000, spend: 885000, start: '2026-07-01', stop: '2026-07-31', burnRate: 88.5, timeProgress: 41, burnStatus: 'over' },
];

// Rich ver2 Mock Audit Results
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
    // ver2 parameters
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

export default function SampleDashboardPage() {
    const [previewTab, setPreviewTab] = useState<'dashboard' | 'audit'>('dashboard');
    
    // Dashboard States
    const [dashboardMedia, setDashboardMedia] = useState<'meta' | 'google'>('google');
    const [burnFilter, setBurnFilter] = useState<'all' | 'over' | 'under' | 'normal'>('all');
    const [isSyncing, setIsSyncing] = useState(false);
    
    // Audit Simulation States
    const [auditState, setAuditState] = useState<'upload' | 'loading' | 'results'>('upload');
    const [loadingProgress, setLoadingProgress] = useState(0);
    const [loadingLog, setLoadingLog] = useState('');

    // UI Option Design Selection States (For User Review)
    const [selectedDesignOption, setSelectedDesignOption] = useState<'A' | 'B'>('A');
    const [activeDrawerRow, setActiveDrawerRow] = useState<MockAuditResult | null>(null);
    const [optionBToggleMode, setOptionBToggleMode] = useState<'simple' | 'detail'>('simple');

    // Handlers
    const triggerSyncDemo = () => {
        setIsSyncing(true);
        setTimeout(() => {
            setIsSyncing(false);
            alert("🔒 [안내] GUEST(미승인) 계정은 데모 화면 내에서 가상 동기화만 체험 가능합니다. 실제 매체 API 연동은 권한 승인 후에 제공됩니다.");
        }, 1500);
    };

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
                    // Automatically open first drawer for Option A demonstration to make it obvious
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

    const activeCampaigns = dashboardMedia === 'google' ? MOCK_GOOGLE_CAMPAIGNS : MOCK_META_CAMPAIGNS;
    const filteredCampaigns = activeCampaigns.filter(c => {
        if (burnFilter === 'all') return true;
        return c.burnStatus === burnFilter;
    });

    const totalCount = activeCampaigns.length;
    const overCount = activeCampaigns.filter(c => c.burnStatus === 'over').length;
    const underCount = activeCampaigns.filter(c => c.burnStatus === 'under').length;
    const normalCount = activeCampaigns.filter(c => c.burnStatus === 'normal').length;

    return (
        <div className="space-y-8 pb-16 animate-in fade-in duration-500 relative">
            {/* 🔒 Guest Pending Banner */}
            <div className="bg-gradient-to-br from-amber-50 to-orange-50/50 dark:from-amber-950/20 dark:to-zinc-950 border border-amber-200 dark:border-amber-900/50 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row items-center gap-6">
                <div className="w-14 h-14 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-500 rounded-full flex items-center justify-center flex-shrink-0 shadow-inner">
                    <Lock className="w-6 h-6 animate-pulse" />
                </div>
                <div className="flex-1 text-center md:text-left space-y-1">
                    <h2 className="text-xl font-bold text-zinc-950 dark:text-zinc-50 flex items-center justify-center md:justify-start gap-2">
                        계정 승인 대기 중입니다
                        <span className="text-xs bg-amber-200 dark:bg-amber-900/50 text-amber-800 dark:text-amber-400 px-2 py-0.5 rounded-full font-bold">GUEST 권한</span>
                    </h2>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 max-w-2xl leading-relaxed">
                        현재 미승인 권한 상태입니다. 관리자가 소속 팀과 매체 조회 권한을 배정해 주시면, 실제 연동된 미디어믹스 및 실시간 계정 데이터로 전체 서비스를 이용하실 수 있습니다.
                    </p>
                </div>
                <div className="shrink-0 flex items-center gap-2 bg-white dark:bg-zinc-900 px-4 py-2 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                    체험관 가동 중
                </div>
            </div>

            {/* 🌟 Tab Selector (體驗館) */}
            <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-2">
                    <div>
                        <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
                            📢 서비스 기능 미리보기
                        </h3>
                        <p className="text-xs text-zinc-500 mt-0.5">실 사용자의 대시보드와 실시간 검수센터 기능을 정적 데이터 기반으로 직접 클릭하여 체험해볼 수 있습니다.</p>
                    </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 max-w-md">
                    <button
                        onClick={() => setPreviewTab('dashboard')}
                        className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl border text-sm font-semibold transition-all shadow-sm ${
                            previewTab === 'dashboard'
                                ? 'bg-indigo-600 border-indigo-600 text-white shadow-indigo-100 dark:shadow-none'
                                : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                        }`}
                    >
                        <BarChart3 className="w-4 h-4" />
                        실시간 대시보드
                    </button>
                    <button
                        onClick={() => setPreviewTab('audit')}
                        className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl border text-sm font-semibold transition-all shadow-sm ${
                            previewTab === 'audit'
                                ? 'bg-indigo-600 border-indigo-600 text-white shadow-indigo-100 dark:shadow-none'
                                : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                        }`}
                    >
                        <Activity className="w-4 h-4" />
                        실시간 검수 센터
                    </button>
                </div>
            </div>

            {/* ──────────────────────────────────────────────────────── */}
            {/* Tab 1: 실시간 대시보드 미리보기 */}
            {/* ──────────────────────────────────────────────────────── */}
            {previewTab === 'dashboard' && (
                <div className="space-y-6 max-w-7xl border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 bg-white dark:bg-zinc-900/50 shadow-sm animate-in fade-in duration-300">
                    <div className="flex items-center gap-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                        <span className="w-2 h-2 rounded-full bg-indigo-600 animate-ping"></span>
                        대시보드 미리보기 모드 (정적 데모)
                    </div>

                    {/* Gradient Header Banner */}
                    <div className="relative overflow-hidden bg-gradient-to-r from-indigo-600 to-violet-600 rounded-2xl shadow-lg p-6 text-white">
                        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <h1 className="text-2xl font-bold tracking-tight mb-1 flex items-center gap-2">
                                    실시간 대시보드
                                </h1>
                                <p className="text-indigo-100 text-sm opacity-90 max-w-2xl">
                                    팀에 매핑된 Meta 및 Google 광고 계정의 라이브 캠페인과 최근 검수 내역을 한눈에 파악하세요.
                                </p>
                            </div>
                            <div className="flex flex-col items-end gap-1 shrink-0">
                                <button
                                    onClick={triggerSyncDemo}
                                    disabled={isSyncing}
                                    className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg backdrop-blur-sm transition-all disabled:opacity-50"
                                >
                                    <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                                    <span className="font-semibold text-xs">{isSyncing ? '동기화 중...' : '실시간 동기화'}</span>
                                </button>
                                <div className="text-[10px] text-indigo-200 mt-1">
                                    마지막 동기화: 오늘 14:50
                                </div>
                            </div>
                        </div>
                        <div className="absolute right-0 top-0 opacity-10 transform translate-x-1/3 -translate-y-1/4">
                            <BarChart3 className="w-48 h-48" />
                        </div>
                    </div>

                    {/* Media Tabs */}
                    <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-px">
                        <button
                            onClick={() => { setDashboardMedia('meta'); setBurnFilter('all'); }}
                            className={`px-6 py-3 font-semibold text-sm border-b-2 transition-colors ${dashboardMedia === 'meta' ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400' : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
                        >
                            Meta (Facebook/Instagram)
                        </button>
                        <button
                            onClick={() => { setDashboardMedia('google'); setBurnFilter('all'); }}
                            className={`px-6 py-3 font-semibold text-sm border-b-2 transition-colors ${dashboardMedia === 'google' ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400' : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
                        >
                            Google Ads
                        </button>
                    </div>

                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div 
                            onClick={() => setBurnFilter('all')}
                            className={`cursor-pointer rounded-xl p-4 border shadow-sm flex flex-col justify-center transition-all hover:-translate-y-0.5 hover:shadow-md ${
                                burnFilter === 'all'
                                    ? 'bg-indigo-50/40 dark:bg-indigo-950/20 border-indigo-500/70 dark:border-indigo-800 ring-2 ring-indigo-500/20'
                                    : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800'
                            }`}
                        >
                            <span className="text-zinc-500 text-[11px] font-medium mb-1">📊 전체 라이브 캠페인</span>
                            <div className="text-xl font-bold text-zinc-900 dark:text-zinc-50 flex items-baseline gap-1">
                                {totalCount} <span className="text-xs font-normal text-zinc-500">건</span>
                            </div>
                        </div>
                        <div 
                            onClick={() => setBurnFilter('over')}
                            className={`cursor-pointer rounded-xl p-4 border shadow-sm flex flex-col justify-center relative overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-md ${
                                burnFilter === 'over'
                                    ? 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-500/70 dark:border-rose-800 ring-2 ring-rose-500/20'
                                    : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800'
                            }`}
                        >
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-rose-500"></div>
                            <span className="text-zinc-500 text-[11px] font-medium mb-1 pl-1">🚨 예산 과소진</span>
                            <div className="text-xl font-bold text-rose-600 dark:text-rose-400 flex items-baseline gap-1 pl-1">
                                {overCount} <span className="text-xs font-normal text-zinc-500">건</span>
                            </div>
                        </div>
                        <div 
                            onClick={() => setBurnFilter('under')}
                            className={`cursor-pointer rounded-xl p-4 border shadow-sm flex flex-col justify-center relative overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-md ${
                                burnFilter === 'under'
                                    ? 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-500/70 dark:border-amber-800 ring-2 ring-amber-500/20'
                                    : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800'
                            }`}
                        >
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500"></div>
                            <span className="text-zinc-500 text-[11px] font-medium mb-1 pl-1">⚠️ 예산 미소진</span>
                            <div className="text-xl font-bold text-amber-600 dark:text-amber-400 flex items-baseline gap-1 pl-1">
                                {underCount} <span className="text-xs font-normal text-zinc-500">건</span>
                            </div>
                        </div>
                        <div 
                            onClick={() => setBurnFilter('normal')}
                            className={`cursor-pointer rounded-xl p-4 border shadow-sm flex flex-col justify-center relative overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-md ${
                                burnFilter === 'normal'
                                    ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-500/70 dark:border-emerald-800 ring-2 ring-emerald-500/20'
                                    : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800'
                            }`}
                        >
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500"></div>
                            <span className="text-zinc-500 text-[11px] font-medium mb-1 pl-1">✅ 정상 소진</span>
                            <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 flex items-baseline gap-1 pl-1">
                                {normalCount} <span className="text-xs font-normal text-zinc-500">건</span>
                            </div>
                        </div>
                    </div>

                    {/* Table & Audits Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Live Campaigns Table */}
                        <div className="lg:col-span-2 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden flex flex-col h-96">
                            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 flex justify-between items-center shrink-0">
                                <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                                    팀 매핑 라이브 캠페인
                                    <span className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 text-[9px] px-1.5 py-0.5 rounded font-bold uppercase">
                                        {dashboardMedia.toUpperCase()}
                                    </span>
                                </h2>
                                <span className="text-xs font-normal text-zinc-500">
                                    ENABLED {filteredCampaigns.length}건 / {activeCampaigns.length}건
                                </span>
                            </div>
                            <div className="flex-1 overflow-y-auto custom-scrollbar">
                                <table className="w-full text-sm text-left">
                                    <thead className="text-[11px] text-zinc-500 dark:text-zinc-400 uppercase bg-zinc-50 dark:bg-zinc-900/60 font-semibold border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-10">
                                        <tr>
                                            <th className="px-4 py-3">계정 ID</th>
                                            <th className="px-4 py-3">캠페인명</th>
                                            <th className="px-4 py-3 text-center">동작 상태</th>
                                            <th className="px-4 py-3 text-center">예산 소진율(%)</th>
                                            <th className="px-4 py-3 text-center">소진 상태</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                                        {filteredCampaigns.map((camp, idx) => {
                                            const burnBadge = (() => {
                                                if (camp.burnStatus === 'normal') return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">● 정상</span>;
                                                if (camp.burnStatus === 'under') return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">▼ 미소진</span>;
                                                if (camp.burnStatus === 'over') return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400">▲ 과소진</span>;
                                                return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-100 text-zinc-500">—</span>;
                                            })();

                                            const pct = Math.min(camp.burnRate, 100);
                                            const barColor = camp.burnStatus === 'over' ? 'bg-rose-500' : camp.burnStatus === 'under' ? 'bg-amber-400' : 'bg-emerald-500';

                                            return (
                                                <tr key={idx} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                                                    <td className="px-4 py-3 font-mono text-zinc-400 text-[10px]">{camp.account}</td>
                                                    <td className="px-4 py-3 max-w-[200px]">
                                                        <div className="font-semibold text-zinc-800 dark:text-zinc-200 text-xs leading-snug truncate">{camp.name}</div>
                                                        <div className="text-[9px] text-zinc-400 font-mono mt-0.5">{camp.id}</div>
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400">
                                                            ENABLED
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex flex-col items-center gap-1 min-w-[70px]">
                                                            <span className="text-[10px] font-bold text-zinc-700 dark:text-zinc-300">{camp.burnRate}%</span>
                                                            <div className="w-full h-1 bg-zinc-100 dark:bg-zinc-700 rounded-full overflow-hidden">
                                                                <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                                                            </div>
                                                            <span className="text-[8px] text-zinc-400">진행률 {camp.timeProgress}%</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 text-center">{burnBadge}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Recent Audits List */}
                        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col h-96">
                            <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 shrink-0 gap-2">
                                <Clock className="w-4 h-4 text-indigo-500" /> 최근 실시간 검수 내역
                            </h2>
                            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                                <div className="p-3 rounded-lg border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40">
                                    <div className="flex justify-between items-start mb-1.5">
                                        <span className="text-[9px] text-zinc-400 font-mono">07/06 15:19</span>
                                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-400">PASS</span>
                                    </div>
                                    <p className="text-xs text-zinc-700 dark:text-zinc-300">총 234개 검증 완료</p>
                                </div>
                                <div className="p-3 rounded-lg border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40">
                                    <div className="flex justify-between items-start mb-1.5">
                                        <span className="text-[9px] text-zinc-400 font-mono">07/06 15:18</span>
                                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-400">PASS</span>
                                    </div>
                                    <p className="text-xs text-zinc-700 dark:text-zinc-300">총 2개 검증 완료</p>
                                </div>
                                <div className="p-3 rounded-lg border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40">
                                    <div className="flex justify-between items-start mb-1.5">
                                        <span className="text-[9px] text-zinc-400 font-mono">07/06 15:03</span>
                                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-400">PASS</span>
                                    </div>
                                    <p className="text-xs text-zinc-700 dark:text-zinc-300">총 234개 검증 완료</p>
                                </div>
                                <div className="p-3 rounded-lg border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40 border-rose-200 dark:border-rose-900/40">
                                    <div className="flex justify-between items-start mb-1.5">
                                        <span className="text-[9px] text-zinc-400 font-mono">07/06 15:01</span>
                                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-400">234 FAIL</span>
                                    </div>
                                    <p className="text-xs text-zinc-700 dark:text-zinc-300">총 234개 검증 완료</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ──────────────────────────────────────────────────────── */}
            {/* Tab 2: 실시간 검수 센터 미리보기 */}
            {/* ──────────────────────────────────────────────────────── */}
            {previewTab === 'audit' && (
                <div className="space-y-6 max-w-7xl border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 bg-white dark:bg-zinc-900/50 shadow-sm animate-in fade-in duration-300">
                    <div className="flex items-center gap-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                        <span className="w-2 h-2 rounded-full bg-indigo-600 animate-ping"></span>
                        검수 센터 미리보기 모드 (정적 데모)
                    </div>

                    {/* Standard Audit Title */}
                    <div className="pb-4 border-b border-zinc-200 dark:border-zinc-800">
                        <h1 className="text-2xl font-bold text-zinc-950 dark:text-zinc-50 flex items-center gap-2">
                            <Activity className="w-6 h-6 text-indigo-500" />
                            실시간 검수 센터
                        </h1>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                            통합 표준 미디어믹스(Excel)를 업로드하여 매체에 세팅된 라이브 데이터와 실시간으로 크로스 체크합니다.
                        </p>
                    </div>

                    {auditState === 'upload' && (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Left Side: Upload Card */}
                            <div className="lg:col-span-1 flex flex-col gap-4">
                                <div className="border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-2xl p-8 bg-zinc-50/50 dark:bg-zinc-900/40 text-center flex flex-col items-center justify-center min-h-[300px] transition-all hover:border-indigo-400 dark:hover:border-indigo-900">
                                    <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center mb-4">
                                        <UploadCloud className="w-6 h-6" />
                                    </div>
                                    <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">엑셀 파일 업로드</h3>
                                    <p className="text-xs text-zinc-400 mt-1 mb-6 max-w-[200px] mx-auto">
                                        클릭 또는 드래그 앤 드롭으로 파일을 올려주세요. .xlsx / .xls
                                    </p>
                                    
                                    <button
                                        onClick={runAuditSimulation}
                                        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-md transition-all mb-3 hover:scale-[1.02] active:scale-[0.98]"
                                    >
                                        <Play className="w-3.5 h-3.5" />
                                        ✨ 샘플 데이터 검수 시뮬레이션 실행
                                    </button>
                                </div>
                                <button className="w-full flex items-center justify-center gap-2 py-2 px-4 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 rounded-xl text-xs font-semibold text-zinc-700 dark:text-zinc-300 transition-colors">
                                    <FileText className="w-4 h-4 text-zinc-400" />
                                    기본 엑셀 양식 템플릿 다운로드
                                </button>
                            </div>

                            {/* Right Side: Column Guide Table */}
                            <div className="lg:col-span-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden flex flex-col h-[400px]">
                                <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 flex items-center justify-between shrink-0">
                                    <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                                        <BookOpen className="w-4 h-4 text-indigo-500" /> 22개 표준 컬럼 가이드
                                    </h2>
                                    <span className="text-[10px] text-zinc-400">템플릿 작성 전 필독 안내</span>
                                </div>
                                <div className="flex-1 overflow-y-auto custom-scrollbar">
                                    <table className="w-full text-xs text-left">
                                        <thead className="text-[10px] text-zinc-500 uppercase bg-zinc-50 dark:bg-zinc-900/60 font-semibold border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-10">
                                            <tr>
                                                <th className="px-4 py-3 text-center w-12">#</th>
                                                <th className="px-4 py-3 w-28">컬럼명</th>
                                                <th className="px-4 py-3 text-center w-20">필수 여부</th>
                                                <th className="px-4 py-3">설명</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50 font-normal">
                                            {COLUMN_META.map((col) => (
                                                <tr key={col.no} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                                                    <td className="px-4 py-2.5 text-center font-mono text-zinc-400">{col.no}</td>
                                                    <td className="px-4 py-2.5 font-semibold text-zinc-800 dark:text-zinc-200">{col.name}</td>
                                                    <td className="px-4 py-2.5 text-center">
                                                        <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                                            col.required === '필수' 
                                                                ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400' 
                                                                : col.required === '조건부'
                                                                    ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400'
                                                                    : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                                                        }`}>
                                                            {col.required}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-2.5 text-zinc-600 dark:text-zinc-400 leading-relaxed">{col.description}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Loader during simulation */}
                    {auditState === 'loading' && (
                        <div className="min-h-[350px] border border-zinc-200 dark:border-zinc-800 rounded-2xl flex flex-col items-center justify-center bg-zinc-50/30 dark:bg-zinc-900/30 p-8 animate-in fade-in">
                            <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-4" />
                            <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">실시간 데이터 정합성 검증 중...</h3>
                            <p className="text-xs text-zinc-500 mt-1 max-w-sm text-center">
                                매체 API 서버에 연결하여 라이브 세팅 사양과 미디어믹스를 검수하고 있습니다.
                            </p>
                            
                            <div className="w-full max-w-md bg-zinc-200 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden mt-6 mb-4">
                                <div className="h-full bg-indigo-600 rounded-full transition-all duration-300" style={{ width: `${loadingProgress}%` }}></div>
                            </div>
                            
                            <div className="bg-zinc-900 text-zinc-200 font-mono text-[10px] p-3 rounded-lg w-full max-w-md border border-zinc-800 shadow-inner h-24 overflow-y-auto leading-relaxed">
                                {loadingLog}
                            </div>
                        </div>
                    )}

                    {/* Audit Results View containing interactive Options A & B */}
                    {auditState === 'results' && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                            
                            {/* 💡 UI Design Option Selector Banner */}
                            <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-2xl p-5 shadow-md flex flex-col md:flex-row items-center justify-between gap-4 border border-indigo-950">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <Sparkles className="w-5 h-5 text-indigo-400" />
                                        <h3 className="text-sm font-bold">💡 검수 결과 UI 설계안 비교 체험관</h3>
                                    </div>
                                    <p className="text-xs text-slate-300">
                                        다중 URL 및 소재 상세 검수 정보(ver2)를 어떻게 보여줄지 두 가지 대안을 골라 직접 사용해보세요.
                                    </p>
                                </div>
                                <div className="flex items-center gap-2 bg-slate-800/80 p-1.5 rounded-xl border border-slate-700/60 shadow-inner shrink-0">
                                    <button
                                        onClick={() => { setSelectedDesignOption('A'); setActiveDrawerRow(MOCK_AUDIT_RESULTS[1]); }}
                                        className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
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
                                        className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
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

                            {/* Summary Card */}
                            <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 rounded-full flex items-center justify-center flex-shrink-0">
                                        <AlertCircle className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">검수 완료: 총 3건 중 불일치 2건 감지</h3>
                                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">매체 API에 실시간 반영된 내용과 다르게 세팅된 항목이 확인되었습니다.</p>
                                    </div>
                                </div>
                                <button 
                                    onClick={resetAudit}
                                    className="flex items-center gap-1.5 py-2 px-3 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 rounded-xl text-xs font-semibold text-zinc-700 dark:text-zinc-300 transition-colors shrink-0"
                                >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                    검수 초기화
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
                                            <span className="font-bold">대안 A (Drawer 방식)의 이점:</span> 메인 테이블은 ver1(기본형)처럼 가독성을 극대화하여 컴팩트하게 노출하고, 복잡한 다중 지면 URL 대조나 소재 상세 카피 비교는 광고 행을 클릭했을 때 우측에서 열리는 <strong>상세 검수 슬라이드 패널(Drawer)</strong>에서 독립적으로 검수합니다. 
                                            <p className="mt-1 font-semibold text-indigo-800 dark:text-indigo-300">💡 표에서 아래 광고 행을 클릭하여 우측 상세 패널을 직접 열어보세요.</p>
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
                                            <span className="font-bold">대안 B (간편/상세 토글)의 특징:</span> 우측 상단의 토글 스위치로 테이블에 보여줄 정보 범위를 선택합니다. 
                                            <strong className="text-rose-600 dark:text-rose-400"> '상세 소재 검수 뷰'</strong>를 켜면 테이블에 본문, 헤드라인, CTA, 지면별 다중 URL 등 ver2의 모든 컬럼이 가로로 대량 추가되어 스크롤이 넓어집니다. 
                                            소규모 검수에선 한눈에 볼 수 있어 좋으나, 대용량 데이터 검수 시에는 가로 크기가 비대해집니다.
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
                                                    
                                                    {/* Extra ver2 columns activated conditionally */}
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
                </div>
            )}

            {/* ──────────────────────────────────────────────────────── */}
            {/* OPTION A: Slide-out Right Drawer Overlay (Interactive) */}
            {/* ──────────────────────────────────────────────────────── */}
            {previewTab === 'audit' && auditState === 'results' && selectedDesignOption === 'A' && activeDrawerRow && (
                <>
                    {/* Drawer Backdrop */}
                    <div 
                        className="fixed inset-0 bg-black/40 backdrop-blur-xs z-40 transition-opacity animate-in fade-in"
                        onClick={() => setActiveDrawerRow(null)}
                    ></div>
                    
                    {/* Drawer Container */}
                    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[480px] bg-white dark:bg-zinc-950 border-l border-zinc-200 dark:border-zinc-800 shadow-2xl p-6 overflow-y-auto flex flex-col justify-between transition-all duration-300 animate-in slide-in-from-right">
                        
                        <div className="space-y-6">
                            {/* Drawer Header */}
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

                            {/* Section 1: Budget and Dates (Basic) */}
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

                            {/* Section 2: Creative Copy (Ver2 Details) */}
                            <div className="space-y-3">
                                <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">2. 광고 소재 카피 대조</h3>
                                
                                <div className="space-y-3">
                                    {/* Headline */}
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

                                    {/* Body Text */}
                                    <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30 text-xs space-y-1">
                                        <span className="text-[10px] text-zinc-400 block font-semibold">📝 기본 본문 카피</span>
                                        <div className="font-semibold text-zinc-800 dark:text-zinc-200 leading-relaxed">계획: {activeDrawerRow.body.excel}</div>
                                        <div className="text-zinc-600 dark:text-zinc-400 leading-relaxed">실제: {activeDrawerRow.body.api}</div>
                                        <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 block mt-1">✅ 정상 일치</span>
                                    </div>

                                    {/* CTA Button */}
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

                            {/* Section 3: Placement Specific URLs (PAC/Advantage+) */}
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

                        {/* Drawer Footer */}
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
