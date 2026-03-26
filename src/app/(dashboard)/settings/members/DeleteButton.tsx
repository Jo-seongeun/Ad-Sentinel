'use client';

import { Trash2 } from 'lucide-react';

export default function DeleteButton() {
    return (
        <button
            type="submit"
            title="유저 삭제"
            className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors inline-block"
            onClick={(e) => {
                if (!confirm('이 유저를 영구 삭제하시겠습니까? 복구할 수 없습니다.')) {
                    e.preventDefault();
                }
            }}
        >
            <Trash2 className="w-4 h-4" />
        </button>
    );
}
