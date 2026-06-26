export type UserRole = "Leader" | "Member" | "Admin";
export type UserStatus = "Active" | "Inactive";

export type WhitelistUser = {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  status: UserStatus;
  created_at: string;
  updated_at: string;
};

export type ReportLogSummary = {
  id: string;
  member_email: string;
  date: string;
};

export type ReportLog = {
  id: string;
  member_email: string;
  created_by: string;
  date: string;
  content: string;
  output: string | null;
  evidence_link: string | null;
  blocker: string | null;
  follow_up: string | null;
  created_at: string;
  updated_at: string;
};

export type ChecklistScope = "Team" | "Personal";

export type Checklist = {
  id: string;
  created_by: string;
  title: string;
  description: string | null;
  scope: ChecklistScope;
  due_date: string | null;
  created_at: string;
  updated_at: string;
};

export type ChecklistItem = {
  id: string;
  checklist_id: string;
  title: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type ChecklistAssignment = {
  id: string;
  checklist_id: string;
  member_email: string;
  created_at: string;
};

export type ChecklistItemCompletion = {
  id: string;
  checklist_item_id: string;
  member_email: string;
  completed_at: string;
};

export type ReportComment = {
  id: string;
  report_id: string;
  author_email: string;
  author_name: string | null;
  content: string;
  created_at: string;
  updated_at: string | null;
};

export type Notification = {
  id: string;
  recipient_email: string;
  actor_email: string | null;
  type: string;
  title: string;
  body: string | null;
  link_url: string | null;
  read_at: string | null;
  created_at: string;
};

export type RoadmapNode = {
  id: string;
  title: string;
  description: string | null;
  resource_links: string[] | null;
  parent_id: string | null;
  sort_order: number;
  position_x: number | null;
  position_y: number | null;
  created_at: string;
  updated_at: string;
};
