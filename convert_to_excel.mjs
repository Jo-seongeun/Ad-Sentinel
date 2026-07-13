import fs from 'fs';
import XLSX from 'xlsx';

// 1. JSON 파일 로드
const objectiveKrMap = {
    'OUTCOME_AWARENESS': '인지도 (Awareness)',
    'OUTCOME_TRAFFIC': '트래픽 (Traffic)',
    'OUTCOME_ENGAGEMENT': '참여 (Engagement)',
    'OUTCOME_LEADS': '잠재고객 (Leads)',
    'OUTCOME_APP_PROMOTION': '앱 홍보 (App Promotion)',
    'OUTCOME_SALES': '매출 (Sales)',
    'AWARENESS': '인지도',
    'BRAND_AWARENESS': '브랜드 인지도',
    'COVERAGE': '도달범위',
    'LINK_CLICKS': '링크 클릭',
    'POST_ENGAGEMENT': '게시물 참여',
    'PAGE_LIKES': '페이지 좋아요',
    'EVENT_RESPONSES': '이벤트 응답',
    'LEAD_GENERATION': '리드 생성',
    'MESSAGES': '메시지',
    'CONVERSIONS': '전환',
    'PRODUCT_CATALOG_SALES': '제품 카탈로그 판매',
    'STORE_VISITS': '매장 방문'
};

function formatDate(isoStr) {
    if (!isoStr) return '상시 운영';
    try {
        return isoStr.substring(0, 10);
    } catch {
        return isoStr;
    }
}

const jsonPath = './meta_insights_raw.json';
if (!fs.existsSync(jsonPath)) {
    console.error('Error: meta_insights_raw.json 파일이 존재하지 않습니다. 먼저 python fetch_meta_insights_debug.py를 실행하세요.');
    process.exit(1);
}

const rawData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

// Helper: Action 리스트 파싱
function parseActions(actionsList) {
    const parsed = {
        '링크 클릭': 0,
        '랜딩 페이지 조회': 0,
        '구매': 0,
        '리드': 0,
        '회원가입': 0,
        '장바구니': 0
    };
    if (!actionsList) return parsed;
    for (const act of actionsList) {
        const type = act.action_type;
        const val = parseInt(act.value || 0, 10);
        if (type === 'link_click') parsed['링크 클릭'] = val;
        else if (type === 'landing_page_view') parsed['랜딩 페이지 조회'] = val;
        else if (type === 'purchase' || type === 'offsite_conversion.fb_pixel_purchase') parsed['구매'] = val;
        else if (type === 'lead' || type === 'offsite_conversion.fb_pixel_lead') parsed['리드'] = val;
        else if (type === 'complete_registration' || type === 'offsite_conversion.fb_pixel_complete_registration') parsed['회원가입'] = val;
        else if (type === 'add_to_cart' || type === 'offsite_conversion.fb_pixel_add_to_cart') parsed['장바구니'] = val;
    }
    return parsed;
}

// Helper: Action Value 리스트 파싱 (구매 금액)
function parseActionValues(actionValuesList) {
    if (!actionValuesList) return 0;
    for (const actVal of actionValuesList) {
        const type = actVal.action_type;
        if (type === 'purchase' || type === 'offsite_conversion.fb_pixel_purchase' || type === 'omni_purchase') {
            return parseFloat(actVal.value || 0);
        }
    }
    return 0;
}

// Helper: ROAS 파싱
function parseROAS(roasList, spend, purchaseValue) {
    if (roasList && roasList.length > 0) {
        for (const r of roasList) {
            if (r.action_type === 'purchase' || r.action_type === 'offsite_conversion.fb_pixel_purchase' || r.action_type === 'omni_purchase') {
                return parseFloat(r.value || 0) * 100; // 백분율 환산 (%)
            }
        }
    }
    if (spend > 0 && purchaseValue > 0) {
        return (purchaseValue / spend) * 100;
    }
    return 0;
}

// 2. 데이터 가공 및 플랫(Flat) 배열 생성
const campaignRows = [];
const adRows = [];

const presets = ['maximum', 'last_30d'];

