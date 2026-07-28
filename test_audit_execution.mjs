import fs from 'fs';
import dotenv from 'dotenv';
import xlsx from 'xlsx';

dotenv.config({ path: '.env.local' });

const fileBuffer = fs.readFileSync('2026.07.27_meta_LG_데이터체크_5차.xlsx');
const wb = xlsx.read(fileBuffer, { type: 'buffer' });
const ws = wb.Sheets[wb.SheetNames[0]];
const rawData = xlsx.utils.sheet_to_json(ws, { raw: false });

console.log(`Parsed ${rawData.length} rows from Excel.`);
console.log('Sample Row 1:', rawData[0]);

const token = process.env.META_ACCESS_TOKEN;
console.log('Token exists:', Boolean(token));

const accountIds = [...new Set(rawData.map((r) => String(r['계정 ID'] || '').replace(/[^0-9]/g, '')).filter(Boolean))];
console.log('Account IDs in Excel:', accountIds);

// Direct API fetch test for Account ID
for (const act of accountIds) {
    console.log(`\n--- Fetching Meta API for Account ${act} ---`);
    const adsUrl = `https://graph.facebook.com/v19.0/act_${act}/ads?fields=id,name,adset_id,creative{id,name,title,body,call_to_action_type,url_tags,object_story_spec,asset_feed_spec},status&limit=100&access_token=${token}`;
    const res = await fetch(adsUrl);
    const data = await res.json();
    if (data.error) {
        console.error('API Error:', data.error);
    } else {
        console.log(`Fetched ${data.data?.length || 0} ads from API.`);
        if (data.data && data.data.length > 0) {
            console.log('First Ad Sample:', JSON.stringify(data.data[0], null, 2));
        }
    }
}
