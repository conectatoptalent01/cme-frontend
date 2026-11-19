import { NextRequest, NextResponse } from "next/server";
import { forwardInvitation } from "./_proxy";

export const runtime = "nodejs";

/** Referir a alguien sin cuenta: { jobOfferId, firstName, lastName, phone, note? } */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.jobOfferId) return NextResponse.json({ error: "jobOfferId_required" }, { status: 400 });
  return forwardInvitation(req, "", {
    method: "POST",
    requireAuth: true,
    body: {
      jobOfferId: String(body.jobOfferId),
      firstName: String(body.firstName ?? ""),
      lastName: String(body.lastName ?? ""),
      phone: String(body.phone ?? ""),
      ...(body.note ? { note: String(body.note) } : {}),
    },
  });
}
