import { reportSelect } from "@/lib/report-helpers";
import { supabase } from "@/lib/supabase";
import type { ReportLog } from "@/lib/types";

type ReportPayload = {
  blocker?: string | null;
  content: string;
  created_by?: string;
  date: string;
  evidence_link?: string | null;
  follow_up?: string | null;
  member_email: string;
  output?: string | null;
};

type ReportUpdatePayload = Partial<Omit<ReportPayload, "created_by" | "member_email">>;

async function getAccessToken() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error(error.message);
  const token = data.session?.access_token;
  if (!token) throw new Error("Not signed in.");
  return token;
}

async function requestReports<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getAccessToken();
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "Report request failed.");
  }
  return payload as T;
}

export async function fetchReports(params?: { memberEmail?: string }) {
  const searchParams = new URLSearchParams();
  if (params?.memberEmail) searchParams.set("member_email", params.memberEmail);
  const query = searchParams.toString();
  const payload = await requestReports<{ reports: ReportLog[] }>(
    `/api/reports${query ? `?${query}` : ""}`,
  );
  return payload.reports;
}

export async function fetchReport(reportId: string, params?: { memberEmail?: string }) {
  const searchParams = new URLSearchParams();
  if (params?.memberEmail) searchParams.set("member_email", params.memberEmail);
  const query = searchParams.toString();
  const payload = await requestReports<{ report: ReportLog | null }>(
    `/api/reports/${reportId}${query ? `?${query}` : ""}`,
  );
  return payload.report;
}

export async function createReportLog(payload: ReportPayload) {
  const result = await requestReports<{ report: ReportLog }>("/api/reports", {
    body: JSON.stringify(payload),
    method: "POST",
  });
  return result.report;
}

export async function updateReportLog(reportId: string, payload: ReportUpdatePayload) {
  const result = await requestReports<{ report: ReportLog }>(`/api/reports/${reportId}`, {
    body: JSON.stringify(payload),
    method: "PATCH",
  });
  return result.report;
}

export async function deleteReportLog(reportId: string) {
  await requestReports<{ ok: true }>(`/api/reports/${reportId}`, {
    method: "DELETE",
  });
}

export { reportSelect };
