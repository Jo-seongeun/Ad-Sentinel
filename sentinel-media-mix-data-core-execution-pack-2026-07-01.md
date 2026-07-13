# Sentinel Media Mix Data-Core Execution Pack

Date: 2026-07-01

Purpose: provide the concrete discovery, staging, export/import, verification, and cutover checklist for moving Sentinel Media Mix into `AdMate-Data-Core`.

This pack is execution-ready for source discovery and target staging preparation only. It does not authorize production cutover, source DB deletion, source auth migration, secret export, or Vercel production environment changes.

## 1. Fixed Decisions

| Item | Decision |
| --- | --- |
| Direction | Move Sentinel Media Mix into `AdMate-Data-Core` |
| Dry-run schema | `sentinel_mix_staging` |
| Final product schema | `sentinel_mix` |
| Source auth | Do not migrate |
| Target identity source | Existing AdMate Auth / Openclaw access model |
| Target public schema | Do not use for migrated app tables |

## 2. Non-Negotiables

- Do not migrate source `auth.*`.
- Do not export passwords, refresh tokens, provider tokens, service-role keys, API keys, or credential values into docs, chat, CSV samples, or commits.
- Do not repoint production Vercel environment variables until the cutover gate is explicitly approved.
- Do not delete, drop, or mutate the source DB during staging.
- Do not create Sentinel Mix app tables in target `public`.
- Do not disable RLS in `AdMate-Data-Core`.

## 3. Execution Overview

| Step | Action | Output |
| --- | --- | --- |
| A | Source structure discovery | Column, constraint, index, trigger, and row-count inventory |
| B | Target staging bootstrap | `sentinel_mix_staging` schema and migration helper tables |
| C | Source data export | Table CSV/SQL exports without source auth or secrets |
| D | Staging import | App tables and data loaded into staging |
| E | Verification | Source/target row counts and data-shape checks |
| F | User/Auth remapping | Source users mapped to approved AdMate users |
| G | RPC/RLS rewrite | Target helper functions and access policies |
| H | Preview app verification | Non-production deployment reads/writes staging safely |
| I | Production cutover approval | Final migration window and rollback plan |

## 4. Step A - Source Structure Discovery

Run these queries in the source Sentinel Media Mix Supabase SQL editor.

### 4.1 Column Inventory

```sql
select
  c.table_schema,
  c.table_name,
  c.ordinal_position,
  c.column_name,
  c.data_type,
  c.udt_name,
  c.is_nullable,
  c.column_default,
  c.character_maximum_length,
  c.numeric_precision,
  c.numeric_scale
from information_schema.columns c
where c.table_schema = 'public'
  and c.table_name in (
    'users',
    'teams',
    'team_account_map',
    'planned_campaigns',
    'live_campaign_settings',
    'audit_logs',
    'platform_settings',
    'ad_enum_values',
    'live_campaign_cache',
    'team_sync_status',
    'campaign_settings_check'
  )
order by c.table_name, c.ordinal_position;
```

### 4.2 Constraint Inventory

```sql
select
  tc.table_schema,
  tc.table_name,
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name,
  ccu.table_schema as foreign_table_schema,
  ccu.table_name as foreign_table_name,
  ccu.column_name as foreign_column_name
from information_schema.table_constraints tc
left join information_schema.key_column_usage kcu
  on tc.constraint_catalog = kcu.constraint_catalog
 and tc.constraint_schema = kcu.constraint_schema
 and tc.constraint_name = kcu.constraint_name
left join information_schema.constraint_column_usage ccu
  on tc.constraint_catalog = ccu.constraint_catalog
 and tc.constraint_schema = ccu.constraint_schema
 and tc.constraint_name = ccu.constraint_name
where tc.table_schema = 'public'
  and tc.table_name in (
    'users',
    'teams',
    'team_account_map',
    'planned_campaigns',
    'live_campaign_settings',
    'audit_logs',
    'platform_settings',
    'ad_enum_values',
    'live_campaign_cache',
    'team_sync_status',
    'campaign_settings_check'
  )
order by tc.table_name, tc.constraint_type, tc.constraint_name, kcu.ordinal_position;
```

### 4.3 Index Inventory

