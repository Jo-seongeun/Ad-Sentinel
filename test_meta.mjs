import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkMeta() {
  const { data: metaSetting } = await supabase.from('platform_settings').select('access_token').eq('id', 'META').single();
  const token = metaSetting?.access_token;
  const actId = 'act_1065783086786270';
  
  const url = `https://graph.facebook.com/v19.0/${actId}/campaigns?fields=id,name,objective,effective_status,status&limit=10&access_token=${token}`;
  
  console.log('Fetching', url);
  
  const res = await fetch(url);
  const json = await res.json();
  
  console.log('STATUS:', res.status);
  console.log('JSON:', JSON.stringify(json, null, 2));
}

checkMeta();
