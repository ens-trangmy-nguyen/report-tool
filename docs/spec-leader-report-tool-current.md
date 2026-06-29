# Spec: FE Team Leader Report Tool (Current MVP)

## Overview

Internal web tool for a Frontend team leader to track member activity. Leaders log work reports for members, manage checklists, and leave comments. Members read their own reports, tick checklist items, and receive notifications. Admins have read-only team visibility.

---

## Roles

| Role | Description |
|---|---|
| **Leader** | Creates/edits/deletes reports, checklists, and comments. Manages team. |
| **Admin** | Read-only access to all reports, members, and checklists. |
| **Member** | Reads own reports and comments. Views/completes assigned checklists. |

All roles are stored in `whitelist_users.role`. Access is denied unless the authenticated user's email exists in `whitelist_users` with `status = 'Active'`.

---

## Authentication

- **Provider**: Supabase Google OAuth.
- **Flow**: `/` → Google sign-in → `/auth/callback` → role-based redirect.
- **Whitelist gate**: After OAuth, the app reads `whitelist_users` by email. If the email is missing or `status = 'Inactive'`, the session is signed out immediately and an error toast is shown.
- **Member redirect**: Members are redirected to `/my/dashboard` on login (not the Leader dashboard).

---

## Navigation (AppShell)

- **Leader/Admin**: Dashboard · Members · Reports · Checklists · Roadmap · Bell · User menu
- **Member**: My Dashboard · My Reports · My Checklists · Roadmap · Bell · User menu
- Active route is highlighted. Notifications bell shows unread badge count.

---

## Dashboards

### Leader/Admin Dashboard (`/`)

- **Metrics row**: Total active members · Members needing review (no report in 30 days) · Overdue checklists.
- **Need Review table**: Members with no report in the past 30 days. Leader can open "Add Report" modal inline.
- **Overdue Checklists section**: Lists all checklists where `due_date < today` and at least one assigned member has progress < 100%. Shows checklist title (linked), due date, scope, number of incomplete members. Hidden when empty.
- **Create Report modal**: Leader can create a report log for any active member directly from the dashboard.

### Member Dashboard (`/my/dashboard`)

- **Metrics row**: Overdue checklists count · My reports count · Unread notifications count.
- **Overdue Checklists section**: Same component, filtered to the current member's own assigned checklists where their progress < 100%.

---

## Members (`/members`, `/members/[memberId]`)

- **Leader/Admin only**.
- List of all whitelist users with name, email, role, status, join date.
- Member detail page shows all report logs for that member with month filter.

---

## Reports / Logs

### Report Field Encryption

- Report text fields are encrypted server-side before saving to Supabase.
- Encrypted fields: `content`, `output`, `blocker`, `follow_up`.
- Not encrypted: `evidence_link`, `date`, `member_email`, `created_by`, timestamps.
- The encryption key is stored only in the server environment variable `ENCRYPTION_KEY`.
- Existing plaintext reports are still readable; newly created/updated reports are saved encrypted.

### Leader/Admin Reports (`/reports`)

- Filterable by month and by member (select).
- Table: date, member, content summary, created-at, view link.
- Leaders can delete their own reports directly from the list via a trash action with confirmation. The action is hidden for Admins and for reports created by another user.

### Report Detail (`/members/[memberId]/reports/[reportId]`, `/my/reports/[reportId]`)

- Fields: member, date, content, output, evidence link, blocker, follow-up, created by, timestamps.
- **Leader**: can edit and delete own reports.
- **Member**: read-only.
- **Comments thread** below the report detail card (see Comments).

### My Reports (`/my/reports`)

- Member's own report list, filterable by month.
- Shows overdue checklists section at top (same component as Member Dashboard).

---

## Comments

- Attached to each report log (`report_comments` table).
- Displayed as a thread below the report detail.
- **Create**: Leader and the report's own member can post comments.
- **Edit**: Author only. Shows "(edited)" marker after edit.
- **Delete**: Author only.
- Author name is resolved from `whitelist_users` by email at load time.

---

## Checklists

### Leader Checklist Management (`/checklists`, `/checklists/new`, `/checklists/[checklistId]`)

- **List page**: Shows title, description, scope tag, assigned count, average progress bar, due date with Overdue tag if past due and incomplete.
- **List delete**: The Leader who created a checklist can delete it directly from the list via a trash action with confirmation. Deleting a checklist cascades to its items, assignments, and completions through database foreign keys.
- **Create (`/checklists/new`)**: Form with title, description, scope (Team/Personal), due date (required, must be today or future), checklist items (dynamic list), and assignees (shown for Personal scope; Team scope assigns all active Members automatically).
- **Detail page**: View/edit metadata (title, description, due date), manage items (add/edit/delete), manage assignments (add/remove). Per-member progress table with Progress bar per row.
- Only the Leader who created the checklist can edit/delete it (`canEdit = role === 'Leader' && created_by === email`).

