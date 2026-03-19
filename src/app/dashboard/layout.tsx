import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
    title: 'Ad-Sentinel Dashboard',
    description: 'Ad-Sentinel MVP for Campaign Auditing',
};

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className={`${inter.className} min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50`}>
            <header className="sticky top-0 z-40 w-full border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md">
                <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
                            <span className="text-white font-bold text-xl">A</span>
                        </div>
                        <h1 className="text-xl font-bold tracking-tight">Ad-Sentinel</h1>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="text-sm font-medium px-3 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800">
                            Team: Marketing A
                        </div>
                    </div>
                </div>
            </header>

            <main className="container mx-auto px-4 py-8">
                {children}
            </main>
        </div>
    );
}
