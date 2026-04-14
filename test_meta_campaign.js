const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const { data } = await supabase.from('platform_settings').select('*').eq('id', 'META').single();
    if (!data) return console.log('No token');
    const token = data.access_token;

    const accRes = await fetch(`https://graph.facebook.com/v19.0/me/adaccounts?fields=id&access_token=${token}`);
    const accData = await accRes.json();
    if (!accData.data || accData.data.length === 0) return console.log('No accounts');

    let foundCampaign = false;
    for (const acc of accData.data) {
        const act = acc.id.replace('act_', '');
        console.log('Act:', act);

        const adsetRes = await fetch(`https://graph.facebook.com/v19.0/act_${act}/adsets?fields=name,daily_budget,lifetime_budget,campaign{name,daily_budget,lifetime_budget}&limit=5&access_token=${token}`);
        const adsetData = await adsetRes.json();

        if (adsetData.data && adsetData.data.length > 0) {
            console.log(JSON.stringify(adsetData.data.slice(0, 2), null, 2));
            foundCampaign = true;
            break;
        }
    }
}

run();
