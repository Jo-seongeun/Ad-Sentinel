import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function GET() {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY! // Bypass RLS
    );

    // all users
    const { data: users } = await supabase.from('users').select('email, role, team_id');
    // all teams
    const { data: teams } = await supabase.from('teams').select('id, name');
    // mappings
    const { data: maps } = await supabase.from('team_account_map').select('*');

    return NextResponse.json({
        users,
        teams,
        maps
    });
}
