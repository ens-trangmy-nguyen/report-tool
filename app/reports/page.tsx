"use client";

import { EyeOutlined } from "@ant-design/icons";
import {
  Alert,
  Button,
  Card,
  DatePicker,
  Empty,
  Select,
  Space,
  Spin,
  Table,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import type { Dayjs } from "dayjs";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { canViewTeam, getCurrentProfile } from "@/lib/auth-client";
import { formatDisplayDate, formatDisplayDateTime } from "@/lib/date-format";
import {
  encodeMemberId,
  memberSelect,
  reportSelect,
  tablePagination,
} from "@/lib/report-helpers";
import { supabase } from "@/lib/supabase";
import type { ReportLog, WhitelistUser } from "@/lib/types";

const { Text, Title } = Typography;

export default function ReportsPage() {
  const [currentUser, setCurrentUser] = useState<WhitelistUser | null>(null);
  const [members, setMembers] = useState<WhitelistUser[]>([]);
  const [reports, setReports] = useState<ReportLog[]>([]);
  const [selectedMemberEmail, setSelectedMemberEmail] = useState<string>();
  const [selectedMonth, setSelectedMonth] = useState<Dayjs | null>(null);
  const [loading, setLoading] = useState(true);
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

    let reportQuery = supabase
      .from("report_logs")
      .select(reportSelect)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });

    if (!canViewTeam(profileResult.profile.role)) {
      reportQuery = reportQuery.eq("member_email", profileResult.profile.email);
    }

    const [{ data: reportData, error: reportError }, { data: memberData }] =
      await Promise.all([
        reportQuery,
        canViewTeam(profileResult.profile.role)
          ? supabase
              .from("whitelist_users")
              .select(memberSelect)
              .order("name", { ascending: true })
          : Promise.resolve({ data: [] }),
      ]);

    if (reportError) setError(reportError.message);
    setReports((reportData ?? []) as ReportLog[]);
    setMembers((memberData ?? []) as WhitelistUser[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  const visibleReports = useMemo(() => {
    const month = selectedMonth?.format("YYYY-MM");

    return reports.filter((report) => {
      const matchesMember =
        !selectedMemberEmail || report.member_email === selectedMemberEmail;
      const matchesMonth = !month || report.date.startsWith(month);
      return matchesMember && matchesMonth;
    });
  }, [reports, selectedMemberEmail, selectedMonth]);

  const columns: ColumnsType<ReportLog> = [
    {
      title: "Date",
      dataIndex: "date",
      key: "date",
      width: 130,
      render: (value: string) => formatDisplayDate(value),
    },
    {
      title: "Member",
      dataIndex: "member_email",
      key: "member",
      width: 260,
      render: (email: string) => {
        const member = members.find((item) => item.email === email);
        return (
          <div>
            <div className="font-medium text-slate-900">
              {member?.name || email}
            </div>
            <Text className="text-sm text-slate-500">{email}</Text>
          </div>
        );
      },
    },
    {
      title: "Content",
      dataIndex: "content",
      key: "content",
      render: (content: string, record) => (
        <Space orientation="vertical" size={2}>
          <Text>{content}</Text>
          {record.output ? (
            <Text className="text-sm text-slate-500">
              Output: {record.output}
            </Text>
          ) : null}
        </Space>
      ),
    },
    {
      title: "Created at",
      dataIndex: "created_at",
      key: "created_at",
      width: 180,
      render: (value: string) => formatDisplayDateTime(value),
    },
    {
      title: "",
      key: "action",
      width: 100,
      render: (_, record) => (
        <Link
          href={
            canViewTeam(currentUser?.role)
              ? `/members/${encodeMemberId(record.member_email)}/reports/${record.id}`
              : `/my/reports/${record.id}`
          }
        >
          <Button
            aria-label="Report detail"
            className="icon-only-action-button"
            icon={<EyeOutlined />}
            type="text"
          />
        </Link>
      ),
    },
  ];

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
                  Reports
                </Title>
              </Space>
            }
          >
            <Space orientation="vertical" size="middle" className="w-full">
              <Space wrap>
                {canViewTeam(currentUser?.role) ? (
                  <Select
                    allowClear
                    className="min-w-64"
                    placeholder="Filter by member"
                    value={selectedMemberEmail}
                    onChange={setSelectedMemberEmail}
                    options={members
                      .filter((member) => member.role === "Member")
                      .map((member) => ({
                        label: member.name || member.email,
                        value: member.email,
                      }))}
                  />
                ) : null}
                <DatePicker
                  allowClear
                  picker="month"
                  placeholder="Filter by month"
                  value={selectedMonth}
                  onChange={setSelectedMonth}
                />
              </Space>

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
    </AppShell>
  );
}
