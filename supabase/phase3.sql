create table if not exists checklists (
  id uuid primary key default gen_random_uuid(),
  created_by text not null,
  title text not null,
  description text,
  scope text not null check (scope in ('Team', 'Personal')),
  due_date date not null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists checklist_items (
  id uuid primary key default gen_random_uuid(),
  checklist_id uuid not null references checklists(id) on delete cascade,
  title text not null,
  sort_order integer not null default 0,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists checklist_assignments (
  id uuid primary key default gen_random_uuid(),
  checklist_id uuid not null references checklists(id) on delete cascade,
  member_email text not null references whitelist_users(email) on delete cascade,
  created_at timestamp with time zone default now(),
  unique (checklist_id, member_email)
);

create table if not exists checklist_item_completions (
  id uuid primary key default gen_random_uuid(),
  checklist_item_id uuid not null references checklist_items(id) on delete cascade,
  member_email text not null references whitelist_users(email) on delete cascade,
  completed_at timestamp with time zone default now(),
  unique (checklist_item_id, member_email)
);

create index if not exists checklist_items_checklist_idx
on checklist_items (checklist_id, sort_order asc);

create index if not exists checklist_assignments_checklist_member_idx
on checklist_assignments (checklist_id, member_email);

create index if not exists checklist_assignments_member_idx
on checklist_assignments (member_email);

create index if not exists checklist_completions_item_member_idx
on checklist_item_completions (checklist_item_id, member_email);

alter table checklists enable row level security;
alter table checklist_items enable row level security;
alter table checklist_assignments enable row level security;
alter table checklist_item_completions enable row level security;

drop policy if exists "Leaders and admins can read checklists" on checklists;
create policy "Leaders and admins can read checklists"
on checklists
for select
to authenticated
using (public.current_app_role() in ('Leader', 'Admin'));

drop policy if exists "Members can read assigned checklists" on checklists;
create policy "Members can read assigned checklists"
on checklists
for select
to authenticated
using (
  exists (
    select 1
    from checklist_assignments
    where checklist_assignments.checklist_id = checklists.id
      and checklist_assignments.member_email = auth.jwt() ->> 'email'
  )
);

drop policy if exists "Leaders can insert checklists" on checklists;
create policy "Leaders can insert checklists"
on checklists
for insert
to authenticated
with check (
  public.current_app_role() = 'Leader'
  and created_by = auth.jwt() ->> 'email'
);

drop policy if exists "Leaders can update own checklists" on checklists;
create policy "Leaders can update own checklists"
on checklists
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

drop policy if exists "Leaders can delete own checklists" on checklists;
create policy "Leaders can delete own checklists"
on checklists
for delete
to authenticated
using (
  public.current_app_role() = 'Leader'
  and created_by = auth.jwt() ->> 'email'
);

drop policy if exists "Users can read visible checklist items" on checklist_items;
create policy "Users can read visible checklist items"
on checklist_items
for select
to authenticated
using (
  exists (
    select 1
    from checklists
    where checklists.id = checklist_items.checklist_id
  )
);

drop policy if exists "Leaders can insert checklist items" on checklist_items;
create policy "Leaders can insert checklist items"
on checklist_items
for insert
to authenticated
with check (
  public.current_app_role() = 'Leader'
  and exists (
    select 1
    from checklists
    where checklists.id = checklist_items.checklist_id
      and checklists.created_by = auth.jwt() ->> 'email'
  )
);

drop policy if exists "Leaders can update checklist items" on checklist_items;
create policy "Leaders can update checklist items"
on checklist_items
for update
to authenticated
using (
  public.current_app_role() = 'Leader'
  and exists (
    select 1
    from checklists
    where checklists.id = checklist_items.checklist_id
      and checklists.created_by = auth.jwt() ->> 'email'
  )
)
with check (
  public.current_app_role() = 'Leader'
  and exists (
    select 1
    from checklists
    where checklists.id = checklist_items.checklist_id
      and checklists.created_by = auth.jwt() ->> 'email'
  )
);

drop policy if exists "Leaders can delete checklist items" on checklist_items;
create policy "Leaders can delete checklist items"
on checklist_items
for delete
to authenticated
using (
  public.current_app_role() = 'Leader'
  and exists (
    select 1
    from checklists
    where checklists.id = checklist_items.checklist_id
      and checklists.created_by = auth.jwt() ->> 'email'
  )
);

drop policy if exists "Leaders and admins can read checklist assignments" on checklist_assignments;
create policy "Leaders and admins can read checklist assignments"
on checklist_assignments
for select
to authenticated
using (public.current_app_role() in ('Leader', 'Admin'));

drop policy if exists "Members can read own checklist assignments" on checklist_assignments;
create policy "Members can read own checklist assignments"
on checklist_assignments
for select
to authenticated
using (member_email = auth.jwt() ->> 'email');

drop policy if exists "Leaders can insert checklist assignments" on checklist_assignments;
create policy "Leaders can insert checklist assignments"
on checklist_assignments
for insert
to authenticated
with check (
  public.current_app_role() = 'Leader'
  and exists (
    select 1
    from checklists
    where checklists.id = checklist_assignments.checklist_id
      and checklists.created_by = auth.jwt() ->> 'email'
  )
);

drop policy if exists "Leaders can delete checklist assignments" on checklist_assignments;
create policy "Leaders can delete checklist assignments"
on checklist_assignments
for delete
to authenticated
using (
  public.current_app_role() = 'Leader'
  and exists (
    select 1
    from checklists
    where checklists.id = checklist_assignments.checklist_id
      and checklists.created_by = auth.jwt() ->> 'email'
  )
);

drop policy if exists "Users can read visible checklist completions" on checklist_item_completions;
create policy "Users can read visible checklist completions"
on checklist_item_completions
for select
to authenticated
using (
  public.current_app_role() in ('Leader', 'Admin')
  or member_email = auth.jwt() ->> 'email'
);

drop policy if exists "Members can insert own checklist completions" on checklist_item_completions;
create policy "Members can insert own checklist completions"
on checklist_item_completions
for insert
to authenticated
with check (
  member_email = auth.jwt() ->> 'email'
  and exists (
    select 1
    from checklist_items
    join checklist_assignments
      on checklist_assignments.checklist_id = checklist_items.checklist_id
    where checklist_items.id = checklist_item_completions.checklist_item_id
      and checklist_assignments.member_email = auth.jwt() ->> 'email'
  )
);

drop policy if exists "Members can delete own checklist completions" on checklist_item_completions;
create policy "Members can delete own checklist completions"
on checklist_item_completions
for delete
to authenticated
using (member_email = auth.jwt() ->> 'email');

alter table checklists add column if not exists due_date date;

update checklists
set due_date = current_date
where due_date is null;

alter table checklists
alter column due_date set not null;

notify pgrst, 'reload schema';
