import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET() {
    const supabase = await createClient()

    // 1. Check authentication status
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Fetch team filtered accounts from team_account_map
    // Due to the RLS policy: USING (team_id = current_user_team_id())
    // this query automatically filters out any rows that do not belong to the user's team.
    const { data: accounts, error: accountError } = await supabase
        .from('team_account_map')
        .select('id, team_id, platform, ad_account_id, created_at')

    if (accountError) {
        return NextResponse.json({ error: accountError.message }, { status: 500 })
    }

    return NextResponse.json({
        message: 'Success',
        user_id: user.id,
        accounts
    }, { status: 200 })
}
