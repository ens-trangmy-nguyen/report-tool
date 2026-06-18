-- Seed overdue checklists for local/demo testing.
-- Safe to rerun: it removes previous demo overdue checklists before creating new ones.

delete from public.checklists
where title in (
  'Demo overdue - team PR checklist',
  'Demo overdue - personal review checklist',
  'Demo overdue - release checklist'
);

do $$
declare
  leader_email text;
  team_checklist_id uuid := gen_random_uuid();
  personal_checklist_id uuid := gen_random_uuid();
  release_checklist_id uuid := gen_random_uuid();
begin
  select email
  into leader_email
  from public.whitelist_users
  where role = 'Leader'
    and status = 'Active'
  order by created_at asc
  limit 1;

  if leader_email is null then
    raise exception 'No active Leader found in whitelist_users.';
  end if;

  insert into public.checklists (id, created_by, title, description, scope, due_date)
  values
    (
      team_checklist_id,
      leader_email,
      'Demo overdue - team PR checklist',
      'Checklist demo for overdue dashboard. This should appear because it is past due and incomplete.',
      'Team',
      current_date - interval '7 days'
    ),
    (
      personal_checklist_id,
      leader_email,
      'Demo overdue - personal review checklist',
      'Personal checklist demo for assigned members.',
      'Personal',
      current_date - interval '3 days'
    ),
    (
      release_checklist_id,
      leader_email,
      'Demo overdue - release checklist',
      'Release checklist demo for overdue dashboard.',
      'Team',
      current_date - interval '1 day'
    );

  insert into public.checklist_items (checklist_id, title, sort_order)
  values
    (team_checklist_id, 'Review open PRs', 0),
    (team_checklist_id, 'Update PR status', 1),
    (team_checklist_id, 'Follow up blocked reviews', 2),
    (personal_checklist_id, 'Prepare review evidence', 0),
    (personal_checklist_id, 'Update self-review notes', 1),
    (release_checklist_id, 'Check release notes', 0),
    (release_checklist_id, 'Verify production checklist', 1);

  insert into public.checklist_assignments (checklist_id, member_email)
  select team_checklist_id, email
  from public.whitelist_users
  where role = 'Member'
    and status = 'Active'
  on conflict (checklist_id, member_email) do nothing;

  insert into public.checklist_assignments (checklist_id, member_email)
  select personal_checklist_id, email
  from public.whitelist_users
  where role = 'Member'
    and status = 'Active'
  order by created_at asc
  limit 3
  on conflict (checklist_id, member_email) do nothing;

  insert into public.checklist_assignments (checklist_id, member_email)
  select release_checklist_id, email
  from public.whitelist_users
  where role = 'Member'
    and status = 'Active'
  order by created_at desc
  limit 5
  on conflict (checklist_id, member_email) do nothing;
end $$;

notify pgrst, 'reload schema';
