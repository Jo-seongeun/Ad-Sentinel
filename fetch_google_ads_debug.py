import os
import requests
import json
import urllib3
from dotenv import load_dotenv

# SSL 경고 무시
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# 1. 환경 변수 로드
load_dotenv('.env.local')

SUPABASE_URL = os.environ.get('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')

if not SUPABASE_URL or not SUPABASE_KEY:
    print("Error: .env.local 파일에 필수 환경변수가 누락되었습니다.")
    exit(1)

# ==========================================
# 사용자 설정 영역
# ==========================================
# 구글 애즈에서 검수할 하위 클라이언트 계정 ID (하이픈 없이 10자리 숫자)
TARGET_CUSTOMER_ID = '3544680803' 
# ==========================================

print(f"[Info] 설정된 대상 계정 ID: {TARGET_CUSTOMER_ID}")

# 2. Supabase에서 구글 연동 정보 가져오기
print("[Info] Supabase에서 Google Ads 설정 정보 가져오기...")
res = requests.get(
    f"{SUPABASE_URL}/rest/v1/platform_settings?platform=eq.GOOGLE_ADS",
    headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"},
    verify=False
)
data = res.json()
if not data:
    print("Error: Supabase 'platform_settings' 테이블에 GOOGLE_ADS 정보가 없습니다.")
    exit(1)

google_settings = data[0]
client_id = google_settings.get('app_id', '').strip()
client_secret = google_settings.get('app_secret', '').strip()
developer_token = google_settings.get('access_token', '').strip()
mcc_id = google_settings.get('business_id', '').strip().replace('-', '') # 로그인-고객-ID (MCC)
refresh_token = google_settings.get('refresh_token', '').strip()

# 3. Refresh Token을 사용하여 새로운 Access Token 발급
print("[Info] Google Ads Access Token 발급 중...")
token_res = requests.post('https://oauth2.googleapis.com/token', data={
    'client_id': client_id,
    'client_secret': client_secret,
    'refresh_token': refresh_token,
    'grant_type': 'refresh_token'
})

token_data = token_res.json()
access_token = token_data.get('access_token')

if not access_token:
    print("! Token API Error:", token_data)
    exit(1)

print("[Success] Access Token 획득 성공")

# 4. Google Ads API 요청 (GAQL)
API_VERSION = 'v22'
BASE_URL = f"https://googleads.googleapis.com/{API_VERSION}"
search_url = f"{BASE_URL}/customers/{TARGET_CUSTOMER_ID}/googleAds:searchStream"
headers = {
    'Authorization': f'Bearer {access_token}',
    'developer-token': developer_token,
    'Content-Type': 'application/json'
}
if mcc_id:
    headers['login-customer-id'] = mcc_id

print(f"[Info] Google Ads API 호출 중... (대상: {TARGET_CUSTOMER_ID})")

# 4-1. 캠페인 예산 가져오기 (GAQL은 ad_group_ad 쿼리에서 campaign_budget을 조인할 수 없음)
budget_query = """
    SELECT 
        campaign.id,
        campaign_budget.amount_micros,
        campaign_budget.total_amount_micros
    FROM campaign
    WHERE campaign.status = 'ENABLED'
"""
budget_res = requests.post(search_url, headers=headers, json={'query': budget_query})
if budget_res.status_code != 200:
    print("! Budget Query Error:", budget_res.status_code, budget_res.text)
    exit(1)

budgets_dict = {}
for chunk in budget_res.json():
    for row in chunk.get('results', []):
        camp_id = row.get('campaign', {}).get('id')
        budget = row.get('campaignBudget', {})
        if camp_id:
            budgets_dict[camp_id] = {
                'daily': int(budget.get('amountMicros', 0)) // 1000000,
                'lifetime': int(budget.get('totalAmountMicros', 0)) // 1000000
            }