### Member Checklists (`/my/checklists`, `/my/checklists/[checklistId]`)

- **List**: Assigned checklists with progress bar, due date, Overdue tag if past-due and own progress < 100%.
- **Detail**: Tick/untick individual items. Progress updates in real time.

### Due Date Rules

- **Required** at create/edit time.
- **Validation**: DatePicker disables past dates. Form validator rejects manually typed past dates with message "Due date must be today or a future date."
- **Overdue**: Computed at query time as `due_date < today` with incomplete progress. Existing records can become overdue naturally as time passes — no retroactive blocking.

### Checklist Scope

| Scope | Assignees |
|---|---|
| Team | All active Members, auto-assigned on create |
| Personal | Leader selects specific Members |

---

## Notifications

- Stored in `notifications` table (`phase5-notifications.sql`).
- **In-app bell** (AppShell header): shows last 10 notifications, unread count badge. Clicking a notification marks it read and navigates to `link_url`.
- **Mark all read** button in notification popover.
- **Notification types**:
  - `checklist_overdue`: Auto-inserted client-side when `OverdueChecklistsSection` loads for a Member and finds overdue checklists not yet notified. One notification per checklist, deduplicated by `link_url`.
  - `checklist_assigned`: Inserted when a Leader assigns a checklist to a Member.
  - `report_comment`: Inserted when a comment is posted on a report. Sent to the relevant party (Leader or Member), not the author themselves.
- Notifications reload on route change and on the `report-tool:notifications-changed` custom DOM event.

---

## Roadmap

### Overview

A shared learning/skill roadmap for the whole FE team, displayed as an interactive mindmap. All active whitelisted users view the same roadmap. Leaders manage the content.

### Roadmap Page (`/roadmap`)

- **Visible to**: all roles (Leader, Admin, Member).
- Displays all roadmap nodes in an interactive mindmap/canvas layout (parent → children).
- Supports canvas zoom and pan for all roles.
- Clicking a node selects it on the canvas.
- Clicking the detail icon on a node opens a drawer with the node's full detail (description and resource links).
- Double-clicking a node title starts inline rename for Leaders.
- Top-level (root) nodes have no parent. Children are ordered by `sort_order`.

### Node Fields

| Field | Type | Notes |
|---|---|---|
| `title` | text | Required |
| `description` | text | Optional. Shown in drawer. |
| `resource_links` | text[] | Optional. List of URLs shown in drawer. |
| `parent_id` | uuid | Null for root nodes. References `roadmap_nodes.id`. |
| `sort_order` | integer | Controls display order among siblings. |
| `position_x` | integer | Canvas x-position. |
| `position_y` | integer | Canvas y-position. |

### Leader Actions

- **Create**: Add a root node or child node directly on the canvas.
- **Edit**: Rename node title inline on the canvas. Description/resources are edited in the drawer opened from the node detail icon.
- **Delete**: Remove a node (cascades to all child nodes).
- **Move**: Drag nodes on the canvas. Position is saved.

### Admin/Member Actions

- Read-only. Can view the roadmap and open node drawers.
- Cannot create, edit, or delete nodes.

### Out of Scope (MVP)

- Personal roadmaps or per-member assignment.
- Drag-and-drop parent reassignment.
- Progress tracking or completion status.
- Notifications for roadmap changes.
- Integration with checklists or reports.

---

## Permissions Summary

| Action | Leader | Admin | Member |
|---|---|---|---|
| Read all reports | ✓ | ✓ | Own only |
| Create report | ✓ | — | — |
| Edit/delete own report | ✓ | — | — |
| Read all members | ✓ | ✓ | — |
| Read all checklists | ✓ | ✓ | Assigned only |
| Create/edit/delete checklist | Own only | — | — |
| Tick checklist items | — | — | ✓ |
| Post comment | ✓ | — | Own report only |
| Edit/delete comment | Own only | — | Own only |
| Read notifications | Own only | Own only | Own only |
| View roadmap | ✓ | ✓ | ✓ |
| Create/edit/delete roadmap node | ✓ | — | — |

---

## SQL Phases

| File | Tables / Changes |
|---|---|
| `phase1.sql` | `whitelist_users`, `current_app_role()` security-definer function, RLS |
| `phase2.sql` | `report_logs`, RLS |
| `phase3.sql` | `checklists` (with `due_date date not null`), `checklist_items`, `checklist_assignments`, `checklist_item_completions`, RLS, indexes, existing `due_date` backfill |
| `phase4.sql` | `report_comments`, RLS |
| `phase5-notifications.sql` | `notifications`, RLS |
| `phase6-roadmap.sql` | `roadmap_nodes` (with `parent_id`, `sort_order`, `resource_links`), RLS, indexes |

All RLS policies use `public.current_app_role()` which resolves the role from `whitelist_users` via the JWT email claim.
