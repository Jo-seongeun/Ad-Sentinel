'use server';

import { createClient } from '@/utils/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { ParsedRow, AuditResult } from './AuditClientUI';

export async function crosscheckApiAction(rows: ParsedRow[]): Promise<AuditResult[]> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Fetch User Team and Role
    const { data: myUser } = await supabase
        .from('users')
        .select('role, team_id, teams(name)')
        .eq('id', user.id)
        .single();

    const isAdmin = myUser?.role === 'SUPER_ADMIN' || myUser?.role === 'ADMIN';
    const myTeamName = (myUser?.teams as any)?.name;

    // Fetch Meta Token using Service Role to bypass RLS for background validation validation
    const adminClient = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: tokenData } = await adminClient
        .from('platform_settings')
        .select('*')
        .eq('platform', 'META')
        .single();

    const token = tokenData?.access_token;

    // Fetch Google Ads settings
    const { data: googleSettings } = await adminClient
        .from('platform_settings')
        .select('*')
        .eq('platform', 'GOOGLE_ADS')
        .single();

    let googleAccessToken: string | null = null;
    const liveGoogleCache: Record<string, any> = {};

    if (googleSettings?.refresh_token) {
        try {
            const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    client_id: googleSettings.app_id.trim(),
                    client_secret: googleSettings.app_secret.trim(),
                    refresh_token: googleSettings.refresh_token.trim(),
                    grant_type: 'refresh_token',
                }).toString(),
            });
            const tokenJson = await tokenRes.json();
            googleAccessToken = tokenJson.access_token || null;
        } catch (e) {
            console.error('Google Ads Token Error:', e);
        }
    }

    // Fetch all ad enum values for mapping
    const { data: enumValues } = await adminClient
        .from('ad_enum_values')
        .select('platform, field_type, api_value, kr_name');

    const getPlatformKey = (p: string): 'META' | 'GOOGLE_ADS' => {
        const up = p.toUpperCase();
        if (up.includes('GOOGLE')) return 'GOOGLE_ADS';
        return 'META';
    };

    // Mapping dictionary for Excel 한글 ➡️ API 영문
    const enumMap: Record<string, string> = {};
    // Mapping dictionary for API 영문 ➡️ 화면 한글
    const apiToKrMap: Record<string, string> = {};

    if (enumValues) {
        for (const ev of enumValues) {
            const platformKey = ev.platform.toUpperCase();
            const fieldKey = ev.field_type.toLowerCase();
            const apiVal = ev.api_value.toUpperCase().trim();
            const krName = ev.kr_name || ev.api_value;
            const krKey = String(ev.kr_name || '').replace(/\s+/g, '').toLowerCase();

            if (krKey) {
                enumMap[`${platformKey}_${fieldKey}_${krKey}`] = ev.api_value;
            }
            // Map the English API value itself (case-insensitively, spaces removed) to the canonical API value
            const apiValNormalized = apiVal.replace(/\s+/g, '').toLowerCase();
            enumMap[`${platformKey}_${fieldKey}_${apiValNormalized}`] = ev.api_value;

            apiToKrMap[`${platformKey}_${fieldKey}_${apiVal}`] = krName;
        }
    }

    const translateValue = (val: string, platformKey: string, fieldType: string): string => {
        if (!val) return '';
        const trimmedVal = val.trim();
        const normVal = trimmedVal.replace(/\s+/g, '').toLowerCase();
        const lookupKey = `${platformKey}_${fieldType}_${normVal}`;
        if (enumMap[lookupKey]) {
            return enumMap[lookupKey];
        }
        return trimmedVal; // fall back to original (e.g. if already English api_value)
    };

    const getKrName = (val: string, platformKey: string, fieldType: string): string => {
        if (!val) return '없음';
        const key = `${platformKey}_${fieldType}_${val.toUpperCase().trim()}`;
        return apiToKrMap[key] || val;
    };

    // Group rows by AccountID for efficiency and sanitize to strictly numbers, translating Korean inputs
    const processedRows = rows.map(r => {
        const pKey = getPlatformKey(r.Platform);
        return {
            ...r,
            AccountID: r.AccountID ? r.AccountID.replace(/[^0-9]/g, '') : '',
            CampaignObjective: translateValue(r.CampaignObjective, pKey, 'objective'),
            CampaignBuyingType: translateValue(r.CampaignBuyingType, pKey, 'buying_type'),
            AdSetOptimizationGoal: translateValue(r.AdSetOptimizationGoal, pKey, 'optimization_goal'),
            AdSetBillingEvent: translateValue(r.AdSetBillingEvent, pKey, 'billing_event'),
        };
    });

    const accountIds = [...new Set(processedRows.map(r => r.AccountID).filter(Boolean))];
    const liveMetaCache: Record<string, any> = {};

    // If token exists, we fetch exactly what they need from Meta Graph API
    if (token) {
        for (const act of accountIds) {
            try {
                // Fetch AdSets along with their Campaign's budget
                const adsetRes = await fetch(
                    `https://graph.facebook.com/v19.0/act_${act}/adsets?fields=name,daily_budget,lifetime_budget,status,campaign_id,campaign{name,daily_budget,lifetime_budget,start_time,stop_time,objective,buying_type},optimization_goal,billing_event,promoted_object&limit=500&access_token=${token}`,
                    { cache: 'no-store' }
                );
                const adsetData = await adsetRes.json();

                // Fetch Ads for URL & UTM checking
                const adsRes = await fetch(
                    `https://graph.facebook.com/v19.0/act_${act}/ads?fields=name,adset_id,creative{url_tags,object_story_spec},status&limit=500&access_token=${token}`,
                    { cache: 'no-store' }
                );
                const adsData = await adsRes.json();

                // Fetch Account Currency
                const accRes = await fetch(
                    `https://graph.facebook.com/v19.0/act_${act}?fields=currency&access_token=${token}`,
                    { cache: 'no-store' }
                );
                const accData = await accRes.json();

                liveMetaCache[act] = { adsets: adsetData.data || [], ads: adsData.data || [], currency: accData.currency || 'KRW' };
            } catch (error) {
                console.error(`Meta API Error for Act ${act}:`, error);
                liveMetaCache[act] = { adsets: [], ads: [] };
            }
        }
    }

    // Fetch Google Ads live data per account (only for rows with GOOGLE_ADS platform)
    if (googleAccessToken && googleSettings) {
        const googleAccountIds = [...new Set(
            processedRows
                .filter(r => r.Platform.toUpperCase().includes('GOOGLE'))
                .map(r => r.AccountID.replace(/-/g, ''))
                .filter(Boolean)
        )];
        const mccId = (googleSettings.business_id || '').replace(/-/g, '');
        const devToken = (googleSettings.access_token || '').trim();

        for (const custId of googleAccountIds) {
            try {
                const gaqlHeaders: Record<string, string> = {
                    'Authorization': `Bearer ${googleAccessToken}`,
                    'developer-token': devToken,
                    'Content-Type': 'application/json',
                };
                if (mccId) gaqlHeaders['login-customer-id'] = mccId;

                // 1. Campaign budget query (separate due to GAQL join restriction)
                const budgetQuery = `SELECT campaign.id, campaign_budget.amount_micros, campaign_budget.total_amount_micros FROM campaign WHERE campaign.status IN ('ENABLED', 'PAUSED')`;
                const budgetRes = await fetch(
                    `https://googleads.googleapis.com/v22/customers/${custId}/googleAds:searchStream`,
                    { method: 'POST', headers: gaqlHeaders, body: JSON.stringify({ query: budgetQuery }) }
                );
                const budgetData = await budgetRes.json();
                const budgetsDict: Record<string, any> = {};
                if (Array.isArray(budgetData)) {
                    for (const chunk of budgetData) {
                        for (const r of (chunk.results || [])) {
                            const cid = r.campaign?.id;
                            if (cid) budgetsDict[cid] = r.campaignBudget || {};
                        }
                    }
                }

                // 2. [쿼리 A] Ad group + ad query — Search / Shopping / Display 등 일반 캠페인
                const adQuery = `SELECT customer.currency_code, campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type, campaign.bidding_strategy_type, campaign.start_date, campaign.end_date, ad_group.id, ad_group.name, ad_group.status, ad_group_ad.ad.id, ad_group_ad.ad.name, ad_group_ad.status, ad_group_ad.ad.final_urls, ad_group_ad.ad.tracking_url_template FROM ad_group_ad WHERE ad_group_ad.status = 'ENABLED' AND campaign.status = 'ENABLED' AND ad_group.status = 'ENABLED' LIMIT 1000`;
                const adRes = await fetch(
                    `https://googleads.googleapis.com/v22/customers/${custId}/googleAds:searchStream`,
                    { method: 'POST', headers: gaqlHeaders, body: JSON.stringify({ query: adQuery }) }
                );
                const adData = await adRes.json();

                const campaigns: any[] = [];
                const adGroups: any[] = [];
                const ads: any[] = [];
                let currency = 'KRW';

                if (Array.isArray(adData)) {
                    for (const chunk of adData) {
                        for (const r of (chunk.results || [])) {
                            currency = r.customer?.currencyCode || currency;
                            const camp = r.campaign || {};
                            const adGroup = r.adGroup || {};
                            const adGroupAd = r.adGroupAd || {};
                            const ad = adGroupAd.ad || {};
                            const budget = budgetsDict[camp.id] || {};

                            if (!campaigns.find((c: any) => c.id === camp.id)) {
                                campaigns.push({
                                    id: camp.id,
                                    name: camp.name,
                                    startDate: camp.startDate,
                                    endDate: camp.endDate,
                                    channelType: camp.advertisingChannelType,
                                    biddingStrategyType: camp.biddingStrategyType || '',
                                    dailyBudget: Math.round((Number(budget.amountMicros) || 0) / 1000000),
                                    lifetimeBudget: Math.round((Number(budget.totalAmountMicros) || 0) / 1000000),
                                });
                            }
                            if (!adGroups.find((ag: any) => ag.id === adGroup.id)) {
                                adGroups.push({ id: adGroup.id, name: adGroup.name, campaignId: camp.id });
                            }
                            ads.push({
                                id: ad.id,
                                name: ad.name,
                                adGroupId: adGroup.id,
                                finalUrls: ad.finalUrls || [],
                                trackingUrl: ad.trackingUrlTemplate || '',
                            });
                        }
                    }
                }

                // 3. [쿼리 B] Campaign 보완 쿼리
                //    — 쿼리 A에서 수집되지 않은 캠페인(PMax, PAUSED 등)을 campaign 테이블에서 직접 조회
                const collectedCampaignIds = new Set(campaigns.map((c: any) => String(c.id)));
                const campaignFallbackQuery = `SELECT customer.currency_code, campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type, campaign.bidding_strategy_type, campaign.start_date, campaign.end_date FROM campaign WHERE campaign.status IN ('ENABLED', 'PAUSED') LIMIT 500`;
                const campaignFallbackRes = await fetch(
                    `https://googleads.googleapis.com/v22/customers/${custId}/googleAds:searchStream`,
                    { method: 'POST', headers: gaqlHeaders, body: JSON.stringify({ query: campaignFallbackQuery }) }
                );
                const campaignFallbackData = await campaignFallbackRes.json();

                if (Array.isArray(campaignFallbackData)) {
                    for (const chunk of campaignFallbackData) {
                        for (const r of (chunk.results || [])) {
                            currency = r.customer?.currencyCode || currency;
                            const camp = r.campaign || {};
                            // 쿼리 A에서 이미 수집된 캠페인은 스킵 (중복 방지)
                            if (collectedCampaignIds.has(String(camp.id))) continue;
                            const budget = budgetsDict[camp.id] || {};
                            campaigns.push({
                                id: camp.id,
                                name: camp.name,
                                startDate: camp.startDate,
                                endDate: camp.endDate,
                                channelType: camp.advertisingChannelType,
                                biddingStrategyType: camp.biddingStrategyType || '',
                                dailyBudget: Math.round((Number(budget.amountMicros) || 0) / 1000000),
                                lifetimeBudget: Math.round((Number(budget.totalAmountMicros) || 0) / 1000000),
                            });
                        }
                    }
                }

                liveGoogleCache[custId] = { campaigns, adGroups, ads, currency };

            } catch (e) {
                console.error(`Google Ads API Error for customer ${custId}:`, e);
                liveGoogleCache[custId] = { campaigns: [], adGroups: [], ads: [], currency: 'KRW' };
            }
        }
    }

    const results: AuditResult[] = [];

    // Process Each Row
    for (let i = 0; i < processedRows.length; i++) {
        const row = processedRows[i];
        const errors: string[] = [];
        let status: 'PASS' | 'FAIL' | 'WARNING' = 'PASS';

        // 0. Team Permission Check
        if (!isAdmin && row.Team !== myTeamName) {
            errors.push(`타 팀 데이터 접근 불가 (선언된 팀: ${row.Team || '없음'})`);
            status = 'FAIL';
        }

        // Wait a few MS to simulate heavy processing for UI effect if no token
        if (!token) {
            await new Promise(resolve => setTimeout(resolve, 50));
        }

        // (Deprecated) URL 404 Check was removed as the goal is to cross-check with Meta's actual Live URL, not to ping the server.

        if (status !== 'FAIL' && token && row.Platform.toUpperCase() === 'META') {
            const cache = liveMetaCache[row.AccountID];
            if (cache) {
                // Find AdSet using absolute space removal for safety against Excel invisible non-breaking spaces
                const safeName = String(row.AdSetName || '').replace(/\s+/g, '').toLowerCase();
                const safeCampName = String(row.CampaignName || '').replace(/\s+/g, '').toLowerCase();
                const safeCampId = String(row.CampaignID || '').replace(/\s+/g, '');

                // If CampaignID is provided in excel, match by ID (more precise). Otherwise fall back to name matching.
                const liveAdSet = cache.adsets.find((a: any) => {
                    const adSetNameMatch = String(a.name || '').replace(/\s+/g, '').toLowerCase() === safeName;
                    if (safeCampId) {
                        // ID-based campaign matching (CampaignID is optional, not required)
                        return adSetNameMatch && a.campaign_id === safeCampId;
                    } else {
                        // Fallback: name-based campaign matching
                        return adSetNameMatch && String(a.campaign?.name || '').replace(/\s+/g, '').toLowerCase() === safeCampName;
                    }
                });
                if (!liveAdSet) {
                    errors.push('매체에 일치하는 광고 세트가 없음');
                    status = 'FAIL';
                } else {
                    // Currency Check
                    if (row.Currency) {
                        const safeCurrency = row.Currency.toUpperCase().trim();
                        const liveCurrency = (cache.currency || 'KRW').toUpperCase();
                        if (safeCurrency !== liveCurrency) {
                            errors.push(`통화 불일치 (기획안: ${safeCurrency}, 매체: ${liveCurrency})`);
                            status = 'FAIL';
                        }
                    }

                    // Budget Check (Support both Campaign Budget (CBO) and AdSet Budget (ABO))
                    const excelCampDaily = Number(String(row.CampaignDailyBudget || '').replace(/,/g, '').replace(/[^0-9.]/g, '').trim()) || 0;
                    const excelCampLifetime = Number(String(row.CampaignLifetimeBudget || '').replace(/,/g, '').replace(/[^0-9.]/g, '').trim()) || 0;
                    const excelCampBudget = excelCampDaily || excelCampLifetime || 0;

                    const excelAdSetDaily = Number(String(row.AdSetDailyBudget || '').replace(/,/g, '').replace(/[^0-9.]/g, '').trim()) || 0;
                    const excelAdSetLifetime = Number(String(row.AdSetLifetimeBudget || '').replace(/,/g, '').replace(/[^0-9.]/g, '').trim()) || 0;
                    const excelAdSetBudget = excelAdSetDaily || excelAdSetLifetime || 0;

                    const liveCampDaily = Number(liveAdSet.campaign?.daily_budget) || 0;
                    const liveCampLifetime = Number(liveAdSet.campaign?.lifetime_budget) || 0;
                    const liveCampNormalized = liveCampDaily || liveCampLifetime || 0;

                    const liveAdSetDaily = Number(liveAdSet.daily_budget) || 0;
                    const liveAdSetLifetime = Number(liveAdSet.lifetime_budget) || 0;
                    const liveAdSetNormalized = liveAdSetDaily || liveAdSetLifetime || 0;

                    if (excelCampBudget > 0) {
                        // Compare Campaign Budget (CBO)
                        if (liveCampNormalized > 0 && Math.abs(liveCampNormalized - excelCampBudget) > (excelCampBudget * 0.1)) {
                            errors.push(`캠페인 예산 불일치 (기획안: ${excelCampBudget.toLocaleString()}, 매체: ${liveCampNormalized.toLocaleString()})`);
                            status = 'FAIL';
                        } else if (liveCampNormalized === 0) {
                            errors.push(`매체의 캠페인 예산이 0입니다 (세트 예산 활용 가능성)`);
                            status = 'FAIL';
                        }
                    } else if (excelAdSetBudget > 0) {
                        // Compare AdSet Budget (ABO)
                        if (liveAdSetNormalized > 0 && Math.abs(liveAdSetNormalized - excelAdSetBudget) > (excelAdSetBudget * 0.1)) {
                            errors.push(`세트 예산 불일치 (기획안: ${excelAdSetBudget.toLocaleString()}, 매체: ${liveAdSetNormalized.toLocaleString()})`);
                            status = 'FAIL';
                        } else if (liveAdSetNormalized === 0) {
                            errors.push(`매체의 세트 예산이 0입니다 (캠페인 예산 활용 가능성)`);
                            status = 'FAIL';
                        }
                    } else {
                        errors.push(`기획안 엑셀에 설정된 예산 값이 없습니다.`);
                        status = 'FAIL';
                    }

                    // Campaign Dates
                    const normalizeDate = (d: string) => d ? d.substring(0, 10).replace(/[^0-9-]/g, '') : '';
                    if (row.StartDate && liveAdSet.campaign?.start_time) {
                        const metaStart = normalizeDate(liveAdSet.campaign.start_time);
                        const excelStart = normalizeDate(row.StartDate);
                        if (metaStart !== excelStart && !liveAdSet.campaign.start_time.includes(excelStart)) {
                            errors.push(`시작일 불일치 (기획안: ${excelStart}, 매체: ${metaStart})`);
                            status = 'FAIL';
                        }
                    }
                    if (row.EndDate && liveAdSet.campaign?.stop_time) {
                        const metaStop = normalizeDate(liveAdSet.campaign.stop_time);
                        const excelStop = normalizeDate(row.EndDate);
                        if (metaStop !== excelStop && !liveAdSet.campaign.stop_time.includes(excelStop)) {
                            errors.push(`종료일 불일치 (기획안: ${excelStop}, 매체: ${metaStop})`);
                            status = 'FAIL';
                        }
                    }

                    // Campaign Parameters
                    if (row.CampaignObjective && liveAdSet.campaign?.objective !== row.CampaignObjective) {
                        const excelKr = getKrName(row.CampaignObjective, 'META', 'objective');
                        const liveKr = getKrName(liveAdSet.campaign?.objective, 'META', 'objective');
                        errors.push(`캠페인 목적 불일치 (기획안: ${excelKr}, 매체: ${liveKr})`);
                        status = 'FAIL';
                    }
                    if (row.CampaignBuyingType && liveAdSet.campaign?.buying_type !== row.CampaignBuyingType) {
                        const excelKr = getKrName(row.CampaignBuyingType, 'META', 'buying_type');
                        const liveKr = getKrName(liveAdSet.campaign?.buying_type, 'META', 'buying_type');
                        errors.push(`구매 유형 불일치 (기획안: ${excelKr}, 매체: ${liveKr})`);
                        status = 'FAIL';
                    }

                    // Optimization & Billing
                    if (row.AdSetOptimizationGoal && liveAdSet.optimization_goal !== row.AdSetOptimizationGoal) {
                        const excelKr = getKrName(row.AdSetOptimizationGoal, 'META', 'optimization_goal');
                        const liveKr = getKrName(liveAdSet.optimization_goal, 'META', 'optimization_goal');
                        errors.push(`최적화 목표 불일치 (기획안: ${excelKr}, 매체: ${liveKr})`);
                        status = 'FAIL';
                    }
                    if (row.AdSetBillingEvent && liveAdSet.billing_event !== row.AdSetBillingEvent) {
                        const excelKr = getKrName(row.AdSetBillingEvent, 'META', 'billing_event');
                        const liveKr = getKrName(liveAdSet.billing_event, 'META', 'billing_event');
                        errors.push(`과금 기준 불일치 (기획안: ${excelKr}, 매체: ${liveKr})`);
                        status = 'FAIL';
                    }

                    // Pixels and Events
                    if (row.PixelID && liveAdSet.promoted_object?.pixel_id !== row.PixelID) {
                        errors.push(`픽셀 ID 불일치 (기획안: ${row.PixelID}, 매체: ${liveAdSet.promoted_object?.pixel_id || '없음'})`);
                        status = 'FAIL';
                    }
                    if (row.CustomEventType && liveAdSet.promoted_object?.custom_event_type !== row.CustomEventType) {
                        errors.push(`이벤트 유형 불일치 (기획안: ${row.CustomEventType}, 매체: ${liveAdSet.promoted_object?.custom_event_type || '없음'})`);
                        status = 'FAIL';
                    }

                    // Check Ad Level (URL and UTM)
                    if (row.AdName) {
                        const safeAdName = String(row.AdName || '').trim().toLowerCase();
                        const liveAd = cache.ads.find((a: any) => String(a.name || '').trim().toLowerCase() === safeAdName && a.adset_id === liveAdSet.id);
                        if (!liveAd) {
                            errors.push(`매체에 일치하는 광고가 없음 (${row.AdName})`);
                            status = 'FAIL';
                        } else {
                            // Link extraction from Meta Ad
                            const creative = liveAd.creative || {};
                            const spec = creative.object_story_spec || {};
                            const metaLink = spec.link_data?.link || spec.video_data?.call_to_action?.value?.link || "";

                            // Normalize URLs for comparison (stripping query params and trailing slashes)
                            const normalizeUrl = (url: string) => {
                                if (!url) return "";
                                try {
                                    const u = new URL(url);
                                    return (u.origin + u.pathname).replace(/\/$/, '').toLowerCase();
                                } catch {
                                    return url.split('?')[0].replace(/\/$/, '').toLowerCase();
                                }
                            };

                            if (row.LandingURL) {
                                const normMeta = normalizeUrl(metaLink);
                                const normExcel = normalizeUrl(row.LandingURL);
                                if (normMeta && normExcel && normMeta !== normExcel) {
                                    errors.push(`랜딩 URL 불일치 (매체: ${metaLink})`);
                                    status = 'FAIL';
                                } else if (!metaLink) {
                                    errors.push(`매체에 랜딩 URL이 세팅되지 않음`);
                                    status = 'WARNING';
                                }
                            }

                            // UTM Parameter Check
                            const metaUtm = creative.url_tags || "";
                            if (row.UTMParameters) {
                                if (!metaUtm) {
                                    errors.push(`매체에 UTM 파라미터가 비어있음`);
                                    status = 'FAIL';
                                } else if (!metaUtm.includes(row.UTMParameters) && metaUtm !== row.UTMParameters) {
                                    errors.push(`UTM 파라미터 불일치 (매체: ${metaUtm})`);
                                    status = 'FAIL';
                                }
                            }
                        }
                    }
                }
            }
        } else if (status !== 'FAIL' && !token && row.Platform.toUpperCase() === 'META') {
            // Mock Meta logic
            if (row.Currency) {
                const safeCurrency = row.Currency.toUpperCase().trim();
                if (safeCurrency !== 'KRW') {
                    errors.push(`통화 불일치 (기획안: ${safeCurrency}, 매체: KRW)`);
                    status = 'FAIL';
                }
            }

            const excelCampBudget = Number(String(row.CampaignLifetimeBudget || row.CampaignDailyBudget || '').replace(/,/g, '').replace(/[^0-9.]/g, '').trim()) || 0;
            const excelAdSetBudget = Number(String(row.AdSetLifetimeBudget || row.AdSetDailyBudget || '').replace(/,/g, '').replace(/[^0-9.]/g, '').trim()) || 0;

            if (excelCampBudget > 0 && excelCampBudget < 1000) {
                errors.push('캠페인 예산이 비정상적으로 낮습니다.');
                status = 'FAIL';
            } else if (excelCampBudget === 0 && excelAdSetBudget > 0 && excelAdSetBudget < 1000) {
                errors.push('세트 예산이 비정상적으로 낮습니다.');
                status = 'FAIL';
            } else if (excelCampBudget === 0 && excelAdSetBudget === 0) {
                errors.push('예산 입력값이 없습니다.');
                if (status === 'PASS') status = 'WARNING';
            }

            if (!row.UTMParameters) {
                errors.push('UTM 파라미터가 누락되었습니다.');
                if (status === 'PASS') status = 'WARNING';
            }

        } else if (status !== 'FAIL' && googleAccessToken && row.Platform.toUpperCase().includes('GOOGLE')) {
            // ─── Google Ads Live Crosscheck ───
            const custId = row.AccountID.replace(/-/g, '');
            const cache = liveGoogleCache[custId];

            if (!cache) {
                errors.push('Google Ads 계정 데이터를 불러오지 못했습니다.');
                status = 'FAIL';
            } else {
                const normalizeStr = (s: string) => String(s || '').replace(/\s+/g, '').toLowerCase();
                const normalizeDate = (d: string) => d ? d.substring(0, 10).replace(/[^0-9-]/g, '') : '';
                const normalizeUrl = (url: string) => {
                    if (!url) return '';
                    try {
                        const u = new URL(url);
                        return (u.origin + u.pathname).replace(/\/$/, '').toLowerCase();
                    } catch { return url.split('?')[0].replace(/\/$/, '').toLowerCase(); }
                };

                // 1. Find campaign (by ID if provided, else by name)
                const liveCampaign = row.CampaignID
                    ? cache.campaigns.find((c: any) => String(c.id) === String(row.CampaignID).trim())
                    : cache.campaigns.find((c: any) => normalizeStr(c.name) === normalizeStr(row.CampaignName));

                if (!liveCampaign) {
                    errors.push(`매체에 일치하는 캠페인이 없음 (${row.CampaignID || row.CampaignName})`);
                    status = 'FAIL';
                } else {
                    // 2. Currency
                    if (row.Currency) {
                        const liveCurrency = (cache.currency || 'KRW').toUpperCase();
                        if (row.Currency.toUpperCase().trim() !== liveCurrency) {
                            errors.push(`통화 불일치 (기획안: ${row.Currency}, 매체: ${liveCurrency})`);
                            status = 'FAIL';
                        }
                    }

                    // 3. Budget (Google uses micros → divide by 1,000,000)
                    const excelCampDaily = Number(String(row.CampaignDailyBudget || '').replace(/[^0-9.]/g, '')) || 0;
                    const excelCampLifetime = Number(String(row.CampaignLifetimeBudget || '').replace(/[^0-9.]/g, '')) || 0;
                    const excelBudget = excelCampDaily || excelCampLifetime || 0;
                    const liveBudget = liveCampaign.dailyBudget || liveCampaign.lifetimeBudget || 0;
                    if (excelBudget > 0 && liveBudget > 0 && Math.abs(liveBudget - excelBudget) > excelBudget * 0.1) {
                        errors.push(`캠페인 예산 불일치 (기획안: ${excelBudget.toLocaleString()}, 매체: ${liveBudget.toLocaleString()})`);
                        status = 'FAIL';
                    }

                    // 4. Dates
                    if (row.StartDate && liveCampaign.startDate) {
                        const excelStart = normalizeDate(row.StartDate);
                        const liveStart = normalizeDate(liveCampaign.startDate);
                        if (excelStart && liveStart && excelStart !== liveStart) {
                            errors.push(`시작일 불일치 (기획안: ${excelStart}, 매체: ${liveStart})`);
                            status = 'FAIL';
                        }
                    }
                    if (row.EndDate && liveCampaign.endDate) {
                        const excelEnd = normalizeDate(row.EndDate);
                        const liveEnd = normalizeDate(liveCampaign.endDate);
                        if (excelEnd && liveEnd && excelEnd !== liveEnd) {
                            errors.push(`종료일 불일치 (기획안: ${excelEnd}, 매체: ${liveEnd})`);
                            status = 'FAIL';
                        }
                    }

                    // 5. Campaign objective (channel type)
                    if (row.CampaignObjective && liveCampaign.channelType) {
                        if (normalizeStr(liveCampaign.channelType) !== normalizeStr(row.CampaignObjective)) {
                            const excelKr = getKrName(row.CampaignObjective, 'GOOGLE_ADS', 'objective');
                            const liveKr = getKrName(liveCampaign.channelType, 'GOOGLE_ADS', 'objective');
                            errors.push(`캠페인 목적(채널) 불일치 (기획안: ${excelKr}, 매체: ${liveKr})`);
                            status = 'FAIL';
                        }
                    }

                    // 5-1. Campaign buying type (bidding strategy)
                    // Google Ads의 구매 유형은 입찰 전략(biddingStrategyType)으로 매핑
                    // 예: TARGET_CPA, TARGET_ROAS, MAXIMIZE_CONVERSIONS, MAXIMIZE_CLICKS, MANUAL_CPC 등
                    if (row.CampaignBuyingType && liveCampaign.biddingStrategyType) {
                        if (normalizeStr(liveCampaign.biddingStrategyType) !== normalizeStr(row.CampaignBuyingType)) {
                            const excelKr = getKrName(row.CampaignBuyingType, 'GOOGLE_ADS', 'buying_type');
                            const liveKr = getKrName(liveCampaign.biddingStrategyType, 'GOOGLE_ADS', 'buying_type');
                            errors.push(`구매 유형(입찰 전략) 불일치 (기획안: ${excelKr}, 매체: ${liveKr})`);
                            status = 'FAIL';
                        }
                    }

                    // 6. Ad group name
                    const liveAdGroup = cache.adGroups.find((ag: any) =>
                        ag.campaignId === liveCampaign.id &&
                        normalizeStr(ag.name) === normalizeStr(row.AdSetName)
                    );
                    if (row.AdSetName && !liveAdGroup) {
                        errors.push(`매체에 일치하는 광고 그룹이 없음 (${row.AdSetName})`);
                        status = 'FAIL';
                    }

                    // 7. Ad name + landing URL + UTM
                    if (row.AdName && liveAdGroup) {
                        const liveAd = cache.ads.find((a: any) =>
                            a.adGroupId === liveAdGroup.id &&
                            normalizeStr(a.name) === normalizeStr(row.AdName)
                        );
                        if (!liveAd) {
                            errors.push(`매체에 일치하는 광고가 없음 (${row.AdName})`);
                            status = 'FAIL';
                        } else {
                            // Landing URL
                            const liveLandingUrl = liveAd.finalUrls?.[0] || '';
                            if (row.LandingURL) {
                                if (!liveLandingUrl) {
                                    errors.push('매체에 랜딩 URL이 세팅되지 않음');
                                    if (status === 'PASS') status = 'WARNING';
                                } else if (normalizeUrl(liveLandingUrl) !== normalizeUrl(row.LandingURL)) {
                                    errors.push(`랜딩 URL 불일치 (매체: ${liveLandingUrl})`);
                                    status = 'FAIL';
                                }
                            }
                            // UTM (trackingUrlTemplate)
                            // tracking_url_template이 비어있으면 Google 자동 태깅(gclid) 사용 가능성 → WARNING 처리
                            if (row.UTMParameters) {
                                if (!liveAd.trackingUrl) {
                                    errors.push('매체 Tracking Template이 비어있음 — Google 자동 태깅(Auto-tagging) 사용 가능성 (UTM 검수 제외)');
                                    if (status === 'PASS') status = 'WARNING';
                                } else if (!liveAd.trackingUrl.includes(row.UTMParameters) && liveAd.trackingUrl !== row.UTMParameters) {
                                    errors.push(`UTM 파라미터 불일치 (매체: ${liveAd.trackingUrl})`);
                                    status = 'FAIL';
                                }
                            }
                        }
                    }
                }
            }
        }

        results.push({
            rowId: i,
            CampaignName: row.CampaignName,
            AdSetName: row.AdSetName,
            status,
            errors,
        });
    }

    // Insert Audit History to DB
    if (myUser?.team_id && results.length > 0) {
        // Find how many errors
        const errorCount = results.filter(r => r.status === 'FAIL').length;
        const detailsData = results.filter(r => r.status !== 'PASS');

        const { error: insertError } = await supabase.from('audit_logs').insert({
            team_id: myUser.team_id,
            total_campaigns: rows.length,
            error_count: errorCount,
            details: detailsData
        });

        if (insertError) {
            console.error('Audit Log Insert Error:', insertError);
        }
    }

    return results;
}
