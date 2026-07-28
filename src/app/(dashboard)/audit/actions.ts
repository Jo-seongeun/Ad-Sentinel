'use server';

import { createClient } from '@/utils/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { ParsedRow, AuditResult, FieldDiff } from './AuditClientUI';

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

    const token = tokenData?.access_token || process.env.META_ACCESS_TOKEN;

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

                // 1차: Fetch Basic Ads List
                const adsRes = await fetch(
                    `https://graph.facebook.com/v19.0/act_${act}/ads?fields=id,name,adset_id,creative{id},status&limit=500&access_token=${token}`,
                    { cache: 'no-store' }
                );
                const adsJson = await adsRes.json();
                const rawAds = adsJson.data || [];

                // 2차: Collect Creative IDs and Batch Direct Query (matching fetch_meta_insights_debug.py)
                const creativeIds = Array.from(new Set(rawAds.map((a: any) => a.creative?.id).filter(Boolean)));
                const creativeMap: Record<string, any> = {};

                if (creativeIds.length > 0) {
                    const batchSize = 50;
                    for (let i = 0; i < creativeIds.length; i += batchSize) {
                        const batch = creativeIds.slice(i, i + batchSize);
                        const idsStr = batch.join(',');
                        const batchRes = await fetch(
                            `https://graph.facebook.com/v19.0/?ids=${idsStr}&fields=id,name,title,body,call_to_action_type,url_tags,object_story_spec,asset_feed_spec,degrees_of_freedom_spec&access_token=${token}`,
                            { cache: 'no-store' }
                        );
                        const batchData = await batchRes.json();
                        if (batchData && !batchData.error) {
                            Object.assign(creativeMap, batchData);
                        }
                    }
                }

                // 3차: Combine Full Creative Details into Ads
                const enrichedAds = rawAds.map((a: any) => {
                    const cId = a.creative?.id;
                    const fullCreative = cId ? (creativeMap[cId] || a.creative) : a.creative;
                    return {
                        ...a,
                        creative: fullCreative
                    };
                });

                // Fetch Account Currency
                const accRes = await fetch(
                    `https://graph.facebook.com/v19.0/act_${act}?fields=currency&access_token=${token}`,
                    { cache: 'no-store' }
                );
                const accData = await accRes.json();

                liveMetaCache[act] = { adsets: adsetData.data || [], ads: enrichedAds, currency: accData.currency || 'KRW' };
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
        const fieldDiffs: Record<string, FieldDiff> = {};
        let status: 'PASS' | 'FAIL' | 'WARNING' = 'PASS';

        // 0. Team Permission Check
        if (!isAdmin && row.Team !== myTeamName) {
            errors.push(`타 팀 데이터 접근 불가 (선언된 팀: ${row.Team || '없음'})`);
            status = 'FAIL';
        }

        // Wait a few MS to simulate heavy processing for UI effect if no token
        if (!token && !googleAccessToken) {
            await new Promise(resolve => setTimeout(resolve, 50));
        }

        if (status !== 'FAIL' && token && row.Platform.toUpperCase() === 'META') {
            const cache = liveMetaCache[row.AccountID];
            if (cache) {
                const safeName = String(row.AdSetName || '').replace(/\s+/g, '').toLowerCase();
                const safeCampName = String(row.CampaignName || '').replace(/\s+/g, '').toLowerCase();
                const safeCampId = String(row.CampaignID || '').replace(/\s+/g, '');

                let liveAdSet: any = null;

                if (safeCampId) {
                    // 1. 엑셀에 캠페인 ID가 기재되어 있는 경우: 최우선 1:1 정밀 대조
                    liveAdSet = cache.adsets.find((a: any) => {
                        const adSetNameMatch = String(a.name || '').replace(/\s+/g, '').toLowerCase() === safeName;
                        return adSetNameMatch && String(a.campaign_id || '') === safeCampId;
                    });
                }

                if (!liveAdSet) {
                    // 2. 광고세트명 & 캠페인명 완전 1:1 대조
                    let candidateAdSets = cache.adsets.filter((a: any) => {
                        const adSetNameMatch = String(a.name || '').replace(/\s+/g, '').toLowerCase() === safeName;
                        const campNameMatch = String(a.campaign?.name || '').replace(/\s+/g, '').toLowerCase() === safeCampName;
                        return adSetNameMatch && campNameMatch;
                    });

                    // 3. 만약 캠페인명 명칭 차이로 실패 시, 광고세트명 1:1 일치 탐색 (캠페인 명칭 미세 오차 유연 허용)
                    if (candidateAdSets.length === 0 && safeName) {
                        candidateAdSets = cache.adsets.filter((a: any) => {
                            return String(a.name || '').replace(/\s+/g, '').toLowerCase() === safeName;
                        });
                    }

                    // 4. 광고세트명 부분/유사도 유연 대조
                    if (candidateAdSets.length === 0 && safeName) {
                        const baseAdSetName = safeName.replace(/-[a-z0-9]+$/i, '').trim();
                        candidateAdSets = cache.adsets.filter((a: any) => {
                            const aName = String(a.name || '').replace(/\s+/g, '').toLowerCase();
                            return aName.includes(safeName) || safeName.includes(aName) || (baseAdSetName && aName.includes(baseAdSetName));
                        });
                    }

                    const uniqueCampIds = Array.from(new Set(candidateAdSets.map((a: any) => a.campaign_id).filter(Boolean)));

                    if (candidateAdSets.length > 0) {
                        // 1순위: 활성화(ACTIVE) 상태의 캠페인/광고세트 선택
                        const activeCandidate = candidateAdSets.find((a: any) => {
                            const isCampActive = (a.campaign?.status || '').toUpperCase() === 'ACTIVE';
                            const isAdSetModifiable = (a.status || '').toUpperCase() === 'ACTIVE';
                            return isCampActive || isAdSetModifiable;
                        });

                        liveAdSet = activeCandidate || candidateAdSets[0];

                        // 2개 이상의 동명 캠페인이 발굴된 경우 마케터 안내용 스마트 경고(WARNING) 표출
                        if (uniqueCampIds.length > 1) {
                            errors.push(`⚠️ 라이브 계정에 동일 캠페인명(${row.CampaignName})이 ${uniqueCampIds.length}개 존재하여 활성화(ACTIVE) 캠페인을 우선 매칭했습니다. (정밀 대조를 위해 엑셀에 캠페인 ID 기입 권장)`);
                            if (status === 'PASS') status = 'WARNING';
                        }
                    }
                }

                if (!liveAdSet) {
                    errors.push('매체에 일치하는 광고 세트가 없음');
                    status = 'FAIL';
                    fieldDiffs['AdSetName'] = { excelVal: row.AdSetName, apiVal: '없음', matched: false, message: '광고 세트 미존재' };
                } else {
                    fieldDiffs['AdSetName'] = { excelVal: row.AdSetName, apiVal: liveAdSet.name || row.AdSetName, matched: true };

                    // 1. Currency Check
                    const safeCurrency = row.Currency ? row.Currency.toUpperCase().trim() : '';
                    const liveCurrency = (cache.currency || 'KRW').toUpperCase();
                    const currencyMatched = !safeCurrency || safeCurrency === liveCurrency;
                    fieldDiffs['Currency'] = {
                        excelVal: safeCurrency || '-',
                        apiVal: liveCurrency,
                        matched: currencyMatched,
                        message: currencyMatched ? undefined : '통화 불일치'
                    };
                    if (safeCurrency && !currencyMatched) {
                        errors.push(`통화 불일치 (기획안: ${safeCurrency}, 매체: ${liveCurrency})`);
                        status = 'FAIL';
                    }

                    // 2. Budget Check (CBO & ABO)
                    const excelCampDaily = Number(String(row.CampaignDailyBudget || '').replace(/,/g, '').replace(/[^0-9.]/g, '').trim()) || 0;
                    const excelCampLifetime = Number(String(row.CampaignLifetimeBudget || '').replace(/,/g, '').replace(/[^0-9.]/g, '').trim()) || 0;

                    const excelAdSetDaily = Number(String(row.AdSetDailyBudget || '').replace(/,/g, '').replace(/[^0-9.]/g, '').trim()) || 0;
                    const excelAdSetLifetime = Number(String(row.AdSetLifetimeBudget || '').replace(/,/g, '').replace(/[^0-9.]/g, '').trim()) || 0;

                    const liveCampDaily = Number(liveAdSet.campaign?.daily_budget) || 0;
                    const liveCampLifetime = Number(liveAdSet.campaign?.lifetime_budget) || 0;

                    const liveAdSetDaily = Number(liveAdSet.daily_budget) || 0;
                    const liveAdSetLifetime = Number(liveAdSet.lifetime_budget) || 0;

                    // 캠페인 일 예산 대조 및 표출
                    let campDailyMatched = true;
                    let isNoExcelCampDaily = false;
                    if (excelCampDaily > 0) {
                        campDailyMatched = liveCampDaily > 0 && Math.abs(liveCampDaily - excelCampDaily) <= (excelCampDaily * 0.1);
                    } else if (liveCampDaily > 0) {
                        isNoExcelCampDaily = true;
                    }

                    fieldDiffs['CampaignDailyBudget'] = {
                        excelVal: excelCampDaily > 0 ? excelCampDaily.toLocaleString() : '-',
                        apiVal: liveCampDaily > 0 ? liveCampDaily.toLocaleString() : '-',
                        matched: campDailyMatched,
                        isNoExcelInput: isNoExcelCampDaily,
                        message: campDailyMatched ? undefined : '캠페인 일 예산 불일치'
                    };
                    if (excelCampDaily > 0 && !campDailyMatched) {
                        errors.push(`캠페인 일 예산 불일치 (기획안: ${excelCampDaily.toLocaleString()}, 매체: ${liveCampDaily > 0 ? liveCampDaily.toLocaleString() : '미세팅'})`);
                        status = 'FAIL';
                    }

                    // 캠페인 총 예산 대조 및 표출
                    let campLifeMatched = true;
                    let isNoExcelCampLife = false;
                    if (excelCampLifetime > 0) {
                        campLifeMatched = liveCampLifetime > 0 && Math.abs(liveCampLifetime - excelCampLifetime) <= (excelCampLifetime * 0.1);
                    } else if (liveCampLifetime > 0) {
                        isNoExcelCampLife = true;
                    }

                    fieldDiffs['CampaignLifetimeBudget'] = {
                        excelVal: excelCampLifetime > 0 ? excelCampLifetime.toLocaleString() : '-',
                        apiVal: liveCampLifetime > 0 ? liveCampLifetime.toLocaleString() : '-',
                        matched: campLifeMatched,
                        isNoExcelInput: isNoExcelCampLife,
                        message: campLifeMatched ? undefined : '캠페인 총 예산 불일치'
                    };
                    if (excelCampLifetime > 0 && !campLifeMatched) {
                        errors.push(`캠페인 총 예산 불일치 (기획안: ${excelCampLifetime.toLocaleString()}, 매체: ${liveCampLifetime > 0 ? liveCampLifetime.toLocaleString() : '미세팅'})`);
                        status = 'FAIL';
                    }

                    // 광고세트 일 예산 대조 및 표출
                    let adsetDailyMatched = true;
                    let isNoExcelAdsetDaily = false;
                    if (excelAdSetDaily > 0) {
                        adsetDailyMatched = liveAdSetDaily > 0 && Math.abs(liveAdSetDaily - excelAdSetDaily) <= (excelAdSetDaily * 0.1);
                    } else if (liveAdSetDaily > 0) {
                        isNoExcelAdsetDaily = true;
                    }

                    fieldDiffs['AdSetDailyBudget'] = {
                        excelVal: excelAdSetDaily > 0 ? excelAdSetDaily.toLocaleString() : '-',
                        apiVal: liveAdSetDaily > 0 ? liveAdSetDaily.toLocaleString() : '-',
                        matched: adsetDailyMatched,
                        isNoExcelInput: isNoExcelAdsetDaily,
                        message: adsetDailyMatched ? undefined : '세트 일 예산 불일치'
                    };
                    if (excelAdSetDaily > 0 && !adsetDailyMatched) {
                        errors.push(`세트 일 예산 불일치 (기획안: ${excelAdSetDaily.toLocaleString()}, 매체: ${liveAdSetDaily > 0 ? liveAdSetDaily.toLocaleString() : '미세팅'})`);
                        status = 'FAIL';
                    }

                    // 광고세트 총 예산 대조 및 표출
                    let adsetLifeMatched = true;
                    let isNoExcelAdsetLife = false;
                    if (excelAdSetLifetime > 0) {
                        adsetLifeMatched = liveAdSetLifetime > 0 && Math.abs(liveAdSetLifetime - excelAdSetLifetime) <= (excelAdSetLifetime * 0.1);
                    } else if (liveAdSetLifetime > 0) {
                        isNoExcelAdsetLife = true;
                    }

                    fieldDiffs['AdSetLifetimeBudget'] = {
                        excelVal: excelAdSetLifetime > 0 ? excelAdSetLifetime.toLocaleString() : '-',
                        apiVal: liveAdSetLifetime > 0 ? liveAdSetLifetime.toLocaleString() : '-',
                        matched: adsetLifeMatched,
                        isNoExcelInput: isNoExcelAdsetLife,
                        message: adsetLifeMatched ? undefined : '세트 총 예산 불일치'
                    };
                    if (excelAdSetLifetime > 0 && !adsetLifeMatched) {
                        errors.push(`세트 총 예산 불일치 (기획안: ${excelAdSetLifetime.toLocaleString()}, 매체: ${liveAdSetLifetime > 0 ? liveAdSetLifetime.toLocaleString() : '미세팅'})`);
                        status = 'FAIL';
                    }

                    // 3. Campaign Dates
                    const normalizeDate = (d: string) => d ? d.substring(0, 10).replace(/[^0-9-]/g, '') : '';
                    const metaStart = normalizeDate(liveAdSet.campaign?.start_time || '');
                    const excelStart = normalizeDate(row.StartDate || '');
                    const startMatched = !excelStart || metaStart === excelStart || (liveAdSet.campaign?.start_time && liveAdSet.campaign.start_time.includes(excelStart));
                    fieldDiffs['StartDate'] = {
                        excelVal: excelStart || '-',
                        apiVal: metaStart || '-',
                        matched: startMatched,
                        message: startMatched ? undefined : '시작일 불일치'
                    };
                    if (excelStart && !startMatched) {
                        errors.push(`시작일 불일치 (기획안: ${excelStart}, 매체: ${metaStart})`);
                        status = 'FAIL';
                    const metaStop = normalizeDate(liveAdSet.campaign?.stop_time || '');
                    const excelStop = normalizeDate(row.EndDate || '');
                    const stopMatched = !excelStop || metaStop === excelStop || (liveAdSet.campaign?.stop_time && liveAdSet.campaign.stop_time.includes(excelStop));
                    fieldDiffs['EndDate'] = {
                        excelVal: excelStop || '-',
                        apiVal: metaStop || '-',
                        matched: stopMatched,
                        message: stopMatched ? undefined : '종료일 불일치'
                    };
                    if (excelStop && !stopMatched) {
                        errors.push(`종료일 불일치 (기획안: ${excelStop}, 매체: ${metaStop})`);
                        status = 'FAIL';
                    }

                    // 4. Campaign Objectives & Buying Type
                    const excelObjKr = row.CampaignObjective ? getKrName(row.CampaignObjective, 'META', 'objective') : '-';
                    const liveObjKr = liveAdSet.campaign?.objective ? getKrName(liveAdSet.campaign.objective, 'META', 'objective') : '-';
                    const objMatched = row.CampaignObjective ? liveAdSet.campaign?.objective === row.CampaignObjective : true;
                    const isNoExcelInputObj = !row.CampaignObjective && Boolean(liveAdSet.campaign?.objective);
                    fieldDiffs['CampaignObjective'] = {
                        excelVal: excelObjKr,
                        apiVal: liveObjKr,
                        matched: objMatched,
                        isNoExcelInput: isNoExcelInputObj,
                        message: (row.CampaignObjective && !objMatched) ? '캠페인 목적 불일치' : undefined
                    };
                    if (row.CampaignObjective && !objMatched) {
                        errors.push(`캠페인 목적 불일치 (기획안: ${excelObjKr}, 매체: ${liveObjKr})`);
                        status = 'FAIL';
                    }

                    const excelBuyKr = row.CampaignBuyingType ? getKrName(row.CampaignBuyingType, 'META', 'buying_type') : '-';
                    const liveBuyKr = liveAdSet.campaign?.buying_type ? getKrName(liveAdSet.campaign.buying_type, 'META', 'buying_type') : '-';
                    const buyMatched = row.CampaignBuyingType ? liveAdSet.campaign?.buying_type === row.CampaignBuyingType : true;
                    const isNoExcelInputBuy = !row.CampaignBuyingType && Boolean(liveAdSet.campaign?.buying_type);
                    fieldDiffs['CampaignBuyingType'] = {
                        excelVal: excelBuyKr,
                        apiVal: liveBuyKr,
                        matched: buyMatched,
                        isNoExcelInput: isNoExcelInputBuy,
                        message: (row.CampaignBuyingType && !buyMatched) ? '구매 유형 불일치' : undefined
                    };
                    if (row.CampaignBuyingType && !buyMatched) {
                        errors.push(`구매 유형 불일치 (기획안: ${excelBuyKr}, 매체: ${liveBuyKr})`);
                        status = 'FAIL';
                    }

                    // 5. Optimization & Billing
                    const excelOptKr = row.AdSetOptimizationGoal ? getKrName(row.AdSetOptimizationGoal, 'META', 'optimization_goal') : '-';
                    const liveOptKr = liveAdSet.optimization_goal ? getKrName(liveAdSet.optimization_goal, 'META', 'optimization_goal') : '-';
                    const optMatched = row.AdSetOptimizationGoal ? liveAdSet.optimization_goal === row.AdSetOptimizationGoal : true;
                    const isNoExcelInputOpt = !row.AdSetOptimizationGoal && Boolean(liveAdSet.optimization_goal);
                    fieldDiffs['AdSetOptimizationGoal'] = {
                        excelVal: excelOptKr,
                        apiVal: liveOptKr,
                        matched: optMatched,
                        isNoExcelInput: isNoExcelInputOpt,
                        message: (row.AdSetOptimizationGoal && !optMatched) ? '최적화 목표 불일치' : undefined
                    };
                    if (row.AdSetOptimizationGoal && !optMatched) {
                        errors.push(`최적화 목표 불일치 (기획안: ${excelOptKr}, 매체: ${liveOptKr})`);
                        status = 'FAIL';
                    }

                    const excelBillKr = row.AdSetBillingEvent ? getKrName(row.AdSetBillingEvent, 'META', 'billing_event') : '-';
                    const liveBillKr = liveAdSet.billing_event ? getKrName(liveAdSet.billing_event, 'META', 'billing_event') : '-';
                    const billMatched = row.AdSetBillingEvent ? liveAdSet.billing_event === row.AdSetBillingEvent : true;
                    const isNoExcelInputBill = !row.AdSetBillingEvent && Boolean(liveAdSet.billing_event);
                    fieldDiffs['AdSetBillingEvent'] = {
                        excelVal: excelBillKr,
                        apiVal: liveBillKr,
                        matched: billMatched,
                        isNoExcelInput: isNoExcelInputBill,
                        message: (row.AdSetBillingEvent && !billMatched) ? '과금 기준 불일치' : undefined
                    };
                    if (row.AdSetBillingEvent && !billMatched) {
                        errors.push(`과금 기준 불일치 (기획안: ${excelBillKr}, 매체: ${liveBillKr})`);
                        status = 'FAIL';
                    }

                    // 6. Pixels & Events
                    const livePixel = liveAdSet.promoted_object?.pixel_id || '-';
                    const pixelMatched = row.PixelID ? livePixel === row.PixelID : true;
                    const isNoExcelInputPixel = !row.PixelID && Boolean(liveAdSet.promoted_object?.pixel_id);
                    fieldDiffs['PixelID'] = {
                        excelVal: row.PixelID || '-',
                        apiVal: livePixel,
                        matched: pixelMatched,
                        isNoExcelInput: isNoExcelInputPixel,
                        message: (row.PixelID && !pixelMatched) ? '픽셀 ID 불일치' : undefined
                    };
                    if (row.PixelID && !pixelMatched) {
                        errors.push(`픽셀 ID 불일치 (기획안: ${row.PixelID}, 매체: ${livePixel})`);
                        status = 'FAIL';
                    }

                    const liveEvent = liveAdSet.promoted_object?.custom_event_type || '-';
                    const eventMatched = row.CustomEventType ? liveEvent === row.CustomEventType : true;
                    const isNoExcelInputEvent = !row.CustomEventType && Boolean(liveAdSet.promoted_object?.custom_event_type);
                    fieldDiffs['CustomEventType'] = {
                        excelVal: row.CustomEventType || '-',
                        apiVal: liveEvent,
                        matched: eventMatched,
                        isNoExcelInput: isNoExcelInputEvent,
                        message: (row.CustomEventType && !eventMatched) ? '이벤트 유형 불일치' : undefined
                    };
                    if (row.CustomEventType && !eventMatched) {
                        errors.push(`이벤트 유형 불일치 (기획안: ${row.CustomEventType}, 매체: ${liveEvent})`);
                        status = 'FAIL';
                    }

                    // 7. Ad Level Checks (AdName, LandingURL, UTM, Headline, Body, CTA)
                    const safeAdName = String(row.AdName || '').trim().toLowerCase();
                    const normAdName = safeAdName.replace(/\s+/g, '');
                    // 서픽스(-s, -a, -1 등) 제거 기본 소재명
                    const baseAdName = safeAdName.replace(/-[a-z0-9]+$/i, '').trim();

                    // 1순위: adset_id & 광고명 완전 일치 탐색
                    let liveAd = cache.ads.find((a: any) => String(a.name || '').trim().toLowerCase() === safeAdName && a.adset_id === liveAdSet.id);

                    // 2순위: 띄어쓰기 제거 후 공백 무시 일치 탐색
                    if (!liveAd) {
                        liveAd = cache.ads.find((a: any) => String(a.name || '').replace(/\s+/g, '').toLowerCase() === normAdName && a.adset_id === liveAdSet.id);
                    }

                    // 3순위: 서픽스(-S 등) 제외 접두사/부분 일치 탐색 (예: LAD_VID_OTH_DE_G6-Main-30s-S -> LAD_VID_OTH_DE_G6-Main-30s)
                    if (!liveAd && baseAdName) {
                        liveAd = cache.ads.find((a: any) => {
                            const aName = String(a.name || '').trim().toLowerCase();
                            return (aName.includes(baseAdName) || baseAdName.includes(aName)) && a.adset_id === liveAdSet.id;
                        });
                    }

                    // 4순위: 해당 광고 세트 내에 등록된 광고(Ad) 세팅값 자동 연결 Fallback
                    if (!liveAd && liveAdSet.id) {
                        const adsetAds = cache.ads.filter((a: any) => a.adset_id === liveAdSet.id);
                        if (adsetAds.length > 0) {
                            liveAd = adsetAds[0];
                        }
                    }

                    // 5순위: 계정 전체 소재명 유연 탐색 Fallback
                    if (!liveAd && baseAdName) {
                        liveAd = cache.ads.find((a: any) => {
                            const aName = String(a.name || '').trim().toLowerCase();
                            return aName.includes(baseAdName) || baseAdName.includes(aName);
                        });
                    }
                    
                    if (!liveAd) {
                        fieldDiffs['AdName'] = { excelVal: row.AdName || '-', apiVal: '없음', matched: false, message: '광고 소재 미존재' };
                        fieldDiffs['LandingURL'] = { excelVal: row.LandingURL || '-', apiVal: '미확인', matched: false };
                        fieldDiffs['UTMParameters'] = { excelVal: row.UTMParameters || '-', apiVal: '미확인', matched: false };
                        fieldDiffs['Headline'] = { excelVal: row.Headline || '-', apiVal: '미확인', matched: false };
                        fieldDiffs['BodyCopy'] = { excelVal: row.BodyCopy || '-', apiVal: '미확인', matched: false };
                        fieldDiffs['CTA'] = { excelVal: row.CTA || '-', apiVal: '미확인', matched: false };
                        
                        // 기획안 데이터(소재명, 헤드라인, 본문, URL, UTM 등)가 존재함에도 라이브 광고를 매칭하지 못한 경우 ➔ 무조건 FAIL!
                        if (row.AdName || row.Headline || row.BodyCopy || row.LandingURL || row.UTMParameters) {
                            errors.push(`매체에 일치하는 광고 소재 데이터를 찾을 수 없음 (${row.AdName || '소재명 미입력'})`);
                            status = 'FAIL';
                        }
                    } else {
                        fieldDiffs['AdName'] = { excelVal: row.AdName || '-', apiVal: liveAd.name || row.AdName, matched: true };
                        const creative = liveAd.creative || {};
                        const spec = creative.object_story_spec || {};
                        
                        // Parse Multi-Placement tagged items like "[페이스북 (스토리, 릴스)] https://..." or "[기본 설정] https://..."
                        interface PlacementItem {
                            tag: string;
                            content: string;
                        }

                        const parseMultiPlacementItems = (rawText: string): PlacementItem[] => {
                            if (!rawText) return [];
                            const lines = rawText.split(/[\r\n]+/).map(l => l.trim()).filter(Boolean);
                            const items: PlacementItem[] = [];
                            
                            for (const line of lines) {
                                const tagMatch = line.match(/^\[([^\]]+)\]\s*(.*)$/);
                                if (tagMatch) {
                                    items.push({
                                        tag: tagMatch[1].trim(),
                                        content: tagMatch[2].trim()
                                    });
                                } else {
                                    items.push({
                                        tag: '기본 설정',
                                        content: line.trim()
                                    });
                                }
                            }
                            return items;
                        };

                        const normalizeUrl = (url: string) => {
                            if (!url) return "";
                            try {
                                const u = new URL(url);
                                return (u.origin + u.pathname).replace(/\/$/, '').toLowerCase();
                            } catch {
                                return url.split('?')[0].replace(/\/$/, '').toLowerCase();
                            }
                        };

                        // Collect all URLs from live Meta API (Primary, Video CTA, Carousel Children, Multi-Placement Asset Feed)
                        const primaryUrl = spec.link_data?.link || spec.video_data?.call_to_action?.value?.link || "";
                        const childUrls: string[] = (spec.link_data?.child_attachments || [])
                            .map((c: any) => c.link)
                            .filter(Boolean);
                        const assetFeedUrls: string[] = (creative.asset_feed_spec?.link_urls || [])
                            .map((l: any) => l.website_url || l.display_url)
                            .filter(Boolean);

                        const allLiveUrls = Array.from(new Set([primaryUrl, ...childUrls, ...assetFeedUrls].filter(Boolean)));
                        const normLiveUrls = allLiveUrls.map(u => normalizeUrl(u));

                        // Multi-Placement Landing URL Crosscheck
                        const excelPlacementUrls = parseMultiPlacementItems(row.LandingURL || '');
                        let landingMatched = true;
                        let unmatchedPlacementMsg = '';

                        if (row.LandingURL) {
                            if (normLiveUrls.length === 0) {
                                landingMatched = false;
                                unmatchedPlacementMsg = '매체에 랜딩 URL 미세팅';
                            } else {
                                for (const item of excelPlacementUrls) {
                                    const normTarget = normalizeUrl(item.content);
                                    const isItemMatched = normLiveUrls.some(liveU => liveU === normTarget);
                                    if (!isItemMatched) {
                                        landingMatched = false;
                                        unmatchedPlacementMsg = `[${item.tag}] 지면 랜딩 URL 불일치`;
                                        break;
                                    }
                                }
                            }
                        }

                        const isNoExcelLanding = !row.LandingURL && normLiveUrls.length > 0;
                        fieldDiffs['LandingURL'] = {
                            excelVal: row.LandingURL || '-',
                            apiVal: primaryUrl || (normLiveUrls[0] || '미설정'),
                            matched: landingMatched,
                            isNoExcelInput: isNoExcelLanding,
                            message: landingMatched ? undefined : (unmatchedPlacementMsg || '랜딩 URL 불일치')
                        };

                        if (row.LandingURL && !landingMatched) {
                            errors.push(unmatchedPlacementMsg || '랜딩 URL 불일치');
                            status = 'FAIL';
                        }

                        // Multi-Placement UTM Parameter Crosscheck
                        const excelPlacementUtms = parseMultiPlacementItems(row.UTMParameters || '');
                        const metaUtm = creative.url_tags || "";

                        let utmMatched = true;
                        let unmatchedUtmMsg = '';

                        if (row.UTMParameters) {
                            if (!metaUtm) {
                                utmMatched = false;
                                unmatchedUtmMsg = '매체에 UTM 파라미터 미세팅';
                            } else {
                                for (const item of excelPlacementUtms) {
                                    const cleanUtm = item.content;
                                    const isUtmMatch = metaUtm && (metaUtm.includes(cleanUtm) || cleanUtm.includes(metaUtm) || metaUtm === cleanUtm);
                                    if (!isUtmMatch) {
                                        utmMatched = false;
                                        unmatchedUtmMsg = `[${item.tag}] UTM 불일치`;
                                        break;
                                    }
                                }
                            }
                        }

                        const isNoExcelUtm = !row.UTMParameters && Boolean(metaUtm);
                        fieldDiffs['UTMParameters'] = {
                            excelVal: row.UTMParameters || '-',
                            apiVal: metaUtm || '미세팅',
                            matched: utmMatched,
                            isNoExcelInput: isNoExcelUtm,
                            message: utmMatched ? undefined : (unmatchedUtmMsg || 'UTM 파라미터 불일치')
                        };

                        if (row.UTMParameters && !utmMatched) {
                            errors.push(unmatchedUtmMsg || 'UTM 파라미터 불일치');
                            status = 'FAIL';
                        }

                        // Ver2 Copy Fields (Headline, BodyCopy, CTA with normalized linebreaks & multi-spec fallbacks)
                        const cleanText = (t: string) => String(t || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();

                        const liveHeadline = 
                            creative.title || 
                            spec.link_data?.title || 
                            spec.link_data?.name || 
                            spec.video_data?.title || 
                            spec.video_data?.call_to_action?.value?.title ||
                            creative.asset_feed_spec?.titles?.[0]?.text || 
                            '';

                        const liveBodyCopy = 
                            creative.body || 
                            spec.link_data?.message || 
                            spec.video_data?.message || 
                            spec.photo_data?.message ||
                            creative.asset_feed_spec?.bodies?.[0]?.text || 
                            '';

                        const liveCTA = 
                            creative.call_to_action_type ||
                            spec.link_data?.call_to_action?.type || 
                            spec.video_data?.call_to_action?.type || 
                            creative.asset_feed_spec?.call_to_action_types?.[0] || 
                            '';

                        // 헬퍼: 엑셀 기획안과 매체 실데이터 1:1 대조 판정 로직
                        const evaluateCopy = (excelVal: string, liveVal: string, fieldLabel: string) => {
                            const normExcel = cleanText(excelVal);
                            const normLive = cleanText(liveVal);

                            if (normExcel) {
                                if (!normLive) {
                                    // 🚨 기획안 작성 O, 매체 API 데이터 X ➔ ❌ 불일치!
                                    return {
                                        excelVal: excelVal,
                                        apiVal: '-',
                                        matched: false,
                                        isNoExcelInput: false,
                                        message: `매체에 ${fieldLabel} 미세팅`
                                    };
                                } else if (normExcel === normLive) {
                                    // 양쪽 내용 완전 일치 ➔ ✓ 일치
                                    return {
                                        excelVal: excelVal,
                                        apiVal: liveVal,
                                        matched: true,
                                        isNoExcelInput: false
                                    };
                                } else {
                                    // 양쪽 데이터가 존재하나 문구 다름 ➔ ❌ 불일치
                                    return {
                                        excelVal: excelVal,
                                        apiVal: liveVal,
                                        matched: false,
                                        isNoExcelInput: false,
                                        message: `${fieldLabel} 문구 상이`
                                    };
                                }
                            } else {
                                if (normLive) {
                                    // 엑셀은 비었으나 매체에 데이터 존재 ➔ ➖ 업로드 내용 없음
                                    return {
                                        excelVal: '-',
                                        apiVal: liveVal,
                                        matched: true,
                                        isNoExcelInput: true
                                    };
                                } else {
                                    // 둘 다 비어 있음 ➔ 정상 미세팅
                                    return {
                                        excelVal: '-',
                                        apiVal: '-',
                                        matched: true,
                                        isNoExcelInput: false
                                    };
                                }
                            }
                        };

                        const headDiff = evaluateCopy(row.Headline, liveHeadline, '헤드라인');
                        fieldDiffs['Headline'] = headDiff;
                        if (row.Headline && !headDiff.matched) {
                            errors.push(headDiff.message || '헤드라인 불일치');
                            status = 'FAIL';
                        }

                        const bodyDiff = evaluateCopy(row.BodyCopy, liveBodyCopy, '본문 카피');
                        fieldDiffs['BodyCopy'] = bodyDiff;
                        if (row.BodyCopy && !bodyDiff.matched) {
                            errors.push(bodyDiff.message || '본문 카피 불일치');
                            status = 'FAIL';
                        }

                        const ctaDiff = evaluateCopy(row.CTA, liveCTA, 'CTA 버튼');
                        fieldDiffs['CTA'] = ctaDiff;
                        if (row.CTA && !ctaDiff.matched) {
                            errors.push(ctaDiff.message || 'CTA 버튼 불일치');
                            status = 'FAIL';
                        }
                    }
                }
            }
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

                let liveCampaign: any = null;
                if (row.CampaignID) {
                    liveCampaign = cache.campaigns.find((c: any) => String(c.id) === String(row.CampaignID).trim());
                } else {
                    const candidateCampaigns = cache.campaigns.filter((c: any) => normalizeStr(c.name) === normalizeStr(row.CampaignName));
                    if (candidateCampaigns.length > 0) {
                        const activeCandidate = candidateCampaigns.find((c: any) => (c.status || '').toUpperCase() === 'ENABLED');
                        liveCampaign = activeCandidate || candidateCampaigns[0];

                        if (candidateCampaigns.length > 1) {
                            errors.push(`⚠️ 라이브 계정에 동일 캠페인명(${row.CampaignName})이 ${candidateCampaigns.length}개 존재하여 활성화(ENABLED) 캠페인을 우선 매칭했습니다. (정밀 대조를 위해 엑셀에 캠페인 ID 기입 권장)`);
                            if (status === 'PASS') status = 'WARNING';
                        }
                    }
                }

                if (!liveCampaign) {
                    errors.push(`매체에 일치하는 캠페인이 없음 (${row.CampaignID || row.CampaignName})`);
                    status = 'FAIL';
                } else {
                    if (row.Currency) {
                        const liveCurrency = (cache.currency || 'KRW').toUpperCase();
                        const isMatched = row.Currency.toUpperCase().trim() === liveCurrency;
                        fieldDiffs['Currency'] = { excelVal: row.Currency, apiVal: liveCurrency, matched: isMatched, message: isMatched ? undefined : '통화 불일치' };
                        if (!isMatched) {
                            errors.push(`통화 불일치 (기획안: ${row.Currency}, 매체: ${liveCurrency})`);
                            status = 'FAIL';
                        }
                    }

                    const excelCampDaily = Number(String(row.CampaignDailyBudget || '').replace(/[^0-9.]/g, '')) || 0;
                    const excelCampLifetime = Number(String(row.CampaignLifetimeBudget || '').replace(/[^0-9.]/g, '')) || 0;
                    const excelBudget = excelCampDaily || excelCampLifetime || 0;
                    const liveBudget = liveCampaign.dailyBudget || liveCampaign.lifetimeBudget || 0;
                    if (excelBudget > 0) {
                        const isMatched = liveBudget > 0 && Math.abs(liveBudget - excelBudget) <= excelBudget * 0.1;
                        fieldDiffs['CampaignBudget'] = { excelVal: excelBudget.toLocaleString(), apiVal: liveBudget.toLocaleString(), matched: isMatched, message: isMatched ? undefined : '캠페인 예산 불일치' };
                        if (!isMatched) {
                            errors.push(`캠페인 예산 불일치 (기획안: ${excelBudget.toLocaleString()}, 매체: ${liveBudget.toLocaleString()})`);
                            status = 'FAIL';
                        }
                    }

                    if (row.StartDate && liveCampaign.startDate) {
                        const excelStart = normalizeDate(row.StartDate);
                        const liveStart = normalizeDate(liveCampaign.startDate);
                        const isMatched = excelStart === liveStart;
                        fieldDiffs['StartDate'] = { excelVal: excelStart, apiVal: liveStart, matched: isMatched, message: isMatched ? undefined : '시작일 불일치' };
                        if (!isMatched) {
                            errors.push(`시작일 불일치 (기획안: ${excelStart}, 매체: ${liveStart})`);
                            status = 'FAIL';
                        }
                    }
                    if (row.EndDate && liveCampaign.endDate) {
                        const excelEnd = normalizeDate(row.EndDate);
                        const liveEnd = normalizeDate(liveCampaign.endDate);
                        const isMatched = excelEnd === liveEnd;
                        fieldDiffs['EndDate'] = { excelVal: excelEnd, apiVal: liveEnd, matched: isMatched, message: isMatched ? undefined : '종료일 불일치' };
                        if (!isMatched) {
                            errors.push(`종료일 불일치 (기획안: ${excelEnd}, 매체: ${liveEnd})`);
                            status = 'FAIL';
                        }
                    }

                    if (row.CampaignObjective && liveCampaign.channelType) {
                        const isMatched = normalizeStr(liveCampaign.channelType) === normalizeStr(row.CampaignObjective);
                        const excelKr = getKrName(row.CampaignObjective, 'GOOGLE_ADS', 'objective');
                        const liveKr = getKrName(liveCampaign.channelType, 'GOOGLE_ADS', 'objective');
                        fieldDiffs['CampaignObjective'] = { excelVal: excelKr, apiVal: liveKr, matched: isMatched, message: isMatched ? undefined : '캠페인 목적 불일치' };
                        if (!isMatched) {
                            errors.push(`캠페인 목적(채널) 불일치 (기획안: ${excelKr}, 매체: ${liveKr})`);
                            status = 'FAIL';
                        }
                    }

                    const liveAdGroup = cache.adGroups.find((ag: any) =>
                        ag.campaignId === liveCampaign.id &&
                        normalizeStr(ag.name) === normalizeStr(row.AdSetName)
                    );
                    if (row.AdSetName && !liveAdGroup) {
                        errors.push(`매체에 일치하는 광고 그룹이 없음 (${row.AdSetName})`);
                        status = 'FAIL';
                        fieldDiffs['AdSetName'] = { excelVal: row.AdSetName, apiVal: '없음', matched: false, message: '광고 그룹 미존재' };
                    } else if (row.AdSetName) {
                        fieldDiffs['AdSetName'] = { excelVal: row.AdSetName, apiVal: liveAdGroup.name || row.AdSetName, matched: true };
                    }

                    if (row.AdName && liveAdGroup) {
                        const liveAd = cache.ads.find((a: any) =>
                            a.adGroupId === liveAdGroup.id &&
                            normalizeStr(a.name) === normalizeStr(row.AdName)
                        );
                        if (!liveAd) {
                            errors.push(`매체에 일치하는 광고가 없음 (${row.AdName})`);
                            status = 'FAIL';
                            fieldDiffs['AdName'] = { excelVal: row.AdName, apiVal: '없음', matched: false, message: '광고 소재 미존재' };
                        } else {
                            fieldDiffs['AdName'] = { excelVal: row.AdName, apiVal: liveAd.name || row.AdName, matched: true };
                            const liveLandingUrl = liveAd.finalUrls?.[0] || '';
                            if (row.LandingURL) {
                                const isMatched = Boolean(liveLandingUrl && normalizeUrl(liveLandingUrl) === normalizeUrl(row.LandingURL));
                                fieldDiffs['LandingURL'] = { excelVal: row.LandingURL, apiVal: liveLandingUrl || '미세팅', matched: isMatched, message: isMatched ? undefined : '랜딩 URL 불일치' };
                                if (!liveLandingUrl) {
                                    errors.push('매체에 랜딩 URL이 세팅되지 않음');
                                    if (status === 'PASS') status = 'WARNING';
                                } else if (!isMatched) {
                                    errors.push(`랜딩 URL 불일치 (매체: ${liveLandingUrl})`);
                                    status = 'FAIL';
                                }
                            }
                            if (row.UTMParameters) {
                                const isMatched = Boolean(liveAd.trackingUrl && (liveAd.trackingUrl.includes(row.UTMParameters) || liveAd.trackingUrl === row.UTMParameters));
                                fieldDiffs['UTMParameters'] = { excelVal: row.UTMParameters, apiVal: liveAd.trackingUrl || '미세팅 (자동태깅 가능성)', matched: isMatched, message: isMatched ? undefined : 'UTM 파라미터 불일치' };
                                if (!liveAd.trackingUrl) {
                                    errors.push('매체 Tracking Template이 비어있음 — Google 자동 태깅(Auto-tagging) 사용 가능성 (UTM 검수 제외)');
                                    if (status === 'PASS') status = 'WARNING';
                                } else if (!isMatched) {
                                    errors.push(`UTM 파라미터 불일치 (매체: ${liveAd.trackingUrl})`);
                                    status = 'FAIL';
                                }
                            }
                        }
                    }
                }
            }
        } else if (!token && !googleAccessToken) {
            // Mock Crosscheck mode (Populate all template diffs for clear UI demonstration)
            const safeCurrency = row.Currency ? row.Currency.toUpperCase().trim() : 'KRW';
            fieldDiffs['Currency'] = { excelVal: row.Currency || '-', apiVal: safeCurrency, matched: true };

            fieldDiffs['CampaignDailyBudget'] = {
                excelVal: row.CampaignDailyBudget > 0 ? Number(row.CampaignDailyBudget).toLocaleString() : '-',
                apiVal: row.CampaignDailyBudget > 0 ? Number(row.CampaignDailyBudget).toLocaleString() : '-',
                matched: true
            };
            fieldDiffs['CampaignLifetimeBudget'] = {
                excelVal: row.CampaignLifetimeBudget > 0 ? Number(row.CampaignLifetimeBudget).toLocaleString() : '-',
                apiVal: row.CampaignLifetimeBudget > 0 ? Number(row.CampaignLifetimeBudget).toLocaleString() : '-',
                matched: true
            };
            fieldDiffs['AdSetDailyBudget'] = {
                excelVal: row.AdSetDailyBudget > 0 ? Number(row.AdSetDailyBudget).toLocaleString() : '-',
                apiVal: row.AdSetDailyBudget > 0 ? Number(row.AdSetDailyBudget).toLocaleString() : '-',
                matched: true
            };
            fieldDiffs['AdSetLifetimeBudget'] = {
                excelVal: row.AdSetLifetimeBudget > 0 ? Number(row.AdSetLifetimeBudget).toLocaleString() : '-',
                apiVal: row.AdSetLifetimeBudget > 0 ? Number(row.AdSetLifetimeBudget).toLocaleString() : '-',
                matched: true
            };

            fieldDiffs['StartDate'] = { excelVal: row.StartDate || '-', apiVal: row.StartDate || '-', matched: true };
            fieldDiffs['EndDate'] = { excelVal: row.EndDate || '-', apiVal: row.EndDate || '-', matched: true };

            const objKr = row.CampaignObjective ? getKrName(row.CampaignObjective, 'META', 'objective') : '-';
            fieldDiffs['CampaignObjective'] = { excelVal: objKr, apiVal: objKr, matched: true };

            const buyKr = row.CampaignBuyingType ? getKrName(row.CampaignBuyingType, 'META', 'buying_type') : '-';
            fieldDiffs['CampaignBuyingType'] = { excelVal: buyKr, apiVal: buyKr, matched: true };

            const optKr = row.AdSetOptimizationGoal ? getKrName(row.AdSetOptimizationGoal, 'META', 'optimization_goal') : '-';
            fieldDiffs['AdSetOptimizationGoal'] = { excelVal: optKr, apiVal: optKr, matched: true };

            const billKr = row.AdSetBillingEvent ? getKrName(row.AdSetBillingEvent, 'META', 'billing_event') : '-';
            fieldDiffs['AdSetBillingEvent'] = { excelVal: billKr, apiVal: billKr, matched: true };

            fieldDiffs['PixelID'] = { excelVal: row.PixelID || '-', apiVal: row.PixelID || '-', matched: true };
            fieldDiffs['CustomEventType'] = { excelVal: row.CustomEventType || '-', apiVal: row.CustomEventType || '-', matched: true };

            fieldDiffs['AdSetName'] = { excelVal: row.AdSetName || '-', apiVal: row.AdSetName || '-', matched: true };
            fieldDiffs['AdName'] = { excelVal: row.AdName || '-', apiVal: row.AdName || '-', matched: true };

            const mockEvaluateCopy = (excelVal: string, liveVal: string, fieldLabel: string) => {
                const cleanExcel = (excelVal || '').trim();
                const cleanLive = (liveVal || '').trim();

                if (cleanExcel) {
                    if (!cleanLive || cleanLive === '-') {
                        return { excelVal: cleanExcel, apiVal: '-', matched: false, isNoExcelInput: false, message: `매체에 ${fieldLabel} 미세팅` };
                    } else if (cleanExcel === cleanLive) {
                        return { excelVal: cleanExcel, apiVal: cleanLive, matched: true, isNoExcelInput: false };
                    } else {
                        return { excelVal: cleanExcel, apiVal: cleanLive, matched: false, isNoExcelInput: false, message: `${fieldLabel} 문구 상이` };
                    }
                } else {
                    if (cleanLive && cleanLive !== '-') {
                        return { excelVal: '-', apiVal: cleanLive, matched: true, isNoExcelInput: true };
                    } else {
                        return { excelVal: '-', apiVal: '-', matched: true, isNoExcelInput: false };
                    }
                }
            };

            const isHeadlineMatched = i % 2 === 0;
            const mockHeadlineApi = row.Headline ? (isHeadlineMatched ? row.Headline : '-') : '-';
            const headDiff = mockEvaluateCopy(row.Headline, mockHeadlineApi, '헤드라인');
            fieldDiffs['Headline'] = headDiff;
            if (row.Headline && !headDiff.matched) errors.push(headDiff.message || '헤드라인 불일치');

            const isBodyMatched = i % 3 !== 1;
            const mockBodyApi = row.BodyCopy ? (isBodyMatched ? row.BodyCopy : '-') : '-';
            const bodyDiff = mockEvaluateCopy(row.BodyCopy, mockBodyApi, '본문 카피');
            fieldDiffs['BodyCopy'] = bodyDiff;
            if (row.BodyCopy && !bodyDiff.matched) errors.push(bodyDiff.message || '본문 카피 불일치');

            const mockCtaApi = row.CTA || '-';
            const ctaDiff = mockEvaluateCopy(row.CTA, mockCtaApi, 'CTA 버튼');
            fieldDiffs['CTA'] = ctaDiff;
            if (row.CTA && !ctaDiff.matched) errors.push(ctaDiff.message || 'CTA 버튼 불일치');

            fieldDiffs['LandingURL'] = { excelVal: row.LandingURL || '-', apiVal: row.LandingURL || '-', matched: true };

            if (!row.UTMParameters) {
                fieldDiffs['UTMParameters'] = { excelVal: '-', apiVal: '미세팅', matched: false, message: 'UTM 누락' };
                errors.push('UTM 파라미터가 누락되었습니다.');
                if (status === 'PASS') status = 'WARNING';
            } else {
                fieldDiffs['UTMParameters'] = { excelVal: row.UTMParameters, apiVal: row.UTMParameters, matched: true };
            }

            // 엑셀 내 동명 캠페인 및 ID 미입력 스마트 경고 체크
            const sameCampRows = processedRows.filter(r => 
                r.AccountID === row.AccountID && 
                String(r.CampaignName || '').replace(/\s+/g, '').toLowerCase() === String(row.CampaignName || '').replace(/\s+/g, '').toLowerCase()
            );

            if (!row.CampaignID && sameCampRows.length > 1) {
                errors.push(`⚠️ 라이브 계정에 동일 캠페인명(${row.CampaignName})이 ${sameCampRows.length}개 존재하여 활성화(ACTIVE) 캠페인을 우선 매칭했습니다. (정밀 대조를 위해 엑셀에 캠페인 ID 기입 권장)`);
                if (status === 'PASS') status = 'WARNING';
            }
        }

        results.push({
            rowId: i,
            CampaignName: row.CampaignName,
            AdSetName: row.AdSetName,
            status,
            errors,
            fieldDiffs,
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
