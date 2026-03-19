'use client';

import { X } from 'lucide-react';

interface CampaignVersion {
    version_no: number;
    budget_plan: number;
    start_date: string;
    end_date: string;
    landing_url: string;
    is_active: boolean;
    sync_at: string;
}

interface TimelineModalProps {
    isOpen: boolean;
    onClose: () => void;
    campaignName: string;
    versions: CampaignVersion[];
}

export default function TimelineModal({ isOpen, onClose, campaignName, versions }: TimelineModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="relative w-full max-w-2xl max-h-[80vh] overflow-y-auto bg-white dark:bg-zinc-900 rounded-2xl shadow-xl p-6 border border-zinc-200 dark:border-zinc-800">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>

                <h2 className="text-xl font-semibold mb-6 text-zinc-900 dark:text-zinc-100">
                    History: {campaignName}
                </h2>

                <div className="space-y-6">
                    {versions.map((v, idx) => (
                        <div key={v.version_no} className="relative flex gap-4">
                            {/* Timeline line */}
                            {idx !== versions.length - 1 && (
                                <div className="absolute left-6 top-10 bottom-[-24px] w-0.5 bg-zinc-200 dark:bg-zinc-700"></div>
                            )}

                            <div className="flex-shrink-0 mt-1">
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center border-4 border-white dark:border-zinc-900 ${v.is_active ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-500'}`}>
                                    v{v.version_no}
                                </div>
                            </div>

                            <div className={`flex-1 p-4 rounded-xl border ${v.is_active ? 'border-indigo-200 bg-indigo-50 dark:bg-indigo-900/10 dark:border-indigo-800' : 'border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50'}`}>
                                <div className="flex justify-between items-start mb-2">
                                    <h3 className="font-medium text-zinc-900 dark:text-zinc-100">
                                        {v.is_active ? 'Current Active Version' : 'Historical Version'}
                                    </h3>
                                    <span className="text-xs text-zinc-500">
                                        {new Date(v.sync_at).toLocaleString()}
                                    </span>
                                </div>

                                <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
                                    <div>
                                        <span className="block text-zinc-500 dark:text-zinc-400 mb-1">Budget</span>
                                        <span className="font-medium">₩{v.budget_plan.toLocaleString()}</span>
                                    </div>
                                    <div>
                                        <span className="block text-zinc-500 dark:text-zinc-400 mb-1">Duration</span>
                                        <span className="font-medium">{v.start_date} ~ {v.end_date}</span>
                                    </div>
                                    <div className="col-span-2">
                                        <span className="block text-zinc-500 dark:text-zinc-400 mb-1">Landing URL</span>
                                        <span className="font-medium truncate block" title={v.landing_url}>{v.landing_url}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}

                    {versions.length === 0 && (
                        <div className="text-center text-zinc-500 py-8">
                            No history available.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
