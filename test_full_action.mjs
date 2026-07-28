import fs from 'fs';
import dotenv from 'dotenv';
import xlsx from 'xlsx';

dotenv.config({ path: '.env.local' });

const fileBuffer = fs.readFileSync('2026.07.27_meta_LG_데이터체크_5차.xlsx');
const wb = xlsx.read(fileBuffer, { type: 'buffer' });
const ws = wb.Sheets[wb.SheetNames[0]];
const data = xlsx.utils.sheet_to_json(ws, { raw: false });

const rows = data.map(item => ({
    Platform: item['매체'] || '',
    Team: item['팀명'] || '',
    AccountID: item['계정 ID']?.toString() || '',
    CampaignID: item['캠페인 ID']?.toString() || '',
    CampaignName: item['캠페인명'] || '',
    Currency: item['통화'] || '',
    AdSetName: item['광고 세트명'] || '',
    AdName: item['광고명'] || '',
    Headline: item['헤드라인'] || '',
    BodyCopy: item['본문 카피'] || '',
    CTA: item['행동유도(CTA)'] || '',
    LandingURL: item['랜딩 URL'] || '',
    UTMParameters: item['UTM 파라미터'] || '',
}));

const token = process.env.META_ACCESS_TOKEN;
const processedRows = rows.map(r => ({
    ...r,
    AccountID: r.AccountID ? r.AccountID.replace(/[^0-9]/g, '').trim() : ''
}));

const accountIds = [...new Set(processedRows.map(r => r.AccountID).filter(Boolean))];
console.log('Account IDs:', accountIds);

const liveMetaCache = {};

for (const act of accountIds) {
    console.log(`Fetching Meta API for act_${act}...`);
    const adsetRes = await fetch(
        `https://graph.facebook.com/v19.0/act_${act}/adsets?fields=name,daily_budget,lifetime_budget,status,campaign_id,campaign{name,daily_budget,lifetime_budget,start_time,stop_time,objective,buying_type},optimization_goal,billing_event,promoted_object&limit=500&access_token=${token}`
    );
    const adsetData = await adsetRes.json();

    const adsRes = await fetch(
        `https://graph.facebook.com/v19.0/act_${act}/ads?fields=id,name,adset_id,creative{id},status,effective_status&filtering=[{"field":"effective_status","operator":"IN","value":["ACTIVE","PAUSED","PENDING_REVIEW","DISAPPROVED","PREAPPROVED","IN_PROCESS","WITH_ISSUES","CAMPAIGN_PAUSED","ADSET_PAUSED","ARCHIVED"]}]&limit=1000&access_token=${token}`
    );
    const adsJson = await adsRes.json();
    let rawAds = adsJson.data || [];

    const creativeIds = Array.from(new Set(rawAds.map((a) => a.creative?.id).filter(Boolean)));
    console.log(`Total creative IDs: ${creativeIds.length}`);
    const creativeMap = {};

    if (creativeIds.length > 0) {
        const batchSize = 50;
        for (let i = 0; i < creativeIds.length; i += batchSize) {
            const batch = creativeIds.slice(i, i + batchSize);
            const idsStr = batch.join(',');
            const batchRes = await fetch(
                `https://graph.facebook.com/v19.0/?ids=${idsStr}&fields=id,name,title,body,call_to_action_type,url_tags,object_story_spec,asset_feed_spec,degrees_of_freedom_spec&access_token=${token}`
            );
            const batchData = await batchRes.json();
            if (batchData && !batchData.error) {
                Object.assign(creativeMap, batchData);
            }
        }
    }

    const enrichedAds = rawAds.map((a) => {
        const cId = a.creative?.id;
        const fullCreative = cId ? (creativeMap[cId] || a.creative) : a.creative;
        return { ...a, creative: fullCreative };
    });

    liveMetaCache[act] = { adsets: adsetData.data || [], ads: enrichedAds };
}

console.log('Enriched ads count in cache:', liveMetaCache[accountIds[0]]?.ads?.length);

// Now simulate row 0 crosscheck
const row = processedRows[0];
const cache = liveMetaCache[row.AccountID];

const safeAdName = String(row.AdName || '').trim().toLowerCase();
const normAdName = safeAdName.replace(/\s+/g, '');
const baseAdName = safeAdName.replace(/-[a-z0-9]+$/i, '').trim();

console.log('Row 0 Excel AdName:', row.AdName);
console.log('Row 0 normAdName:', normAdName);
console.log('Row 0 baseAdName:', baseAdName);

let liveAd = cache.ads.find((a) => String(a.name || '').trim().toLowerCase() === safeAdName);
if (!liveAd) {
    liveAd = cache.ads.find((a) => String(a.name || '').replace(/\s+/g, '').toLowerCase() === normAdName);
}
if (!liveAd && baseAdName) {
    liveAd = cache.ads.find((a) => {
        const aName = String(a.name || '').trim().toLowerCase();
        return aName.includes(baseAdName) || baseAdName.includes(aName);
    });
}
if (!liveAd && cache.ads.length > 0) {
    liveAd = cache.ads.find((a) => Boolean(a.creative?.title || a.creative?.body || a.creative?.object_story_spec)) || cache.ads[0];
}

console.log('Matched liveAd name:', liveAd?.name);
console.log('Matched liveAd creative title:', liveAd?.creative?.title);
console.log('Matched liveAd creative body:', liveAd?.creative?.body);
