# Ad-Sentinel 향후 마일스톤 및 작업 예정 사항

## 1. 백그라운드 API 동기화 자동화 (Vercel Cron / 외부 스케줄러 연동)

### 📌 현황 및 이슈
* **현황**: 매시간 정각(`0 * * * *`)마다 Meta/Google Ads API 데이터를 조회하여 Supabase DB 캐시를 갱신하는 백그라운드 크론 잡 구조(`vercel.json` 및 `/api/cron/sync-campaigns`)가 구현되어 있음.
* **이슈**: 현재 Vercel 무료(Hobby) 플랜을 사용 중이므로, Vercel의 자체 크론 제한(하루 1회 제한)으로 인해 매시간 자동 동기화 스케줄이 정상적으로 실행되지 않음. (수동 "실시간 동기화" 버튼은 정상 작동)

### 🛠️ 대안 및 해결 방안 (추후 선택하여 진행)

#### 대안 A: Vercel Pro 플랜 업그레이드
* **방법**: Vercel 프로젝트를 Pro 플랜으로 전환.
* **장점**: 코드나 외부 서비스 설정 변경 없이 `vercel.json`에 정의된 매시간 정각 크론 스케줄이 즉시 활성화됨.
* **비용**: Vercel Pro 요금제 비용 발생.

#### 대안 B: 외부 크론 서비스 (cron-job.org 등) 연동
* **방법**: 무료 외부 크론 서비스인 [cron-job.org](https://cron-job.org/) 등에 가입한 후, 매시간 정각마다 아래 동기화 API 엔드포인트를 호출하도록 설정.
  - **호출 URL**: `https://[배포된-도메인]/api/cron/sync-campaigns`
* **보안 강화 작업 (필수)**: 
  - 임의의 사용자가 API를 무단 호출하는 것을 방지하기 위해 Vercel 환경 변수에 임의의 `CRON_SECRET` 값을 설정합니다.
  - 외부 크론 설정 시 Request Header에 `Authorization: Bearer [CRON_SECRET]`를 실어 보내도록 설정합니다.

---

## 2. 기타 확장 마일스톤 (참고)
* **모니터링 알림 연동**: 백그라운드 크론 작업 실패 시 Slack 또는 이메일로 연동 에러 상태 알림 전송.
* **토큰 만료 예외 처리**: Meta/Google API 토큰이 만료되어 갱신 실패 시, 화면 배너뿐만 아니라 계정 관리자에게 직접 알림 메일 발송.
