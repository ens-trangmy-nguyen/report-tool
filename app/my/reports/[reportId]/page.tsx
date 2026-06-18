"use client";

import { Alert, Space, Spin } from "antd";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { ReportComments } from "@/components/ReportComments";
import { ReportDetailCard } from "@/components/ReportDetailCard";
import { getCurrentProfile } from "@/lib/auth-client";
import { reportSelect } from "@/lib/report-helpers";
import { supabase } from "@/lib/supabase";
import type { ReportLog, WhitelistUser } from "@/lib/types";

export default function MyReportDetailPage() {
  const params = useParams<{ reportId: string }>();
  const [currentUser, setCurrentUser] = useState<WhitelistUser | null>(null);
  const [report, setReport] = useState<ReportLog | null>(null);
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

    const { data, error: reportError } = await supabase
      .from("report_logs")
      .select(reportSelect)
      .eq("id", params.reportId)
      .eq("member_email", profileResult.profile.email)
      .maybeSingle();

    if (reportError) setError(reportError.message);
    setReport((data ?? null) as ReportLog | null);
    setLoading(false);
  }, [params.reportId]);

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
          {report ? (
            <>
              <ReportDetailCard
                backHref="/my/reports"
                member={currentUser}
                report={report}
              />
              {currentUser ? (
                <ReportComments
                  reportId={report.id}
                  report={report}
                  currentUser={currentUser}
                />
              ) : null}
            </>
          ) : (
            <Alert type="error" showIcon title="Report not found" />
          )}
        </Space>
      )}
    </AppShell>
  );
}
