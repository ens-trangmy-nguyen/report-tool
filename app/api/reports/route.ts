import { NextResponse } from "next/server";

import { decryptReports, encryptReportPayload } from "@/lib/report-encryption";
import { reportSelect } from "@/lib/report-helpers";
import { createServerSupabaseClient, getBearerToken } from "@/lib/supabase-server";
import type { ReportLog } from "@/lib/types";

export async function GET(request: Request) {
  try {
    const token = getBearerToken(request);
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = createServerSupabaseClient(token);
    const { searchParams } = new URL(request.url);
    const memberEmail = searchParams.get("member_email");

    let query = supabase
      .from("report_logs")
      .select(reportSelect)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });

    if (memberEmail) query = query.eq("member_email", memberEmail);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ reports: decryptReports((data ?? []) as ReportLog[]) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Cannot load reports." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const token = getBearerToken(request);
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const payload = await request.json();
    const supabase = createServerSupabaseClient(token);
    const encryptedPayload = encryptReportPayload({
      blocker: payload.blocker || null,
      content: payload.content,
      created_by: payload.created_by,
      date: payload.date,
      evidence_link: payload.evidence_link || null,
      follow_up: payload.follow_up || null,
      member_email: payload.member_email,
      output: payload.output || null,
    });

    const { data, error } = await supabase
      .from("report_logs")
      .insert(encryptedPayload)
      .select(reportSelect)
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ report: decryptReports([data as ReportLog])[0] });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Cannot create report." },
      { status: 500 },
    );
  }
}
