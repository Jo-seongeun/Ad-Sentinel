import { createClient } from '@/utils/supabase/server';
import { Network, Save } from 'lucide-react';
import { savePlatformSettingsAction } from './actions';
import TestMetaButton from './TestMetaButton';

export default async function MediaSettingsPage() {
    const supabase = await createClient();

    // Fetch current META settings
    const { data: metaSettings } = await supabase
        .from('platform_settings')
        .select('*')
        .eq('platform', 'META')
        .single();

    return (
        <div className="space-y-6 max-w-4xl pb-10">
            <header>
                <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
                    <Network className="w-6 h-6 text-emerald-500" />
                    매체 연동 관리
                </h1>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                    API 호출에 필요한 플랫폼 인증 정보(액세스 토큰 등)를 관리합니다. 메타(Meta) 토큰은 수명이 짧으므로 만료되기 전 주기적으로 갱신해주세요.
                </p>
            </header>

            {/* Meta Integration Card */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
                <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 flex justify-between items-center">
                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                        <svg viewBox="0 0 24 24" className="w-5 h-5 fill-[#0668E1]">
                            <path d="M23.998 12c0-6.628-5.372-12-11.999-12C5.372 0 0 5.372 0 12c0 5.988 4.388 10.954 10.124 11.852v-8.384H7.078v-3.468h3.046V9.356c0-3.008 1.792-4.669 4.533-4.669 1.313 0 2.686.234 2.686.234v2.953H15.83c-1.49 0-1.955.925-1.955 1.874V12h3.328l-.532 3.468h-2.796v8.384c5.736-.898 10.124-5.864 10.124-11.852z" />
                        </svg>
                        메타 (Meta Ads) 연동 설정
                    </h3>
                    <TestMetaButton token={metaSettings?.access_token || ''} />
                </div>
                <div className="p-6">
                    <form action={savePlatformSettingsAction} className="space-y-4">
                        <input type="hidden" name="platform" value="META" />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">App ID</label>
                                <input
                                    type="text"
                                    name="appId"
                                    defaultValue={metaSettings?.app_id || ''}
                                    className="w-full text-sm rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-2.5 outline-none focus:border-indigo-500 font-mono"
                                    placeholder="ex: 123456789012345"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">App Secret</label>
                                <input
                                    type="password"
                                    name="appSecret"
                                    defaultValue={metaSettings?.app_secret || ''}
                                    className="w-full text-sm rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-2.5 outline-none focus:border-indigo-500 font-mono"
                                    placeholder="••••••••••••••••"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                                Access Token (2시간 만료 단기 토큰)
                            </label>
                            <textarea
                                name="accessToken"
                                rows={4}
                                defaultValue={metaSettings?.access_token || ''}
                                className="w-full text-sm rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-2.5 outline-none focus:border-indigo-500 resize-none font-mono text-zinc-600 dark:text-zinc-400"
                                placeholder="EAABw..."
                            ></textarea>
                            <p className="text-xs text-zinc-500 mt-1">실제 백엔드 검수 작업은 여기에 저장된 토큰을 우선적으로 사용하여 진행됩니다.</p>
                        </div>

                        <div className="flex items-center justify-between pt-4 border-t border-zinc-100 dark:border-zinc-800">
                            <div className="text-xs text-zinc-400">
                                {metaSettings?.updated_at ? `마지막 수정: ${new Date(metaSettings.updated_at).toLocaleString('ko-KR')}` : '아직 저장된 설정이 없습니다.'}
                            </div>
                            <button type="submit" className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-6 rounded-lg text-sm transition-colors">
                                <Save className="w-4 h-4" />
                                설정 내용 저장
                            </button>
                        </div>
                    </form>
                </div>
            </div>

        </div>
    );
}
