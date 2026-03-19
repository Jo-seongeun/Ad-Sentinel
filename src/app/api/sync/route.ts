import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Mock function to simulate Google Sheets API fetch
async function fetchGoogleSheetData(team_id: string) {
    // Returns mock standard media mix data
    return [
        {
            team_id,
            campaign_name: 'Spring_Sale_2026',
            adset_name: 'Broad_Audience',
            ad_name: 'Video_V1',
            budget_plan: 50000,
            start_date: '2026-03-01',
            end_date: '2026-03-31',
            landing_url: 'https://example.com/sale',
            utm_parameters: 'utm_source=meta&utm_medium=cpc',
            platform: 'META',
            ad_account_id: 'act_12345'
        },
        {
            team_id,
            campaign_name: 'Search_Brand_2026',
            adset_name: 'Exact_Match',
            ad_name: 'Text_Ad_1',
            budget_plan: 100000,
            start_date: '2026-03-01',
            end_date: '2026-12-31',
            landing_url: 'https://example.com/brand',
            utm_parameters: 'utm_source=google&utm_medium=cpc',
            platform: 'GOOGLE',
            ad_account_id: '123-456-7890'
        }
    ];
}

export async function POST(request: Request) {
    try {
        const { team_id } = await request.json();

        if (!team_id) {
            return NextResponse.json({ error: 'team_id is required' }, { status: 400 });
        }

        // 1. Fetch mock Google Sheet data
        const sheetData = await fetchGoogleSheetData(team_id);

        // 2. Fetch current active campaigns from DB for this team
        const { data: activeCampaigns, error: fetchError } = await supabase
            .from('planned_campaigns')
            .select('*')
            .eq('team_id', team_id)
            .eq('is_active', true);

        if (fetchError) {
            throw new Error(`Failed to fetch active campaigns: ${fetchError.message}`);
        }

        const updates = [];
        const inserts = [];

        for (const sheetRow of sheetData) {
            // Find matching active campaign by unique key (campaign + adset + ad)
            const existing = activeCampaigns?.find(
                (c) =>
                    c.campaign_name === sheetRow.campaign_name &&
                    c.adset_name === sheetRow.adset_name &&
                    c.ad_name === sheetRow.ad_name
            );

            if (existing) {
                // Compare to see if there are changes
                const isChanged =
                    existing.budget_plan !== sheetRow.budget_plan ||
                    existing.start_date !== sheetRow.start_date ||
                    existing.end_date !== sheetRow.end_date ||
                    existing.landing_url !== sheetRow.landing_url ||
                    existing.utm_parameters !== sheetRow.utm_parameters;

                if (isChanged) {
                    // Deactivate old version
                    updates.push({ ...existing, is_active: false });
                    // Insert new version with incremented version_no
                    inserts.push({
                        ...sheetRow,
                        version_no: existing.version_no + 1,
                        is_active: true
                    });
                }
            } else {
                // Completely new campaign
                inserts.push({ ...sheetRow, version_no: 1, is_active: true });
            }
        }

        // Process deactivations
        if (updates.length > 0) {
            for (const update of updates) {
                await supabase
                    .from('planned_campaigns')
                    .update({ is_active: false })
                    .eq('plan_id', update.plan_id);
            }
        }

        // Process insertions
        if (inserts.length > 0) {
            const { error: insertError } = await supabase
                .from('planned_campaigns')
                .insert(inserts);

            if (insertError) {
                throw new Error(`Failed to insert new campaigns: ${insertError.message}`);
            }
        }

        return NextResponse.json({
            message: 'Sync completed successfully',
            updated: updates.length,
            inserted: inserts.length
        });
    } catch (error: any) {
        console.error('Sync Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
