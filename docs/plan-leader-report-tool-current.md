================================================================================
LEADER REPORT TOOL — CURRENT STATE IMPLEMENTATION PLAN
================================================================================
Last updated: 2026-06-23

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

phase6-roadmap.sql
  roadmap_nodes
    id uuid PK | title text NOT NULL | description text
    resource_links text[] | parent_id → roadmap_nodes (cascade, nullable)
    sort_order int NOT NULL DEFAULT 0
    position_x int | position_y int
    created_by text | created_at | updated_at
  Index: (parent_id, sort_order ASC)

Report encryption
  report_logs.content, output, blocker, follow_up are encrypted server-side
  before insert/update and decrypted server-side before returning to UI.
  evidence_link is intentionally stored as plaintext.
  Required server env var: ENCRYPTION_KEY.
  Existing plaintext reports remain readable; new/updated reports use enc:v1 payloads.

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
  DELETE: author_email = jwt email

notifications
  SELECT: recipient_email = jwt email
  UPDATE (mark read): recipient_email = jwt email
  INSERT: self-insert for checklist_overdue, or report_comment with actor≠recipient,
          or any if role='Leader'

roadmap_nodes
  SELECT: current_app_role() IS NOT NULL — any active whitelisted user
  INSERT/UPDATE/DELETE: current_app_role() = 'Leader'

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

/roadmap                  Team skill roadmap — tree view, all roles

--------------------------------------------------------------------------------
KEY SHARED COMPONENTS
--------------------------------------------------------------------------------

AppShell (components/AppShell.tsx)
  - Authenticated nav header wrapper used on every page
  - Leader/Admin nav: Dashboard, Members, Reports, Checklists, Roadmap
  - Member nav: My Dashboard, My Reports, My Checklists, Roadmap
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
  - canEditComment: author_email === own; canDeleteComment: author_email === own

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

RoadmapTree (components/roadmap/RoadmapTree.tsx)
  - Renders roadmap_nodes as an interactive React Flow mindmap/canvas
  - Supports zoom/pan for all roles
  - Supports node drag for Leader and saves position_x/position_y
  - Clicking a node selects it on the canvas
  - Detail icon opens node drawer
  - Edges are built from parent_id

RoadmapNodeDrawer (components/roadmap/RoadmapNodeDrawer.tsx)
  - Ant Design Drawer opened from node detail icon.
  - Leader: edit description and resource_links, then save.
  - Admin/Member: read-only title, description, resource_links.

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
    reportCommentSelect, notificationSelect, roadmapNodeSelect  [to add]
  canManageReport(role, createdBy, email) → boolean
  encodeMemberId(email) → encodeURIComponent(email)
  getChecklistProgress(items, completions) → 0–100
  tablePagination — shared Ant Design Table pagination config

lib/date-format.ts
  formatDisplayDate(value) → 'DD-MM-YYYY'
  formatDisplayDateTime(value) → 'HH:mm DD-MM-YYYY'

lib/report-encryption.ts
  Server-only AES-256-GCM helpers for report field encryption/decryption.

lib/report-api.ts
  Client helper for authenticated report API calls. Sends Supabase access token
  to server route handlers.