```sql
select
  schemaname,
  tablename,
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and tablename in (
    'users',
    'teams',
    'team_account_map',
    'planned_campaigns',
    'live_campaign_settings',
    'audit_logs',
    'platform_settings',
    'ad_enum_values',
    'live_campaign_cache',
    'team_sync_status',
    'campaign_settings_check'
  )
order by tablename, indexname;
```

### 4.4 Trigger Inventory

```sql
select
  event_object_schema as table_schema,
  event_object_table as table_name,
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
from information_schema.triggers
where event_object_schema = 'public'
  and event_object_table in (
    'users',
    'teams',
    'team_account_map',
    'planned_campaigns',
    'live_campaign_settings',
    'audit_logs',
    'platform_settings',
    'ad_enum_values',
    'live_campaign_cache',
    'team_sync_status',
    'campaign_settings_check'
  )
order by event_object_table, trigger_name, event_manipulation;
```

### 4.5 Row Counts

```sql
select 'ad_enum_values' as table_name, count(*)::bigint as row_count from public.ad_enum_values
union all select 'audit_logs', count(*)::bigint from public.audit_logs
union all select 'campaign_settings_check', count(*)::bigint from public.campaign_settings_check
union all select 'live_campaign_cache', count(*)::bigint from public.live_campaign_cache
union all select 'live_campaign_settings', count(*)::bigint from public.live_campaign_settings
union all select 'planned_campaigns', count(*)::bigint from public.planned_campaigns
union all select 'platform_settings', count(*)::bigint from public.platform_settings
union all select 'team_account_map', count(*)::bigint from public.team_account_map
union all select 'team_sync_status', count(*)::bigint from public.team_sync_status
union all select 'teams', count(*)::bigint from public.teams
union all select 'users', count(*)::bigint from public.users
order by table_name;
```

## 5. Step B - Target Staging Bootstrap

Run this in `AdMate-Data-Core` only after Commander approves touching the target DB.

```sql
begin;

create schema if not exists sentinel_mix_staging;

comment on schema sentinel_mix_staging is
  'Dry-run staging schema for Sentinel Media Mix migration into AdMate-Data-Core. Not production.';

revoke all on schema sentinel_mix_staging from public;
revoke all on schema sentinel_mix_staging from anon;
revoke all on schema sentinel_mix_staging from authenticated;

create table if not exists sentinel_mix_staging.migration_manifest (
  id bigserial primary key,
  migration_name text not null,
  source_project_ref text not null,
  source_table text not null,
  target_schema text not null default 'sentinel_mix_staging',
  target_table text not null,
  source_row_count bigint,
  target_row_count bigint,
  verification_status text not null default 'pending',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists sentinel_mix_staging.user_identity_map (
  id bigserial primary key,
  source_user_id text,
  source_email text,
  source_display_name text,
  source_role text,
  source_team_id text,
  target_admate_user_id uuid,
  target_team_id text,
  migration_status text not null default 'needs_review',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table sentinel_mix_staging.user_identity_map is
  'Temporary user mapping table. Source auth is not migrated; target identity must be approved AdMate auth/Openclaw access.';

commit;
```

Post-check:

```sql
select
  table_schema,
  table_name
from information_schema.tables
where table_schema = 'sentinel_mix_staging'
order by table_name;
```

## 6. Step C - Source Data Export

Export these source tables after the freeze/backup gate:

| Source table | Export handling |
| --- | --- |
| `public.ad_enum_values` | Export all rows |
| `public.audit_logs` | Export all rows |
| `public.campaign_settings_check` | Export all rows, then classify as active/debug |
| `public.live_campaign_cache` | Export all rows, but allow regeneration after cron reconnect |
| `public.live_campaign_settings` | Export all rows |
| `public.planned_campaigns` | Export all rows |
| `public.platform_settings` | Export structure and non-secret metadata only unless secure secret handling is separately approved |
| `public.team_account_map` | Export all rows |
| `public.team_sync_status` | Export all rows, but validate after cron reconnect |
| `public.teams` | Export all rows |
| `public.users` | Export only fields needed for identity mapping; do not export source auth state |

Allowed export methods:

- Supabase dashboard table CSV export.
- Source-side `pg_dump` performed by the DB owner.

Do not paste raw credential-bearing rows into chat or docs.

## 7. Step D - Staging Table Creation

