================================================================================
LEADER REPORT TOOL — CURRENT STATE IMPLEMENTATION PLAN
================================================================================
Last updated: 2026-06-18

--------------------------------------------------------------------------------
TECH STACK
--------------------------------------------------------------------------------
  - Next.js 16 (App Router, Turbopack) — TypeScript strict mode
  - Ant Design 6 — all UI components
  - Supabase — PostgreSQL + Auth (Google OAuth) + RLS
  - dayjs — date parsing, formatting, comparison
  - pnpm — package manager
  - ESLint — custom rule: react-hooks/set-state-in-effect
    (setState inside useEffect must be deferred via window.setTimeout)

--------------------------------------------------------------------------------
DATABASE SCHEMA (deployed)
--------------------------------------------------------------------------------

phase1.sql
  whitelist_users
    id uuid PK | email text UNIQUE NOT NULL | name text
    role text CHECK ('Leader','Member','Admin') | status text CHECK ('Active','Inactive')
    created_at | updated_at
  current_app_role() — security definer function; reads role from whitelist_users
    by auth.jwt()->>'email'. Used in every RLS policy.

phase2.sql
  report_logs
    id uuid PK | member_email → whitelist_users.email (cascade)
    created_by text | date date | content text NOT NULL
    output text | evidence_link text | blocker text | follow_up text
    created_at | updated_at
  Index: (member_email, date DESC)

phase3.sql
  checklists
    id uuid PK | created_by text | title text NOT NULL | description text
    scope text CHECK ('Team','Personal') | due_date date NOT NULL
    created_at | updated_at
  checklist_items
    id uuid PK | checklist_id → checklists (cascade)
    title text | sort_order int | created_at | updated_at
  checklist_assignments
    id uuid PK | checklist_id → checklists (cascade)
    member_email → whitelist_users (cascade) | created_at
    UNIQUE (checklist_id, member_email)
  checklist_item_completions
    id uuid PK | checklist_item_id → checklist_items (cascade)
    member_email → whitelist_users (cascade) | completed_at
    UNIQUE (checklist_item_id, member_email)

phase4.sql
  report_comments
    id uuid PK | report_id → report_logs (cascade)
    author_email text | author_name text | content text NOT NULL
    created_at | updated_at

phase5-notifications.sql
  notifications
    id uuid PK | recipient_email → whitelist_users (cascade)
    actor_email → whitelist_users (set null) | type text | title text
    body text | link_url text | read_at timestamptz | created_at
  Index: (recipient_email, created_at DESC)

--------------------------------------------------------------------------------
RLS POLICY MATRIX
--------------------------------------------------------------------------------

whitelist_users
  SELECT own row: email = jwt email
  SELECT all: current_app_role() IN ('Leader','Admin')

report_logs
  SELECT all: current_app_role() IN ('Leader','Admin')
  SELECT own: member_email = jwt email
  INSERT: role='Leader' AND created_by = jwt email
  UPDATE: role='Leader' AND created_by = jwt email
  DELETE: role='Leader' AND created_by = jwt email

checklists
  SELECT: role IN ('Leader','Admin') OR assigned member (via checklist_assignments)
  INSERT/UPDATE/DELETE: role='Leader' AND created_by = jwt email

checklist_items
  SELECT: parent checklist is readable (via checklists RLS)
  INSERT/UPDATE/DELETE: role='Leader' AND parent checklist created_by = jwt email

checklist_assignments
  SELECT: role IN ('Leader','Admin') OR member_email = jwt email
  INSERT: role='Leader' AND parent checklist created_by = jwt email
  DELETE: role='Leader' AND parent checklist created_by = jwt email

checklist_item_completions
  SELECT: role IN ('Leader','Admin') OR member_email = jwt email
  INSERT: member_email = jwt email AND member is assigned
  DELETE: member_email = jwt email AND member is assigned

