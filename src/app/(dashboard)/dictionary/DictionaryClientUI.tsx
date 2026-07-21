'use client';

import { useState, useMemo } from 'react';
import { Search, Copy, Check, Info, FileSpreadsheet, Map } from 'lucide-react';

// ─── 지면 매핑 데이터 ───────────────────────────────────────────────────────
interface PlacementItem {
    platform: 'META' | 'GOOGLE';
    excelKeyword: string;   // 엑셀에 입력하는 표준 키워드
    apiValue: string;       // API 실제 값
    size: string;           // 권장 소재 사이즈
    description: string;    // 특징 설명
}

const PLACEMENT_DATA: PlacementItem[] = [
    // ── Meta ────────────────────────────────────────────────────────────────
    { platform: 'META', excelKeyword: '기본 설정',               apiValue: 'facebook_feed',          size: '1080×1080 (1:1) / 1080×1350 (4:5)', description: '별도 지면 지정 없이 모든 지면에 공통 URL을 적용할 때 사용합니다.' },
    { platform: 'META', excelKeyword: '페이스북 (피드)',          apiValue: 'facebook_feed',          size: '1080×1080 (1:1) / 1080×1350 (4:5)', description: '페이스북 홈 피드에 노출되는 가장 기본적인 지면입니다.' },
    { platform: 'META', excelKeyword: '페이스북 (스토리)',        apiValue: 'facebook_story',         size: '1080×1920 (9:16)', description: '페이스북 스토리 전체화면 세로 지면입니다.' },
    { platform: 'META', excelKeyword: '페이스북 (릴스)',          apiValue: 'facebook_reels',         size: '1080×1920 (9:16)', description: '페이스북 릴스 짧은 동영상 지면입니다.' },
    { platform: 'META', excelKeyword: '인스타그램 (피드)',        apiValue: 'instagram_stream',       size: '1080×1080 (1:1) / 1080×1350 (4:5)', description: '인스타그램 홈 피드 지면입니다. API 값은 instagram_stream 입니다.' },
    { platform: 'META', excelKeyword: '인스타그램 (스트림)',      apiValue: 'instagram_stream',       size: '1080×1080 (1:1) / 1080×1350 (4:5)', description: '인스타그램 피드(스트림)와 동일한 지면입니다. Meta API 내부 명칭입니다.' },
    { platform: 'META', excelKeyword: '인스타그램 (스토리)',      apiValue: 'instagram_story',        size: '1080×1920 (9:16)', description: '인스타그램 스토리 전체화면 세로 지면입니다.' },
    { platform: 'META', excelKeyword: '인스타그램 (릴스)',        apiValue: 'instagram_reels',        size: '1080×1920 (9:16)', description: '인스타그램 릴스 짧은 동영상 지면입니다.' },
    { platform: 'META', excelKeyword: '인스타그램 (탐색 탭)',     apiValue: 'instagram_explore',      size: '1080×1080 (1:1)', description: '인스타그램 돋보기(탐색) 탭에 노출됩니다.' },
    { platform: 'META', excelKeyword: '메신저 (스토리)',          apiValue: 'messenger_stories',      size: '1080×1920 (9:16)', description: '페이스북 메신저 스토리 지면입니다.' },
    { platform: 'META', excelKeyword: 'Audience Network (네이티브)', apiValue: 'audience_network_native', size: '다양', description: 'Meta Audience Network 제휴 앱·사이트 네이티브 지면입니다.' },
    // ── Google ──────────────────────────────────────────────────────────────
    { platform: 'GOOGLE', excelKeyword: '구글 (검색 피드)',       apiValue: 'SEARCH',                 size: '텍스트 광고', description: '구글 검색 결과 페이지 상단/하단에 노출됩니다.' },
    { platform: 'GOOGLE', excelKeyword: '구글 (디스플레이)',      apiValue: 'DISPLAY',                size: '다양 (배너)', description: 'GDN — 구글 제휴 언론사, 블로그 등 배너 지면입니다.' },
    { platform: 'GOOGLE', excelKeyword: '유튜브 (인스트림)',      apiValue: 'YOUTUBE_INSTREAM',       size: '1920×1080 (16:9)', description: '유튜브 동영상 재생 전/중 스킵 가능한 인스트림 광고입니다.' },
    { platform: 'GOOGLE', excelKeyword: '유튜브 (범퍼)',          apiValue: 'YOUTUBE_BUMPER',         size: '1920×1080 (16:9)', description: '6초 스킵 불가 유튜브 범퍼 광고입니다.' },
    { platform: 'GOOGLE', excelKeyword: '유튜브 (피드)',          apiValue: 'YOUTUBE_FEED',           size: '1920×1080 (16:9)', description: '유튜브 홈 피드 및 검색 결과에 노출되는 영상 광고입니다.' },
];

