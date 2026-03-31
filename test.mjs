import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
    const { data: users } = await supabase.from('users').select('email, role, team_id');
    const { data: teams } = await supabase.from('teams').select('id, name');
    const { data: mappings } = await supabase.from('team_account_map').select('*');

    console.log('====== USERS ======');
    console.table(users);

    console.log('====== TEAMS ======');
    console.table(teams);

    console.log('====== MAPPINGS ======');
    console.table(mappings);
}

check();
