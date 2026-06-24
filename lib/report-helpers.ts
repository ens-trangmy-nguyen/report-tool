import type { UserRole } from "@/lib/types";

export const reportSelect =
  "id,member_email,created_by,date,content,output,evidence_link,blocker,follow_up,created_at,updated_at";

export const memberSelect = "id,email,name,role,status,created_at,updated_at";

export const checklistSelect =
  "id,created_by,title,description,scope,due_date,created_at,updated_at";

export const checklistItemSelect =
  "id,checklist_id,title,sort_order,created_at,updated_at";

export const checklistAssignmentSelect =
  "id,checklist_id,member_email,created_at";

export const checklistCompletionSelect =
  "id,checklist_item_id,member_email,completed_at";

export const reportCommentSelect =
  "id,report_id,author_email,author_name,content,created_at,updated_at";

export const notificationSelect =
  "id,recipient_email,actor_email,type,title,body,link_url,read_at,created_at";

export const roadmapNodeSelect =
  "id,title,description,resource_links,parent_id,sort_order,position_x,position_y,created_by,created_at,updated_at";

export function canManageReport(role?: UserRole, createdBy?: string, email?: string) {
  return role === "Leader" && Boolean(createdBy) && createdBy === email;
}

export function encodeMemberId(email: string) {
  return encodeURIComponent(email);
}

export function getChecklistProgress(
  items: { id: string }[],
  completions: { checklist_item_id: string }[],
) {
  if (!items.length) return 0;
  const completedIds = new Set(
    completions.map((completion) => completion.checklist_item_id),
  );
  const done = items.filter((item) => completedIds.has(item.id)).length;
  return Math.round((done / items.length) * 100);
}

export const tablePagination = {
  defaultPageSize: 10,
  hideOnSinglePage: false,
  pageSizeOptions: [5, 10, 20, 50],
  showSizeChanger: true,
  showTotal: (total: number) => `${total} items`,
};
