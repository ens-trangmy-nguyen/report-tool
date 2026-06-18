"use client";

import { EyeOutlined } from "@ant-design/icons";
import {
  Alert,
  Avatar,
  Button,
  Card,
  Input,
  Space,
  Spin,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { canViewTeam, getCurrentProfile } from "@/lib/auth-client";
import {
  encodeMemberId,
  memberSelect,
  tablePagination,
} from "@/lib/report-helpers";
import { supabase } from "@/lib/supabase";
import type { UserRole, WhitelistUser } from "@/lib/types";

const { Text, Title } = Typography;

const roleColors: Record<UserRole, string> = {
  Admin: "purple",
  Leader: "blue",
  Member: "green",
};

export default function MembersPage() {
  const [currentUser, setCurrentUser] = useState<WhitelistUser | null>(null);
  const [members, setMembers] = useState<WhitelistUser[]>([]);
  const [search, setSearch] = useState("");
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

    if (!canViewTeam(profileResult.profile.role)) {
      setError("Only Leader/Admin can view member list.");
      setLoading(false);
      return;
    }

    const { data, error: membersError } = await supabase
      .from("whitelist_users")
      .select(memberSelect)
      .order("name", { ascending: true });

    if (membersError) {
      setError(membersError.message);
      setMembers([]);
    } else {
      setMembers((data ?? []) as WhitelistUser[]);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  const visibleMembers = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return members;

    return members.filter((member) => {
      const name = member.name?.toLowerCase() ?? "";
      const email = member.email.toLowerCase();
      return name.includes(keyword) || email.includes(keyword);
    });
  }, [members, search]);

  const columns: ColumnsType<WhitelistUser> = [
    {
      title: "Member",
      dataIndex: "name",
      key: "name",
      render: (_value, record) => (
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
      title: "Role",
      dataIndex: "role",
      key: "role",
      width: 130,
      render: (role: UserRole) => <Tag color={roleColors[role]}>{role}</Tag>,
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 130,
      render: (status: string) => (
        <Tag color={status === "Active" ? "success" : "default"}>{status}</Tag>
      ),
    },
    {
      title: "",
      key: "action",
      width: 120,
      render: (_, record) =>
        record.role === "Member" ? (
          <Tooltip title="Member detail">
            <Link href={`/members/${encodeMemberId(record.email)}/reports`}>
              <Button
                aria-label="Member detail"
                className="icon-only-action-button"
                icon={<EyeOutlined />}
                type="text"
              />
            </Link>
          </Tooltip>
        ) : null,
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
                  Members
                </Title>
              </Space>
            }
          >
            <Space orientation="vertical" size="middle" className="w-full">
              <Input.Search
                allowClear
                className="max-w-sm"
                placeholder="Search by name or email"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <Table
                className="app-table"
                rowKey="id"
                columns={columns}
                dataSource={visibleMembers}
                pagination={tablePagination}
              />
            </Space>
          </Card>
        </Space>
      )}
    </AppShell>
  );
}
