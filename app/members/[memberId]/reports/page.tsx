"use client";

import {
  DeleteOutlined,
  EyeOutlined,
  FileAddOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Button,
  Card,
  DatePicker,
  Empty,
  Form,
  Modal,
  Popconfirm,
  Space,
  Spin,
  Table,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs, { type Dayjs } from "dayjs";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { AppBackButton } from "@/components/AppBackButton";
import { ReportForm, type ReportFormValues } from "@/components/ReportForm";
import { getCurrentProfile, canViewTeam } from "@/lib/auth-client";
import { formatDisplayDate, formatDisplayDateTime } from "@/lib/date-format";
import {
  canManageReport,
  encodeMemberId,
  memberSelect,
  reportSelect,
  tablePagination,
} from "@/lib/report-helpers";
import { supabase } from "@/lib/supabase";
import type { ReportLog, WhitelistUser } from "@/lib/types";

const { Text, Title } = Typography;

export default function MemberReportsPage() {
  const params = useParams<{ memberId: string }>();
  const memberEmail = decodeURIComponent(params.memberId);
  const [currentUser, setCurrentUser] = useState<WhitelistUser | null>(null);
  const [member, setMember] = useState<WhitelistUser | null>(null);
  const [reports, setReports] = useState<ReportLog[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<Dayjs | null>(null);
  const [createReportOpen, setCreateReportOpen] = useState(false);
  const [createReportLoading, setCreateReportLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form] = Form.useForm<ReportFormValues>();

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
      setError("Only Leader/Admin can view member report history.");
      setLoading(false);
      return;
    }

    const [{ data: memberData, error: memberError }, { data: reportData, error: reportError }] =
      await Promise.all([
        supabase.from("whitelist_users").select(memberSelect).eq("email", memberEmail).maybeSingle(),
        supabase
          .from("report_logs")
          .select(reportSelect)
          .eq("member_email", memberEmail)
          .order("date", { ascending: false })
          .order("created_at", { ascending: false }),
      ]);

    if (memberError) setError(memberError.message);
    if (reportError) setError(reportError.message);

    setMember((memberData ?? null) as WhitelistUser | null);
    setReports((reportData ?? []) as ReportLog[]);
    setLoading(false);
  }, [memberEmail]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  const visibleReports = useMemo(() => {
    const month = selectedMonth?.format("YYYY-MM");
    return month ? reports.filter((report) => report.date.startsWith(month)) : reports;
  }, [reports, selectedMonth]);

  const columns: ColumnsType<ReportLog> = [
    {
      title: "Date",
      dataIndex: "date",
      key: "date",
      width: 130,
      render: (value: string) => formatDisplayDate(value),
    },
    {
      title: "Content",
      dataIndex: "content",
      key: "content",
      render: (content: string, record) => (
        <Space orientation="vertical" size={2}>
          <Text>{content}</Text>
          {record.output ? <Text type="secondary">Output: {record.output}</Text> : null}
        </Space>
      ),
    },
    {
      title: "Created at",
      dataIndex: "created_at",
      key: "created_at",
      width: 190,
      render: (value: string) => formatDisplayDateTime(value),
    },
    {
      title: "",
      key: "action",
      width: 120,
      render: (_, record) => (
        <Space size="small">
          <Link href={`/members/${encodeMemberId(memberEmail)}/reports/${record.id}`}>
            <Button
              aria-label="Report detail"
              className="icon-only-action-button"
              icon={<EyeOutlined />}
              type="text"
            />
          </Link>
          {canManageReport(currentUser?.role, record.created_by, currentUser?.email) ? (
            <Popconfirm
              title="Delete this report/log?"
              description="This action cannot be undone."
              okText="Delete"
              okButtonProps={{ danger: true }}
              placement="top"
              onConfirm={() => deleteReport(record.id)}
            >
              <Button
                aria-label="Delete report"
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
  ];

  function closeCreateReportModal() {
    if (createReportLoading) return;
    form.resetFields();
    setCreateReportOpen(false);
  }

  async function createReport(values: ReportFormValues) {
    if (!currentUser || currentUser.role !== "Leader") return;

    setCreateReportLoading(true);
    setError(null);

    const { error: insertError } = await supabase.from("report_logs").insert({
      blocker: values.blocker || null,
      content: values.content,
      created_by: currentUser.email,
      date: values.date.format("YYYY-MM-DD"),
      evidence_link: values.evidence_link || null,
      follow_up: values.follow_up || null,
      member_email: memberEmail,
      output: values.output || null,
    });

    setCreateReportLoading(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    closeCreateReportModal();
    await loadData();
  }

  async function deleteReport(reportId: string) {
    setError(null);

    const { error: deleteError } = await supabase
      .from("report_logs")
      .delete()
      .eq("id", reportId);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    await loadData();
  }

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
            className="page-card member-report-card"
            title={
              <Space align="center" size="middle">
                <AppBackButton fallbackHref="/members" />
                <Space orientation="vertical" size={6}>
                  <Title level={4} className="mb-0 text-slate-950">
                    {member?.name || memberEmail}
                  </Title>
                  <Text className="text-sm text-slate-500">{memberEmail}</Text>
                </Space>
              </Space>
            }
            extra={
              currentUser?.role === "Leader" ? (
                <Button
                  type="primary"
                  className="shadow-sm"
                  icon={<FileAddOutlined />}
                  onClick={() => {
                    form.setFieldsValue({ date: dayjs() });
                    setCreateReportOpen(true);
                  }}
                >
                  New report
                </Button>
              ) : null
            }
          >
            <Space orientation="vertical" size="middle" className="w-full">
              <DatePicker
                allowClear
                className="member-report-month-filter"
                picker="month"
                placeholder="Filter by month"
                style={{ width: 360 }}
                value={selectedMonth}
                onChange={setSelectedMonth}
              />
              {visibleReports.length ? (
                <Table
                  className="app-table"
                  rowKey="id"
                  columns={columns}
                  dataSource={visibleReports}
                  pagination={tablePagination}
                />
              ) : (
                <div className="muted-panel">
                  <Empty description="No report/log found" />
                </div>
              )}
            </Space>
          </Card>
        </Space>
      )}
      <Modal
        title="Create report/log"
        open={createReportOpen}
        okText="Create"
        width={640}
        confirmLoading={createReportLoading}
        onCancel={closeCreateReportModal}
        onOk={() => form.submit()}
        styles={{
          body: {
            maxHeight: "calc(100vh - 240px)",
            overflowY: "auto",
            paddingRight: 8,
          },
        }}
        forceRender
        destroyOnHidden
      >
        <ReportForm form={form} onFinish={createReport} />
      </Modal>
    </AppShell>
  );
}
