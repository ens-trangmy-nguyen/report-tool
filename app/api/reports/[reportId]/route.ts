import { NextResponse } from "next/server";

import { decryptReport, encryptReportPayload } from "@/lib/report-encryption";
import { reportSelect } from "@/lib/report-helpers";
import { createServerSupabaseClient, getBearerToken } from "@/lib/supabase-server";
import type { ReportLog } from "@/lib/types";

type Context = {
  params: Promise<{ reportId: string }>;
};

export async function GET(request: Request, context: Context) {
  try {
    const token = getBearerToken(request);
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { reportId } = await context.params;
    const { searchParams } = new URL(request.url);
    const memberEmail = searchParams.get("member_email");
    const supabase = createServerSupabaseClient(token);

    let query = supabase
      .from("report_logs")
      .select(reportSelect)
      .eq("id", reportId);

    if (memberEmail) query = query.eq("member_email", memberEmail);

    const { data, error } = await query.maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ report: decryptReport((data ?? null) as ReportLog | null) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Cannot load report." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const token = getBearerToken(request);
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { reportId } = await context.params;
    const payload = await request.json();
    const supabase = createServerSupabaseClient(token);
    const encryptedPayload = encryptReportPayload({
      blocker: payload.blocker || null,
      content: payload.content,
      date: payload.date,
      evidence_link: payload.evidence_link || null,
      follow_up: payload.follow_up || null,
      output: payload.output || null,
      updated_at: new Date().toISOString(),
    });

    const { data, error } = await supabase
      .from("report_logs")
      .update(encryptedPayload)
      .eq("id", reportId)
      .select(reportSelect)
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ report: decryptReport(data as ReportLog) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Cannot update report." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    const token = getBearerToken(request);
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { reportId } = await context.params;
    const supabase = createServerSupabaseClient(token);
    const { error } = await supabase.from("report_logs").delete().eq("id", reportId);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Cannot delete report." },
      { status: 500 },
    );
  }
}
