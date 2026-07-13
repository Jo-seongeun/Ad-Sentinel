import os
import json
import requests
import urllib3
from dotenv import load_dotenv

# Disable SSL warnings
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# 1. Load environment variables
load_dotenv('.env.local')

SUPABASE_URL = os.environ.get('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
META_TOKEN = os.environ.get('META_ACCESS_TOKEN')

if not META_TOKEN:
    print("Error: .env.local 파일에 META_ACCESS_TOKEN 환경변수가 누락되었습니다.")
    exit(1)

# 2. Settings (Target Account ID: 1267556304705160)
ACCOUNT_ID = '1267556304705160'
API_VERSION = 'v19.0'
BASE_URL = f"https://graph.facebook.com/{API_VERSION}"

print("=" * 60)
print(f"Meta Marketing API Insights Data Fetcher")
print(f"Target Account: act_{ACCOUNT_ID}")
print("=" * 60)

# 3. Check Account Currency
acc_url = f"{BASE_URL}/act_{ACCOUNT_ID}?fields=currency,name"
try:
    acc_res = requests.get(acc_url, params={'access_token': META_TOKEN}, verify=False)
    acc_data = acc_res.json()
    if 'error' in acc_data:
        print("! Meta Account API Error:", acc_data['error'])
        exit(1)
    account_currency = acc_data.get('currency', 'KRW')
    account_name = acc_data.get('name', 'N/A')
    print(f"[Success] 계정명: {account_name}")
    print(f"[Success] 계정 통화 기준: {account_currency}")
except Exception as e:
    print(f"! Error fetching account currency: {e}")
    account_currency = 'KRW'
from urllib.parse import urlparse, parse_qs

def resolve_placement_urls(creative):
    asset_feed_spec = creative.get('asset_feed_spec')
    if not isinstance(asset_feed_spec, dict):
        return None
        
    link_urls = asset_feed_spec.get('link_urls', [])
    rules = asset_feed_spec.get('asset_customization_rules', [])
    if not link_urls:
        return None
        
    # Map label names to URL objects
    label_to_url = {}
    for url_obj in link_urls:
        url_val = url_obj.get('website_url', '')
        if not url_val:
            continue
        labels = url_obj.get('adlabels', [])
        for label in labels:
            lname = label.get('name')
            if lname:
                label_to_url[lname] = url_val

    url_to_placements = {}
    
    def format_spec(spec):
        platforms = spec.get('publisher_platforms', [])
        fb_pos = spec.get('facebook_positions', [])
        ig_pos = spec.get('instagram_positions', [])
        
        platform_names = []
        for p in platforms:
            if p == 'facebook': platform_names.append('페이스북')
            elif p == 'instagram': platform_names.append('인스타그램')
            elif p == 'messenger': platform_names.append('메신저')
            elif p == 'audience_network': platform_names.append('오디언스 네트워크')
            else: platform_names.append(p)
            
        pos_desc = []
        if fb_pos: pos_desc.extend(fb_pos)
        if ig_pos: pos_desc.extend(ig_pos)
        
        pos_names = []
        for pos in pos_desc:
            if pos == 'feed': pos_names.append('피드')
            elif pos == 'story': pos_names.append('스토리')
            elif pos == 'reels': pos_names.append('릴스')
            elif pos == 'facebook_reels': pos_names.append('릴스')
            elif pos == 'instagram_reels': pos_names.append('릴스')
            elif pos == 'stream': pos_names.append('스트림')
            else: pos_names.append(pos)
            
        if platform_names:
            if pos_names:
                return f"{'/'.join(platform_names)} ({', '.join(set(pos_names))})"
            return f"{'/'.join(platform_names)} 전체"
        return "기본 설정"

    # Match rules to URLs
    if rules:
        for rule in rules:
            url_label = rule.get('link_url_label', {})
            label_name = url_label.get('name') if isinstance(url_label, dict) else None
            if not label_name or label_name not in label_to_url:
                continue
                
            url_val = label_to_url[label_name]
            spec = rule.get('customization_spec', {})
            spec_desc = format_spec(spec) if isinstance(spec, dict) else "기본 설정"
            
            if url_val not in url_to_placements:
                url_to_placements[url_val] = []
            url_to_placements[url_val].append(spec_desc)

    # Any URL in link_urls that didn't get mapped by a rule should be associated with "기본 설정"
    for url_obj in link_urls:
        url_val = url_obj.get('website_url', '')
        if url_val and url_val not in url_to_placements:
            url_to_placements[url_val] = ["기본 설정"]

    # Format output
    url_lines = []
    utm_lines = []
    for url_val, placements in url_to_placements.items():
        placements_desc = " / ".join(sorted(list(set(placements))))
        url_lines.append(f"[{placements_desc}] {url_val}")
        
        parsed_url = urlparse(url_val)
        qs = parse_qs(parsed_url.query)
        utms = {k: v[0] for k, v in qs.items() if k.lower().startswith('utm_')}
        if utms:
            utm_str = "&".join([f"{k}={v}" for k, v in utms.items()])
            utm_lines.append(f"[{placements_desc}] {utm_str}")
        else:
            utm_lines.append(f"[{placements_desc}] 없음")

    return {
        'landing_urls': "\n".join(url_lines),
        'utm_parameters': "\n".join(utm_lines)
    }

# 3.8 Fetch Ads Configuration Map (to resolve URLs, UTMs, Budgets, Dates, Pixel, Objective, and Creative Details)
print("\n[Info] 광고 소재 및 세팅 설정 정보(예산, 날짜, 픽셀, 목적 및 크리에이티브 상세) 조회 중...")
ads_url = f"{BASE_URL}/act_{ACCOUNT_ID}/ads"
ads_params = {
    'fields': 'id,name,creative{id},adset{id},campaign{id}',
    'limit': 500,
    'access_token': META_TOKEN
}
ad_config_map = {}
try:
    ads_res = requests.get(ads_url, params=ads_params, verify=False)
    ads_json = ads_res.json()
    if 'error' in ads_json:
        print("! Error fetching basic ads:", ads_json['error'])
        ads_data = []
    else:
        ads_data = ads_json.get('data', [])

    # Collect unique IDs
    campaign_ids = set()
    adset_ids = set()
    creative_ids = set()
    for ad in ads_data:
        camp_id = ad.get('campaign', {}).get('id')
        if camp_id: campaign_ids.add(camp_id)
        adset_id = ad.get('adset', {}).get('id')
        if adset_id: adset_ids.add(adset_id)
        creative_id = ad.get('creative', {}).get('id')
        if creative_id: creative_ids.add(creative_id)

    # Batch fetch helper
    def fetch_by_ids(ids_list, fields, batch_size=50):
        results = {}
        ids_list = list(ids_list)
        for i in range(0, len(ids_list), batch_size):
            batch = ids_list[i:i+batch_size]
            ids_str = ",".join(batch)
            url = f"https://graph.facebook.com/{API_VERSION}/"
            params = {
                'ids': ids_str,
                'fields': fields,
                'access_token': META_TOKEN
            }
            batch_res = requests.get(url, params=params, verify=False)
            batch_data = batch_res.json()
            if 'error' in batch_data:
                print(f"! Error fetching batch: {batch_data['error']}")
                continue
            results.update(batch_data)
        return results

    # Fetch details
    campaign_details = fetch_by_ids(campaign_ids, 'id,name,daily_budget,lifetime_budget,start_time,stop_time,objective') if campaign_ids else {}
    adset_details = fetch_by_ids(adset_ids, 'id,name,daily_budget,lifetime_budget,promoted_object{pixel_id}') if adset_ids else {}
    creative_details = fetch_by_ids(creative_ids, 'id,name,title,body,image_url,thumbnail_url,object_type,call_to_action_type,instagram_permalink_url,url_tags,object_story_spec,asset_feed_spec,degrees_of_freedom_spec', batch_size=50) if creative_ids else {}

    # Map details to ads
    for ad in ads_data:
        ad_id = ad.get('id')
        
        # Get details from maps
        camp_id = ad.get('campaign', {}).get('id')
        camp = campaign_details.get(camp_id, {}) if camp_id else {}
        
        adset_id = ad.get('adset', {}).get('id')
        adset = adset_details.get(adset_id, {}) if adset_id else {}
        
        creative_id = ad.get('creative', {}).get('id')
        creative = creative_details.get(creative_id, {}) if creative_id else {}
        
        spec = creative.get('object_story_spec', {}) if isinstance(creative, dict) else {}
        link_data = spec.get('link_data', {}) if isinstance(spec, dict) else {}
        video_data = spec.get('video_data', {}) if isinstance(spec, dict) else {}
        
        resolved_urls = resolve_placement_urls(creative)
        if resolved_urls:
            meta_link = resolved_urls['landing_urls']
            utm = resolved_urls['utm_parameters']
        else:
            meta_link = link_data.get('link', '') if isinstance(link_data, dict) else ''
            if not meta_link and video_data:
                call_to_action = video_data.get('call_to_action', {}) if isinstance(video_data, dict) else {}
                value = call_to_action.get('value', {}) if isinstance(call_to_action, dict) else {}
                meta_link = value.get('link', '') if isinstance(value, dict) else ''
            utm = creative.get('url_tags', '') if isinstance(creative, dict) else ''
            
        # 캠페인 정보 추출
        campaign_daily_budget = int(camp.get('daily_budget', 0)) if camp.get('daily_budget') else 0
        campaign_lifetime_budget = int(camp.get('lifetime_budget', 0)) if camp.get('lifetime_budget') else 0
        campaign_start_time = camp.get('start_time', '')
        campaign_stop_time = camp.get('stop_time', '')
        campaign_objective = camp.get('objective', '')
        
        # 광고세트 정보 추출
        adset_daily_budget = int(adset.get('daily_budget', 0)) if adset.get('daily_budget') else 0
        adset_lifetime_budget = int(adset.get('lifetime_budget', 0)) if adset.get('lifetime_budget') else 0
        
        promoted_object = adset.get('promoted_object')
        pixel_id = promoted_object.get('pixel_id', '') if isinstance(promoted_object, dict) else ''
        
        # 크리에이티브 정보 추출
        creative_name = creative.get('name', '')
        
        # 헤드라인(타이틀) 추출
        creative_title = creative.get('title', '') if isinstance(creative, dict) else ''
        if not creative_title:
            creative_title = link_data.get('title', '') if isinstance(link_data, dict) else ''
        if not creative_title:
            creative_title = video_data.get('call_to_action', {}).get('value', {}).get('title', '') if isinstance(video_data, dict) else ''
        if not creative_title:
            asset_spec = creative.get('asset_feed_spec', {}) if isinstance(creative, dict) else {}
            titles = asset_spec.get('titles', []) if isinstance(asset_spec, dict) else []
            if titles:
                creative_title = " / ".join([t.get('text', '') for t in titles if isinstance(t, dict) and t.get('text')])

        # 본문(Body) 추출
        creative_body = creative.get('body', '') if isinstance(creative, dict) else ''
        if not creative_body:
            creative_body = link_data.get('message', '') if isinstance(link_data, dict) else ''
        if not creative_body:
            creative_body = video_data.get('message', '') if isinstance(video_data, dict) else ''
        if not creative_body:
            photo_data = spec.get('photo_data', {}) if isinstance(spec, dict) else {}
            creative_body = photo_data.get('message', '') if isinstance(photo_data, dict) else ''
        if not creative_body:
            asset_spec = creative.get('asset_feed_spec', {}) if isinstance(creative, dict) else {}
            bodies = asset_spec.get('bodies', []) if isinstance(asset_spec, dict) else []
            if bodies:
                creative_body = " / ".join([b.get('text', '') for b in bodies if isinstance(b, dict) and b.get('text')])

        # 설명(Description) 추출
        creative_description = link_data.get('description', '') if isinstance(link_data, dict) else ''
        if not creative_description:
            creative_description = video_data.get('call_to_action', {}).get('value', {}).get('description', '') if isinstance(video_data, dict) else ''
        if not creative_description:
            asset_spec = creative.get('asset_feed_spec', {}) if isinstance(creative, dict) else {}
            descriptions = asset_spec.get('descriptions', []) if isinstance(asset_spec, dict) else []
            if descriptions:
                creative_description = " / ".join([d.get('text', '') for d in descriptions if isinstance(d, dict) and d.get('text')])

        # 행동유도(CTA) 추출
        creative_cta = creative.get('call_to_action_type', '') if isinstance(creative, dict) else ''
        if not creative_cta:
            creative_cta = link_data.get('call_to_action', {}).get('type', '') if isinstance(link_data, dict) else ''
        if not creative_cta:
            creative_cta = video_data.get('call_to_action', {}).get('type', '') if isinstance(video_data, dict) else ''

        # 소재 유형(Creative Type) 판별
        creative_type = '기타'
        if isinstance(creative, dict):
            if creative.get('asset_feed_spec'):
                creative_type = '다이나믹 크리에이티브 (Dynamic)'
            elif spec.get('template_data') if isinstance(spec, dict) else False:
                creative_type = '슬라이드 (Carousel)'
            elif spec.get('video_data') if isinstance(spec, dict) else False:
                creative_type = '동영상 (Video)'
            elif spec.get('link_data') if isinstance(spec, dict) else False:
                creative_type = '단일 이미지/링크 (Image/Link)'
            elif spec.get('photo_data') if isinstance(spec, dict) else False:
                creative_type = '단일 이미지 (Photo)'
            else:
                obj_type = creative.get('object_type', '')
                if obj_type == 'SHARE':
                    creative_type = '단일 이미지/링크 (Share)'
                elif obj_type == 'VIDEO':
                    creative_type = '동영상 (Video)'
                elif obj_type == 'PHOTO':
                    creative_type = '단일 이미지 (Photo)'

        # 프리뷰/썸네일 및 링크
        creative_image_url = creative.get('image_url', '') if isinstance(creative, dict) else ''
        creative_thumbnail_url = creative.get('thumbnail_url', '') if isinstance(creative, dict) else ''
        creative_instagram_permalink = creative.get('instagram_permalink_url', '') if isinstance(creative, dict) else ''

        # 1. 유연한 미디어 (Advantage+ Creative) 활성화 여부
        dof = creative.get('degrees_of_freedom_spec', {}) if isinstance(creative, dict) else {}
        features = dof.get('creative_features_spec', {}) if isinstance(dof, dict) else {}
        advantage_plus_status = '비활성화'
        if isinstance(features, dict):
            ap_feat = features.get('advantage_plus_creative')
            if isinstance(ap_feat, dict) and ap_feat.get('enroll_status') == 'OPT_IN':
                advantage_plus_status = '활성화'

        # 2. 노출 위치별 맞춤 설정 (Placement Asset Customization) 분석
        asset_feed_spec = creative.get('asset_feed_spec') if isinstance(creative, dict) else None
        placement_customized = '비활성화'
        customized_placements_list = []
        if isinstance(asset_feed_spec, dict):
            rules = asset_feed_spec.get('asset_customization_rules', [])
            if isinstance(rules, list):
                for rule in rules:
                    custom_spec = rule.get('customization_spec', {})
                    if not isinstance(custom_spec, dict):
                        continue
                    platforms = custom_spec.get('publisher_platforms', [])
                    fb_pos = custom_spec.get('facebook_positions', [])
                    ig_pos = custom_spec.get('instagram_positions', [])
                    
                    target_desc = []
                    if platforms:
                        platform_names = []
                        for p in platforms:
                            if p == 'facebook': platform_names.append('페이스북')
                            elif p == 'instagram': platform_names.append('인스타그램')
                            elif p == 'messenger': platform_names.append('메신저')
                            elif p == 'audience_network': platform_names.append('오디언스 네트워크')
                            else: platform_names.append(p)
                        
                        pos_desc = []
                        if fb_pos: pos_desc.extend(fb_pos)
                        if ig_pos: pos_desc.extend(ig_pos)
                        
                        if pos_desc:
                            pos_names = []
                            for pos in pos_desc:
                                if pos == 'feed': pos_names.append('피드')
                                elif pos == 'story': pos_names.append('스토리')
                                elif pos == 'reels': pos_names.append('릴스')
                                elif pos == 'facebook_reels': pos_names.append('릴스')
                                elif pos == 'instagram_reels': pos_names.append('릴스')
                                elif pos == 'stream': pos_names.append('스트림')
                                else: pos_names.append(pos)
                            target_desc.append(f"{'/'.join(platform_names)} ({', '.join(set(pos_names))})")
                        else:
                            target_desc.append(f"{'/'.join(platform_names)} 전체")
                    
                    if target_desc:
                        customized_placements_list.append(" / ".join(target_desc))
                
                if customized_placements_list:
                    placement_customized = f"활성화 ({', '.join(customized_placements_list)})"
        
        ad_config_map[ad_id] = {
            'landing_url': meta_link,
            'utm_parameters': utm,
            'campaign_daily_budget': campaign_daily_budget,
            'campaign_lifetime_budget': campaign_lifetime_budget,
            'campaign_start_time': campaign_start_time,
            'campaign_stop_time': campaign_stop_time,
            'campaign_objective': campaign_objective,
            'adset_daily_budget': adset_daily_budget,
            'adset_lifetime_budget': adset_lifetime_budget,
            'pixel_id': pixel_id,
            'creative_id': creative_id,
            'creative_name': creative_name,
            'creative_title': creative_title,
            'creative_body': creative_body,
            'creative_description': creative_description,
            'creative_cta': creative_cta,
            'creative_type': creative_type,
            'creative_image_url': creative_image_url,
            'creative_thumbnail_url': creative_thumbnail_url,
            'creative_instagram_permalink': creative_instagram_permalink,
            'advantage_plus': advantage_plus_status,
            'placement_customization': placement_customized
        }
    print(f"[Success] {len(ad_config_map)}개의 광고 세팅 및 크리에이티브 설정을 로드했습니다.")
except Exception as e:
    print(f"! Error fetching ads creative config: {e}")

# 4. Fetch Insights function
def fetch_insights(level, date_preset='last_30d'):
    print(f"\n[Info] {level.upper()} 레벨 실시간 성과 지표 수집 시작... (기간: {date_preset})")
    
    # 주요 측정 기준 필드 정의
    fields = [
        'campaign_id',
        'campaign_name',
        'adset_id',
        'adset_name',
        'ad_id',
        'ad_name',
        'spend',
        'impressions',
        'clicks',
        'reach',
        'frequency',
        'ctr',
        'cpc',
        'cpm',
        'actions',
        'action_values',
        'purchase_roas',
        'objective',
        'date_start',
        'date_stop'
    ]
    
    # level에 따라 불필요한 id/name 필드는 필터링
    if level == 'campaign':
        fields = [f for f in fields if 'adset_' not in f and 'ad_' not in f]
    elif level == 'adset':
        fields = [f for f in fields if 'ad_' not in f]

    url = f"{BASE_URL}/act_{ACCOUNT_ID}/insights"
    params = {
        'level': level,
        'fields': ','.join(fields),
        'date_preset': date_preset,
        # ACTIVE 상태인 캠페인만 필터링
        'filtering': json.dumps([{
            'field': 'campaign.effective_status',
            'operator': 'IN',
            'value': ['ACTIVE']
        }]),
        'limit': 500,
        'access_token': META_TOKEN
    }
    
    response = requests.get(url, params=params, verify=False)
    result = response.json()
    
    if 'error' in result:
        print(f"! Insights API Error ({level}):", result['error'])
        return []
    
    data = result.get('data', [])
    # ad 레벨인 경우 설정 매핑 정보 추가
    if level == 'ad':
        for record in data:
            ad_id = record.get('ad_id')
            cfg = ad_config_map.get(ad_id, {})
            record['landing_url'] = cfg.get('landing_url', '')
            record['utm_parameters'] = cfg.get('utm_parameters', '')
            record['campaign_daily_budget'] = cfg.get('campaign_daily_budget', 0)
            record['campaign_lifetime_budget'] = cfg.get('campaign_lifetime_budget', 0)
            record['campaign_start_time'] = cfg.get('campaign_start_time', '')
            record['campaign_stop_time'] = cfg.get('campaign_stop_time', '')
            record['campaign_objective'] = cfg.get('campaign_objective', '')
            record['adset_daily_budget'] = cfg.get('adset_daily_budget', 0)
            record['adset_lifetime_budget'] = cfg.get('adset_lifetime_budget', 0)
            record['pixel_id'] = cfg.get('pixel_id', '')
            
            # 크리에이티브 상세 정보 추가
            record['creative_id'] = cfg.get('creative_id', '')
            record['creative_name'] = cfg.get('creative_name', '')
            record['creative_title'] = cfg.get('creative_title', '')
            record['creative_body'] = cfg.get('creative_body', '')
            record['creative_description'] = cfg.get('creative_description', '')
            record['creative_cta'] = cfg.get('creative_cta', '')
            record['creative_type'] = cfg.get('creative_type', '기타')
            record['creative_image_url'] = cfg.get('creative_image_url', '')
            record['creative_thumbnail_url'] = cfg.get('creative_thumbnail_url', '')
            record['creative_instagram_permalink'] = cfg.get('creative_instagram_permalink', '')
            record['advantage_plus'] = cfg.get('advantage_plus', '비활성화')
            record['placement_customization'] = cfg.get('placement_customization', '비활성화')
            
    return data

# Helper to parse key actions from action list
def parse_actions(actions_list):
    parsed = {
        'link_click': 0,
        'landing_page_view': 0,
        'purchase': 0,
        'purchase_value': 0.0,
        'lead': 0,
        'complete_registration': 0,
        'add_to_cart': 0
    }
    if not actions_list:
        return parsed
        
    for act in actions_list:
        action_type = act.get('action_type', '')
        value = int(act.get('value', 0))
        
        if action_type == 'link_click':
            parsed['link_click'] = value
        elif action_type == 'landing_page_view':
            parsed['landing_page_view'] = value
        elif action_type in ['purchase', 'offsite_conversion.fb_pixel_purchase']:
            parsed['purchase'] = value
        elif action_type in ['lead', 'offsite_conversion.fb_pixel_lead']:
            parsed['lead'] = value
        elif action_type in ['complete_registration', 'offsite_conversion.fb_pixel_complete_registration']:
            parsed['complete_registration'] = value
        elif action_type in ['add_to_cart', 'offsite_conversion.fb_pixel_add_to_cart']:
            parsed['add_to_cart'] = value
            
    return parsed

def parse_action_values(action_values_list):
    val = 0.0
    if not action_values_list:
        return val
    for act_val in action_values_list:
        action_type = act_val.get('action_type', '')
        # 구매 금액 합산
        if action_type in ['purchase', 'offsite_conversion.fb_pixel_purchase', 'omni_purchase']:
            val = float(act_val.get('value', 0.0))
            break
    return val

# 5. Run collection for Campaign level and Ad level (Maximum & Last 30 Days)
presets = ['maximum', 'last_30d']
levels = ['campaign', 'ad']
collected_data = {}

for preset in presets:
    collected_data[preset] = {}
    for level in levels:
        data = fetch_insights(level, preset)
        collected_data[preset][level] = data
        print(f"[Success] {level} 레벨 데이터 {len(data)}건 로드 완료.")

# 6. Save raw insights data to JSON for full inspection
output_file = 'meta_insights_raw.json'
with open(output_file, 'w', encoding='utf-8') as f:
    json.dump(collected_data, f, ensure_ascii=False, indent=4)
print(f"\n[Success] 원본 데이터가 '{output_file}' 파일에 저장되었습니다.")

# 7. Print summary dashboard to console
print("\n" + "=" * 80)
print("                    [LIVE CAMPAIGN PERFORMANCE SUMMARY]")
print("=" * 80)

campaign_data_maximum = collected_data['maximum']['campaign']
if not campaign_data_maximum:
    print("수집된 활성 캠페인의 전체 누적(Maximum) 성과 데이터가 없습니다.")
else:
    for camp in campaign_data_maximum:
        camp_id = camp.get('campaign_id')
        camp_name = camp.get('campaign_name')
        objective = camp.get('objective')
        spend = float(camp.get('spend', 0))
        impressions = int(camp.get('impressions', 0))
        clicks = int(camp.get('clicks', 0))
        reach = int(camp.get('reach', 0))
        ctr = float(camp.get('ctr', 0.0))
        cpc = float(camp.get('cpc', 0.0))
        cpm = float(camp.get('cpm', 0.0))
        frequency = float(camp.get('frequency', 0.0))
        
        # Parse actions
        actions = parse_actions(camp.get('actions', []))
        purchase_value = parse_action_values(camp.get('action_values', []))
        
        # ROAS
        roas_list = camp.get('purchase_roas', [])
        roas = 0.0
        if roas_list:
            for r in roas_list:
                if r.get('action_type') in ['purchase', 'offsite_conversion.fb_pixel_purchase', 'omni_purchase']:
                    roas = float(r.get('value', 0.0)) * 100 # 백분율 환산
                    break
        if roas == 0.0 and spend > 0 and purchase_value > 0:
            roas = (purchase_value / spend) * 100

        print(f"\n* 캠페인명: {camp_name} (ID: {camp_id})")
        print(f"   - 캠페인 목적: {objective}")
        print(f"   - 지출액: {spend:,.1f} {account_currency} | 노출수: {impressions:,} | 도달수: {reach:,} | 빈도: {frequency:.2f}")
        print(f"   - 클릭수: {clicks:,} | CTR: {ctr:.3f}% | CPC: {cpc:,.1f} {account_currency} | CPM: {cpm:,.1f} {account_currency}")
        
        # 주요 행동 메트릭 출력
        action_parts = []
        if actions['link_click'] > 0: action_parts.append(f"링크 클릭: {actions['link_click']:,}회")
        if actions['landing_page_view'] > 0: action_parts.append(f"랜딩 페이지 조회: {actions['landing_page_view']:,}회")
        if actions['purchase'] > 0: action_parts.append(f"구매: {actions['purchase']:,}건")
        if purchase_value > 0: action_parts.append(f"구매 금액: {purchase_value:,.1f} {account_currency}")
        if roas > 0: action_parts.append(f"ROAS: {roas:.1f}%")
        if actions['lead'] > 0: action_parts.append(f"리드: {actions['lead']:,}건")
        if actions['complete_registration'] > 0: action_parts.append(f"회원가입: {actions['complete_registration']:,}건")
        if actions['add_to_cart'] > 0: action_parts.append(f"장바구니: {actions['add_to_cart']:,}건")
        
        if action_parts:
            print("   - 주요 전환/행동:")
            for p in action_parts:
                print(f"     * {p}")
        print("-" * 80)

# Optional: Prompt to save parsed data into Supabase if a new table existed, 
# but since campaign_settings_check does not have these performance metrics fields, we only save to local JSON file.
print("\n[Done] 모든 주요 측정 기준 데이터 수집 및 분석 스크립트 실행이 완료되었습니다.")
print("생성된 'meta_insights_raw.json' 파일을 통해 전체 세부 JSON 데이터를 확인하실 수 있습니다.")
