"use client";

import type { Session } from "@supabase/supabase-js";
import { Alert, Form, Space, Spin, message } from "antd";
import dayjs from "dayjs";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import {
  CreateReportModal,
  type DashboardReportFormValues,
} from "@/components/dashboard/CreateReportModal";
import { DashboardMetrics } from "@/components/dashboard/DashboardMetrics";
import { LoginCard } from "@/components/dashboard/LoginCard";
import { NeedReviewSection } from "@/components/dashboard/NeedReviewSection";
import { OverdueChecklistsSection } from "@/components/dashboard/OverdueChecklistsSection";
import { canViewTeam } from "@/lib/auth-client";
import { memberSelect, reportSelect } from "@/lib/report-helpers";
import { supabase } from "@/lib/supabase";
import type { ReportLog, UserRole, WhitelistUser } from "@/lib/types";

function getOneMonthAgoDate() {
  const date = new Date();
  date.setMonth(date.getMonth() - 1);
  return date.toISOString().slice(0, 10);
}

export default function Dashboard() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [currentUser, setCurrentUser] = useState<WhitelistUser | null>(null);
  const [members, setMembers] = useState<WhitelistUser[]>([]);
  const [reportLogs, setReportLogs] = useState<ReportLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [redirectingMember, setRedirectingMember] = useState(false);
  const [membersLoading, setMembersLoading] = useState(false);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [createReportOpen, setCreateReportOpen] = useState(false);
  const [createReportLoading, setCreateReportLoading] = useState(false);
  const [needReviewSearch, setNeedReviewSearch] = useState("");
  const [overdueChecklistsCount, setOverdueChecklistsCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [form] = Form.useForm<DashboardReportFormValues>();
  const [messageApi, messageContextHolder] = message.useMessage();
  const rejectedEmailRef = useRef<string | null>(null);

  const loadReportLogs = useCallback(
    async (role: UserRole, userEmail: string) => {
      setReportsLoading(true);

      let query = supabase
        .from("report_logs")
        .select(reportSelect)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false });

      if (!canViewTeam(role)) {
        query = query.eq("member_email", userEmail);
      }

      const { data, error: reportsError } = await query;

      if (reportsError) {
        setError(
          `Cannot load report logs for Need Review. Run report-tool/supabase/phase2.sql in Supabase if the table/policies are missing. ${reportsError.message}`,
        );
        setReportLogs([]);
      } else {
        setReportLogs((data ?? []) as ReportLog[]);
      }

      setReportsLoading(false);
    },
    [],
  );

  const loadMembers = useCallback(async (role: UserRole) => {
    if (!canViewTeam(role)) {
      setMembers([]);
      return;
    }

    setMembersLoading(true);
    const { data, error: membersError } = await supabase
      .from("whitelist_users")
      .select(memberSelect)
      .order("name", { ascending: true });

    if (membersError) {
      setError(
        `Cannot load member list. Check Supabase RLS policy for Leader/Admin team read access. ${membersError.message}`,
      );
      setMembers([]);
    } else {
      setMembers((data ?? []) as WhitelistUser[]);
    }

    setMembersLoading(false);
  }, []);

  const loadProfile = useCallback(
    async (activeSession: Session | null) => {
      if (!activeSession?.user.email) {
        setCurrentUser(null);
        setMembers([]);
        setReportLogs([]);
        setRedirectingMember(false);
        setLoading(false);
        return;
      }

      setLoading(true);
      setRedirectingMember(false);
      setError(null);

      const { data, error: profileError } = await supabase
        .from("whitelist_users")
        .select(memberSelect)
        .eq("email", activeSession.user.email)
        .maybeSingle();

      if (profileError) {
        setError(profileError.message);
        setCurrentUser(null);
      } else if (!data || data.status !== "Active") {
        const accessDeniedMessage =
          "This Google account is not active in the FE team whitelist.";
        if (rejectedEmailRef.current !== activeSession.user.email) {
          rejectedEmailRef.current = activeSession.user.email;
          messageApi.error({ content: accessDeniedMessage, duration: 3 });
        }
        await supabase.auth.signOut();
        setSession(null);
        setCurrentUser(null);
        setMembers([]);
        setReportLogs([]);
      } else {
        rejectedEmailRef.current = null;
        const profile = data as WhitelistUser;
        if (profile.role === "Member") {
          setRedirectingMember(true);
          setCurrentUser(profile);
          router.replace("/my/dashboard");
          return;
        }
        setCurrentUser(profile);
        await loadMembers(profile.role);
        await loadReportLogs(profile.role, profile.email);
      }

      setLoading(false);
    },
    [loadMembers, loadReportLogs, messageApi, router],
  );

  useEffect(() => {
    let mounted = true;

    async function init() {
      const { data } = await supabase.auth.getSession();

      if (!mounted) return;
      setSession(data.session);
      await loadProfile(data.session);
    }

    void init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      void loadProfile(nextSession);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadProfile]);

  const activeMembers = useMemo(
    () => members.filter((member) => member.status === "Active"),
    [members],
  );

  const reviewCandidates = useMemo(() => {
    const recentlyReviewedEmails = new Set(
      reportLogs
        .filter((log) => log.date >= getOneMonthAgoDate())
        .map((log) => log.member_email),
    );
    return activeMembers
      .filter((member) => member.role === "Member")
      .filter((member) => !recentlyReviewedEmails.has(member.email));
  }, [activeMembers, reportLogs]);

  const teamMembers = useMemo(
    () => activeMembers.filter((member) => member.role === "Member"),
    [activeMembers],
  );

  const visibleReviewCandidates = useMemo(() => {
    const keyword = needReviewSearch.trim().toLowerCase();
    if (!keyword) return reviewCandidates;

    return reviewCandidates.filter((member) => {
      const name = member.name?.toLowerCase() ?? "";
      const memberEmail = member.email.toLowerCase();
      return name.includes(keyword) || memberEmail.includes(keyword);
    });
  }, [needReviewSearch, reviewCandidates]);

  async function signInWithGoogle() {
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (signInError) setError(signInError.message);
  }

  function openCreateReport(member: WhitelistUser) {
    setError(null);
    form.setFieldsValue({
      date: dayjs(),
      member_email: member.email,
    });
    setCreateReportOpen(true);
  }

  function closeCreateReportModal() {
    if (createReportLoading) return;
    form.resetFields();
    setError(null);
    setCreateReportOpen(false);
  }

  async function createReport(values: DashboardReportFormValues) {
    if (!currentUser || currentUser.role !== "Leader") return;

    setError(null);
    setCreateReportLoading(true);
    const { error: insertError } = await supabase.from("report_logs").insert({
      blocker: values.blocker || null,
      content: values.content,
      created_by: currentUser.email,
      date: values.date.format("YYYY-MM-DD"),
      evidence_link: values.evidence_link || null,
      follow_up: values.follow_up || null,
      member_email: values.member_email,
      output: values.output || null,
    });

    if (insertError) {
      setError(insertError.message);
      setCreateReportLoading(false);
      return;
    }

    setCreateReportLoading(false);
    closeCreateReportModal();
    await loadReportLogs(currentUser.role, currentUser.email);
  }

  return (
    <AppShell currentUser={currentUser}>
      {messageContextHolder}
      {loading || redirectingMember ? (
        <div className="flex min-h-105 items-center justify-center">
          <Spin size="large" />
        </div>
      ) : !session ? (
        <LoginCard error={error} onSignIn={signInWithGoogle} />
      ) : !currentUser ? (
        <LoginCard error={error} onSignIn={signInWithGoogle} />
      ) : (
        <Space orientation="vertical" size="large" className="w-full">
          {error ? <Alert type="warning" title={error} showIcon /> : null}

          {canViewTeam(currentUser.role) ? (
            <DashboardMetrics
              needReviewCount={reviewCandidates.length}
              overdueChecklistsCount={overdueChecklistsCount}
              totalMembers={teamMembers.length}
            />
          ) : null}

          <OverdueChecklistsSection
            currentUser={currentUser}
            onCountChange={setOverdueChecklistsCount}
          />

          <NeedReviewSection
            currentUser={currentUser}
            loading={membersLoading || reportsLoading}
            onAddReport={openCreateReport}
            onSearchChange={setNeedReviewSearch}
            reviewCandidates={reviewCandidates}
            search={needReviewSearch}
            visibleReviewCandidates={visibleReviewCandidates}
          />
        </Space>
      )}

      <CreateReportModal
        activeMembers={activeMembers}
        form={form}
        loading={createReportLoading}
        onCancel={closeCreateReportModal}
        onCreate={createReport}
        open={createReportOpen}
      />
    </AppShell>
  );
}