app/api/reports/*
  Authenticated report API route handlers. Enforce Supabase RLS using the
  caller's bearer token, encrypt writes, decrypt reads.

lib/types.ts
  WhitelistUser, ReportLog, ReportLogSummary, ChecklistScope, Checklist,
  ChecklistItem, ChecklistAssignment, ChecklistItemCompletion,
  ReportComment, Notification, RoadmapNode  [to add]

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
  ✓ Phase 6: Roadmap — roadmap_nodes table + RLS (phase6-roadmap.sql),
             /roadmap page, RoadmapTree, RoadmapNodeDrawer,
             RoadmapNodeFormModal, Leader CRUD, Admin/Member read-only,
             Roadmap nav item in AppShell for all roles
  ✓ AppShell: nav, notifications bell, avatar user dropdown
  ✓ AppBackButton: smart back navigation
  ✓ Member dashboard (/my/dashboard): metrics + overdue checklists section
  ✓ My Reports (/my/reports): overdue checklists section at top

--------------------------------------------------------------------------------
PHASE 6 — ROADMAP
--------------------------------------------------------------------------------
Goal: shared learning/skill roadmap for the whole FE team displayed as an interactive mindmap.
      All active whitelisted users view. Leader creates/edits/deletes nodes.

--- 6.1  SQL: create supabase/phase6-roadmap.sql ---

  Table: roadmap_nodes
    id uuid primary key default gen_random_uuid()
    title text not null
    description text
    resource_links text[]          -- array of URLs, nullable
    parent_id uuid references roadmap_nodes(id) on delete cascade
    sort_order integer not null default 0
    position_x integer             -- canvas x-position, nullable for old rows
    position_y integer             -- canvas y-position, nullable for old rows
    created_by text not null       -- email of the Leader who created it
    created_at timestamptz default now()
    updated_at timestamptz default now()

  Index:
    CREATE INDEX IF NOT EXISTS roadmap_nodes_parent_sort_idx
      ON roadmap_nodes (parent_id, sort_order ASC);

  RLS:
    Enable RLS on roadmap_nodes.
    SELECT policy: current_app_role() IS NOT NULL
      (any active whitelisted user — Leader, Admin, Member)
    INSERT policy: current_app_role() = 'Leader'
      AND created_by = auth.jwt()->>'email'
    UPDATE policy: current_app_role() = 'Leader'
      AND created_by = auth.jwt()->>'email'
    DELETE policy: current_app_role() = 'Leader'
      AND created_by = auth.jwt()->>'email'

  File: supabase/phase6-roadmap.sql

--- 6.2  Types: add RoadmapNode to lib/types.ts ---

  export type RoadmapNode = {
    id: string;
    title: string;
    description: string | null;
    resource_links: string[] | null;
    parent_id: string | null;
    sort_order: number;
    position_x: number | null;
    position_y: number | null;
    created_by: string;
    created_at: string;
    updated_at: string;
  };

  File: lib/types.ts

--- 6.3  Select string: add to lib/report-helpers.ts ---

  export const roadmapNodeSelect =
    'id,title,description,resource_links,parent_id,sort_order,position_x,position_y,created_by,created_at,updated_at';

  File: lib/report-helpers.ts

--- 6.4  Component: RoadmapNodeDrawer ---

  File: components/roadmap/RoadmapNodeDrawer.tsx
  Props: { node: RoadmapNode | null; onClose: () => void }
  Behavior:
    - Ant Design Drawer, open when node != null
    - Shows title (heading), description (paragraph), resource_links as <a> list
    - No editing inside drawer (view-only)

--- 6.5  Component: RoadmapNodeFormModal ---

  File: components/roadmap/RoadmapNodeFormModal.tsx
  Props: { open, node?: RoadmapNode | null, parentId?: string | null,
           onSave, onCancel, saving }
  Behavior:
    - Ant Design Modal (create or edit)
    - Form fields: title (required), description (TextArea), resource_links
      (dynamic list of Input, add/remove like checklist items),
      sort_order (InputNumber)
    - parentId passed in; user does not select parent in this form
  Leader-only: rendered only when currentUser.role === 'Leader'

--- 6.6  Component: RoadmapTree ---

  File: components/roadmap/RoadmapTree.tsx
  Props: { nodes: RoadmapNode[]; canEdit: boolean;
           onNodeClick: (node: RoadmapNode) => void;
           onAddChild: (parentId: string | null) => void;
           onEditNode: (node: RoadmapNode) => void;
           onDeleteNode: (node: RoadmapNode) => void; }
  Behavior:
    - Build React Flow nodes and edges from roadmap_nodes.
    - Use parent_id to render smoothstep edges.
    - Use position_x/position_y if present; otherwise compute a fallback layout.
    - Each node shows title + (if canEdit) icon buttons for Add Child, Rename, Delete.
    - Add Child creates a node immediately near the parent.
    - Rename edits the title inline inside the node.
    - Clicking the node title selects the node.
    - Double-clicking the node title starts inline rename for Leader.
    - Detail icon opens drawer for description/resources management.
    - Leader can drag nodes; drag stop saves position_x/position_y.
    - Empty state: show Ant Design Empty when nodes.length === 0.

--- 6.7  Page: /roadmap ---

  File: app/roadmap/page.tsx
  Access: all roles (Leader, Admin, Member) — gate with getCurrentProfile()
  State:
    currentUser, nodes: RoadmapNode[], loading, error,
    drawerNode: RoadmapNode | null,
    deletingId: string | null
  Data loading:
    - getCurrentProfile() + supabase.from('roadmap_nodes').select(roadmapNodeSelect)
      .order('sort_order', ascending)
    - Follow deferred useEffect pattern.
  canEdit: currentUser?.role === 'Leader'
  Actions (Leader only):
    - Add root node: creates a new root node directly.
    - Add child: creates a new child node directly near the parent.
    - Rename node: inline title edit, then Supabase update.
    - Delete node: confirm, then supabase delete; cascades children in DB
    - Save (create): supabase INSERT { title, description, resource_links,
      parent_id, sort_order, position_x, position_y, created_by: currentUser.email }
    - Save (update): supabase UPDATE { title, description, resource_links,
      sort_order, updated_at } WHERE id = editingNode.id
    - Move node: supabase UPDATE { position_x, position_y, updated_at }
    - After save/delete: reload nodes from Supabase (local state update).
  Layout:
    - AppShell wrapper
    - Card with title 'Roadmap' + (Leader) 'Add root node' Button extra
    - RoadmapTree inside card
    - RoadmapNodeDrawer

--- 6.8  AppShell: add Roadmap nav item ---

  File: components/AppShell.tsx
  Change: add isRoadmap = pathname.startsWith('/roadmap')
  Add nav Link to '/roadmap' with label 'Roadmap' for all roles.
  Position: after Checklists in Leader/Admin nav; after My Checklists in Member nav.

--------------------------------------------------------------------------------
VERIFICATION (Phase 6)
--------------------------------------------------------------------------------
  - Run phase6-roadmap.sql in Supabase SQL Editor.
  - Leader can create a root node; it appears in the mindmap.
  - Leader can add a child node under an existing node.
  - Leader can edit node title, description, resource_links.
  - Leader can delete a node; children cascade-delete.
  - Leader can drag a node and its position persists after reload.
  - Admin can view and zoom/pan the mindmap but Add/Edit/Delete/drag are disabled.
  - Member can view and zoom/pan the mindmap but Add/Edit/Delete/drag are disabled.
  - Clicking any node opens the drawer with correct data.
  - Resource links in drawer are clickable external URLs.
  - Roadmap nav item is active-highlighted on /roadmap.
  - pnpm lint and tsc --noEmit pass with no errors.

--------------------------------------------------------------------------------
RISKS / BLOCKERS (Phase 6)
--------------------------------------------------------------------------------
  - React Flow node action buttons must stop click propagation to avoid opening
    the drawer when clicking Add/Edit/Delete.
  - resource_links is text[]. Supabase returns null for empty array columns;
    guard with ?? [] before rendering.
  - Self-referencing parent_id FK: Supabase RLS on DELETE cascades children
    automatically via ON DELETE CASCADE; no extra app logic needed.
  - sort_order is manual (InputNumber field). No drag-and-drop in MVP.
    Ties in sort_order are resolved by insertion order.
  - Deleting a parent with many deep children cascades silently;
    add a confirmation message that mentions 'and all children'.
--------------------------------------------------------------------------------
  Fresh install or upgrade: run phase1 → phase2 → phase3 → phase4 → phase5 → phase6
  in Supabase SQL Editor. phase3.sql includes due_date backfill and NOT NULL.

  Required env vars:
    NEXT_PUBLIC_SUPABASE_URL
    NEXT_PUBLIC_SUPABASE_ANON_KEY
    ENCRYPTION_KEY

  Google OAuth redirect URL: <origin>/auth/callback
