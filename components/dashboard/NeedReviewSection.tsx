"use client";

import { Avatar, Button, Card, Empty, Input, Space, Table, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import Link from "next/link";
import { canViewTeam } from "@/lib/auth-client";
import { encodeMemberId, tablePagination } from "@/lib/report-helpers";
import type { WhitelistUser } from "@/lib/types";

const { Text, Title } = Typography;

type NeedReviewSectionProps = {
  currentUser: WhitelistUser;
  loading: boolean;
  onAddReport: (member: WhitelistUser) => void;
  onSearchChange: (value: string) => void;
  reviewCandidates: WhitelistUser[];
  search: string;
  visibleReviewCandidates: WhitelistUser[];
};

export function NeedReviewSection({
  currentUser,
  loading,
  onAddReport,
  onSearchChange,
  reviewCandidates,
  search,
  visibleReviewCandidates,
}: NeedReviewSectionProps) {
  const canViewTeamData = canViewTeam(currentUser.role);

  const columns: ColumnsType<WhitelistUser> = [
    {
      title: "Member",
      dataIndex: "name",
      key: "member",
      render: (_, record) => (
        <Space size="middle">
          <Avatar className="bg-blue-100 text-blue-700">
            {(record.name || record.email).charAt(0).toUpperCase()}
          </Avatar>
          <div>
            <div className="font-medium text-slate-900">
              {record.name || "Unnamed"}
            </div>
            <Text className="text-sm text-slate-500">{record.email}</Text>
          </div>
        </Space>
      ),
    },
    {
      title: "Reason",
      key: "reason",
      render: () => (
        <Tag color="warning" className="m-0">
          No report/log in last 1 month
        </Tag>
      ),
    },
    {
      title: "",
      key: "action",
      width: 220,
      render: (_, record) => (
        <Space>
          {currentUser.role === "Leader" ? (
            <Button
              type="primary"
              className="shadow-sm"
              onClick={() => onAddReport(record)}
            >
              Add report
            </Button>
          ) : null}
          <Link href={`/members/${encodeMemberId(record.email)}/reports`}>
            <Button>History</Button>
          </Link>
        </Space>
      ),
    },
  ];

  return (
    <Card className="dashboard-hero-card">
      <div className="need-review-header">
        <Space align="center" size="middle">
          <Title level={3} className="mb-0 text-slate-950">
            Need Review
          </Title>
          {canViewTeamData ? (
            <Tag
              color={reviewCandidates.length ? "orange" : "green"}
              className="count-pill"
            >
              {reviewCandidates.length} member
              {reviewCandidates.length === 1 ? "" : "s"}
            </Tag>
          ) : null}
        </Space>
      </div>

      {canViewTeamData ? (
        <div className="need-review-toolbar">
          <Input.Search
            allowClear
            className="need-review-search"
            placeholder="Search members..."
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </div>
      ) : null}

      {canViewTeamData ? (
        visibleReviewCandidates.length ? (
          <Table
            className="app-table need-review-table"
            rowKey="id"
            columns={columns}
            dataSource={visibleReviewCandidates}
            loading={loading}
            pagination={tablePagination}
          />
        ) : (
          <div className="muted-panel">
            <Empty description="All members have report/log in the last 1 month" />
          </div>
        )
      ) : (
        <div className="muted-panel">
          <Link href="/my/reports">View my report history</Link>
        </div>
      )}
    </Card>
  );
}
