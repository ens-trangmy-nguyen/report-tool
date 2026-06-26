"use client";

import { DeleteOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Checkbox, DatePicker, Form, Input, Modal, Popconfirm, Progress, Select, Space, Spin, Table, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import type { Dayjs } from "dayjs";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { AppBackButton } from "@/components/AppBackButton";
import { canViewTeam, getCurrentProfile } from "@/lib/auth-client";
import { checklistAssignmentSelect, checklistCompletionSelect, checklistItemSelect, checklistSelect, getChecklistProgress, memberSelect } from "@/lib/report-helpers";
import { supabase } from "@/lib/supabase";
import type { Checklist, ChecklistAssignment, ChecklistItem, ChecklistItemCompletion, WhitelistUser } from "@/lib/types";

const { Text, Title } = Typography;
const { TextArea } = Input;

export default function ChecklistDetailPage() {
  const router = useRouter();
  const params = useParams<{ checklistId: string }>();
  const checklistId = params.checklistId;
  const [form] = Form.useForm<{ description?: string; due_date: Dayjs; title: string }>();
  const [itemForm] = Form.useForm<{ title: string }>();
  const [editItemForm] = Form.useForm<{ title: string }>();
  const [assignmentForm] = Form.useForm<{ members: string[] }>();
  const [currentUser, setCurrentUser] = useState<WhitelistUser | null>(null);
  const [checklist, setChecklist] = useState<Checklist | null>(null);
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [assignments, setAssignments] = useState<ChecklistAssignment[]>([]);
  const [completions, setCompletions] = useState<ChecklistItemCompletion[]>([]);
  const [members, setMembers] = useState<WhitelistUser[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ChecklistItem | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignmentSearch, setAssignmentSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);
  const [removingAssignmentId, setRemovingAssignmentId] = useState<string | null>(null);
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
      setError("Only Leader/Admin can view checklist detail.");
      setLoading(false);
      return;
    }

    const [
      { data: checklistData, error: checklistError },
      { data: itemData },
      { data: assignmentData },
      { data: memberData },
    ] = await Promise.all([
      supabase.from("checklists").select(checklistSelect).eq("id", checklistId).maybeSingle(),
      supabase.from("checklist_items").select(checklistItemSelect).eq("checklist_id", checklistId).order("sort_order", { ascending: true }),
      supabase.from("checklist_assignments").select(checklistAssignmentSelect).eq("checklist_id", checklistId),
      supabase.from("whitelist_users").select(memberSelect).eq("role", "Member").eq("status", "Active").order("name", { ascending: true }),
    ]);

    if (checklistError) setError(checklistError.message);
    const nextItems = (itemData ?? []) as ChecklistItem[];
    const itemIds = nextItems.map((item) => item.id);
    let nextCompletions: ChecklistItemCompletion[] = [];
    if (itemIds.length) {
      const { data: completionData } = await supabase
        .from("checklist_item_completions")
        .select(checklistCompletionSelect)
        .in("checklist_item_id", itemIds);
      nextCompletions = (completionData ?? []) as ChecklistItemCompletion[];
    }

    const nextChecklist = (checklistData ?? null) as Checklist | null;
    setChecklist(nextChecklist);
    setItems(nextItems);
    setAssignments((assignmentData ?? []) as ChecklistAssignment[]);
    setCompletions(nextCompletions);
    setMembers((memberData ?? []) as WhitelistUser[]);
    if (nextChecklist) {
      form.setFieldsValue({
        description: nextChecklist.description ?? undefined,
        due_date: nextChecklist.due_date ? dayjs(nextChecklist.due_date) : undefined,
        title: nextChecklist.title,
      });
    }
    setLoading(false);
  }, [checklistId, form, router]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  const canEdit = currentUser?.role === "Leader" && checklist?.created_by === currentUser.email;
  const assignedEmails = useMemo(() => new Set(assignments.map((assignment) => assignment.member_email)), [assignments]);
  const visibleAssignments = useMemo(() => {
    const keyword = assignmentSearch.trim().toLowerCase();
    if (!keyword) return assignments;

    return assignments.filter((assignment) => {
      const member = members.find((item) => item.email === assignment.member_email);
      const name = member?.name?.toLowerCase() ?? "";
      const email = assignment.member_email.toLowerCase();
      return name.includes(keyword) || email.includes(keyword);
    });
  }, [assignmentSearch, assignments, members]);

  async function updateChecklist(values: { description?: string; due_date: Dayjs; title: string }) {
    if (!checklist || !canEdit) return;
    setSaving(true);
    setError(null);
    const { data: updatedChecklist, error: updateError } = await supabase
      .from("checklists")
      .update({ description: values.description || null, due_date: values.due_date.format("YYYY-MM-DD"), title: values.title, updated_at: new Date().toISOString() })
      .eq("id", checklist.id)
      .select(checklistSelect)
      .single();
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setChecklist(updatedChecklist as Checklist);
    setEditOpen(false);
  }

  async function addItem(values: { title: string }) {
    if (!canEdit) return;
    setSaving(true);
    setError(null);
    const { data: insertedItem, error: insertError } = await supabase
      .from("checklist_items")
      .insert({
        checklist_id: checklistId,
        sort_order: items.length,
        title: values.title,
      })
      .select(checklistItemSelect)
      .single();
    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setItems((currentItems) => [...currentItems, insertedItem as ChecklistItem]);
    itemForm.resetFields();
    setAddItemOpen(false);
  }

  async function updateItem(values: { title: string }) {
    if (!canEdit || !editingItem) return;
    setSaving(true);
    setError(null);
    const { data: updatedItem, error: updateError } = await supabase
      .from("checklist_items")
      .update({ title: values.title, updated_at: new Date().toISOString() })
      .eq("id", editingItem.id)
      .select(checklistItemSelect)
      .single();
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setItems((currentItems) =>
      currentItems.map((item) =>
        item.id === editingItem.id ? (updatedItem as ChecklistItem) : item,
      ),
    );
    editItemForm.resetFields();
    setEditingItem(null);
  }

  async function deleteItem(itemId: string) {
    if (!canEdit) return;
    setDeletingItemId(itemId);
    setError(null);
    const { error: deleteError } = await supabase.from("checklist_items").delete().eq("id", itemId);
    setDeletingItemId(null);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    setItems((currentItems) => currentItems.filter((item) => item.id !== itemId));
    setCompletions((currentCompletions) =>
      currentCompletions.filter((completion) => completion.checklist_item_id !== itemId),
    );
  }

  async function addAssignments(values: { members: string[] }) {
    if (!canEdit || !values.members?.length) return;
    setSaving(true);
    setError(null);
    const nextAssignments = values.members
      .filter((email) => !assignedEmails.has(email))
      .map((email) => ({ checklist_id: checklistId, member_email: email }));

    const { data: insertedAssignments, error: insertError } = await supabase
      .from("checklist_assignments")
      .insert(nextAssignments)
      .select(checklistAssignmentSelect);
    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setAssignments((currentAssignments) => [
      ...currentAssignments,
      ...((insertedAssignments ?? []) as ChecklistAssignment[]),
    ]);
    if (checklist && currentUser && insertedAssignments?.length) {
      const { error: notificationError } = await supabase.from("notifications").insert(
        (insertedAssignments as ChecklistAssignment[]).map((assignment) => ({
          actor_email: currentUser.email,
          body: checklist.title,
          link_url: `/my/checklists/${checklist.id}`,
          recipient_email: assignment.member_email,
          title: "New checklist assigned",
          type: "checklist_assigned",
        })),
      );
      if (notificationError) {
        setError(`Checklist assigned, but notification was not created. ${notificationError.message}`);
      } else {
        window.dispatchEvent(new Event("report-tool:notifications-changed"));
      }
    }
    assignmentForm.resetFields();
    setAssignOpen(false);
  }

  async function removeAssignment(assignmentId: string) {
    if (!canEdit) return;
    setRemovingAssignmentId(assignmentId);
    setError(null);
    const { error: deleteError } = await supabase.from("checklist_assignments").delete().eq("id", assignmentId);
    setRemovingAssignmentId(null);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    setAssignments((currentAssignments) =>
      currentAssignments.filter((assignment) => assignment.id !== assignmentId),
    );
  }

  const progressColumns: ColumnsType<ChecklistAssignment> = [
    {
      title: "Member",
      dataIndex: "member_email",
      key: "member",
      render: (email: string) => {
        const member = members.find((item) => item.email === email);
        return (
          <div>
            <Text strong>{member?.name || email}</Text>
            <br />
            <Text className="text-sm text-slate-500">{email}</Text>
          </div>
        );
      },
    },
    {
      title: "Progress",
      key: "progress",
      width: 240,
      render: (_, assignment) => (
        <Progress
          percent={getChecklistProgress(
            items,
            completions.filter((completion) => completion.member_email === assignment.member_email),
          )}
        />
      ),
    },
    {
      title: "",
      key: "action",
      width: 80,
      render: (_, assignment) =>
        canEdit ? (
          <Popconfirm
            title="Remove this member from checklist?"
            description="This member will no longer see this checklist."
            okText="Remove"
            okButtonProps={{ danger: true }}
            placement="top"
            onConfirm={() => removeAssignment(assignment.id)}
          >
            <Button
              danger
              icon={<DeleteOutlined />}
              loading={removingAssignmentId === assignment.id}
            />
          </Popconfirm>
        ) : null,
    },
  ];

  return (
    <AppShell currentUser={currentUser}>
      {loading ? (
        <div className="flex min-h-[420px] items-center justify-center"><Spin size="large" /></div>
      ) : (
        <Space orientation="vertical" size="large" className="w-full">
          {error ? <Alert type="warning" title={error} showIcon /> : null}
          {!checklist ? (
            <Alert type="error" showIcon title="Checklist not found" />
          ) : (
            <Card
              className="page-card checklist-detail-card"
              title={<Space align="center" size="middle"><AppBackButton fallbackHref="/checklists" /><Space orientation="vertical" size={2}><Title level={3} className="mb-0 text-slate-950">{checklist.title}</Title><Text className="text-sm text-slate-500">{checklist.scope} checklist</Text></Space></Space>}
              extra={canEdit ? <Space><Button aria-label="Edit checklist" icon={<EditOutlined />} onClick={() => setEditOpen(true)} /><Button icon={<PlusOutlined />} onClick={() => setAddItemOpen(true)}>Add item</Button><Button type="primary" onClick={() => setAssignOpen(true)}>Assign members</Button></Space> : null}
            >
              <Space orientation="vertical" size="large" className="w-full">
                {checklist.description ? <Text>{checklist.description}</Text> : null}
                <div className="checklist-detail-items">
                  <div className="checklist-detail-items-header">
                    <Text strong>Checklist items</Text>
                  </div>
                  {items.map((item) => (
                    <div className="checklist-detail-item" key={item.id}>
                      <Checkbox checked={false} disabled>{item.title}</Checkbox>
                      {canEdit ? (
                        <Space size="small">
                          <Button
                            aria-label="Edit checklist item"
                            icon={<EditOutlined />}
                            onClick={() => {
                              editItemForm.setFieldsValue({ title: item.title });
                              setEditingItem(item);
                            }}
                          />
                          <Popconfirm
                            title="Delete this checklist item?"
                            description="This action cannot be undone."
                            okText="Delete"
                            okButtonProps={{ danger: true }}
                            placement="top"
                            onConfirm={() => deleteItem(item.id)}
                          >
                            <Button
                              danger
                              icon={<DeleteOutlined />}
                              loading={deletingItemId === item.id}
                            />
                          </Popconfirm>
                        </Space>
                      ) : null}
                    </div>
                  ))}
                </div>
                <Input.Search
                  allowClear
                  className="max-w-sm"
                  placeholder="Search assigned members"
                  value={assignmentSearch}
                  onChange={(event) => setAssignmentSearch(event.target.value)}
                />
                <Table className="app-table" columns={progressColumns} dataSource={visibleAssignments} pagination={false} rowKey="id" />
              </Space>
            </Card>
          )}
        </Space>
      )}

      <Modal title="Edit checklist" open={editOpen} okText="Save" confirmLoading={saving} onCancel={() => setEditOpen(false)} onOk={() => form.submit()} forceRender destroyOnHidden>
        <Form form={form} layout="vertical" onFinish={updateChecklist}>
          <Form.Item label="Title" name="title" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item label="Description" name="description"><TextArea rows={3} /></Form.Item>
          <Form.Item
            label="Due date"
            name="due_date"
            rules={[
              { required: true, message: "Select due date" },
              {
                validator(_, value) {
                  if (value && value.isBefore(dayjs(), "day")) {
                    return Promise.reject(new Error("Due date must be today or a future date."));
                  }
                  return Promise.resolve();
                },
              },
            ]}
          >
            <DatePicker className="w-full" disabledDate={(d) => d.isBefore(dayjs(), "day")} format="DD-MM-YYYY" />
          </Form.Item>
        </Form>
      </Modal>
      <Modal title="Add checklist item" open={addItemOpen} okText="Add" confirmLoading={saving} onCancel={() => setAddItemOpen(false)} onOk={() => itemForm.submit()} forceRender destroyOnHidden>
        <Form form={itemForm} layout="vertical" onFinish={addItem}>
          <Form.Item label="Item title" name="title" rules={[{ required: true }]}><Input placeholder="Checklist item" /></Form.Item>
        </Form>
      </Modal>
      <Modal title="Edit checklist item" open={Boolean(editingItem)} okText="Save" confirmLoading={saving} onCancel={() => setEditingItem(null)} onOk={() => editItemForm.submit()} forceRender destroyOnHidden>
        <Form form={editItemForm} layout="vertical" onFinish={updateItem}>
          <Form.Item label="Item title" name="title" rules={[{ required: true }]}><Input placeholder="Checklist item" /></Form.Item>
        </Form>
      </Modal>
      <Modal title="Assign members" open={assignOpen} okText="Assign" confirmLoading={saving} onCancel={() => setAssignOpen(false)} onOk={() => assignmentForm.submit()} forceRender destroyOnHidden>
        <Form form={assignmentForm} layout="vertical" onFinish={addAssignments}>
          <Form.Item label="Members" name="members" rules={[{ required: true }]}>
            <Select
              mode="multiple"
              options={members
                .filter((member) => !assignedEmails.has(member.email))
                .map((member) => ({ label: member.name || member.email, value: member.email }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </AppShell>
  );
}
