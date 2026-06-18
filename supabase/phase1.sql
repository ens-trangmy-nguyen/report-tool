create table if not exists whitelist_users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  name text,
  role text not null check (role in ('Leader', 'Member', 'Admin')),
  status text not null default 'Active' check (status in ('Active', 'Inactive')),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table whitelist_users enable row level security;

create or replace function public.current_app_role()
returns text
language sql
security definer
set search_path = public
as $$
  select role
  from whitelist_users
  where email = auth.jwt() ->> 'email'
    and status = 'Active'
  limit 1
$$;

drop policy if exists "Users can read own whitelist row" on whitelist_users;
create policy "Users can read own whitelist row"
on whitelist_users
for select
to authenticated
using (email = auth.jwt() ->> 'email');

drop policy if exists "Leaders and admins can read whitelist users" on whitelist_users;
create policy "Leaders and admins can read whitelist users"
on whitelist_users
for select
to authenticated
using (public.current_app_role() in ('Leader', 'Admin'));
