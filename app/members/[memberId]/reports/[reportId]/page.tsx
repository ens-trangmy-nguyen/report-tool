"use client";

import { EditOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Form, Space, Spin, Typography } from "antd";
import dayjs from "dayjs";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { ReportComments } from "@/components/ReportComments";
import { ReportDetailCard } from "@/components/ReportDetailCard";
import { ReportForm, type ReportFormValues } from "@/components/ReportForm";
import { canViewTeam, getCurrentProfile } from "@/lib/auth-client";
import { fetchReport, updateReportLog } from "@/lib/report-api";
import {
  canManageReport,
  encodeMemberId,
  memberSelect,
} from "@/lib/report-helpers";
import { supabase } from "@/lib/supabase";
import type { ReportLog, WhitelistUser } from "@/lib/types";

const { Title } = Typography;

export default function MemberReportDetailPage() {
  const params = useParams<{ memberId: string; reportId: string }>();
  const memberEmail = decodeURIComponent(params.memberId);
  const reportId = params.reportId;
  const [form] = Form.useForm<ReportFormValues>();
  const [currentUser, setCurrentUser] = useState<WhitelistUser | null>(null);
  const [member, setMember] = useState<WhitelistUser | null>(null);
  const [report, setReport] = useState<ReportLog | null>(null);
  const [editing, setEditing] = useState(false);
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

    if (!canViewTeam(profileResult.profile.role)) {
      setError("Only Leader/Admin can view member report detail.");
      setLoading(false);
      return;
    }

    const [{ data: memberData }, reportData] =
      await Promise.all([
        supabase
          .from("whitelist_users")
          .select(memberSelect)
          .eq("email", memberEmail)
          .maybeSingle(),
        fetchReport(reportId, { memberEmail }),
      ]);

    setMember((memberData ?? null) as WhitelistUser | null);
    setReport(reportData);

    setLoading(false);
  }, [memberEmail, reportId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  useEffect(() => {
    if (!editing || !report) return;
    form.setFieldsValue({
      blocker: report.blocker ?? undefined,
      content: report.content,
      date: dayjs(report.date),
      evidence_link: report.evidence_link ?? undefined,
      follow_up: report.follow_up ?? undefined,
      output: report.output ?? undefined,
    });
  }, [editing, form, report]);

  async function updateReport(values: ReportFormValues) {
    if (
      !report ||
      !canManageReport(currentUser?.role, report.created_by, currentUser?.email)
    ) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await updateReportLog(report.id, {
        blocker: values.blocker || null,
        content: values.content,
        date: values.date.format("YYYY-MM-DD"),
        evidence_link: values.evidence_link || null,
        follow_up: values.follow_up || null,
        output: values.output || null,
      });
    } catch (updateError) {
      setSaving(false);
      setError(updateError instanceof Error ? updateError.message : "Cannot update report.");
      return;
    }

    setSaving(false);
    setEditing(false);
    await loadData();
  }

  const canEdit = canManageReport(
    currentUser?.role,
    report?.created_by,
    currentUser?.email,
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
          {!report ? (
            <Alert type="error" showIcon title="Report not found" />
          ) : editing ? (
            <Card
              className="page-card"
              title={<Title level={4}>Edit report/log</Title>}
              extra={
                <Button onClick={() => setEditing(false)} disabled={saving}>
                  Cancel
                </Button>
              }
            >
              <ReportForm
                form={form}
                initialReport={report}
                onFinish={updateReport}
              >
                <Button type="primary" htmlType="submit" loading={saving}>
                  Save changes
                </Button>
              </ReportForm>
            </Card>
          ) : (
            <>
              <ReportDetailCard
                backHref={`/members/${encodeMemberId(memberEmail)}/reports`}
                member={member}
                report={report}
                extra={
                  canEdit ? (
                    <Button
                      icon={<EditOutlined />}
                      onClick={() => setEditing(true)}
                    />
                  ) : null
                }
              />
              {currentUser ? (
                <ReportComments
                  currentUser={currentUser}
                  report={report}
                  reportId={report.id}
                />
              ) : null}
            </>
          )}
        </Space>
      )}
    </AppShell>
  );
}