interface AdEnum {
    id: number;
    platform: string;
    field_type: string;
    api_value: string;
    kr_name: string | null;
    description: string | null;
}

export default function DictionaryClientUI({ initialEnums }: { initialEnums: AdEnum[] }) {
    const [activeTab, setActiveTab] = useState<'dictionary' | 'placement'>('dictionary');
    const [placementPlatform, setPlacementPlatform] = useState<'ALL' | 'META' | 'GOOGLE'>('ALL');
    const [copiedPlacement, setCopiedPlacement] = useState<string | null>(null);

    const handleCopyPlacement = (text: string, key: string) => {
        navigator.clipboard.writeText(text);
        setCopiedPlacement(key);
        setTimeout(() => setCopiedPlacement(null), 2000);
    };

    const filteredPlacements = PLACEMENT_DATA.filter(p =>
        placementPlatform === 'ALL' || p.platform === placementPlatform
    );
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedPlatform, setSelectedPlatform] = useState<'ALL' | 'META' | 'GOOGLE_ADS'>('ALL');
    const [selectedFieldType, setSelectedFieldType] = useState<string>('ALL');
    const [copiedKey, setCopiedKey] = useState<string | null>(null);

    // Filter Logic
    const filteredEnums = useMemo(() => {
        return initialEnums.filter((item) => {
            // Platform Filter
            if (selectedPlatform !== 'ALL' && item.platform !== selectedPlatform) {
                return false;
            }
            // Field Type Filter
            if (selectedFieldType !== 'ALL' && item.field_type !== selectedFieldType) {
                return false;
            }
            // Search Filter
            if (searchTerm.trim() !== '') {
                const searchLower = searchTerm.toLowerCase();
                const krMatch = (item.kr_name || '').toLowerCase().includes(searchLower);
                const apiMatch = (item.api_value || '').toLowerCase().includes(searchLower);
                const descMatch = (item.description || '').toLowerCase().includes(searchLower);
                if (!krMatch && !apiMatch && !descMatch) {
                    return false;
                }
            }
            return true;
        });
    }, [initialEnums, selectedPlatform, selectedFieldType, searchTerm]);

    // Stats
    const stats = useMemo(() => {
        const total = initialEnums.length;
        const meta = initialEnums.filter(i => i.platform === 'META').length;
        const google = initialEnums.filter(i => i.platform === 'GOOGLE_ADS').length;
        return { total, meta, google };
    }, [initialEnums]);

    const handleCopy = (text: string, key: string) => {
        navigator.clipboard.writeText(text);
        setCopiedKey(key);
        setTimeout(() => setCopiedKey(null), 2000);
    };

    // Category Label Helper
    const getCategoryLabel = (type: string) => {
        switch (type) {
            case 'objective':
                return { text: '캠페인 목적', bg: 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/40' };
            case 'buying_type':
                return { text: '구매 유형 (입찰)', bg: 'bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800/40' };
            case 'optimization_goal':
                return { text: '최적화 목표', bg: 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/40' };
            case 'billing_event':
                return { text: '과금 기준', bg: 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800/40' };
            default:
                return { text: type, bg: 'bg-zinc-50 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800' };
        }
    };

    return (
        <div className="flex-1 flex flex-col gap-4 overflow-hidden min-h-0">
            {/* ── 탭 선택 ── */}
            <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-900 p-1 rounded-xl border border-zinc-200 dark:border-zinc-800 w-fit shrink-0">
                <button
                    onClick={() => setActiveTab('dictionary')}
                    className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
                        activeTab === 'dictionary'
                            ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm'
                            : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
                    }`}
                >
                    <FileSpreadsheet className="w-4 h-4" />
                    매체 용어 사전
                </button>
                <button
                    onClick={() => setActiveTab('placement')}
                    className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
                        activeTab === 'placement'
                            ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm'
                            : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
                    }`}
                >
                    <Map className="w-4 h-4" />
                    광고 지면 매핑 가이드
                    <span className="text-[10px] font-bold bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded">NEW</span>
                </button>
            </div>

            {/* ── 지면 매핑 가이드 탭 ── */}
            {activeTab === 'placement' && (
                <div className="flex-1 flex flex-col gap-4 overflow-hidden min-h-0">
                    <div className="bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/50 rounded-xl px-4 py-3 text-xs text-indigo-700 dark:text-indigo-400 leading-relaxed shrink-0">
                        <span className="font-bold">📌 사용 방법:</span> 엑셀 템플릿의 <code className="bg-indigo-100 dark:bg-indigo-900/50 px-1 rounded font-mono">[랜딩 URL]</code> 및 <code className="bg-indigo-100 dark:bg-indigo-900/50 px-1 rounded font-mono">[UTM 파라미터]</code> 셀에 지면을 구분할 때 아래의 <strong>엑셀 입력 키워드</strong>를 대괄호 안에 그대로 사용하세요.
                        예시: <code className="bg-indigo-100 dark:bg-indigo-900/50 px-1.5 py-0.5 rounded font-mono text-[11px]">[기본 설정 / 인스타그램 (스트림) / 페이스북 (피드)] https://example.com</code>
                    </div>

                    <div className="flex gap-1.5 p-1 bg-zinc-100 dark:bg-zinc-900 rounded-lg w-fit shrink-0">
                        {(['ALL', 'META', 'GOOGLE'] as const).map(p => (
                            <button key={p} onClick={() => setPlacementPlatform(p)}
                                className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-all ${
                                    placementPlatform === p
                                        ? p === 'META' ? 'bg-blue-600 text-white shadow-sm'
                                            : p === 'GOOGLE' ? 'bg-amber-500 text-white shadow-sm'
                                            : 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm'
                                        : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
                                }`}
                            >{p === 'ALL' ? '전체 매체' : p === 'META' ? 'Meta Ads' : 'Google Ads'}</button>
                        ))}
                    </div>

                    <div className="flex-1 overflow-y-auto min-h-0 custom-scrollbar">
                        <table className="w-full text-left border-collapse text-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
                            <thead className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider bg-zinc-50 dark:bg-zinc-900/60 border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-10">
                                <tr>
                                    <th className="px-5 py-3.5 w-20">매체</th>
                                    <th className="px-5 py-3.5 w-52">엑셀 입력 키워드 <span className="normal-case text-indigo-500">(대괄호 안에 그대로 입력)</span></th>
                                    <th className="px-5 py-3.5 w-48">API 실제 값</th>
                                    <th className="px-5 py-3.5 w-40">권장 소재 사이즈</th>
                                    <th className="px-5 py-3.5">설명 및 특징</th>
                                    <th className="px-5 py-3.5 w-28 text-center">예시 복사</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                {filteredPlacements.map((item, idx) => (
                                    <tr key={idx} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                                        <td className="px-5 py-4">
                                            {item.platform === 'META' ? (
                                                <span className="px-2 py-1 text-xs font-bold rounded-md bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50">Meta</span>
                                            ) : (
                                                <span className="px-2 py-1 text-xs font-bold rounded-md bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50">Google</span>
                                            )}
                                        </td>
                                        <td className="px-5 py-4">
                                            <div className="flex items-center gap-2 group">
                                                <code className="px-2 py-1 rounded bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 font-mono text-xs border border-indigo-200 dark:border-indigo-800/50 font-bold">
                                                    {item.excelKeyword}
                                                </code>
                                            </div>
                                        </td>
                                        <td className="px-5 py-4">
                                            <code className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-mono text-xs border border-zinc-200 dark:border-zinc-700">
                                                {item.apiValue}
                                            </code>
                                        </td>
                                        <td className="px-5 py-4 text-xs text-zinc-500 dark:text-zinc-400">{item.size}</td>
                                        <td className="px-5 py-4 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">{item.description}</td>
                                        <td className="px-5 py-4 text-center">
                                            <button
                                                onClick={() => handleCopyPlacement(`[${item.excelKeyword}] `, `${idx}-placement`)}
                                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold rounded-lg bg-zinc-100 hover:bg-indigo-50 hover:text-indigo-600 dark:bg-zinc-800 dark:hover:bg-indigo-950/40 dark:hover:text-indigo-400 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 transition-all"
                                                title={`[${item.excelKeyword}] 복사`}
                                            >
                                                {copiedPlacement === `${idx}-placement` ? (
                                                    <><Check className="w-3 h-3 text-emerald-500" /> 복사됨</>
                                                ) : (
                                                    <><Copy className="w-3 h-3" /> 복사</>
                                                )}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="p-4 border border-zinc-200 dark:border-zinc-800 bg-amber-50/50 dark:bg-amber-950/10 rounded-xl text-xs text-amber-700 dark:text-amber-400 shrink-0 leading-relaxed">
                        <span className="font-bold">💡 Multi-Placement 작성 예시:</span><br />
                        <code className="font-mono text-[11px] block mt-1.5 bg-white dark:bg-zinc-900 px-3 py-2 rounded border border-amber-200 dark:border-amber-800/40 leading-loose">
                            [기본 설정 / 인스타그램 (스트림) / 페이스북 (피드)] https://www.lg.com/de/g6?utm_source=facebook&amp;utm_medium=feed<br />
                            [페이스북 (릴스) / 페이스북 (스토리)] https://www.lg.com/de/g6?utm_source=facebook&amp;utm_medium=story
                        </code>
                        <span className="text-[10px] text-amber-600 dark:text-amber-500 mt-1.5 block">※ 여러 지면 그룹은 엑셀 셀 내에서 Alt+Enter(줄바꿈)로 구분하세요. 지면명은 위 키워드를 그대로 사용해야 파서가 정확히 인식합니다.</span>
                    </div>
                </div>
            )}

            {/* ── 기존 용어 사전 탭 ── */}
            {activeTab === 'dictionary' && <div className="flex-1 flex flex-col gap-6 overflow-hidden min-h-0">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0">
                <div className="bg-white dark:bg-zinc-900 p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">전체 사전 키워드 수</p>
                        <h3 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mt-1">{stats.total}개</h3>
                    </div>
                    <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 flex items-center justify-center text-indigo-500">
                        <FileSpreadsheet className="w-5 h-5" />
                    </div>
                </div>
                <div className="bg-white dark:bg-zinc-900 p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Meta Ads 사전 개수</p>
                        <h3 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mt-1">{stats.meta}개</h3>
                    </div>
                    <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center text-blue-500 font-bold text-sm">
                        Meta
                    </div>
                </div>
                <div className="bg-white dark:bg-zinc-900 p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Google Ads 사전 개수</p>
                        <h3 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mt-1">{stats.google}개</h3>
                    </div>
                    <div className="w-10 h-10 rounded-lg bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center text-amber-500 font-bold text-xs text-center leading-none">
                        Google
                    </div>
                </div>
            </div>

            {/* Filter controls */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 flex flex-col gap-4 shrink-0 shadow-sm">
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                    {/* Platform Selector */}
                    <div className="flex gap-1.5 p-1 bg-zinc-100 dark:bg-zinc-950 rounded-lg w-full md:w-auto">
                        <button
                            onClick={() => setSelectedPlatform('ALL')}
                            className={`flex-1 md:flex-none px-4 py-1.5 text-sm font-semibold rounded-md transition-all ${
                                selectedPlatform === 'ALL'
                                    ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm'
                                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
                            }`}
                        >
                            전체 매체
                        </button>
                        <button
                            onClick={() => setSelectedPlatform('META')}
                            className={`flex-1 md:flex-none px-4 py-1.5 text-sm font-semibold rounded-md transition-all ${
                                selectedPlatform === 'META'
                                    ? 'bg-blue-600 text-white shadow-sm'
                                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
                            }`}
                        >
                            Meta Ads
                        </button>
                        <button
                            onClick={() => setSelectedPlatform('GOOGLE_ADS')}
                            className={`flex-1 md:flex-none px-4 py-1.5 text-sm font-semibold rounded-md transition-all ${
                                selectedPlatform === 'GOOGLE_ADS'
                                    ? 'bg-amber-500 text-white shadow-sm'
                                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
                            }`}
                        >
                            Google Ads
                        </button>
                    </div>

                    {/* Search Input */}
                    <div className="relative w-full md:max-w-md">
                        <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            placeholder="한글명, 영문 API 코드 또는 설명 검색..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-zinc-900 transition-all text-zinc-900 dark:text-zinc-100"
                        />
                    </div>
                </div>

                {/* Category Type Filter */}
                <div className="flex flex-wrap gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800/60">
                    <button
                        onClick={() => setSelectedFieldType('ALL')}
                        className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${
                            selectedFieldType === 'ALL'
                                ? 'bg-zinc-900 border-zinc-900 text-white dark:bg-zinc-100 dark:border-zinc-100 dark:text-zinc-900'
                                : 'bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800'
                        }`}
                    >
                        전체 카테고리
                    </button>
                    <button
                        onClick={() => setSelectedFieldType('objective')}
                        className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${
                            selectedFieldType === 'objective'
                                ? 'bg-emerald-600 border-emerald-600 text-white'
                                : 'bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800'
                        }`}
                    >
                        캠페인 목적
                    </button>
                    <button
                        onClick={() => setSelectedFieldType('buying_type')}
                        className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${
                            selectedFieldType === 'buying_type'
                                ? 'bg-purple-600 border-purple-600 text-white'
                                : 'bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800'
                        }`}
                    >
                        구매 유형 (입찰 전략)
                    </button>
                    <button
                        onClick={() => setSelectedFieldType('optimization_goal')}
                        className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${
                            selectedFieldType === 'optimization_goal'
                                ? 'bg-amber-600 border-amber-600 text-white'
                                : 'bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800'
                        }`}
                    >
                        최적화 목표
                    </button>
                    <button
                        onClick={() => setSelectedFieldType('billing_event')}
                        className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${
                            selectedFieldType === 'billing_event'
                                ? 'bg-rose-600 border-rose-600 text-white'
                                : 'bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800'
                        }`}
                    >
                        과금 기준
                    </button>
                </div>
            </div>

            {/* Results Table Grid */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm flex-1 flex flex-col min-h-0">
                <div className="overflow-y-auto flex-1 custom-scrollbar">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-zinc-200 dark:border-zinc-800 text-xs font-bold text-zinc-500 uppercase tracking-wider">
                                <th className="px-5 py-3.5 w-24 sticky top-0 bg-zinc-50 dark:bg-zinc-900 z-10">매체</th>
                                <th className="px-5 py-3.5 w-40 sticky top-0 bg-zinc-50 dark:bg-zinc-900 z-10">카테고리</th>
                                <th className="px-5 py-3.5 w-44 sticky top-0 bg-zinc-50 dark:bg-zinc-900 z-10">한글 기입 이름</th>
                                <th className="px-5 py-3.5 w-72 sticky top-0 bg-zinc-50 dark:bg-zinc-900 z-10">API 영문 코드 (크로스체크값)</th>
                                <th className="px-5 py-3.5 sticky top-0 bg-zinc-50 dark:bg-zinc-900 z-10">설명 및 규격 가이드</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-sm">
                            {filteredEnums.length > 0 ? (
                                filteredEnums.map((item) => {
                                    const cat = getCategoryLabel(item.field_type);
                                    return (
                                        <tr key={item.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                                            {/* Platform */}
                                            <td className="px-5 py-4">
                                                {item.platform === 'META' ? (
                                                    <span className="px-2 py-1 text-xs font-bold rounded-md bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50">
                                                        Meta
                                                    </span>
                                                ) : (
                                                    <span className="px-2 py-1 text-xs font-bold rounded-md bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50">
                                                        Google
                                                    </span>
                                                )}
                                            </td>

                                            {/* Category */}
                                            <td className="px-5 py-4">
                                                <span className={`px-2.5 py-1 text-xs font-semibold rounded-md border ${cat.bg}`}>
                                                    {cat.text}
                                                </span>
                                            </td>

                                            {/* Korean Name */}
                                            <td className="px-5 py-4">
                                                <div className="flex items-center gap-1.5 group">
                                                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                                                        {item.kr_name || '-'}
                                                    </span>
                                                    {item.kr_name && (
                                                        <button
                                                            onClick={() => handleCopy(item.kr_name!, `${item.id}-kr`)}
                                                            className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                                                            title="한글 기입 이름 복사"
                                                        >
                                                            {copiedKey === `${item.id}-kr` ? (
                                                                <Check className="w-3.5 h-3.5 text-emerald-500" />
                                                            ) : (
                                                                <Copy className="w-3.5 h-3.5" />
                                                            )}
                                                        </button>
                                                    )}
                                                </div>
                                            </td>

                                            {/* API Value */}
                                            <td className="px-5 py-4">
                                                <div className="flex items-center gap-1.5 group">
                                                    <code className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-850 text-zinc-700 dark:text-zinc-300 font-mono text-xs border border-zinc-200 dark:border-zinc-800">
                                                        {item.api_value}
                                                    </code>
                                                    <button
                                                        onClick={() => handleCopy(item.api_value, `${item.id}-api`)}
                                                        className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                                                        title="API 영문 코드 복사"
                                                    >
                                                        {copiedKey === `${item.id}-api` ? (
                                                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                                                        ) : (
                                                            <Copy className="w-3.5 h-3.5" />
                                                        )}
                                                    </button>
                                                </div>
                                            </td>

                                            {/* Description */}
                                            <td className="px-5 py-4 text-zinc-500 dark:text-zinc-400 leading-relaxed text-xs">
                                                {item.description || '-'}
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={5} className="text-center py-12 text-zinc-400">
                                        <div className="flex flex-col items-center gap-2">
                                            <Info className="w-8 h-8 text-zinc-300" />
                                            <p className="font-medium">검색 결과와 일치하는 매체 용어 사전이 존재하지 않습니다.</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 shrink-0 text-xs text-zinc-400 flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-zinc-400" />
                    엑셀 기획안 업로드 시 한글 기입 이름을 입력하시면 내부 검수 파서가 API 영문 코드로 자동 변환하여 비교합니다.
                </div>
            </div>
        </div>
            }
        </div>
    );
}
