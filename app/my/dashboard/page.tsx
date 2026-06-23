"use client";

import { Alert, Card, Space, Spin, Typography } from "antd";
import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { OverdueChecklistsSection } from "@/components/dashboard/OverdueChecklistsSection";
import { getCurrentProfile } from "@/lib/auth-client";
import { supabase } from "@/lib/supabase";
import type { WhitelistUser } from "@/lib/types";

const { Text, Title } = Typography;

export default function MyDashboardPage() {
  const [currentUser, setCurrentUser] = useState<WhitelistUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [overdueChecklistsCount, setOverdueChecklistsCount] = useState(0);
  const [myReportsCount, setMyReportsCount] = useState(0);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);

  const loadData = useCallback(async () => {
    await Promise.resolve();
    setLoading(true);
    setError(null);

    const profileResult = await getCurrentProfile();
    const profile = profileResult.profile;
    setCurrentUser(profile);

    if (profileResult.error || !profile) {
      setError(profileResult.error || "Cannot load current user.");
    } else {
      const [reportsResult, notificationsResult] = await Promise.all([
        supabase
          .from("report_logs")
          .select("id", { count: "exact", head: true })
          .eq("member_email", profile.email),
        supabase
          .from("notifications")
          .select("id", { count: "exact", head: true })
          .eq("recipient_email", profile.email)
          .is("read_at", null),
      ]);

      if (reportsResult.error) {
        setError(reportsResult.error.message);
      } else {
        setMyReportsCount(reportsResult.count ?? 0);
      }

      if (!notificationsResult.error) {
        setUnreadNotificationsCount(notificationsResult.count ?? 0);
      }
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  return (
    <AppShell currentUser={currentUser}>
      {loading ? (
        <div className="flex min-h-105 items-center justify-center">
          <Spin size="large" />
        </div>
      ) : (
        <Space orientation="vertical" size="large" className="w-full">
          {error ? <Alert type="warning" title={error} showIcon /> : null}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Card className="metric-card metric-card-orange">
              <Text className="metric-label">Overdue checklists</Text>
              <Title level={1} className="metric-value">
                {overdueChecklistsCount}
              </Title>
              <Text className="metric-subtitle metric-subtitle-warning">
                Need follow-up
              </Text>
            </Card>
            <Card className="metric-card metric-card-blue">
              <Text className="metric-label">My reports</Text>
              <Title level={1} className="metric-value">
                {myReportsCount}
              </Title>
              <Text className="metric-subtitle">Leader logs</Text>
            </Card>
            <Card className="metric-card metric-card-green">
              <Text className="metric-label">Unread notifications</Text>
              <Title level={1} className="metric-value">
                {unreadNotificationsCount}
              </Title>
              <Text className="metric-subtitle metric-subtitle-success">
                New updates
              </Text>
            </Card>
          </div>

          {currentUser ? (
            <OverdueChecklistsSection
              currentUser={currentUser}
              hideWhenEmpty={false}
              onCountChange={setOverdueChecklistsCount}
            />
          ) : null}
        </Space>
      )}
    </AppShell>
  );
}
