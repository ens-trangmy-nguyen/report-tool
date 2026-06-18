"use client";

import { Alert, Card, Form, Space, Spin, Typography } from "antd";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ChecklistForm, type ChecklistFormValues } from "@/components/ChecklistForm";
import { AppShell } from "@/components/AppShell";
import { AppBackButton } from "@/components/AppBackButton";
import { canViewTeam, getCurrentProfile } from "@/lib/auth-client";
import { memberSelect } from "@/lib/report-helpers";
import { supabase } from "@/lib/supabase";
import type { WhitelistUser } from "@/lib/types";

const { Title } = Typography;

export default function NewChecklistPage() {
  const router = useRouter();
  const [form] = Form.useForm<ChecklistFormValues>();
  const [currentUser, setCurrentUser] = useState<WhitelistUser | null>(null);
  const [members, setMembers] = useState<WhitelistUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
    if (profileResult.profile.role !== "Leader" || !canViewTeam(profileResult.profile.role)) {
      setError("Only Leader can create checklists.");
      setLoading(false);
      return;
    }

    const { data, error: membersError } = await supabase
      .from("whitelist_users")
      .select(memberSelect)
      .eq("role", "Member")
      .eq("status", "Active")
      .order("name", { ascending: true });
    if (membersError) setError(membersError.message);
    setMembers((data ?? []) as WhitelistUser[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  async function createChecklist(values: ChecklistFormValues) {
    if (!currentUser || currentUser.role !== "Leader") return;
    const assignees =
      values.scope === "Team"
        ? members.map((member) => member.email)
        : values.assignees ?? [];

    if (!assignees.length) {
      setError("Select at least one assigned member.");
      return;
    }

    setSaving(true);
    setError(null);

    const { data: checklist, error: checklistError } = await supabase
      .from("checklists")
      .insert({
        created_by: currentUser.email,
        description: values.description || null,
        due_date: values.due_date.format("YYYY-MM-DD"),
        scope: values.scope,
        title: values.title,
      })
      .select("id")
      .single();

    if (checklistError || !checklist) {
      setSaving(false);
      setError(checklistError?.message || "Cannot create checklist.");
      return;
    }

    const [{ error: itemsError }, { error: assignmentsError }] = await Promise.all([
      supabase.from("checklist_items").insert(
        values.items.map((item, index) => ({
          checklist_id: checklist.id,
          sort_order: index,
          title: item.title,
        })),
      ),
      supabase.from("checklist_assignments").insert(
        assignees.map((email) => ({
          checklist_id: checklist.id,
          member_email: email,
        })),
      ),
    ]);

    if (itemsError || assignmentsError) {
      setSaving(false);
      setError(itemsError?.message || assignmentsError?.message || "Cannot create checklist details.");
      return;
    }

    const { error: notificationError } = await supabase.from("notifications").insert(
      assignees.map((email) => ({
        actor_email: currentUser.email,
        body: values.title,
        link_url: `/my/checklists/${checklist.id}`,
        recipient_email: email,
        title: "New checklist assigned",
        type: "checklist_assigned",
      })),
    );

    setSaving(false);

    if (notificationError) {
      setError(`Checklist created, but notification was not created. ${notificationError.message}`);
      return;
    }

    router.push(`/checklists/${checklist.id}`);
  }

  return (
    <AppShell currentUser={currentUser}>
      {loading ? (
        <div className="flex min-h-[420px] items-center justify-center"><Spin size="large" /></div>
      ) : (
        <Space orientation="vertical" size="large" className="w-full">
          {error ? <Alert type="warning" title={error} showIcon /> : null}
          <Card
            className="page-card"
            title={
              <Space align="center" size="middle">
                <AppBackButton fallbackHref="/checklists" />
                <Title level={4} className="mb-0">New checklist</Title>
              </Space>
            }
          >
            <ChecklistForm form={form} loading={saving} members={members} onFinish={createChecklist} submitText="Create checklist" />
          </Card>
        </Space>
      )}
    </AppShell>
  );
}
