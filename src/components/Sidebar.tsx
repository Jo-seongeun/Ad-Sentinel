'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
    LayoutDashboard,
    Activity,
    History,
    Cable,
    Users,
    ShieldCheck,
    LogOut,
    UserCheck,
    RefreshCw
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';

type Role = 'SUPER_ADMIN' | 'ADMIN' | 'TEAM_MANAGER' | 'MEMBER' | 'GUEST';

export default function Sidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const supabase = createClient();

    // Auth State
    const [userEmail, setUserEmail] = useState<string>('Loading...');
    const [userId, setUserId] = useState<string | null>(null);
    const [role, setRole] = useState<Role>('GUEST');
    const [isUpdating, setIsUpdating] = useState(false);

    useEffect(() => {
        const fetchUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setUserEmail(user.email || '');
                setUserId(user.id);
                // Fetch real role from DB
                const { data } = await supabase.from('users').select('role').eq('id', user.id).single();
                if (data?.role) {
                    setRole(data.role as Role);
                }
            }
        };
        fetchUser();
    }, [supabase]);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.refresh(); // will trigger layout's auth check and redirect to /login
    };

    const handleRoleChange = async (newRole: Role) => {
        if (!userId) return;
        setIsUpdating(true);
        setRole(newRole); // optimistic update

        // Actually update the database so Server Components reflect this!
        await supabase.from('users').update({ role: newRole }).eq('id', userId);

        setIsUpdating(false);
        // Refresh the page so layouts & server components re-fetch securely
        router.refresh();
        router.push(pathname);
    };

    const menuItems = [
        { name: '대시보드', href: '/active', icon: LayoutDashboard, roles: ['SUPER_ADMIN', 'ADMIN', 'TEAM_MANAGER', 'MEMBER'] },
        { name: '실시간 검수 센터', href: '/audit', icon: Activity, roles: ['SUPER_ADMIN', 'ADMIN', 'TEAM_MANAGER', 'MEMBER'] },
        { name: '검수 히스토리', href: '/history', icon: History, roles: ['SUPER_ADMIN', 'ADMIN', 'TEAM_MANAGER', 'MEMBER'] },
        { name: '가입 승인 관리', href: '/settings/users', icon: UserCheck, roles: ['SUPER_ADMIN', 'ADMIN'] },
        { name: '매체 연동 관리', href: '/settings/media', icon: Cable, roles: ['SUPER_ADMIN', 'ADMIN'] },
        { name: '연결 계정 관리', href: '/settings/accounts', icon: Users, roles: ['SUPER_ADMIN', 'ADMIN'] },
    ];

    // Filter based on role
    const visibleMenus = menuItems.filter(item => item.roles.includes(role));

    const getRoleBadgeColor = () => {
        if (role === 'SUPER_ADMIN' || role === 'ADMIN') return 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400 border-rose-200 dark:border-rose-800/50';
        if (role === 'TEAM_MANAGER') return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800/50';
        return 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700';
    };

    const roleLabel = {
        'SUPER_ADMIN': '슈퍼 관리자',
        'ADMIN': '관리자',
        'TEAM_MANAGER': '팀 관리자',
        'MEMBER': '팀원',
        'GUEST': 'GUEST (미승인)'
    }[role] || '알 수 없음';

    return (
        <aside className="fixed top-0 left-0 z-50 w-72 h-screen bg-white dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800 flex flex-col transition-all">
            {/* Brand */}
            <div className="h-16 flex items-center gap-3 px-6 border-b border-zinc-200 dark:border-zinc-800">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center flex-shrink-0">
                    <ShieldCheck className="w-5 h-5 text-white" />
                </div>
                <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Ad-Sentinel</h1>
            </div>

            {/* Role Switcher Demo (MVP Testing Only) */}
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
                <div className="flex justify-between items-center mb-2">
                    <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">실시간 DB 권한 변경(테스트용)</label>
                    {isUpdating && <RefreshCw className="w-3 h-3 text-zinc-400 animate-spin" />}
                </div>
                <select
                    value={role}
                    onChange={(e) => handleRoleChange(e.target.value as Role)}
                    disabled={isUpdating}
                    className="w-full text-sm rounded-lg bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 p-2 shadow-sm focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 transition-all font-medium"
                >
                    <option value="SUPER_ADMIN">SUPER_ADMIN (슈퍼 관리자)</option>
                    <option value="ADMIN">ADMIN (관리자)</option>
                    <option value="TEAM_MANAGER">TEAM_MANAGER (팀 관리자)</option>
                    <option value="MEMBER">MEMBER (팀원)</option>
                    <option value="GUEST" disabled>GUEST (미승인)</option>
                </select>
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-1">
                {visibleMenus.length === 0 && (
                    <div className="text-sm text-zinc-500 text-center py-4">허용된 메뉴가 없습니다.</div>
                )}
                {visibleMenus.map((item) => {
                    const isActive = pathname === item.href || (pathname.startsWith(item.href) && item.href !== '/');
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${isActive
                                ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400'
                                : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/50 dark:hover:text-zinc-100'
                                }`}
                        >
                            <item.icon className="w-5 h-5" />
                            {item.name}
                        </Link>
                    );
                })}
            </nav>

            {/* User Profile Footer */}
            <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30">
                <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center flex-shrink-0">
                        <span className="text-zinc-600 dark:text-zinc-400 font-medium">
                            {userEmail.charAt(0).toUpperCase()}
                        </span>
                    </div>
                    <div className="flex-1 overflow-hidden ml-1">
                        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                            {userEmail}
                        </p>
                        <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-semibold border ${getRoleBadgeColor()}`}>
                            {roleLabel}
                        </span>
                    </div>
                </div>
                <button
                    onClick={handleLogout}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg transition-colors border border-transparent hover:border-zinc-300 dark:hover:border-zinc-700"
                >
                    <LogOut className="w-4 h-4" />
                    로그아웃
                </button>
            </div>
        </aside>
    );
}
