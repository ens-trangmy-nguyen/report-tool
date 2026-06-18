"use client";

import { EyeOutlined } from "@ant-design/icons";
import { Alert, Button, Card, DatePicker, Empty, Space, Spin, Table, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import type { Dayjs } from "dayjs";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { getCurrentProfile } from "@/lib/auth-client";
import { formatDisplayDate, formatDisplayDateTime } from "@/lib/date-format";
import { reportSelect, tablePagination } from "@/lib/report-helpers";
import { supabase } from "@/lib/supabase";
import type { ReportLog, WhitelistUser } from "@/lib/types";

const { Text, Title } = Typography;

export default function MyReportsPage() {
  const [currentUser, setCurrentUser] = useState<WhitelistUser | null>(null);
  const [reports, setReports] = useState<ReportLog[]>([]);
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

    const { data, error: reportsError } = await supabase
      .from("report_logs")
      .select(reportSelect)
      .eq("member_email", profileResult.profile.email)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });

    if (reportsError) setError(reportsError.message);
    setReports((data ?? []) as ReportLog[]);
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
      width: 100,
      render: (_, record) => (
        <Link href={`/my/reports/${record.id}`}>
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
          <Card title={<Title level={4}>My reports</Title>}>
            <Space orientation="vertical" size="middle" className="w-full">
              <DatePicker
                allowClear
                picker="month"
                placeholder="Filter by month"
                value={selectedMonth}
                onChange={setSelectedMonth}
              />
              {visibleReports.length ? (
                <Table
                  rowKey="id"
                  columns={columns}
                  dataSource={visibleReports}
                  pagination={tablePagination}
                />
              ) : (
                <Empty description="No report/log found" />
              )}
            </Space>
          </Card>
        </Space>
      )}
    </AppShell>
  );
}
