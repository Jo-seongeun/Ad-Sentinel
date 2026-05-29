import os
import requests
import urllib3
from dotenv import load_dotenv

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
load_dotenv('.env.local')

SUPABASE_URL = os.environ.get('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
META_TOKEN   = os.environ.get('META_ACCESS_TOKEN')

if not SUPABASE_URL or not SUPABASE_KEY:
    print("Error: 필수 환경변수 누락"); exit(1)

# ─── 한글 매핑 테이블 (Meta) ─────────────────────────────────────────────────
META_OBJECTIVE_MAP = {
    'OUTCOME_AWARENESS':     ('인지도',   '브랜드/제품에 대한 폭넓은 인지도 확대'),
    'OUTCOME_TRAFFIC':       ('트래픽',   '웹사이트·앱·Messenger 트래픽 유도'),
    'OUTCOME_ENGAGEMENT':    ('참여',     '좋아요·댓글·공유 등 사용자 참여 극대화'),
    'OUTCOME_LEADS':         ('리드',     '잠재 고객 연락처 정보 수집'),
    'OUTCOME_APP_PROMOTION': ('앱 홍보',  '앱 설치 및 앱 내 특정 행동 유도'),
    'OUTCOME_SALES':         ('판매',     '온·오프라인 전환(구매) 극대화'),
}
META_BUYING_TYPE_MAP = {
    'AUCTION':  ('경매(Auction)',              '실시간 경매로 노출 지면 구매'),
    'RESERVED': ('도달 및 빈도(Reach & Freq)', '고정 단가로 노출 횟수·빈도 예약 구매'),
}
META_OPT_GOAL_MAP = {
    'CONVERSIONS':          ('전환',              '픽셀/이벤트 기준 전환 수 극대화'),
    'LINK_CLICKS':          ('링크 클릭',         '링크 클릭 수 극대화'),
    'IMPRESSIONS':          ('노출',              '광고 노출 횟수 극대화'),
    'REACH':                ('도달',              '고유 사용자 도달 수 극대화'),
    'LANDING_PAGE_VIEWS':   ('랜딩 페이지 조회',  '광고 클릭 후 실제 랜딩 페이지 도달 수 극대화'),
    'THRUPLAY':             ('ThruPlay',          '동영상 15초 이상 또는 완료 재생 수 극대화'),
    'VIDEO_VIEWS':          ('동영상 조회',        '동영상 조회 수 극대화(3초 이상 기준)'),
    'APP_INSTALLS':         ('앱 설치',            '앱 설치 수 극대화'),
    'OFFSITE_CONVERSIONS':  ('오프사이트 전환',    '픽셀 기반 웹사이트 전환 수 극대화'),
    'LEAD_GENERATION':      ('리드 생성',          'Meta 플랫폼 내 리드 양식 제출 수 극대화'),
    'QUALITY_LEAD':         ('품질 리드',          '고품질 잠재 고객 리드 수집 극대화'),
    'VALUE':                ('구매 가치',          '전환 가치(ROAS) 극대화'),
    'STORE_VISITS':         ('매장 방문',          '오프라인 매장 방문 수 극대화'),
    'REPLIES':              ('답장',               'Messenger/WhatsApp 답장 수 극대화'),
    'SUBSCRIBERS':          ('구독자',             '채널 구독자 수 극대화'),
}
META_BILLING_MAP = {
    'IMPRESSIONS':     ('노출당 과금(CPM)',   '1,000회 노출당 비용 기준 과금'),
    'LINK_CLICKS':     ('클릭당 과금(CPC)',   '링크 클릭 1회당 비용 기준 과금'),
    'THRUPLAY':        ('ThruPlay당 과금',   '동영상 완주(15초 이상) 1회당 과금'),
    'POST_ENGAGEMENT': ('참여당 과금',        '게시물 참여 1회당 과금'),
    'APP_INSTALLS':    ('앱 설치당 과금',     '앱 설치 1건당 비용 기준 과금'),
    'NONE':            ('없음',              '별도 과금 기준 없음(자동 최적화)'),
}

# ─── 한글 매핑 테이블 (Google Ads) ───────────────────────────────────────────
GOOGLE_CHANNEL_MAP = {
    'SEARCH':           ('검색',       '구글 검색 결과 페이지에 텍스트 광고 게재'),
    'DISPLAY':          ('디스플레이', '구글 디스플레이 네트워크(GDN) 이미지/배너 광고'),
    'SHOPPING':         ('쇼핑',       '구글 쇼핑 탭 제품 목록 광고'),
    'VIDEO':            ('동영상',     'YouTube 등 동영상 파트너 지면 광고'),
    'MULTI_CHANNEL':    ('앱(범용)',   '전 지면 앱 광고 자동 최적화'),
    'PERFORMANCE_MAX':  ('실적 최대화','모든 구글 지면 전환/가치 자동 최적화(PMax)'),
    'DEMAND_GEN':       ('수요 창출',  'YouTube·Gmail·Discover 수요 창출'),
    'SMART':            ('스마트',    '구글 자동 최적화 스마트 캠페인'),
    'LOCAL':            ('지역',      '지역 방문 유도 캠페인'),
    'UNKNOWN':          ('알 수 없음','분류되지 않은 채널 유형'),
    'UNSPECIFIED':      ('미지정',    '채널 유형 미지정'),
}
GOOGLE_BIDDING_MAP = {
    'TARGET_CPA':                ('목표 CPA',           '설정 CPA 목표 달성 자동 입찰'),
    'TARGET_ROAS':               ('목표 ROAS',           '설정 ROAS 목표 달성 자동 입찰'),
    'MAXIMIZE_CONVERSIONS':      ('전환수 극대화',        '예산 내 전환 수 최대화 자동 입찰'),
    'MAXIMIZE_CONVERSION_VALUE': ('전환 가치 극대화',     '예산 내 전환 가치(매출) 최대화 자동 입찰'),
    'ENHANCED_CPC':              ('향상된 CPC(eCPC)',    '수동 CPC + 자동 조정 하이브리드'),
    'MANUAL_CPC':                ('수동 CPC',            '클릭당 비용 직접 설정'),
    'MANUAL_CPM':                ('수동 CPM',            '1,000회 노출당 비용 직접 설정'),
    'MANUAL_CPV':                ('수동 CPV',            '동영상 조회당 비용 직접 설정'),
    'TARGET_IMPRESSION_SHARE':   ('목표 노출 점유율',     '목표 노출 비율 달성 자동 입찰'),
    'MAXIMIZE_CLICKS':           ('클릭수 극대화',        '예산 내 클릭 수 최대화 자동 입찰'),
    'UNKNOWN':                   ('알 수 없음',           '분류되지 않은 입찰 전략'),
    'UNSPECIFIED':               ('미지정',              '입찰 전략 미지정'),
}
GOOGLE_AG_TYPE_MAP = {
    'SEARCH_STANDARD':               ('검색_표준',          '일반 키워드 기반 검색 광고 그룹'),
    'DISPLAY_STANDARD':              ('디스플레이_표준',     '이미지/배너 디스플레이 광고 그룹'),
    'SHOPPING_PRODUCT_ADS':          ('쇼핑_제품',          '쇼핑 제품 목록 광고 그룹'),
    'VIDEO_TRUE_VIEW_IN_STREAM':     ('동영상_인스트림',     'YouTube 인스트림(건너뜀 가능)'),
    'VIDEO_BUMPER':                  ('동영상_범퍼',         '6초 범퍼 광고 그룹'),
    'VIDEO_NON_SKIPPABLE_IN_STREAM': ('동영상_논스킵',       '건너뛸 수 없는 인스트림 광고'),
    'VIDEO_RESPONSIVE':              ('동영상_반응형',       '반응형 동영상 광고 그룹'),
    'APP_CAMPAIGN':                  ('앱_캠페인',           '앱 설치/참여 유도 광고 그룹'),
    'SMART_CAMPAIGN_ADS':            ('스마트_캠페인',       '스마트 캠페인 광고 그룹'),
    'UNKNOWN':                       ('알 수 없음',          '분류되지 않은 광고 그룹 유형'),
    'UNSPECIFIED':                   ('미지정',              '광고 그룹 유형 미지정'),
}


def make_record(platform, field_type, api_value, kr_name, description):
    return {'platform': platform, 'field_type': field_type,
            'api_value': api_value, 'kr_name': kr_name, 'description': description}


records_to_insert = []

# ════════════════════════════════════════════════════════════
# PART 1: Meta
# ════════════════════════════════════════════════════════════
print("\n[PART 1] Meta 데이터 수집")

# 1-A. 정적 매핑 전체를 항상 먼저 삽입 (공식 API 문서 기준 전체 enum)
for v, (kr, d) in META_OBJECTIVE_MAP.items():   records_to_insert.append(make_record('META', 'objective', v, kr, d))
for v, (kr, d) in META_BUYING_TYPE_MAP.items():  records_to_insert.append(make_record('META', 'buying_type', v, kr, d))
for v, (kr, d) in META_OPT_GOAL_MAP.items():    records_to_insert.append(make_record('META', 'optimization_goal', v, kr, d))
for v, (kr, d) in META_BILLING_MAP.items():     records_to_insert.append(make_record('META', 'billing_event', v, kr, d))
print(f"  정적 매핑 삽입 완료: {len(records_to_insert)}개")

# 1-B. 라이브 스캔으로 정적 매핑에 없는 미지(未知) 값만 추가 보완
if META_TOKEN:
    print("  라이브 계정 스캔으로 미지 값 보완 중...")
    acc_res = requests.get(
        "https://graph.facebook.com/v19.0/me/adaccounts?fields=account_id&limit=200",
        params={'access_token': META_TOKEN}, verify=False
    )
    accounts = acc_res.json().get('data', [])
    known_meta = {
        'objective':         set(META_OBJECTIVE_MAP.keys()),
        'buying_type':       set(META_BUYING_TYPE_MAP.keys()),
        'optimization_goal': set(META_OPT_GOAL_MAP.keys()),
        'billing_event':     set(META_BILLING_MAP.keys()),
    }
    new_count = 0
    for acc in accounts[:10]:
        act_id = str(acc.get('account_id') or acc.get('id', '')).replace('act_', '')
        try:
            c_res = requests.get(
                f"https://graph.facebook.com/v19.0/act_{act_id}/campaigns",
                params={'fields': 'objective,buying_type', 'limit': 200, 'access_token': META_TOKEN}, verify=False
            )
            for c in c_res.json().get('data', []):
                for ftype, val in [('objective', c.get('objective')), ('buying_type', c.get('buying_type'))]:
                    if val and val not in known_meta[ftype]:
                        records_to_insert.append(make_record('META', ftype, val, val, '(라이브 계정에서 발견된 미분류 값)'))
                        known_meta[ftype].add(val); new_count += 1

            s_res = requests.get(
                f"https://graph.facebook.com/v19.0/act_{act_id}/adsets",
                params={'fields': 'optimization_goal,billing_event', 'limit': 200, 'access_token': META_TOKEN}, verify=False
            )
            for s in s_res.json().get('data', []):
                for ftype, val in [('optimization_goal', s.get('optimization_goal')), ('billing_event', s.get('billing_event'))]:
                    if val and val not in known_meta[ftype]:
                        records_to_insert.append(make_record('META', ftype, val, val, '(라이브 계정에서 발견된 미분류 값)'))
                        known_meta[ftype].add(val); new_count += 1
        except Exception as e:
            print(f"    오류: {e}")
    print(f"  라이브 스캔 보완: {new_count}개 추가")
else:
    print("  토큰 없음 → 라이브 스캔 생략 (정적 매핑만 사용)")

print(f"  Meta 최종: {len(records_to_insert)}개")

# ════════════════════════════════════════════════════════════
# PART 2: Google Ads
# ════════════════════════════════════════════════════════════
print("\n[PART 2] Google Ads 데이터 수집")

# 2-A. 정적 매핑 전체를 항상 먼저 삽입
google_start = len(records_to_insert)
for v, (kr, d) in GOOGLE_CHANNEL_MAP.items():  records_to_insert.append(make_record('GOOGLE_ADS', 'objective', v, kr, d))
for v, (kr, d) in GOOGLE_BIDDING_MAP.items():  records_to_insert.append(make_record('GOOGLE_ADS', 'buying_type', v, kr, d))
for v, (kr, d) in GOOGLE_AG_TYPE_MAP.items():  records_to_insert.append(make_record('GOOGLE_ADS', 'optimization_goal', v, kr, d))
records_to_insert.append(make_record('GOOGLE_ADS', 'billing_event', 'N/A', '해당 없음',
    'Google Ads는 과금 기준 개념이 없습니다. 입찰 전략(buying_type)으로 과금 방식이 결정됩니다.'))
print(f"  정적 매핑 삽입 완료: {len(records_to_insert) - google_start}개")

# 2-B. Supabase에서 Google Ads 설정 로드
g_res = requests.get(
    f"{SUPABASE_URL}/rest/v1/platform_settings?platform=eq.GOOGLE_ADS",
    headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"}, verify=False
)
gs_list = g_res.json()
google_access_token = None

if gs_list:
    gs = gs_list[0]
    tr = requests.post('https://oauth2.googleapis.com/token', data={
        'client_id':     gs.get('app_id', '').strip(),
        'client_secret': gs.get('app_secret', '').strip(),
        'refresh_token': gs.get('refresh_token', '').strip(),
        'grant_type':    'refresh_token'
    })
    td = tr.json()
    google_access_token = td.get('access_token')
    developer_token = gs.get('access_token', '').strip()
    mcc_id = gs.get('business_id', '').strip().replace('-', '')
    print(f"  Access Token {'획득 성공' if google_access_token else '획득 실패'}")

# 2-C. 라이브 스캔으로 정적 매핑에 없는 미지 값만 추가 보완
if google_access_token:
    print("  라이브 계정 스캔으로 미지 값 보완 중...")
    g_headers = {
        'Authorization':    f'Bearer {google_access_token}',
        'developer-token':  developer_token,
        'Content-Type':     'application/json',
        'login-customer-id': mcc_id,
    }
    cust_q = "SELECT customer_client.id FROM customer_client WHERE customer_client.status = 'ENABLED' AND customer_client.level > 0 LIMIT 10"
    cr = requests.post(
        f"https://googleads.googleapis.com/v22/customers/{mcc_id}/googleAds:searchStream",
        headers=g_headers, json={'query': cust_q}, verify=False
    )
    cids = []
    if isinstance(cr.json(), list):
        for chunk in cr.json():
            for row in chunk.get('results', []):
                cid = row.get('customerClient', {}).get('id')
                if cid: cids.append(str(cid))

    known_google = {
        'objective':         set(GOOGLE_CHANNEL_MAP.keys()),
        'buying_type':       set(GOOGLE_BIDDING_MAP.keys()),
        'optimization_goal': set(GOOGLE_AG_TYPE_MAP.keys()),
    }
    new_count = 0
    for cid in cids[:10]:
        try:
            q = """SELECT campaign.advertising_channel_type, campaign.bidding_strategy_type, ad_group.type
                   FROM ad_group WHERE campaign.status='ENABLED' AND ad_group.status='ENABLED' LIMIT 500"""
            r = requests.post(
                f"https://googleads.googleapis.com/v22/customers/{cid}/googleAds:searchStream",
                headers=g_headers, json={'query': q}, verify=False
            )
            if isinstance(r.json(), list):
                for chunk in r.json():
                    for row in chunk.get('results', []):
                        camp = row.get('campaign', {}); ag = row.get('adGroup', {})
                        for ftype, val in [
                            ('objective',         camp.get('advertisingChannelType')),
                            ('buying_type',       camp.get('biddingStrategyType')),
                            ('optimization_goal', ag.get('type')),
                        ]:
                            if val and val not in known_google[ftype]:
                                records_to_insert.append(make_record('GOOGLE_ADS', ftype, val, val, '(라이브 계정에서 발견된 미분류 값)'))
                                known_google[ftype].add(val); new_count += 1
        except Exception as e:
            print(f"    오류: {e}")
    print(f"  라이브 스캔 보완: {new_count}개 추가")
else:
    print("  토큰 없음 → 라이브 스캔 생략 (정적 매핑만 사용)")

print(f"  Google Ads 최종: {len(records_to_insert) - google_start}개")

# ════════════════════════════════════════════════════════════
# PART 3: 중복 제거 후 Supabase upsert
# ════════════════════════════════════════════════════════════
print("\n[PART 3] Supabase 저장")
seen_keys, unique_records = set(), []
for r in records_to_insert:
    k = (r['platform'], r['field_type'], r['api_value'])
    if k not in seen_keys:
        seen_keys.add(k); unique_records.append(r)

print(f"  고유 레코드: {len(unique_records)}개")
rest_url = f"{SUPABASE_URL}/rest/v1/ad_enum_values"
db_headers = {
    "apikey":        SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type":  "application/json",
    "Prefer":        "resolution=merge-duplicates",
}
has_error = False
for i in range(0, len(unique_records), 50):
    chunk = unique_records[i:i + 50]
    res = requests.post(rest_url, headers=db_headers, json=chunk, verify=False)
    if res.status_code >= 400:
        print(f"! DB Error (chunk {i // 50 + 1}):", res.text); has_error = True

if not has_error:
    print(f"[Success] 'ad_enum_values' 테이블에 {len(unique_records)}개 저장 완료!")
else:
    print("[Warning] 일부 저장 실패. 위 로그를 확인하세요.")