# ──────────────────────────────────────────────────────────────────────────────
# 4-2. [쿼리 A] ad_group_ad 기반 — Search / Shopping / Display 등 일반 캠페인
# ──────────────────────────────────────────────────────────────────────────────
ad_group_query = """
    SELECT 
        customer.currency_code,
        campaign.id,
        campaign.name,
        campaign.status,
        campaign.advertising_channel_type,
        campaign.bidding_strategy_type,
        campaign.start_date,
        campaign.end_date,
        ad_group.id,
        ad_group.name,
        ad_group.status,
        ad_group.type,
        ad_group_ad.ad.id,
        ad_group_ad.ad.name,
        ad_group_ad.status,
        ad_group_ad.ad.final_urls,
        ad_group_ad.ad.tracking_url_template,
        ad_group_ad.ad.url_custom_parameters
    FROM ad_group_ad
    WHERE ad_group_ad.status = 'ENABLED' 
      AND campaign.status = 'ENABLED'
      AND ad_group.status = 'ENABLED'
    LIMIT 500
"""

response_a = requests.post(search_url, headers=headers, json={'query': ad_group_query})
if response_a.status_code != 200:
    print("! [쿼리A] Google Ads API Error:", response_a.status_code, response_a.text)
    exit(1)

records_to_insert = []

print("[Info] [쿼리A] ad_group_ad 기반 일반 캠페인 파싱 중...")
for chunk in response_a.json():
    for row in chunk.get('results', []):
        campaign  = row.get('campaign', {})
        ad_group  = row.get('adGroup', {})
        ad_grp_ad = row.get('adGroupAd', {})
        ad        = ad_grp_ad.get('ad', {})
        customer  = row.get('customer', {})

        final_urls       = ad.get('finalUrls', [])
        landing_url      = final_urls[0] if final_urls else ''
        tracking_tpl     = ad.get('trackingUrlTemplate', '')
        utm_string       = tracking_tpl if tracking_tpl else ''

        camp_id     = campaign.get('id')
        camp_type   = campaign.get('advertisingChannelType', '')
        camp_budget = budgets_dict.get(camp_id, {'daily': 0, 'lifetime': 0})

        record = {
            'account_id':               TARGET_CUSTOMER_ID,
            'campaign_id':              camp_id,
            'campaign_name':            campaign.get('name'),
            'currency':                 customer.get('currencyCode', 'KRW'),
            'campaign_daily_budget':    camp_budget['daily'],
            'campaign_lifetime_budget': camp_budget['lifetime'],
            'campaign_start_time':      campaign.get('startDate'),
            'campaign_stop_time':       campaign.get('endDate'),
            'adset_id':                 ad_group.get('id'),
            'adset_name':               ad_group.get('name'),
            'adset_daily_budget':       0,
            'adset_lifetime_budget':    0,
            'campaign_objective':       camp_type,
            'campaign_buying_type':     campaign.get('biddingStrategyType'),
            'ad_id':                    ad.get('id'),
            'ad_name':                  ad.get('name') or 'Google Ad (Name Missing)',
            'landing_url':              landing_url,
            'utm_parameters':           utm_string,
            'adset_optimization_goal':  ad_group.get('type'),
            'adset_billing_event':      None,
            'adset_pixel_id':           None,
            'adset_custom_event_type':  None,
            'adset_targeting':          None,
            'effective_status':         ad_grp_ad.get('status'),
        }
        records_to_insert.append(record)
        print(f"  → [A][{camp_type}] {campaign.get('name')} / adGroup: {ad_group.get('name')} | 상태: {ad_grp_ad.get('status')}")

# ──────────────────────────────────────────────────────────────────────────────
# 4-3. [쿼리 B] 캠페인 보완 쿼리
#   — 쿼리 A(ad_group_ad)에서 이미 수집된 campaign_id를 제외하고
#     나머지 캠페인(PAUSED 일반 캠페인 + PMax 전체)을 campaign 테이블에서 직접 조회
# ──────────────────────────────────────────────────────────────────────────────

