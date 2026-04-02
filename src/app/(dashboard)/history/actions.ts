'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

export async function passAuditErrorAction(logId: string, rowId: number) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Get user info for logging who passed it
    const { data: myUser } = await supabase.from('users').select('full_name, email').eq('id', user.id).single();
    const passedBy = myUser?.full_name || myUser?.email || 'Unknown';

    // Fetch the specific log
    const { data: log } = await supabase.from('audit_logs').select('details').eq('id', logId).single();
    if (!log || !log.details) throw new Error('Log not found');

    let details = typeof log.details === 'string' ? JSON.parse(log.details) : log.details;

    // Find the row and mark it as passed
    details = details.map((d: any) => {
        if (d.rowId === rowId && d.status !== 'PASS') {
            return {
                ...d,
                passed: true,
                passedBy: passedBy
            };
        }
        return d;
    });

    // Recalculate physical error_count
    const newErrorCount = details.filter((d: any) => d.status !== 'PASS' && !d.passed).length;

    // Update DB
    await supabase.from('audit_logs').update({
        details: details,
        error_count: newErrorCount
    }).eq('id', logId);

    revalidatePath('/history');
    return { success: true };
}

export async function passAllAuditErrorsAction(logId: string) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Get user info for logging who passed it
    const { data: myUser } = await supabase.from('users').select('full_name, email').eq('id', user.id).single();
    const passedBy = myUser?.full_name || myUser?.email || 'Unknown';

    // Fetch the specific log
    const { data: log } = await supabase.from('audit_logs').select('details').eq('id', logId).single();
    if (!log || !log.details) throw new Error('Log not found');

    let details = typeof log.details === 'string' ? JSON.parse(log.details) : log.details;

    // Mark ALL unpassed rows as passed
    details = details.map((d: any) => {
        if (d.status !== 'PASS' && !d.passed) {
            return {
                ...d,
                passed: true,
                passedBy: passedBy
            };
        }
        return d;
    });

    // Update DB (Error count is now implicitly 0)
    await supabase.from('audit_logs').update({
        details: details,
        error_count: 0
    }).eq('id', logId);

    revalidatePath('/history');
    return { success: true };
}
