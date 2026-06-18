create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_email text not null references public.whitelist_users(email) on delete cascade,
  actor_email text references public.whitelist_users(email) on delete set null,
  type text not null,
  title text not null,
  body text,
  link_url text,
  read_at timestamp with time zone,
  created_at timestamp with time zone default now()
);

drop index if exists public.notifications_unique_unread_source_idx;
drop index if exists public.notifications_unique_source_idx;

create index if not exists notifications_recipient_created_idx
on public.notifications (recipient_email, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "Users can read own notifications" on public.notifications;
create policy "Users can read own notifications"
on public.notifications
for select
to authenticated
using (recipient_email = auth.jwt() ->> 'email');

drop policy if exists "Users can mark own notifications read" on public.notifications;
create policy "Users can mark own notifications read"
on public.notifications
for update
to authenticated
using (recipient_email = auth.jwt() ->> 'email')
with check (recipient_email = auth.jwt() ->> 'email');

drop policy if exists "Users can create allowed notifications" on public.notifications;
create policy "Users can create allowed notifications"
on public.notifications
for insert
to authenticated
with check (
  (
    recipient_email = auth.jwt() ->> 'email'
    and type = 'checklist_overdue'
  )
  or (
    type = 'report_comment'
    and actor_email = auth.jwt() ->> 'email'
    and recipient_email <> auth.jwt() ->> 'email'
  )
  or public.current_app_role() = 'Leader'
);

notify pgrst, 'reload schema';