report_comments
  SELECT: role IN ('Leader','Admin') OR jwt email = report's member_email
  INSERT: author_email = jwt email AND (role='Leader' OR jwt email = report member)
  UPDATE: author_email = jwt email
  DELETE: author_email = jwt email OR role='Leader'

notifications
  SELECT: recipient_email = jwt email
  UPDATE (mark read): recipient_email = jwt email
  INSERT: self-insert for checklist_overdue, or report_comment with actor≠recipient,
          or any if role='Leader'

--------------------------------------------------------------------------------
ROUTE STRUCTURE
--------------------------------------------------------------------------------

/                         Leader/Admin dashboard; Members redirect → /my/dashboard
/auth/callback            OAuth code-exchange handler

/members                  Member list (Leader/Admin)
/members/[memberId]       Member detail + report history (Leader/Admin)
                          [memberId] = encodeURIComponent(email)

/reports                  All reports list (Leader/Admin) — month + member filter
/members/[memberId]/reports/[reportId]
                          Report detail, edit/delete (Leader); read-only (Admin)

/checklists               Checklist management list (Leader/Admin)
/checklists/new           Create checklist (Leader only)
/checklists/[checklistId] Checklist detail: edit metadata, manage items/assignments,
                          per-member progress table (Leader/Admin)

/my/dashboard             Member dashboard: overdue count, reports count,
                          unread notification count, OverdueChecklistsSection
/my/reports               Member report list — month filter
/my/reports/[reportId]    Member report detail + comments
/my/checklists            Member assigned checklists list — progress + due date
/my/checklists/[checklistId] Member checklist detail — tick/untick items

--------------------------------------------------------------------------------
KEY SHARED COMPONENTS
--------------------------------------------------------------------------------

AppShell (components/AppShell.tsx)
  - Authenticated nav header wrapper used on every page
  - Leader/Admin nav: Dashboard, Members, Reports, Checklists
  - Member nav: My Dashboard, My Reports, My Checklists
  - Notifications bell: Badge with unread count, Popover with last 10 entries,
    mark-all-read button. Reloads on route change and on custom DOM event
    'report-tool:notifications-changed'.
  - Avatar + Dropdown user menu: name, email, role, sign-out

AppBackButton (components/AppBackButton.tsx)
  - Smart back: uses router.back() if referrer is same origin + history exists,
    otherwise router.push(fallbackHref)

ChecklistForm (components/ChecklistForm.tsx)
  - Reusable create/edit form: title, description, scope, due_date (required),
    items (dynamic list), assignees (Personal scope only)
  - due_date: DatePicker with disabledDate (past dates greyed), validator rule
    rejects manually entered past dates
  - ChecklistFormValues: { title, description?, due_date: Dayjs, scope,
    items: {title}[], assignees? }

ReportComments (components/ReportComments.tsx)
  - Comment thread: create, inline edit (pencil), delete with confirm modal (trash)
  - Author name resolved from whitelist_users at load time
  - "(edited)" marker shown after update
  - canEditComment: author_email === own; canDeleteComment: author === own OR role==='Leader'

OverdueChecklistsSection (components/dashboard/OverdueChecklistsSection.tsx)
  - Self-contained: queries checklists WHERE due_date < today, then items/
    assignments/completions, filters by incomplete progress
  - Leader/Admin: shows all team overdue checklists + incomplete member count column
  - Member: shows only own assigned overdue checklists (completions filtered by
    member_email client-side AND via RLS)
  - Props: { currentUser, onCountChange? }
  - Side effect (Member only): inserts checklist_overdue notifications for any
    overdue checklist not yet notified, deduped by link_url. Fires
    'report-tool:notifications-changed' event after insert.
  - Hides itself (returns null) when loading=false and rows=[].

DashboardMetrics (components/dashboard/DashboardMetrics.tsx)
  - Leader/Admin: total members, members needing review, overdue checklists
  - Member: overdue checklists count, my reports count, unread notifications count

NeedReviewSection (components/dashboard/NeedReviewSection.tsx)
  - Members with no report in the past 30 days
  - Leader can open Create Report modal per row

