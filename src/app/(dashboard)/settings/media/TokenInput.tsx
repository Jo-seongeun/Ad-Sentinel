'use client';

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export default function TokenInput({ defaultValue }: { defaultValue: string }) {
    const [show, setShow] = useState(false);

    return (
        <div className="relative">
            <input
                type={show ? "text" : "password"}
                name="accessToken"
                defaultValue={defaultValue}
                className="w-full text-sm rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-2.5 pr-10 outline-none focus:border-indigo-500 font-mono text-zinc-600 dark:text-zinc-400"
                placeholder="EAABw..."
            />
            <button
                type="button"
                onClick={() => setShow(!show)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                title={show ? "토큰 숨기기" : "토큰 보기"}
            >
                {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
        </div>
    );
}
