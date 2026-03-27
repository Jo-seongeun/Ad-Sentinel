'use client';

import {
    Activity,
    ArrowUpRight,
    ArrowDownRight,
    DollarSign,
    MousePointerClick,
    TrendingUp,
    Users,
    AlertTriangle,
    CheckCircle2,
    BarChart3,
    Clock
} from 'lucide-react';

const kpis = [
    { title: '오늘의 총 지출액', value: '₩1,245,000', change: '+12.5%', isPositive: true, icon: DollarSign },
    { title: '총 노출수 (Imp)', value: '842.5K', change: '+5.2%', isPositive: true, icon: Users },
    { title: '클릭수 (Clicks)', value: '12,405', change: '-1.2%', isPositive: false, icon: MousePointerClick },
    { title: '실시간 통합 ROAS', value: '342%', change: '+18.4%', isPositive: true, icon: TrendingUp }
];

const mockCampaigns = [
    { id: 'CMP-1001', name: '[PROMO] 봄맞이 신상품 기획전', platform: 'Meta', status: 'normal', spend: '₩450,000', roas: '420%', cpa: '₩8,500' },
    { id: 'CMP-1002', name: '[A/B Test] 글로벌 타겟확장 테스트', platform: 'Meta', status: 'warning', spend: '₩320,000', roas: '280%', cpa: '₩12,400' },
    { id: 'CMP-1003', name: '[Retargeting] 장바구니 유기 유저 리마인드', platform: 'Google', status: 'normal', spend: '₩180,000', roas: '560%', cpa: '₩4,200' },
    { id: 'CMP-1004', name: '[SA] 핵심 브랜드 키워드 검색광고', platform: 'Google', status: 'error', spend: '₩210,000', roas: '150%', cpa: '₩24,000' },
    { id: 'CMP-1005', name: '[Video] 브랜드 스토리 인지도 스폰서드', platform: 'Meta', status: 'normal', spend: '₩85,000', roas: '310%', cpa: '₩9,100' },
];

