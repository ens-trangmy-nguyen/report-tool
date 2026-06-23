"use client";

import { DeleteOutlined, EditOutlined } from "@ant-design/icons";
import {
  Alert,
  Button,
  Card,
  Input,
  Modal,
  Space,
  Spin,
  Typography,
} from "antd";
import { useCallback, useEffect, useState } from "react";
import { formatDisplayDateTime } from "@/lib/date-format";
import { memberSelect, reportCommentSelect } from "@/lib/report-helpers";
import { supabase } from "@/lib/supabase";
import type { ReportComment, ReportLog, WhitelistUser } from "@/lib/types";

const { Text } = Typography;
const { TextArea } = Input;

type ReportCommentsProps = {
  currentUser: WhitelistUser;
  report: ReportLog;
  reportId: string;
};

export function ReportComments({ currentUser, report, reportId }: ReportCommentsProps) {
  const [comments, setComments] = useState<ReportComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [savingEditId, setSavingEditId] = useState<string | null>(null);

  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadComments = useCallback(async () => {
    setLoading(true);
    const { data, error: fetchError } = await supabase
      .from("report_comments")
      .select(reportCommentSelect)
      .eq("report_id", reportId)
      .order("created_at", { ascending: true });

    if (fetchError) {
      setError(fetchError.message);
      setLoading(false);
      return;
    }

    const nextComments = (data ?? []) as ReportComment[];
    const authorEmails = Array.from(
      new Set(nextComments.map((comment) => comment.author_email)),
    );

    if (authorEmails.length) {
      const { data: authorData } = await supabase
        .from("whitelist_users")
        .select(memberSelect)
        .in("email", authorEmails);
      const authorNameByEmail = new Map(
        (authorData ?? []).map((author) => [author.email, author.name]),
      );
      setComments(
        nextComments.map((comment) => ({
          ...comment,
          author_name:
            authorNameByEmail.get(comment.author_email) ||
            comment.author_name ||
            comment.author_email,
        })),
      );
    } else {
      setComments(nextComments);
    }

    setLoading(false);
  }, [reportId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadComments();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadComments]);

  async function handleSubmit() {
    const trimmed = content.trim();
    if (!trimmed) return;

    setSubmitting(true);
    setError(null);

    const { data: sessionData } = await supabase.auth.getSession();
    const metadata = sessionData?.session?.user?.user_metadata ?? {};
    const authorName =
      currentUser.name ||
      (metadata.full_name as string | undefined) ||
      (metadata.name as string | undefined) ||
      currentUser.email;

    const { error: insertError } = await supabase.from("report_comments").insert({
      author_email: currentUser.email,
      author_name: authorName,
      content: trimmed,
      report_id: reportId,
    });

    if (insertError) {
      setError(insertError.message);
      setSubmitting(false);
      return;
    }

    const recipientEmail =
      currentUser.email === report.member_email
        ? report.created_by
        : report.member_email;

    if (recipientEmail && recipientEmail !== currentUser.email) {
      const linkUrl =
        recipientEmail === report.member_email
          ? `/my/reports/${report.id}`
          : `/members/${encodeURIComponent(report.member_email)}/reports/${report.id}`;
      const { error: notificationError } = await supabase.from("notifications").insert({
        actor_email: currentUser.email,
        body: `${authorName}: ${trimmed.slice(0, 120)}`,
        link_url: linkUrl,
        recipient_email: recipientEmail,
        title: "New report comment",
        type: "report_comment",
      });

      if (!notificationError) {
        window.dispatchEvent(new Event("report-tool:notifications-changed"));
      }
    }

    setContent("");
    setSubmitting(false);
    await loadComments();
  }

  function startEdit(comment: ReportComment) {
    setEditingId(comment.id);
    setEditContent(comment.content);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditContent("");
  }

  async function saveEdit(commentId: string) {
    const trimmed = editContent.trim();
    if (!trimmed) return;

    setSavingEditId(commentId);
    const updatedAt = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("report_comments")
      .update({ content: trimmed, updated_at: updatedAt })
      .eq("id", commentId);
    setSavingEditId(null);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setEditingId(null);
    setEditContent("");
    setComments((current) =>
      current.map((comment) =>
        comment.id === commentId
          ? { ...comment, content: trimmed, updated_at: updatedAt }
          : comment,
      ),
    );
  }

  async function executeDelete() {
    if (!deleteTargetId) return;
    setDeleting(true);
    const { error: deleteError } = await supabase
      .from("report_comments")
      .delete()
      .eq("id", deleteTargetId);
    setDeleting(false);
    setDeleteTargetId(null);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setComments((current) =>
      current.filter((comment) => comment.id !== deleteTargetId),
    );
  }

  function canEditComment(comment: ReportComment) {
    return comment.author_email === currentUser.email;
  }

  function canDeleteComment(comment: ReportComment) {
    return comment.author_email === currentUser.email;
  }

  return (
    <Card className="page-card" title="Comments">
      {error ? (
        <Alert type="error" message={error} showIcon className="mb-4" />
      ) : null}

      {loading ? (
        <div className="flex justify-center py-6">
          <Spin />
        </div>
      ) : (
        <div className="comment-list">
          {comments.length ? (
            comments.map((comment) => {
              const isEditing = editingId === comment.id;
              const isSaving = savingEditId === comment.id;
              const isEdited =
                comment.updated_at && comment.updated_at !== comment.created_at;

              return (
                <div className="comment-item" key={comment.id}>
                  <div className="flex items-start justify-between gap-2">
                    <Space size="small" wrap>
                      <Text strong className="text-sm">
                        {comment.author_name ?? comment.author_email}
                      </Text>
                      <Text type="secondary" className="text-xs">
                        {formatDisplayDateTime(comment.created_at)}
                      </Text>
                      {isEdited ? (
                        <Text type="secondary" className="text-xs">
                          (edited)
                        </Text>
                      ) : null}
                    </Space>
                    {!isEditing ? (
                      <Space size={4}>
                        {canEditComment(comment) ? (
                          <Button
                            aria-label="Edit comment"
                            icon={<EditOutlined />}
                            size="small"
                            type="text"
                            onClick={() => startEdit(comment)}
                          />
                        ) : null}
                        {canDeleteComment(comment) ? (
                          <Button
                            aria-label="Delete comment"
                            danger
                            icon={<DeleteOutlined />}
                            size="small"
                            type="text"
                            onClick={() => setDeleteTargetId(comment.id)}
                          />
                        ) : null}
                      </Space>
                    ) : null}
                  </div>
                  {isEditing ? (
                    <Space orientation="vertical" size="small" className="mt-2 w-full">
                      <TextArea
                        autoFocus
                        rows={3}
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        disabled={isSaving}
                        maxLength={2000}
                      />
                      <Space size="small">
                        <Button
                          type="primary"
                          size="small"
                          loading={isSaving}
                          disabled={!editContent.trim()}
                          onClick={() => void saveEdit(comment.id)}
                        >
                          Save
                        </Button>
                        <Button size="small" disabled={isSaving} onClick={cancelEdit}>
                          Cancel
                        </Button>
                      </Space>
                    </Space>
                  ) : (
                    <Text className="mt-1 block whitespace-pre-wrap">
                      {comment.content}
                    </Text>
                  )}
                </div>
              );
            })
          ) : (
            <Text type="secondary">No comments yet.</Text>
          )}
        </div>
      )}

      <Space orientation="vertical" size="small" className="mt-4 w-full">
        <TextArea
          rows={3}
          placeholder="Add a comment…"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          disabled={submitting}
          maxLength={2000}
          showCount
        />
        <Button
          type="primary"
          onClick={handleSubmit}
          loading={submitting}
          disabled={!content.trim()}
        >
          Post comment
        </Button>
      </Space>

      <Modal
        title="Delete comment"
        open={!!deleteTargetId}
        okText="Delete"
        okButtonProps={{ danger: true, loading: deleting }}
        cancelButtonProps={{ disabled: deleting }}
        onOk={() => void executeDelete()}
        onCancel={() => {
          if (!deleting) setDeleteTargetId(null);
        }}
      >
        <Text>Are you sure you want to delete this comment? This cannot be undone.</Text>
      </Modal>
    </Card>
  );
}