Do not hand-write app table DDL until Step A inventories are captured.

DDL rewrite rules after discovery:

- Rewrite `public.<table>` to `sentinel_mix_staging.<table>`.
- Do not port source `auth.*`.
- Do not port `handle_new_user()` as-is.
- Review any FK to `public.users`; target identity must be AdMate auth/Openclaw approved user mapping.
- Keep source row IDs where needed for traceability.
- Preserve indexes required by campaign lookup, team/account lookup, and sync cache reads.

## 8. Step E - Verification

After staging import, run:

```sql
select 'ad_enum_values' as table_name, count(*)::bigint as row_count from sentinel_mix_staging.ad_enum_values
union all select 'audit_logs', count(*)::bigint from sentinel_mix_staging.audit_logs
union all select 'campaign_settings_check', count(*)::bigint from sentinel_mix_staging.campaign_settings_check
union all select 'live_campaign_cache', count(*)::bigint from sentinel_mix_staging.live_campaign_cache
union all select 'live_campaign_settings', count(*)::bigint from sentinel_mix_staging.live_campaign_settings
union all select 'planned_campaigns', count(*)::bigint from sentinel_mix_staging.planned_campaigns
union all select 'platform_settings', count(*)::bigint from sentinel_mix_staging.platform_settings
union all select 'team_account_map', count(*)::bigint from sentinel_mix_staging.team_account_map
union all select 'team_sync_status', count(*)::bigint from sentinel_mix_staging.team_sync_status
union all select 'teams', count(*)::bigint from sentinel_mix_staging.teams
union all select 'users', count(*)::bigint from sentinel_mix_staging.users
order by table_name;
```

Manifest insert template:

```sql
insert into sentinel_mix_staging.migration_manifest (
  migration_name,
  source_project_ref,
  source_table,
  target_table,
  source_row_count,
  target_row_count,
  verification_status,
  notes
) values (
  'sentinel_mix_dry_run_2026_07_01',
  'mkrfyynrsksvsagyxrld',
  'public.ad_enum_values',
  'ad_enum_values',
  76,
  null,
  'pending',
  'Do not mark passed until target row count is verified.'
);
```

## 9. Step F - User/Auth Remapping

Mapping statuses:

| Status | Meaning |
| --- | --- |
| `matched` | Source user maps to an approved AdMate user |
| `needs_invite` | User should be invited through AdMate access process |
| `excluded` | Source user should not be migrated |
| `blocked` | Ambiguous or risky mapping |

Review rules:

- Match by approved business email first.
- Do not trust source auth sessions or identities.
- Do not create long-term `sentinel_mix.users` as a separate auth source.
- Store only masked examples or aggregate counts in docs.

## 10. Step G - RPC/RLS Rewrite

Do not port source helpers as-is.

| Source helper | Target behavior |
| --- | --- |
| `current_user_team_id()` | Resolve team through existing AdMate/Openclaw approved user mapping |
| `is_admin()` | Resolve admin status through AdMate project/system role |
| `handle_new_user()` | Omit; use AdMate access request and approval |
| `set_updated_at()` | Recreate as safe shared helper or target schema helper |

Minimum RLS matrix:

| Role | Expected access |
| --- | --- |
| Sentinel admin | Manage all Sentinel Mix rows |
| Team manager | Manage own team/account rows |
| Member | Read own team/account rows, limited write if product requires |
| Guest/unapproved | No app data access |

`platform_settings` must be server/admin-only and must not expose token-bearing columns to client roles.

## 11. Stop Conditions

Stop immediately if any of these happen:

- Source export includes auth sessions, refresh tokens, provider secrets, passwords, API keys, or service-role keys.
- Staging DDL creates app tables in target `public`.
- Plan attempts to import source `auth.*`.
- Plan disables Data-Core RLS.
- Production Vercel env is changed before preview validation.
- Cron writes to target before row-count verification.
- Team/account mapping cannot be tied to approved AdMate users.

## 12. Next Commander Task After Step A

After the user/team provides Step A source structure outputs, Commander should generate:

1. Reviewed `sentinel_mix_staging` app table DDL.
2. Import order by FK dependency.
3. RLS/RPC rewrite draft.
4. Preview verification checklist.
5. A separate approval request before running target staging DDL.