export default function ActiveDashboardPage() {
    return (
        <div className="space-y-6 max-w-7xl animate-in fade-in duration-500 pb-12">

            {/* Header section with lively gradient */}
            <div className="relative overflow-hidden bg-gradient-to-r from-indigo-600 to-violet-600 rounded-2xl shadow-lg p-8 text-white">
                <div className="relative z-10">
                    <h1 className="text-3xl font-bold tracking-tight mb-2">실시간 대시보드</h1>
                    <p className="text-indigo-100 text-lg opacity-90 max-w-2xl">
                        팀에 연결된 매체들의 광고 집행 현황과 실시간 성과 지표를 모니터링하세요.
                        (본 화면은 임시 데이터로 구성된 Mockup 화면입니다.)
                    </p>
                </div>
                {/* Decorative background vectors */}
                <div className="absolute right-0 top-0 opacity-10 transform translate-x-1/3 -translate-y-1/4">
                    <BarChart3 className="w-64 h-64" />
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {kpis.map((kpi, index) => {
                    const Icon = kpi.icon;
                    return (
                        <div key={index} className="bg-white dark:bg-zinc-900 rounded-xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-lg group-hover:scale-110 transition-transform">
                                    <Icon className="w-6 h-6" />
                                </div>
                                <span className={`flex items-center text-xs font-semibold px-2 py-1 rounded-full ${kpi.isPositive
                                    ? 'text-emerald-700 bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-400'
                                    : 'text-rose-700 bg-rose-50 dark:bg-rose-500/10 dark:text-rose-400'
                                    }`}>
                                    {kpi.isPositive ? <ArrowUpRight className="w-3 h-3 mr-1" /> : <ArrowDownRight className="w-3 h-3 mr-1" />}
                                    {kpi.change}
                                </span>
                            </div>
                            <h3 className="text-zinc-500 dark:text-zinc-400 text-sm font-medium">{kpi.title}</h3>
                            <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 mt-1">{kpi.value}</p>

                            <div className="absolute -bottom-4 -right-4 opactity-5 text-indigo-100 dark:text-zinc-800 transform rotate-12 group-hover:rotate-0 transition-transform duration-500">
                                <Icon className="w-24 h-24" />
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* 1. Main Growth Chart Placeholder (Spans 2 cols) */}
                <div className="lg:col-span-2 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-6 flex flex-col">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                                <Activity className="w-5 h-5 text-indigo-500" /> 시간별 전환 성과 추이
                            </h2>
                            <p className="text-xs text-zinc-500 mt-1">최근 24시간 동안의 클릭 대비 전환율(CVR) 비교 그래프</p>
                        </div>
                        <select className="bg-zinc-50 dark:bg-zinc-800 border-none text-xs rounded-md p-2 uppercase font-semibold text-zinc-600 dark:text-zinc-400 cursor-pointer outline-none">
                            <option>Today</option>
                            <option>Last 7 Days</option>
                        </select>
                    </div>

                    {/* Simulated CSS Bar Chart */}
                    <div className="flex-1 min-h-[250px] flex items-end justify-between gap-2 px-2 mt-4 relative">
                        {/* Grid lines */}
                        <div className="absolute inset-0 flex flex-col justify-between -z-10 px-2 pb-6">
                            {[1, 2, 3, 4].map(i => <div key={i} className="w-full border-t border-zinc-100 dark:border-zinc-800"></div>)}
                        </div>

                        {/* Bars representing hours */}
                        {Array.from({ length: 24 }).map((_, i) => {
                            const height1 = Math.floor(Math.random() * 80) + 20; // Imp
                            const height2 = Math.floor(Math.random() * (height1 - 10)) + 10; // Clicks/Conv
                            return (
                                <div key={i} className="w-full flex justify-center group relative cursor-crosshair">
                                    <div className="absolute -top-10 scale-0 group-hover:scale-100 transition-transform bg-zinc-800 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap z-20 shadow-lg">
                                        {i}:00 <br />
                                        성과: {height2}
                                    </div>
                                    <div
                                        className="w-1/2 bg-indigo-100 hover:bg-indigo-200 dark:bg-indigo-900/40 dark:hover:bg-indigo-800/60 rounded-t-sm transition-colors absolute bottom-0"
                                        style={{ height: `${height1}%` }}
                                    ></div>
                                    <div
                                        className="w-1/2 bg-indigo-500 hover:bg-indigo-400 dark:bg-indigo-500 dark:hover:bg-indigo-400 rounded-t-sm transition-colors absolute bottom-0 z-10"
                                        style={{ height: `${height2}%` }}
                                    ></div>
                                </div>
                            );
                        })}
                    </div>
                    <div className="flex justify-between text-[10px] text-zinc-400 mt-2">
                        <span>00:00</span>
                        <span>06:00</span>
                        <span>12:00</span>
                        <span>18:00</span>
                        <span>24:00</span>
                    </div>
                </div>

                {/* 2. Live Alerts column */}
                <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-6 flex flex-col">
                    <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2 mb-6">
                        <Clock className="w-5 h-5 text-amber-500" /> 실시간 알림 센터
                    </h2>

                    <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                        <div className="flex gap-3 relative before:absolute before:inset-y-0 before:left-1.5 before:border-l before:border-zinc-200 dark:before:border-zinc-800">
                            <div className="relative z-10 w-3 h-3 rounded-full bg-rose-500 mt-1 shrink-0 ring-4 ring-white dark:ring-zinc-900"></div>
                            <div>
                                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                                    단가 상승 경고
                                    <span className="text-[10px] bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded font-bold">HIGH</span>
                                </p>
                                <p className="text-xs text-zinc-500 mt-0.5">CMP-1004 캠페인의 CPA가 목표치 대비 42% 초과 중입니다. 즉각적인 소재 점검이 필요합니다.</p>
                                <span className="text-[10px] text-zinc-400 mt-1 block">15분 전</span>
                            </div>
                        </div>

                        <div className="flex gap-3 relative before:absolute before:inset-y-0 before:left-1.5 before:border-l before:border-zinc-200 dark:before:border-zinc-800">
                            <div className="relative z-10 w-3 h-3 rounded-full bg-amber-500 mt-1 shrink-0 ring-4 ring-white dark:ring-zinc-900"></div>
                            <div>
                                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">일일 예산 소진 임박</p>
                                <p className="text-xs text-zinc-500 mt-0.5">글로벌 타겟팅 캠페인이 금일 설정된 예산의 90%를 소진했습니다.</p>
                                <span className="text-[10px] text-zinc-400 mt-1 block">1시간 전</span>
                            </div>
                        </div>

                        <div className="flex gap-3 relative">
                            <div className="relative z-10 w-3 h-3 rounded-full bg-emerald-500 mt-1 shrink-0 ring-4 ring-white dark:ring-zinc-900"></div>
                            <div>
                                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">ROAS 목표 조기 달성</p>
                                <p className="text-xs text-zinc-500 mt-0.5">리타겟팅 캠페인 ROAS 500% 초과, 벤치마크를 상회중입니다.</p>
                                <span className="text-[10px] text-zinc-400 mt-1 block">3시간 전</span>
                            </div>
                        </div>
                    </div>
                </div>

            </div >

            {/* Table Section */}
            < div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden" >
                <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40">
                    <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                        실시간 모니터링 캠페인
                        <span className="bg-indigo-100 text-indigo-700 text-[10px] px-2 py-0.5 rounded-full uppercase font-bold tracking-wider">Live</span>
                    </h2>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-zinc-500 dark:text-zinc-400 uppercase bg-zinc-50 dark:bg-zinc-900/60 font-semibold border-b border-zinc-200 dark:border-zinc-800">
                            <tr>
                                <th className="px-6 py-4">캠페인</th>
                                <th className="px-6 py-4">매체</th>
                                <th className="px-6 py-4">금일 지출액</th>
                                <th className="px-6 py-4">ROAS</th>
                                <th className="px-6 py-4">CPA</th>
                                <th className="px-6 py-4 text-center">상태</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                            {mockCampaigns.map((camp) => (
                                <tr key={camp.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="font-medium text-zinc-900 dark:text-zinc-100">{camp.name}</div>
                                        <div className="text-xs text-zinc-400 font-mono mt-0.5">{camp.id}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider ${camp.platform === 'Meta' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                                            }`}>{camp.platform}</span>
                                    </td>
                                    <td className="px-6 py-4 font-medium text-zinc-700 dark:text-zinc-300">{camp.spend}</td>
                                    <td className="px-6 py-4">
                                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">{camp.roas}</span>
                                    </td>
                                    <td className="px-6 py-4">{camp.cpa}</td>
                                    <td className="px-6 py-4 text-center">
                                        {camp.status === 'normal' && <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"><CheckCircle2 className="w-3.5 h-3.5" /> 정상 구동중</span>}
                                        {camp.status === 'warning' && <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400"><AlertTriangle className="w-3.5 h-3.5" /> 예산 소진 임박</span>}
                                        {camp.status === 'error' && <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400"><Activity className="w-3.5 h-3.5" /> 단가 상승 주의</span>}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div >

        </div >
    );
}
