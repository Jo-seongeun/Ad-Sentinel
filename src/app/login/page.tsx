import { login, signup } from './actions'
import Link from 'next/link'

type SearchParams = Promise<{ message?: string; mode?: string }>

export default async function LoginPage(props: { searchParams: SearchParams }) {
    const searchParams = await props.searchParams;
    const message = searchParams.message;
    const isSignup = searchParams.mode === 'signup';

    return (
        <div className="flex items-center justify-center min-h-screen bg-zinc-50 dark:bg-zinc-950 p-4">
            <form className="w-full max-w-sm flex flex-col gap-5 p-8 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm">
                <div className="text-center mb-2">
                    <div className="w-12 h-12 bg-indigo-600 rounded-xl mx-auto mb-4 flex items-center justify-center">
                        <span className="text-white font-bold text-xl">A</span>
                    </div>
                    <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Ad-Sentinel</h2>
                    <p className="text-sm text-zinc-500 mt-1">
                        {isSignup ? '새 계정을 생성하세요.' : '로그인하여 계속 진행하세요.'}
                    </p>
                </div>

                {message && (
                    <div className="p-3 text-sm text-center text-rose-600 bg-rose-50 dark:bg-rose-900/30 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50 rounded-lg">
                        {message}
                    </div>
                )}

                {isSignup && (
                    <div className="flex flex-col gap-1.5 animate-in slide-in-from-top-2 fade-in duration-200">
                        <label htmlFor="fullName" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">사용자 명</label>
                        <input
                            id="fullName"
                            name="fullName"
                            type="text"
                            placeholder="홍길동_퍼포먼스1팀"
                            required
                            className="p-2.5 text-sm border rounded-lg bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 outline-none focus:border-indigo-500 dark:focus:border-indigo-500 transition-colors"
                        />
                    </div>
                )}

                <div className="flex flex-col gap-1.5">
                    <label htmlFor="email" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">이메일</label>
                    <input
                        id="email"
                        name="email"
                        type="email"
                        placeholder="you@example.com"
                        required
                        className="p-2.5 text-sm border rounded-lg bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 outline-none focus:border-indigo-500 dark:focus:border-indigo-500 transition-colors"
                    />
                </div>

                <div className="flex flex-col gap-1.5">
                    <label htmlFor="password" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">비밀번호</label>
                    <input
                        id="password"
                        name="password"
                        type="password"
                        placeholder="••••••••"
                        required
                        className="p-2.5 text-sm border rounded-lg bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 outline-none focus:border-indigo-500 dark:focus:border-indigo-500 transition-colors"
                    />
                </div>

                <div className="flex flex-col gap-3 mt-4">
                    {isSignup ? (
                        <>
                            <button formAction={signup} className="w-full bg-indigo-600 text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2">
                                회원가입
                            </button>
                            <div className="text-center text-sm text-zinc-500 mt-2">
                                이미 계정이 있으신가요? <Link href="/login" className="text-indigo-600 hover:underline font-semibold ml-1">로그인</Link>
                            </div>
                        </>
                    ) : (
                        <>
                            <button formAction={login} className="w-full bg-indigo-600 text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2">
                                로그인
                            </button>
                            <div className="text-center text-sm text-zinc-500 mt-2">
                                계정이 없으신가요? <Link href="/login?mode=signup" className="text-indigo-600 hover:underline font-semibold ml-1">회원가입</Link>
                            </div>
                        </>
                    )}
                </div>
            </form>
        </div>
    )
}

