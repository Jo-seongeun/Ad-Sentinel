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
TARGET_CUSTOMER_ID = '6823217446' 
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

# 4-2. 광고(Ad) 데이터 가져오기
query = """
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

response = requests.post(search_url, headers=headers, json={'query': query})

if response.status_code != 200:
    print("! Google Ads API Error:", response.status_code, response.text)
    exit(1)

ads_data = response.json()
records_to_insert = []

# searchStream은 JSON 배열의 배열로 반환됨 (결과 청크)
for chunk in ads_data:
    for row in chunk.get('results', []):
        campaign = row.get('campaign', {})
        ad_group = row.get('adGroup', {})
        ad_group_ad = row.get('adGroupAd', {})
        ad = ad_group_ad.get('ad', {})
        customer = row.get('customer', {})
        
        # URL / UTM 파라미터 파싱
        final_urls = ad.get('finalUrls', [])
        landing_url = final_urls[0] if final_urls else ''
        
        utm_params = []
        tracking_template = ad.get('trackingUrlTemplate', '')
        custom_params = ad.get('urlCustomParameters', [])
        
        if tracking_template:
            utm_params.append(tracking_template)
            
        utm_string = ", ".join(utm_params)
        
        # 캠페인 ID를 키로 예산 딕셔너리에서 예산 조회
        camp_id = campaign.get('id')
        camp_budget = budgets_dict.get(camp_id, {'daily': 0, 'lifetime': 0})
        
        record = {
            'account_id': TARGET_CUSTOMER_ID,
            'campaign_id': camp_id,
            'campaign_name': campaign.get('name'),
            'currency': customer.get('currencyCode', 'KRW'),
            'campaign_daily_budget': camp_budget['daily'],
            'campaign_lifetime_budget': camp_budget['lifetime'],
            'campaign_start_time': campaign.get('startDate'),
            'campaign_stop_time': campaign.get('endDate'),
            'adset_id': ad_group.get('id'), # Meta의 AdSet -> Google의 AdGroup
            'adset_name': ad_group.get('name'),
            'adset_daily_budget': 0, # 구글은 주로 캠페인 예산을 사용함
            'adset_lifetime_budget': 0,
            'campaign_objective': campaign.get('advertisingChannelType'),
            'campaign_buying_type': campaign.get('biddingStrategyType'),
            'ad_id': ad.get('id'),
            'ad_name': ad.get('name', 'Google Ad (Name Missing)'),
            'landing_url': landing_url,
            'utm_parameters': utm_string,
            'adset_optimization_goal': ad_group.get('type'),
            'adset_billing_event': None,
            'adset_pixel_id': None,
            'adset_custom_event_type': None,
            'adset_targeting': None,
            'effective_status': ad_group_ad.get('status')
        }
        records_to_insert.append(record)

print(f"[Info] 총 {len(records_to_insert)}개의 활성화된 광고를 발견했습니다.")

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
