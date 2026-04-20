import os
import requests
import urllib3
from dotenv import load_dotenv

# SSL 경고 무시
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# 1. 환경 변수 로드
load_dotenv('.env.local')

SUPABASE_URL = os.environ.get('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
META_TOKEN = os.environ.get('META_ACCESS_TOKEN')

if not SUPABASE_URL or not SUPABASE_KEY or not META_TOKEN:
    print("Error: .env.local 파일에 필수 환경변수가 누락되었습니다.")
    exit(1)

# 3. Meta API 기본 정보 세팅
ACCOUNT_ID = '851125950859042'
API_VERSION = 'v19.0'
BASE_URL = f"https://graph.facebook.com/{API_VERSION}"

print(f"[Success] 접속 계정: {ACCOUNT_ID}")

# 3.5. Meta Ads API 계정 화폐(Currency) 확인
acc_url = f"{BASE_URL}/act_{ACCOUNT_ID}?fields=currency"
acc_res = requests.get(acc_url, params={'access_token': META_TOKEN}, verify=False)
account_currency = acc_res.json().get('currency', 'KRW') # Default to KRW if none
print(f"[Success] 계정 통화 기준: {account_currency}")

# 4. Meta Ads API 요청 (ACTIVE 캠페인에 속하는 소재만 추출)
fields = "id,name,effective_status,creative{url_tags,object_story_spec},adset{id,name,daily_budget,lifetime_budget,optimization_goal,billing_event,promoted_object,targeting},campaign{id,name,daily_budget,lifetime_budget,start_time,stop_time,objective,buying_type}"
url = f"{BASE_URL}/act_{ACCOUNT_ID}/ads"
params = {
    'fields': fields,
    'limit': 500,
    'access_token': META_TOKEN
}

# SSL 우회하여 Meta에 요청 (필요한 경우)
response = requests.get(url, params=params, verify=False)
data = response.json()

if 'error' in data:
    print("! Meta API Error:", data['error'])
    exit(1)

ads_data = data.get('data', [])
print(f"[Info] 총 {len(ads_data)}개의 활성화된 (Active Campaign 기반) 광고를 발견했습니다.")

# 5. 데이터 정제 및 파싱
records_to_insert = []
for ad in ads_data:
    campaign = ad.get('campaign', {})
    adset = ad.get('adset', {})
    creative = ad.get('creative', {})
    
    # 캠페인, 세트, 혹은 광고 중 하나라도 상태값이 없거나 비활성이면 보류하는게 맞지만
    # 확실하게 활성화(ACTIVE)된 데이터만 저장합니다.
    target_status = 'ACTIVE'
    
    # 랜딩 URL 찾기 (object_story_spec 하위 노드)
    spec = creative.get('object_story_spec', {})
    link_data = spec.get('link_data', {})
    video_data = spec.get('video_data', {})
    
    meta_link = link_data.get('link', '')
    if not meta_link and video_data:
        call_to_action = video_data.get('call_to_action', {})
        value = call_to_action.get('value', {})
        meta_link = value.get('link', '')
        
    utm = creative.get('url_tags', '')
    
    promoted_object = adset.get('promoted_object', {})
    
    record = {
        'account_id': ACCOUNT_ID,
        'campaign_id': campaign.get('id'),
        'currency': account_currency,
        'campaign_name': campaign.get('name'),
        'campaign_daily_budget': int(campaign.get('daily_budget', 0)) if campaign.get('daily_budget') else 0,
        'campaign_lifetime_budget': int(campaign.get('lifetime_budget', 0)) if campaign.get('lifetime_budget') else 0,
        'campaign_start_time': campaign.get('start_time'),
        'campaign_stop_time': campaign.get('stop_time'),
        'campaign_objective': campaign.get('objective'),
        'campaign_buying_type': campaign.get('buying_type'),
        'adset_id': adset.get('id'),
        'adset_name': adset.get('name'),
        'adset_daily_budget': int(adset.get('daily_budget', 0)) if adset.get('daily_budget') else 0,
        'adset_lifetime_budget': int(adset.get('lifetime_budget', 0)) if adset.get('lifetime_budget') else 0,
        'adset_optimization_goal': adset.get('optimization_goal'),
        'adset_billing_event': adset.get('billing_event'),
        'adset_pixel_id': promoted_object.get('pixel_id') if isinstance(promoted_object, dict) else None,
        'adset_custom_event_type': promoted_object.get('custom_event_type') if isinstance(promoted_object, dict) else None,
        'adset_targeting': adset.get('targeting'),
        'ad_id': ad.get('id'),
        'ad_name': ad.get('name'),
        'landing_url': meta_link,
        'utm_parameters': utm,
        'effective_status': ad.get('effective_status')
    }
    
    # 활성화된 소재의 데이터만 선별
    if record['effective_status'] == target_status or not record['effective_status']:
       records_to_insert.append(record)

# 6. Supabase에 일괄 저장 (DB 테이블이 비워있는지 확인하거나, 계속 쌓음)
if records_to_insert:
    rest_url = f"{SUPABASE_URL}/rest/v1/campaign_settings_check"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
    }
    
    chunk_size = 50
    has_error = False
    for i in range(0, len(records_to_insert), chunk_size):
        chunk = records_to_insert[i:i + chunk_size]
        res = requests.post(rest_url, headers=headers, json=chunk, verify=False)
        if res.status_code >= 400:
            print("! DB Insert Error:", res.text)
            has_error = True
            
    if not has_error:
        print(f"[Success] Supabase db 'campaign_settings_check' 테이블에 {len(records_to_insert)}개의 데이터를 성공적으로 저장했습니다!")
else:
    print("저장할 데이터가 없습니다.")