--------------------------------------------------------------------------------
KEY LIB FILES
--------------------------------------------------------------------------------

lib/auth-client.ts
  getCurrentProfile() → { error, profile: WhitelistUser | null, session }
  canViewTeam(role) → role === 'Leader' || role === 'Admin'

lib/report-helpers.ts
  Select string constants:
    reportSelect, memberSelect, checklistSelect (includes due_date),
    checklistItemSelect, checklistAssignmentSelect, checklistCompletionSelect,
    reportCommentSelect, notificationSelect
  canManageReport(role, createdBy, email) → boolean
  encodeMemberId(email) → encodeURIComponent(email)
  getChecklistProgress(items, completions) → 0–100
  tablePagination — shared Ant Design Table pagination config

lib/date-format.ts
  formatDisplayDate(value) → 'DD-MM-YYYY'
  formatDisplayDateTime(value) → 'HH:mm DD-MM-YYYY'

lib/types.ts
  WhitelistUser, ReportLog, ReportLogSummary, ChecklistScope, Checklist,
  ChecklistItem, ChecklistAssignment, ChecklistItemCompletion,
  ReportComment, Notification

--------------------------------------------------------------------------------
CODING CONVENTIONS
--------------------------------------------------------------------------------

1. All pages are "use client". No server components used.

2. Data loading pattern (required by ESLint react-hooks/set-state-in-effect):
     const loadData = useCallback(async () => { ... }, [deps]);
     useEffect(() => {
       const timer = window.setTimeout(() => { void loadData(); }, 0);
       return () => window.clearTimeout(timer);
     }, [loadData]);

3. Route param encoding:
     [memberId] = encodeURIComponent(email)  — encode via encodeMemberId()
     [checklistId], [reportId] = raw UUID

4. Supabase query pattern:
     const { data, error } = await supabase.from('table').select(selectString)...
     Cast result: (data ?? []) as Type[]

5. Overdue check: dayjs(due_date).isBefore(dayjs(), 'day')
   Today string: new Date().toISOString().slice(0, 10)
   Supabase filter: .lt('due_date', todayStr) (excludes NULLs automatically)

6. canEdit guard on checklist detail:
     const canEdit = currentUser?.role === 'Leader' && checklist?.created_by === currentUser.email

7. Notifications reload trigger:
     window.dispatchEvent(new Event('report-tool:notifications-changed'))

--------------------------------------------------------------------------------
CURRENT STATUS — ALL FEATURES IMPLEMENTED
--------------------------------------------------------------------------------
  ✓ Phase 1: Auth, whitelist gate, role-based redirect, Google OAuth
  ✓ Phase 2: Report/log CRUD — create, edit, delete, list (month + member filter),
             detail, Leader dashboard quick-create modal
  ✓ Phase 3: Checklists — full CRUD, scope (Team/Personal), due_date (required,
             validated, NOT NULL in DB), per-member progress, member tick/untick,
             overdue section on all dashboards, overdue tag in list pages
  ✓ Phase 4: Comments — create, edit, delete, author name, RLS
  ✓ Phase 5: Notifications — in-app bell, unread badge, mark-all-read,
             checklist_assigned insert, checklist_overdue auto-insert,
             report_comment insert
  ✓ AppShell: nav, notifications bell, avatar user dropdown
  ✓ AppBackButton: smart back navigation
  ✓ Member dashboard (/my/dashboard): metrics + overdue checklists section
  ✓ My Reports (/my/reports): overdue checklists section at top

--------------------------------------------------------------------------------
DEPLOYMENT
--------------------------------------------------------------------------------
  Fresh install or upgrade: run phase1 → phase2 → phase3 → phase4 → phase5
  in Supabase SQL Editor. phase3.sql includes due_date backfill and NOT NULL.

  Required env vars:
    NEXT_PUBLIC_SUPABASE_URL
    NEXT_PUBLIC_SUPABASE_ANON_KEY

  Google OAuth redirect URL: <origin>/auth/callback
