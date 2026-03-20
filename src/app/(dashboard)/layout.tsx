import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Sidebar from '@/components/Sidebar';
import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
    title: 'Ad-Sentinel Dashboard',
    description: 'Ad-Sentinel MVP for Campaign Auditing',
};

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect('/login');
    }

    return (
        <div className={`${inter.className} min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 flex`}>
            <Sidebar />
            <main className="flex-1 ml-72">
                <div className="p-8 max-w-7xl mx-auto">
                    {children}
                </div>
            </main>
        </div>
    );
}
