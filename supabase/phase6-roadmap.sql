-- Phase 6: Roadmap
-- Shared learning/skill roadmap for the FE team.
-- Run this in the Supabase SQL Editor.
-- Important: any active Leader can create/edit/delete roadmap nodes.
-- Roadmap is a shared team artifact, not owned by an individual Leader.

create table if not exists public.roadmap_nodes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  resource_links text[],
  parent_id uuid references public.roadmap_nodes(id) on delete cascade,
  sort_order integer not null default 0,
  position_x integer,
  position_y integer,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table public.roadmap_nodes
  add column if not exists position_x integer,
  add column if not exists position_y integer;

-- Legacy column from older MVP versions. Keep it nullable for existing DBs,
-- but do not use it for permissions or inserts anymore.
alter table public.roadmap_nodes
  add column if not exists created_by text;

alter table public.roadmap_nodes
  alter column created_by drop not null;

create index if not exists roadmap_nodes_parent_sort_idx
  on public.roadmap_nodes (parent_id, sort_order asc);

alter table public.roadmap_nodes enable row level security;

drop policy if exists "Active whitelisted users can read roadmap nodes" on public.roadmap_nodes;
create policy "Active whitelisted users can read roadmap nodes"
on public.roadmap_nodes
for select
to authenticated
using (public.current_app_role() is not null);

drop policy if exists "Leaders can insert roadmap nodes" on public.roadmap_nodes;
create policy "Leaders can insert roadmap nodes"
on public.roadmap_nodes
for insert
to authenticated
with check (public.current_app_role() = 'Leader');

drop policy if exists "Leaders can update own roadmap nodes" on public.roadmap_nodes;
drop policy if exists "Leaders can update roadmap nodes" on public.roadmap_nodes;
create policy "Leaders can update roadmap nodes"
on public.roadmap_nodes
for update
to authenticated
using (public.current_app_role() = 'Leader')
with check (public.current_app_role() = 'Leader');

drop policy if exists "Leaders can delete own roadmap nodes" on public.roadmap_nodes;
drop policy if exists "Leaders can delete roadmap nodes" on public.roadmap_nodes;
create policy "Leaders can delete roadmap nodes"
on public.roadmap_nodes
for delete
to authenticated
using (public.current_app_role() = 'Leader');

notify pgrst, 'reload schema';
