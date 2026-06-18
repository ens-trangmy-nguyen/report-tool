"use client";

import { Alert, Card, Checkbox, Progress, Space, Spin, Typography } from "antd";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { AppBackButton } from "@/components/AppBackButton";
import { getCurrentProfile } from "@/lib/auth-client";
import {
  checklistCompletionSelect,
  checklistItemSelect,
  checklistSelect,
  getChecklistProgress,
} from "@/lib/report-helpers";
import { supabase } from "@/lib/supabase";
import type {
  Checklist,
  ChecklistItem,
  ChecklistItemCompletion,
  WhitelistUser,
} from "@/lib/types";

const { Text, Title } = Typography;

export default function MyChecklistDetailPage() {
  const params = useParams<{ checklistId: string }>();
  const checklistId = params.checklistId;
  const [currentUser, setCurrentUser] = useState<WhitelistUser | null>(null);
  const [checklist, setChecklist] = useState<Checklist | null>(null);
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [completions, setCompletions] = useState<ChecklistItemCompletion[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    await Promise.resolve();
    setLoading(true);
    setError(null);

    const profileResult = await getCurrentProfile();
    setCurrentUser(profileResult.profile);
    if (profileResult.error || !profileResult.profile) {
      setError(profileResult.error || "Cannot load current user.");
      setLoading(false);
      return;
    }

    const { data: assignment } = await supabase
      .from("checklist_assignments")
      .select("id")
      .eq("checklist_id", checklistId)
      .eq("member_email", profileResult.profile.email)
      .maybeSingle();
    if (!assignment) {
      setChecklist(null);
      setItems([]);
      setCompletions([]);
      setLoading(false);
      return;
    }

    const [{ data: checklistData }, { data: itemData }] = await Promise.all([
      supabase
        .from("checklists")
        .select(checklistSelect)
        .eq("id", checklistId)
        .maybeSingle(),
      supabase
        .from("checklist_items")
        .select(checklistItemSelect)
        .eq("checklist_id", checklistId)
        .order("sort_order", { ascending: true }),
    ]);
    const nextItems = (itemData ?? []) as ChecklistItem[];
    let nextCompletions: ChecklistItemCompletion[] = [];
    if (nextItems.length) {
      const { data: completionData } = await supabase
        .from("checklist_item_completions")
        .select(checklistCompletionSelect)
        .eq("member_email", profileResult.profile.email)
        .in(
          "checklist_item_id",
          nextItems.map((item) => item.id),
        );
      nextCompletions = (completionData ?? []) as ChecklistItemCompletion[];
    }

    setChecklist((checklistData ?? null) as Checklist | null);
    setItems(nextItems);
    setCompletions(nextCompletions);
    setLoading(false);
  }, [checklistId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  const progress = useMemo(
    () => getChecklistProgress(items, completions),
    [items, completions],
  );
  const completedIds = useMemo(
    () =>
      new Set(completions.map((completion) => completion.checklist_item_id)),
    [completions],
  );

  async function toggleItem(item: ChecklistItem) {
    if (!currentUser) return;
    setSavingId(item.id);
    setError(null);

    if (completedIds.has(item.id)) {
      const { error: deleteError } = await supabase
        .from("checklist_item_completions")
        .delete()
        .eq("checklist_item_id", item.id)
        .eq("member_email", currentUser.email);
      if (deleteError) {
        setError(deleteError.message);
      } else {
        setCompletions((current) =>
          current.filter(
            (completion) => completion.checklist_item_id !== item.id,
          ),
        );
      }
    } else {
      const { data, error: insertError } = await supabase
        .from("checklist_item_completions")
        .insert({
          checklist_item_id: item.id,
          member_email: currentUser.email,
        })
        .select(checklistCompletionSelect)
        .single();
      if (insertError) {
        setError(insertError.message);
      } else if (data) {
        setCompletions((current) => [
          ...current,
          data as ChecklistItemCompletion,
        ]);
      }
    }

    setSavingId(null);
  }

  return (
    <AppShell currentUser={currentUser}>
      {loading ? (
        <div className="flex min-h-105 items-center justify-center">
          <Spin size="large" />
        </div>
      ) : (
        <Space orientation="vertical" size="large" className="w-full">
          {error ? <Alert type="warning" title={error} showIcon /> : null}
          {!checklist ? (
            <Alert type="error" showIcon title="Checklist not found" />
          ) : (
            <Card
              className="page-card"
              title={
                <Space align="center" size="middle">
                  <AppBackButton fallbackHref="/my/checklists" />
                  <Space orientation="vertical" size={2}>
                    <Title level={3} className="mb-0 text-slate-950">
                      {checklist.title}
                    </Title>
                    <Text className="text-sm text-slate-500">
                      {checklist.scope} checklist
                    </Text>
                  </Space>
                </Space>
              }
            >
              <Space orientation="vertical" size="large" className="w-full">
                {checklist.description ? (
                  <Text>{checklist.description}</Text>
                ) : null}
                <Progress percent={progress} />
                <div className="checklist-detail-items">
                  {items.map((item) => (
                    <div className="checklist-detail-item" key={item.id}>
                      <Checkbox
                        checked={completedIds.has(item.id)}
                        disabled={savingId === item.id}
                        onChange={() => void toggleItem(item)}
                      >
                        {item.title}
                      </Checkbox>
                    </div>
                  ))}
                </div>
              </Space>
            </Card>
          )}
        </Space>
      )}
    </AppShell>
  );
}
