require('dotenv').config({ path: '.env.local' });

async function run() {
    const token = process.env.META_ACCESS_TOKEN;
    const act = '1777607596977990';

    // specifically look for "휴리와친구들DA_트래픽(프로필방문)_260331" campaign or adsets
    const adsetRes = await fetch(`https://graph.facebook.com/v19.0/act_${act}/adsets?fields=name,daily_budget,lifetime_budget,status,campaign_id,campaign{name,daily_budget,lifetime_budget}&limit=50&access_token=${token}`);
    const adsetData = await adsetRes.json();

    if (adsetData.data) {
        // filter adsets corresponding to the campaign name
        const match = adsetData.data.filter(a => a.campaign && a.campaign.name && a.campaign.name.includes('휴리와친구들'));
        console.log("Matched AdSets:", JSON.stringify(match, null, 2));
        if (match.length === 0) {
            console.log("No match found for given campaign name. All campaigns:");
            const uniqueCamps = [...new Set(adsetData.data.map(a => a.campaign?.name))];
            console.log(uniqueCamps.filter(Boolean));
        }
    } else {
        console.log("Error or no data:", adsetData);
    }
}
run();
