'use client';

import { useEffect, useState } from 'react';
import { RefreshCw, Play, AlertCircle, CheckCircle2, ShieldAlert } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import TimelineModal from '@/components/TimelineModal';

export default function Dashboard() {
    const [teamId] = useState('11111111-1111-1111-1111-111111111111'); // Mock team ID for MVP
    const [campaigns, setCampaigns] = useState<any[]>([]);
    const [auditLogs, setAuditLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [auditing, setAuditing] = useState(false);

    // Modal state
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedCampaign, setSelectedCampaign] = useState('');
    const [campaignHistory, setCampaignHistory] = useState<any[]>([]);

    const fetchData = async () => {
        setLoading(true);
        // Fetch active campaigns
        const { data: plans } = await supabase
            .from('planned_campaigns')
            .select('*')
            .eq('team_id', teamId)
            .eq('is_active', true)
            .order('sync_at', { ascending: false });

        if (plans) setCampaigns(plans);

        // Fetch unresolved audits
        const { data: audits } = await supabase
            .from('audit_logs')
            .select('*')
            .eq('team_id', teamId)
            .eq('is_resolved', false);

        if (audits) setAuditLogs(audits);
        setLoading(false);
    };

    useEffect(() => {
        fetchData();
    }, [teamId]);

    const handleSync = async () => {
        setSyncing(true);
        try {
            const res = await fetch('/api/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ team_id: teamId })
            });
            if (!res.ok) throw new Error('Sync failed');
            await fetchData();
        } catch (e) {
            console.error(e);
            alert('Failed to sync data');
        } finally {
            setSyncing(false);
        }
    };

    const handleAudit = async () => {
        setAuditing(true);
        try {
            const res = await fetch('/api/audit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ team_id: teamId })
            });
            if (!res.ok) throw new Error('Audit failed');
            await fetchData();
        } catch (e) {
            console.error(e);
            alert('Failed to run audit');
        } finally {
            setAuditing(false);
        }
    };

    const openHistory = async (campaign: any) => {
        setSelectedCampaign(campaign.campaign_name);
        // Fetch all versions of this campaign
        const { data } = await supabase
            .from('planned_campaigns')
            .select('*')
            .eq('team_id', teamId)
            .eq('campaign_name', campaign.campaign_name)
            .eq('adset_name', campaign.adset_name)
            .eq('ad_name', campaign.ad_name)
            .order('version_no', { ascending: false });

        if (data) setCampaignHistory(data);
        setModalOpen(true);
    };

    const getStatusBadge = (planId: string) => {
        const issues = auditLogs.filter(log => log.plan_id === planId);
        if (issues.length === 0) {
            return (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Normal
                </span>
            );
        }

        const hasCritical = issues.some(log => log.severity === 'CRITICAL');

        if (hasCritical) {
            return (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400">
                    <ShieldAlert className="w-3.5 h-3.5" /> Critical Error
                </span>
            );
        }

        return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                <AlertCircle className="w-3.5 h-3.5" /> Warning
            </span>
        );
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Active Campaigns</h2>
                    <p className="text-zinc-500 dark:text-zinc-400">Manage and audit your live campaign setups.</p>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={handleSync}
                        disabled={syncing}
                        className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:pointer-events-none disabled:opacity-50 bg-white border border-zinc-200 hover:bg-zinc-100 text-zinc-900 dark:bg-zinc-900 dark:border-zinc-800 dark:hover:bg-zinc-800 dark:text-zinc-100 h-10 px-4 py-2"
                    >
                        <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                        {syncing ? 'Syncing...' : 'Sync Data'}
                    </button>

                    <button
                        onClick={handleAudit}
                        disabled={auditing}
                        className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:pointer-events-none disabled:opacity-50 bg-indigo-600 text-white hover:bg-indigo-700 h-10 px-4 py-2 shadow-sm shadow-indigo-600/20"
                    >
                        <Play className={`w-4 h-4 ${auditing ? 'animate-pulse' : ''}`} />
                        {auditing ? 'Running Audit...' : 'Run Audit'}
                    </button>
                </div>
            </div>

            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-zinc-50/50 dark:bg-zinc-800/20 text-zinc-500 dark:text-zinc-400 uppercase font-medium border-b border-zinc-200 dark:border-zinc-800">
                            <tr>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4">Campaign</th>
                                <th className="px-6 py-4">Ad Set / Ad</th>
                                <th className="px-6 py-4 text-right">Budget</th>
                                <th className="px-6 py-4">Platform</th>
                                <th className="px-6 py-4">Version</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-8 text-center text-zinc-500">
                                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
                                        Loading campaigns...
                                    </td>
                                </tr>
                            ) : campaigns.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-8 text-center text-zinc-500 dark:text-zinc-400">
                                        No active campaigns found. Try syncing data from Google Sheets.
                                    </td>
                                </tr>
                            ) : (
                                campaigns.map((camp) => (
                                    <tr
                                        key={camp.plan_id}
                                        className="group hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer"
                                        onClick={() => openHistory(camp)}
                                    >
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {getStatusBadge(camp.plan_id)}
                                        </td>
                                        <td className="px-6 py-4 font-medium text-zinc-900 dark:text-zinc-100">
                                            {camp.campaign_name}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-zinc-900 dark:text-zinc-100">{camp.adset_name}</div>
                                            <div className="text-zinc-500 text-xs mt-0.5">{camp.ad_name}</div>
                                        </td>
                                        <td className="px-6 py-4 text-right text-zinc-900 dark:text-zinc-100">
                                            ₩{camp.budget_plan?.toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4 text-zinc-500">
                                            {camp.platform}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300">
                                                v{camp.version_no}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <TimelineModal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                campaignName={selectedCampaign}
                versions={campaignHistory}
            />
        </div>
    );
}
