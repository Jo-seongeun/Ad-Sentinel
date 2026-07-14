import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';

export default async function DashboardIndex() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect('/login');
    }

    const { data } = await supabase.from('users').select('role').eq('id', user.id).single();
    const role = data?.role || 'GUEST';

    if (role === 'GUEST') {
        redirect('/sample');
    } else {
        redirect('/active');
    }
}
