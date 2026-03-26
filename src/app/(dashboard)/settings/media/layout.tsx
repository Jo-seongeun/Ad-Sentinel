import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';

export default async function MediaSettingsLayout({ children }: { children: React.ReactNode }) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect('/login');

    const { data: adminData } = await supabase.from('users').select('role').eq('id', user.id).single();

    // Only allow SUPER_ADMIN, ADMIN
    const allowedRoles = ['SUPER_ADMIN', 'ADMIN'];
    if (!adminData || !allowedRoles.includes(adminData.role)) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="text-center">
                    <div className="w-16 h-16 bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-500 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">권한이 부족합니다</h2>
                    <p className="text-sm text-zinc-500">이 메뉴는 관리자만 접근할 수 있습니다.</p>
                </div>
            </div>
        );
    }

    return children;
}
