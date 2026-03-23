import { login, signup } from './actions'

type SearchParams = Promise<{ message?: string }>

export default async function LoginPage(props: { searchParams: SearchParams }) {
    const searchParams = await props.searchParams;
    const message = searchParams.message;

    return (
        <div className="flex items-center justify-center min-h-screen bg-zinc-50 dark:bg-zinc-950 p-4">
            <form className="w-full max-w-sm flex flex-col gap-5 p-8 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm">
                <div className="text-center mb-2">
                    <div className="w-12 h-12 bg-indigo-600 rounded-xl mx-auto mb-4 flex items-center justify-center">
                        <span className="text-white font-bold text-xl">A</span>
                    </div>
                    <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Ad-Sentinel</h2>
                    <p className="text-sm text-zinc-500 mt-1">로그인하거나 새 계정을 생성하세요.</p>
                </div>

                {message && (
                    <div className="p-3 text-sm text-center text-rose-600 bg-rose-50 dark:bg-rose-900/30 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50 rounded-lg">
                        {message}
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

                <div className="flex flex-col gap-2 mt-4">
                    <button formAction={login} className="w-full bg-indigo-600 text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2">
                        로그인
                    </button>
                    <button formAction={signup} className="w-full bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 rounded-lg py-2 text-sm font-semibold hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
                        회원가입
                    </button>
                </div>
            </form>
        </div>
    )
}