for (const preset of presets) {
    const presetLabel = preset === 'maximum' ? '전체 누적(Max)' : '최근 30일';
    
    // 캠페인 데이터 처리
    const campaigns = rawData[preset]?.campaign || [];
    for (const camp of campaigns) {
        const spend = parseFloat(camp.spend || 0);
        const purchaseValue = parseActionValues(camp.action_values);
        const roas = parseROAS(camp.purchase_roas, spend, purchaseValue);
        const actions = parseActions(camp.actions);

        campaignRows.push({
            '기간구분': presetLabel,
            '캠페인 ID': camp.campaign_id,
            '캠페인명': camp.campaign_name,
            '캠페인 목적': objectiveKrMap[camp.objective] || camp.objective || '미지정',
            '지출액': spend,
            '노출수': parseInt(camp.impressions || 0, 10),
            '도달수': parseInt(camp.reach || 0, 10),
            '빈도': parseFloat(camp.frequency || 0),
            '클릭수': parseInt(camp.clicks || 0, 10),
            'CTR (%)': parseFloat(camp.ctr || 0),
            'CPC': parseFloat(camp.cpc || 0),
            'CPM': parseFloat(camp.cpm || 0),
            ...actions,
            '구매 금액': purchaseValue,
            'ROAS (%)': roas,
            '분석 시작일': formatDate(camp.date_start),
            '분석 종료일': formatDate(camp.date_stop)
        });
    }

    // 광고 데이터 처리
    const ads = rawData[preset]?.ad || [];
    for (const ad of ads) {
        const spend = parseFloat(ad.spend || 0);
        const purchaseValue = parseActionValues(ad.action_values);
        const roas = parseROAS(ad.purchase_roas, spend, purchaseValue);
        const actions = parseActions(ad.actions);

        // 예산 데이터 구분 (CBO vs ABO)
        const campDaily = parseFloat(ad.campaign_daily_budget || 0);
        const campLifetime = parseFloat(ad.campaign_lifetime_budget || 0);
        const adsetDaily = parseFloat(ad.adset_daily_budget || 0);
        const adsetLifetime = parseFloat(ad.adset_lifetime_budget || 0);

        let budgetType = '미설정';
        let budgetAmount = 0;
        if (campDaily > 0 || campLifetime > 0) {
            budgetType = '캠페인 예산 (CBO)';
            budgetAmount = campLifetime > 0 ? campLifetime : campDaily;
        } else if (adsetDaily > 0 || adsetLifetime > 0) {
            budgetType = '광고 세트 예산 (ABO)';
            budgetAmount = adsetLifetime > 0 ? adsetLifetime : adsetDaily;
        }

        const campaignStart = formatDate(ad.campaign_start_time);
        const campaignEnd = formatDate(ad.campaign_stop_time);
        const campaignObjective = objectiveKrMap[ad.campaign_objective] || ad.campaign_objective || '미지정';

        adRows.push({
            '기간구분': presetLabel,
            '캠페인 ID': ad.campaign_id,
            '캠페인명': ad.campaign_name,
            '캠페인 목적': campaignObjective,
            '캠페인 시작일': campaignStart,
            '캠페인 종료일': campaignEnd,
            '예산 구분': budgetType,
            '설정 예산': budgetAmount,
            '사용된 픽셀': ad.pixel_id || '없음',
            '광고세트 ID': ad.adset_id,
            '광고세트명': ad.adset_name,
            '광고 ID': ad.ad_id,
            '광고명': ad.ad_name,
            '소재 ID': ad.creative_id || '',
            '소재명': ad.creative_name || '',
            '소재 유형': ad.creative_type || '기타',
            '유연한 미디어 (Advantage+)': ad.advantage_plus || '비활성화',
            '노출 위치별 맞춤 설정': ad.placement_customization || '비활성화',
            '소재 헤드라인': ad.creative_title || '',
            '소재 본문 텍스트': ad.creative_body || '',
            '소재 설명': ad.creative_description || '',
            '행동유도 버튼 (CTA)': ad.creative_cta || '',
            '이미지 URL': ad.creative_image_url || '',
            '동영상 썸네일 URL': ad.creative_thumbnail_url || '',
            '인스타그램 permalink': ad.creative_instagram_permalink || '',
            '지출액': spend,
            '노출수': parseInt(ad.impressions || 0, 10),
            '도달수': parseInt(ad.reach || 0, 10),
            '빈도': parseFloat(ad.frequency || 0),
            '클릭수': parseInt(ad.clicks || 0, 10),
            'CTR (%)': parseFloat(ad.ctr || 0),
            'CPC': parseFloat(ad.cpc || 0),
            'CPM': parseFloat(ad.cpm || 0),
            ...actions,
            '구매 금액': purchaseValue,
            'ROAS (%)': roas,
            '랜딩 URL': ad.landing_url || '',
            'UTM 파라미터': ad.utm_parameters || '',
            '분석 시작일': formatDate(ad.date_start),
            '분석 종료일': formatDate(ad.date_stop)
        });
    }
}

// 3. 엑셀 워크북 생성 및 시트 추가
const wb = XLSX.utils.book_new();

const campSheet = XLSX.utils.json_to_sheet(campaignRows);
XLSX.utils.book_append_sheet(wb, campSheet, '캠페인 성과');

const adSheet = XLSX.utils.json_to_sheet(adRows);
XLSX.utils.book_append_sheet(wb, adSheet, '광고 소재별 성과');

// 4. 파일 저장
const excelPath = './meta_insights_report.xlsx';
XLSX.writeFile(wb, excelPath);

console.log(`[Success] 엑셀 리포트가 성공적으로 생성되었습니다: ${excelPath}`);
console.log(`- '캠페인 성과' 시트: ${campaignRows.length}행`);
console.log(`- '광고 소재별 성과' 시트: ${adRows.length}행`);