# 쿼리 A에서 이미 수집된 campaign_id 집합
collected_campaign_ids = set(r['campaign_id'] for r in records_to_insert)

campaign_fallback_query = """
    SELECT 
        customer.currency_code,
        campaign.id,
        campaign.name,
        campaign.status,
        campaign.advertising_channel_type,
        campaign.bidding_strategy_type,
        campaign.start_date,
        campaign.end_date
    FROM campaign
    WHERE campaign.status IN ('ENABLED', 'PAUSED')
    LIMIT 500
"""

response_b = requests.post(search_url, headers=headers, json={'query': campaign_fallback_query})
if response_b.status_code != 200:
    print("! [쿼리B] Campaign Fallback Query Error:", response_b.status_code, response_b.text)
    exit(1)

print("[Info] [쿼리B] 누락 캠페인 보완 중 (쿼리A에서 수집되지 않은 캠페인)...")
for chunk in response_b.json():
    for row in chunk.get('results', []):
        campaign  = row.get('campaign', {})
        customer  = row.get('customer', {})

        camp_id     = campaign.get('id')
        camp_type   = campaign.get('advertisingChannelType', '')
        camp_budget = budgets_dict.get(camp_id, {'daily': 0, 'lifetime': 0})

        # 쿼리 A에서 이미 ad_group 단위로 수집된 캠페인은 스킵 (중복 방지)
        if camp_id in collected_campaign_ids:
            continue

        record = {
            'account_id':               TARGET_CUSTOMER_ID,
            'campaign_id':              camp_id,
            'campaign_name':            campaign.get('name'),
            'currency':                 customer.get('currencyCode', 'KRW'),
            'campaign_daily_budget':    camp_budget['daily'],
            'campaign_lifetime_budget': camp_budget['lifetime'],
            'campaign_start_time':      campaign.get('startDate'),
            'campaign_stop_time':       campaign.get('endDate'),
            # ad_group 없음 (PMax) 또는 PAUSED로 쿼리A 미수집 — 캠페인 기준 단일 행
            'adset_id':                 None,
            'adset_name':               None,
            'adset_daily_budget':       0,
            'adset_lifetime_budget':    0,
            'campaign_objective':       camp_type,
            'campaign_buying_type':     campaign.get('biddingStrategyType'),
            'ad_id':                    None,
            'ad_name':                  None,
            'landing_url':              None,
            'utm_parameters':           None,
            'adset_optimization_goal':  None,
            'adset_billing_event':      None,
            'adset_pixel_id':           None,
            'adset_custom_event_type':  None,
            'adset_targeting':          None,
            'effective_status':         campaign.get('status'),
        }
        records_to_insert.append(record)
        print(f"  → [B][{camp_type}] {campaign.get('name')} (ID: {camp_id}) | 상태: {campaign.get('status')} | 일예산: {camp_budget['daily']:,}")

print(f"[Info] 총 {len(records_to_insert)}개 행 수집 완료")
print(f"       ├─ 쿼리A (ad_group 단위): {len(collected_campaign_ids)}개 캠페인")
print(f"       └─ 쿼리B (캠페인 보완):   {len(records_to_insert) - len(collected_campaign_ids)}개 캠페인")



# 5. Supabase에 일괄 저장
if records_to_insert:
    rest_url = f"{SUPABASE_URL}/rest/v1/campaign_settings_check"
    db_headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
    }
    
    chunk_size = 50
    has_error = False
    for i in range(0, len(records_to_insert), chunk_size):
        chunk = records_to_insert[i:i + chunk_size]
        res = requests.post(rest_url, headers=db_headers, json=chunk, verify=False)
        if res.status_code >= 400:
            print("! DB Insert Error:", res.text)
            has_error = True
            
    if not has_error:
        print(f"[Success] Supabase db 'campaign_settings_check' 테이블에 {len(records_to_insert)}개의 데이터를 성공적으로 저장했습니다!")
else:
    print("저장할 데이터가 없습니다.")
