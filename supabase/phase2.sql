create table if not exists report_logs (
  id uuid primary key default gen_random_uuid(),
  member_email text not null references whitelist_users(email) on delete cascade,
  created_by text not null,
  date date not null,
  content text not null,
  output text,
  evidence_link text,
  blocker text,
  follow_up text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create index if not exists report_logs_member_date_idx
on report_logs (member_email, date desc);

alter table report_logs enable row level security;

drop policy if exists "Leaders and admins can read report logs" on report_logs;
create policy "Leaders and admins can read report logs"
on report_logs
for select
to authenticated
using (public.current_app_role() in ('Leader', 'Admin'));

drop policy if exists "Members can read own report logs" on report_logs;
create policy "Members can read own report logs"
on report_logs
for select
to authenticated
using (member_email = auth.jwt() ->> 'email');

drop policy if exists "Leaders can insert report logs" on report_logs;
create policy "Leaders can insert report logs"
on report_logs
for insert
to authenticated
with check (
  public.current_app_role() = 'Leader'
  and created_by = auth.jwt() ->> 'email'
);

drop policy if exists "Leaders can update own report logs" on report_logs;
create policy "Leaders can update own report logs"
on report_logs
for update
to authenticated
using (
  public.current_app_role() = 'Leader'
  and created_by = auth.jwt() ->> 'email'
)
with check (
  public.current_app_role() = 'Leader'
  and created_by = auth.jwt() ->> 'email'
);

drop policy if exists "Leaders can delete own report logs" on report_logs;
create policy "Leaders can delete own report logs"
on report_logs
for delete
to authenticated
using (
  public.current_app_role() = 'Leader'
  and created_by = auth.jwt() ->> 'email'
);

