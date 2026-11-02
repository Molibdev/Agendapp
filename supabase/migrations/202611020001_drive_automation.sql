begin;
-- Server backups read the latest snapshot; no additional client grants.
grant select on public.finance_snapshots to service_role;
create table public.drive_connections (
 user_id uuid primary key references auth.users(id) on delete cascade,
 encrypted_refresh text not null,
 automatic_enabled boolean not null default false,
 next_backup_at timestamptz not null default now(),
 last_backup_at timestamptz,
 status text not null default 'connected',
 updated_at timestamptz not null default now()
);
alter table public.drive_connections enable row level security;
create policy own_drive_status on public.drive_connections for select to authenticated using(user_id=(select auth.uid()));
revoke all on public.drive_connections from public,anon,authenticated;
grant select(user_id,automatic_enabled,next_backup_at,last_backup_at,status,updated_at) on public.drive_connections to authenticated;
grant all on public.drive_connections to service_role;
create table public.drive_backup_runs (
 user_id uuid not null references auth.users(id) on delete cascade,
 backup_day date not null,
 file_id text not null,
 completed boolean not null default false,
 primary key(user_id,backup_day)
);
alter table public.drive_backup_runs enable row level security;
revoke all on public.drive_backup_runs from public,anon,authenticated;
grant all on public.drive_backup_runs to service_role;
commit;
