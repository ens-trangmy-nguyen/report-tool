create table if not exists report_comments (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references report_logs(id) on delete cascade,
  author_email text not null,
  author_name text,
  content text not null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- if table already existed without updated_at, add it
alter table report_comments
  add column if not exists updated_at timestamp with time zone default now();

create index if not exists report_comments_report_created_idx
on report_comments (report_id, created_at asc);

alter table report_comments enable row level security;

drop policy if exists "Leaders and admins can read report comments" on report_comments;
create policy "Leaders and admins can read report comments"
on report_comments
for select
to authenticated
using (public.current_app_role() in ('Leader', 'Admin'));

drop policy if exists "Members can read comments on own reports" on report_comments;
create policy "Members can read comments on own reports"
on report_comments
for select
to authenticated
using (
  auth.jwt() ->> 'email' = (
    select member_email from report_logs where id = report_id
  )
);

drop policy if exists "Leaders and members can insert own comments" on report_comments;
create policy "Leaders and members can insert own comments"
on report_comments
for insert
to authenticated
with check (
  author_email = auth.jwt() ->> 'email'
  and (
    public.current_app_role() = 'Leader'
    or auth.jwt() ->> 'email' = (
      select member_email from report_logs where id = report_id
    )
  )
);

drop policy if exists "Authors can update own comments" on report_comments;
create policy "Authors can update own comments"
on report_comments
for update
to authenticated
using (author_email = auth.jwt() ->> 'email')
with check (author_email = auth.jwt() ->> 'email');

drop policy if exists "Authors and leaders can delete comments" on report_comments;
create policy "Authors and leaders can delete comments"
on report_comments
for delete
to authenticated
using (
  author_email = auth.jwt() ->> 'email'
  or public.current_app_role() = 'Leader'
);
