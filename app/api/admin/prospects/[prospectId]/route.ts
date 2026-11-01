import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/accounts/session";
import { updateProspectStatus, ProspectStatus } from "@/lib/leads/prospects";
import { getSupabaseClient } from "@/lib/supabase/client";

export const runtime = "nodejs";

const VALID_STATUSES: ProspectStatus[] = ["new", "contacted", "converted", "closed"];

export async function POST(req: NextRequest, context: { params: Promise<{ prospectId: string }> }) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Admin access required." }, { status: 403 });
  }

  const { prospectId } = await context.params;

  let body: { status?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.status || !VALID_STATUSES.includes(body.status as ProspectStatus)) {
    return NextResponse.json(
      { success: false, error: `status must be one of: ${VALID_STATUSES.join(", ")}` },
      { status: 400 }
    );
  }

  await updateProspectStatus(prospectId, body.status as ProspectStatus);
  return NextResponse.json({ success: true });
}

/** Delete an inquiry from the demo request form. */
export async function DELETE(_req: NextRequest, context: { params: Promise<{ prospectId: string }> }) {
  if (!(await getAdminSession())) return NextResponse.json({ success: false, error: "Admin access required." }, { status: 403 });
  const { prospectId } = await context.params;
  await getSupabaseClient().from("prospect_leads").delete().eq("id", prospectId);
  return NextResponse.json({ success: true });
}
