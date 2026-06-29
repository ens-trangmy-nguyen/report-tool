"use client";

import { DeleteOutlined, EyeOutlined, PlusOutlined } from "@ant-design/icons";
import {
  Alert,
  Button,
  Card,
  Empty,
  Popconfirm,
  Progress,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { canViewTeam, getCurrentProfile } from "@/lib/auth-client";
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

const { Text, Title } = Typography;

type ChecklistRow = Checklist & {
  assignments: ChecklistAssignment[];
  completions: ChecklistItemCompletion[];
  items: ChecklistItem[];
};

export default function ChecklistsPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<WhitelistUser | null>(null);
  const [checklists, setChecklists] = useState<ChecklistRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    await Promise.resolve();
    setLoading(true);
    setError(null);

    const profileResult = await getCurrentProfile();
    setCurrentUser(profileResult.profile);

    if (!profileResult.session?.user.email) {
      router.replace("/");
      return;
    }

    if (profileResult.error || !profileResult.profile) {
      setError(profileResult.error || "Cannot load current user.");
      setLoading(false);
      return;
    }

    if (!canViewTeam(profileResult.profile.role)) {
      setError("Only Leader/Admin can view checklist management.");
      setLoading(false);
      return;
    }

    const { data: checklistData, error: checklistError } = await supabase
      .from("checklists")
      .select(checklistSelect)
      .order("created_at", { ascending: false });

    if (checklistError) {
      setError(
        `Cannot load checklists. Run report-tool/supabase/phase3.sql in Supabase if tables/policies are missing. ${checklistError.message}`,
      );
      setChecklists([]);
      setLoading(false);
      return;
    }

    const nextChecklists = (checklistData ?? []) as Checklist[];
    const ids = nextChecklists.map((checklist) => checklist.id);
    let assignments: ChecklistAssignment[] = [];
    let items: ChecklistItem[] = [];
    let completions: ChecklistItemCompletion[] = [];

    if (ids.length) {
      const [{ data: assignmentData }, { data: itemData }] = await Promise.all([
        supabase
          .from("checklist_assignments")
          .select(checklistAssignmentSelect)
          .in("checklist_id", ids),
        supabase
          .from("checklist_items")
          .select(checklistItemSelect)
          .in("checklist_id", ids),
      ]);
      assignments = (assignmentData ?? []) as ChecklistAssignment[];
      items = (itemData ?? []) as ChecklistItem[];

      const itemIds = items.map((item) => item.id);
      if (itemIds.length) {
        const { data: completionData } = await supabase
          .from("checklist_item_completions")
          .select(checklistCompletionSelect)
          .in("checklist_item_id", itemIds);
        completions = (completionData ?? []) as ChecklistItemCompletion[];
      }
    }

    setChecklists(
      nextChecklists.map((checklist) => ({
        ...checklist,
        assignments: assignments.filter(
          (assignment) => assignment.checklist_id === checklist.id,
        ),
        completions: completions.filter((completion) =>
          items.some(
            (item) =>
              item.checklist_id === checklist.id &&
              item.id === completion.checklist_item_id,
          ),
        ),
        items: items.filter((item) => item.checklist_id === checklist.id),
      })),
    );
    setLoading(false);
  }, [router]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  const deleteChecklist = useCallback(async (checklistId: string) => {
    const previousChecklists = checklists;
    setError(null);
    setChecklists((currentChecklists) =>
      currentChecklists.filter((checklist) => checklist.id !== checklistId),
    );

    const { error: deleteError } = await supabase
      .from("checklists")
      .delete()
      .eq("id", checklistId);

    if (deleteError) {
      setChecklists(previousChecklists);
      setError(deleteError.message);
    }
  }, [checklists]);

  const canDeleteChecklist = useCallback((checklist: ChecklistRow) => {
    return currentUser?.role === "Leader" && checklist.created_by === currentUser.email;
  }, [currentUser]);

  const columns: ColumnsType<ChecklistRow> = useMemo(
    () => [
      {
        title: "Checklist",
        dataIndex: "title",
        key: "title",
        render: (title: string, record) => (
          <Space orientation="vertical" size={2}>
            <Text strong>{title}</Text>
            {record.description ? (
              <Text className="text-sm text-slate-500">
                {record.description}
              </Text>
            ) : null}
          </Space>
        ),
      },
      {
        title: "Scope",
        dataIndex: "scope",
        key: "scope",
        width: 120,
        render: (scope: string) => (
          <Tag color={scope === "Team" ? "blue" : "purple"}>{scope}</Tag>
        ),
      },
      {
        title: "Due date",
        dataIndex: "due_date",
        key: "due_date",
        width: 150,
        render: (due_date: string | null, record) => {
          if (!due_date) return <Text className="text-slate-400">—</Text>;
          const overdue =
            dayjs(due_date).isBefore(dayjs(), "day") &&
            record.assignments.some((a) => {
              const mc = record.completions.filter((c) => c.member_email === a.member_email);
              return getChecklistProgress(record.items, mc) < 100;
            });
          return (
            <Space size={4}>
              <Text className={overdue ? "text-red-600" : ""}>{formatDisplayDate(due_date)}</Text>
              {overdue ? <Tag color="error">Overdue</Tag> : null}
            </Space>
          );
        },
      },
      {
        title: "Assigned",
        key: "assigned",
        width: 120,
        render: (_, record) => record.assignments.length,
      },
      {
        title: "Average progress",
        key: "progress",
        width: 220,
        render: (_, record) => {
          const total = record.assignments.length;
          const average = total
            ? Math.round(
                record.assignments.reduce((sum, assignment) => {
                  const memberCompletions = record.completions.filter(
                    (completion) =>
                      completion.member_email === assignment.member_email,
                  );
                  return (
                    sum + getChecklistProgress(record.items, memberCompletions)
                  );
                }, 0) / total,
              )
            : 0;
          return <Progress percent={average} />;
        },
      },
      {
        title: "",
        key: "action",
        width: 120,
        render: (_, record) => (
          <Space size="small">
            <Link href={`/checklists/${record.id}`}>
              <Button
                aria-label="Checklist detail"
                className="icon-only-action-button"
                icon={<EyeOutlined />}
                type="text"
              />
            </Link>
            {canDeleteChecklist(record) ? (
              <Popconfirm
                title="Delete this checklist?"
                description="This will also delete its items, assignments, and completions."
                okText="Delete"
                okButtonProps={{ danger: true }}
                placement="top"
                onConfirm={() => deleteChecklist(record.id)}
              >
                <Button
                  aria-label="Delete checklist"
                  className="icon-only-action-button"
                  danger
                  icon={<DeleteOutlined />}
                  type="text"
                />
              </Popconfirm>
            ) : null}
          </Space>
        ),
      },
    ],
    [canDeleteChecklist, deleteChecklist],
  );

  return (
    <AppShell currentUser={currentUser}>
      {loading ? (
        <div className="flex min-h-105 items-center justify-center">
          <Spin size="large" />
        </div>
      ) : (
        <Space orientation="vertical" size="large" className="w-full">
          {error ? <Alert type="warning" title={error} showIcon /> : null}
          <Card
            className="page-card"
            title={
              <Space orientation="vertical" size={2}>
                <Title level={3} className="mb-0 text-slate-950">
                  Checklists
                </Title>
              </Space>
            }
            extra={
              currentUser?.role === "Leader" ? (
                <Link href="/checklists/new">
                  <Button icon={<PlusOutlined />} type="primary">
                    New checklist
                  </Button>
                </Link>
              ) : null
            }
          >
            {checklists.length ? (
              <Table
                className="app-table"
                columns={columns}
                dataSource={checklists}
                pagination={tablePagination}
                rowKey="id"
              />
            ) : (
              <div className="muted-panel">
                <Empty description="No checklist found" />
              </div>
            )}
          </Card>
        </Space>
      )}
    </AppShell>
  );
}
