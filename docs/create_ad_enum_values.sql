-- ad_enum_values 테이블
-- 매체별 [캠페인 목적 / 구매 유형 / 최적화 목표 / 과금 기준]의
-- API 값, 한글명, 설명을 저장하는 참조(Reference) 테이블입니다.

CREATE TABLE IF NOT EXISTS public.ad_enum_values (
    id          SERIAL PRIMARY KEY,

    -- 매체 구분 (META | GOOGLE_ADS)
    platform    TEXT NOT NULL,

    -- 필드 유형 (objective | buying_type | optimization_goal | billing_event)
    field_type  TEXT NOT NULL,

    -- API에서 실제로 반환되는 영문 값 (예: OUTCOME_SALES, AUCTION, CONVERSIONS ...)
    api_value   TEXT NOT NULL,

    -- 한글 명칭 (예: 판매, 경매, 전환 ...)
    kr_name     TEXT,

    -- 해당 값에 대한 간략한 설명
    description TEXT,

    -- 생성/수정 시각
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),

    -- 중복 방지: (platform, field_type, api_value) 조합은 유일해야 함
    CONSTRAINT uq_ad_enum_values UNIQUE (platform, field_type, api_value)
);

-- RLS 비활성화 (내부 참조 테이블이므로 공개 읽기 허용)
ALTER TABLE public.ad_enum_values DISABLE ROW LEVEL SECURITY;

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ad_enum_values_updated_at ON public.ad_enum_values;
CREATE TRIGGER trg_ad_enum_values_updated_at
    BEFORE UPDATE ON public.ad_enum_values
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 조회 성능을 위한 인덱스
CREATE INDEX IF NOT EXISTS idx_ad_enum_platform_field ON public.ad_enum_values (platform, field_type);

-- ============================================================
-- 확인용 샘플 조회 쿼리 (테이블 생성 후 실행)
-- ============================================================
-- SELECT platform, field_type, api_value, kr_name, description
-- FROM   ad_enum_values
-- ORDER  BY platform, field_type, api_value;
