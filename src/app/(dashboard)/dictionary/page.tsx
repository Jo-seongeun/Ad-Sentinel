import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/utils/supabase/server';
import { BookOpen } from 'lucide-react';
import DictionaryClientUI from './DictionaryClientUI';

export default async function DictionaryPage() {
    // Authenticate user first using regular client
    const userClient = await createClient();
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return null;

    // Use admin client to query public ad_enum_values metadata to bypass RLS policies
    const adminClient = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: enums, error } = await adminClient
        .from('ad_enum_values')
        .select('*')
        .order('platform', { ascending: true })
        .order('field_type', { ascending: true })
        .order('api_value', { ascending: true });

    if (error) {
        console.error('Error fetching ad enum values:', error);
    }

    return (
        <div className="space-y-6 flex flex-col h-[calc(100vh-4rem)]">
            <header className="flex justify-between items-end flex-shrink-0 mb-2">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
                        <BookOpen className="w-6 h-6 text-indigo-500" />
                        매체 사전 가이드
                    </h1>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                        Meta Ads 및 Google Ads API 통신 값에 매핑되는 한국어 설정 명칭 및 상세 가이드를 검색합니다.
                    </p>
                </div>
            </header>

            <DictionaryClientUI initialEnums={enums || []} />
        </div>
    );
}
