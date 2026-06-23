"use client";

import { EyeOutlined, TeamOutlined, UserOutlined, WarningOutlined } from "@ant-design/icons";
import { Button, Card, Progress, Spin, Table, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { canViewTeam } from "@/lib/auth-client";
import { formatDisplayDate } from "@/lib/date-format";
import {
  checklistAssignmentSelect,
  checklistCompletionSelect,
  checklistItemSelect,
  checklistSelect,
  getChecklistProgress,
  tablePagination,
} from "@/lib/report-helpers";
import { supabase } from "@/lib/supabase";
import type {
  Checklist,
  ChecklistAssignment,
  ChecklistItem,
  ChecklistItemCompletion,
  WhitelistUser,
} from "@/lib/types";

const { Text } = Typography;

type OverdueRow = Checklist & {
  assignments: ChecklistAssignment[];
  completions: ChecklistItemCompletion[];
  items: ChecklistItem[];
};

type Props = {
  currentUser: WhitelistUser;
  hideWhenEmpty?: boolean;
  onCountChange?: (count: number) => void;
};

function getTodayStr() {
  return new Date().toISOString().slice(0, 10);
}

function getDaysOverdue(dueDate: string | null) {
  if (!dueDate) return 0;
  const today = new Date(`${getTodayStr()}T00:00:00`);
  const due = new Date(`${dueDate}T00:00:00`);
  return Math.max(0, Math.floor((today.getTime() - due.getTime()) / 86400000));
}

function getIncompleteCount(row: OverdueRow) {
  return row.assignments.filter((assignment) => {
    const memberCompletions = row.completions.filter(
      (completion) => completion.member_email === assignment.member_email,
    );
    return getChecklistProgress(row.items, memberCompletions) < 100;
  }).length;
}

export function OverdueChecklistsSection({
  currentUser,
  hideWhenEmpty = true,
  onCountChange,
}: Props) {
  const [rows, setRows] = useState<OverdueRow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    await Promise.resolve();
    setLoading(true);
    const today = getTodayStr();

    const { data: clData } = await supabase
      .from("checklists")
      .select(checklistSelect)
      .lt("due_date", today);

    const checklists = (clData ?? []) as Checklist[];
    if (!checklists.length) {
      setRows([]);
      onCountChange?.(0);
      setLoading(false);
      return;
    }

    const ids = checklists.map((c) => c.id);
    const [{ data: aData }, { data: iData }] = await Promise.all([
      supabase
        .from("checklist_assignments")
        .select(checklistAssignmentSelect)
        .in("checklist_id", ids),
      supabase
        .from("checklist_items")
        .select(checklistItemSelect)
        .in("checklist_id", ids),
    ]);

    const assignments = (aData ?? []) as ChecklistAssignment[];
    const items = (iData ?? []) as ChecklistItem[];
    const itemIds = items.map((i) => i.id);
    let completions: ChecklistItemCompletion[] = [];

    if (itemIds.length) {
      const completionQuery = canViewTeam(currentUser.role)
        ? supabase
            .from("checklist_item_completions")
            .select(checklistCompletionSelect)
            .in("checklist_item_id", itemIds)
        : supabase
            .from("checklist_item_completions")
            .select(checklistCompletionSelect)
            .in("checklist_item_id", itemIds)
            .eq("member_email", currentUser.email);

      const { data: cData } = await completionQuery;
      completions = (cData ?? []) as ChecklistItemCompletion[];
    }

    const overdueRows = checklists
      .map((cl) => ({
        ...cl,
        assignments: assignments.filter((a) => a.checklist_id === cl.id),
        completions: completions.filter((c) =>
          items.some((i) => i.checklist_id === cl.id && i.id === c.checklist_item_id),
        ),
        items: items.filter((i) => i.checklist_id === cl.id),
      }))
      .filter((cl) => {
        if (!cl.items.length) return false;
        if (canViewTeam(currentUser.role)) {
          return cl.assignments.some((a) => {
            const mc = cl.completions.filter((c) => c.member_email === a.member_email);
            return getChecklistProgress(cl.items, mc) < 100;
          });
        }
        const myCompletions = cl.completions.filter((c) => c.member_email === currentUser.email);
        return getChecklistProgress(cl.items, myCompletions) < 100;
      });

    setRows(overdueRows);
    onCountChange?.(overdueRows.length);
    if (!canViewTeam(currentUser.role) && overdueRows.length) {
      const linkUrls = overdueRows.map((checklist) => `/my/checklists/${checklist.id}`);
      const { data: existingNotifications } = await supabase
        .from("notifications")
        .select("link_url")
        .eq("recipient_email", currentUser.email)
        .eq("type", "checklist_overdue")
        .in("link_url", linkUrls);
      const existingLinks = new Set(
        (existingNotifications ?? []).map((notification) => notification.link_url),
      );
      const nextNotifications = overdueRows
        .filter((checklist) => !existingLinks.has(`/my/checklists/${checklist.id}`))
        .map((checklist) => ({
          body: checklist.title,
          link_url: `/my/checklists/${checklist.id}`,
          recipient_email: currentUser.email,
          title: "Checklist overdue",
          type: "checklist_overdue",
        }));
      const { error: notificationError } = nextNotifications.length
        ? await supabase.from("notifications").insert(nextNotifications)
        : { error: null };
      if (!notificationError) {
        window.dispatchEvent(new Event("report-tool:notifications-changed"));
      }
    }
    setLoading(false);
  }, [currentUser.email, currentUser.role, onCountChange]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  const isTeam = canViewTeam(currentUser.role);
  const columns: ColumnsType<OverdueRow> = useMemo(
    () => [
      {
        title: "Checklist",
        dataIndex: "title",
        key: "title",
        width: 300,
        render: (title: string, record) => {
          const href = isTeam ? `/checklists/${record.id}` : `/my/checklists/${record.id}`;
          return (
            <Link href={href}>
              <Text strong className="text-slate-950 hover:text-blue-600">
                {title}
              </Text>
            </Link>
          );
        },
      },
      {
        title: "Scope",
        dataIndex: "scope",
        key: "scope",
        width: 150,
        render: (scope: string) => (
          <Tag
            className="overdue-scope-tag"
            color={scope === "Team" ? "blue" : "default"}
            icon={scope === "Team" ? <TeamOutlined /> : <UserOutlined />}
          >
            {scope}
          </Tag>
        ),
      },
      {
        title: "Due date",
        dataIndex: "due_date",
        key: "due_date",
        width: 140,
        render: (dueDate: string | null) => (
          <Text className="font-semibold text-slate-600">
            {dueDate ? formatDisplayDate(dueDate) : "-"}
          </Text>
        ),
      },
      {
        title: "Overdue",
        dataIndex: "due_date",
        key: "overdue",
        width: 140,
        render: (dueDate: string | null) => {
          const daysOverdue = getDaysOverdue(dueDate);
          return (
            <span className={daysOverdue >= 7 ? "overdue-days-pill danger" : "overdue-days-pill"}>
              <span className="overdue-days-dot" />
              <span>{daysOverdue} days</span>
            </span>
          );
        },
      },
      {
        title: "Progress",
        key: "progress",
        width: 280,
        render: (_, record) => {
          const incompleteCount = getIncompleteCount(record);
          const progress = isTeam
            ? Math.round(
                ((record.assignments.length - incompleteCount) /
                  Math.max(record.assignments.length, 1)) *
                  100,
              )
            : getChecklistProgress(
                record.items,
                record.completions.filter(
                  (completion) => completion.member_email === currentUser.email,
                ),
              );
          const doneCount = isTeam
            ? record.assignments.length - incompleteCount
            : record.items.filter((item) =>
                record.completions.some(
                  (completion) =>
                    completion.member_email === currentUser.email &&
                    completion.checklist_item_id === item.id,
                ),
              ).length;
          const totalCount = isTeam ? record.assignments.length : record.items.length;

          return (
            <div className="overdue-progress-cell">
              <div className="overdue-progress-meta">
                <Text strong>{progress}%</Text>
                <Text className="text-slate-500">
                  {doneCount}/{totalCount}
                </Text>
              </div>
              <Progress
                percent={progress}
                showInfo={false}
                size="small"
                status="exception"
                strokeColor="#ff4d4f"
              />
            </div>
          );
        },
      },
      {
        title: "",
        key: "action",
        width: 72,
        render: (_, record) => {
          const href = isTeam ? `/checklists/${record.id}` : `/my/checklists/${record.id}`;
          return (
            <Link href={href}>
              <Button
                aria-label="View checklist"
                className="icon-only-action-button"
                icon={<EyeOutlined />}
                type="text"
              />
            </Link>
          );
        },
      },
    ],
    [currentUser.email, isTeam],
  );

  if (!loading && !rows.length && hideWhenEmpty) return null;

  return (
    <Card
      className="page-card"
      title={
        <div className="overdue-card-title">
          <WarningOutlined className="overdue-title-icon" />
          <span className="overdue-card-title-text">Overdue checklists</span>
        </div>
      }
    >
      {loading ? (
        <div className="flex justify-center py-4">
          <Spin />
        </div>
      ) : (
        <Table
          className="app-table overdue-checklist-table"
          columns={columns}
          dataSource={rows}
          pagination={tablePagination}
          rowKey="id"
          size="middle"
        />
      )}
    </Card>
  );
}
