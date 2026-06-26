"use client";

import { EyeOutlined } from "@ant-design/icons";
import {
  Alert,
  Button,
  Card,
  Empty,
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
import { getCurrentProfile } from "@/lib/auth-client";
import { formatDisplayDate } from "@/lib/date-format";
import {
  checklistCompletionSelect,
  checklistItemSelect,
  checklistSelect,
  getChecklistProgress,
  tablePagination,
} from "@/lib/report-helpers";
import { supabase } from "@/lib/supabase";
import type {
  Checklist,
  ChecklistItem,
  ChecklistItemCompletion,
  WhitelistUser,
} from "@/lib/types";

const { Text, Title } = Typography;

type ChecklistRow = Checklist & {
  completions: ChecklistItemCompletion[];
  items: ChecklistItem[];
};

export default function MyChecklistsPage() {
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

    const { data: assignmentData, error: assignmentError } = await supabase
      .from("checklist_assignments")
      .select("checklist_id")
      .eq("member_email", profileResult.profile.email);
    if (assignmentError) {
      setError(
        `Cannot load checklists. Run report-tool/supabase/phase3.sql in Supabase if tables/policies are missing. ${assignmentError.message}`,
      );
      setLoading(false);
      return;
    }

    const ids = (assignmentData ?? []).map(
      (assignment) => assignment.checklist_id as string,
    );
    if (!ids.length) {
      setChecklists([]);
      setLoading(false);
      return;
    }

    const [{ data: checklistData }, { data: itemData }] = await Promise.all([
      supabase
        .from("checklists")
        .select(checklistSelect)
        .in("id", ids)
        .order("created_at", { ascending: false }),
      supabase
        .from("checklist_items")
        .select(checklistItemSelect)
        .in("checklist_id", ids)
        .order("sort_order", { ascending: true }),
    ]);
    const nextChecklists = (checklistData ?? []) as Checklist[];
    const items = (itemData ?? []) as ChecklistItem[];
    const itemIds = items.map((item) => item.id);
    let completions: ChecklistItemCompletion[] = [];
    if (itemIds.length) {
      const { data: completionData } = await supabase
        .from("checklist_item_completions")
        .select(checklistCompletionSelect)
        .eq("member_email", profileResult.profile.email)
        .in("checklist_item_id", itemIds);
      completions = (completionData ?? []) as ChecklistItemCompletion[];
    }

    setChecklists(
      nextChecklists.map((checklist) => ({
        ...checklist,
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
        title: "Progress",
        key: "progress",
        width: 220,
        render: (_, record) => (
          <Progress
            percent={getChecklistProgress(record.items, record.completions)}
          />
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
            getChecklistProgress(record.items, record.completions) < 100;
          return (
            <Space size={4}>
              <Text className={overdue ? "text-red-600" : ""}>{formatDisplayDate(due_date)}</Text>
              {overdue ? <Tag color="error">Overdue</Tag> : null}
            </Space>
          );
        },
      },
      {
        title: "",
        key: "action",
        width: 100,
        render: (_, record) => (
          <Link href={`/my/checklists/${record.id}`}>
            <Button
              aria-label="Checklist detail"
              className="icon-only-action-button"
              icon={<EyeOutlined />}
              type="text"
            />
          </Link>
        ),
      },
    ],
    [],
  );

  return (
    <AppShell currentUser={currentUser}>
      {loading ? (
        <div className="flex min-h-[420px] items-center justify-center">
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
                  My checklists
                </Title>
              </Space>
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
