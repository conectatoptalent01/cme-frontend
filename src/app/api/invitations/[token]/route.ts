import { NextRequest, NextResponse } from "next/server";
import { forwardInvitation, tokenOk } from "../_proxy";

export const runtime = "nodejs";

/** Pública: datos de la invitación para la página del enlace. */
export async function GET(req: NextRequest, context: any) {
  const { token } = await context.params;
  if (!tokenOk(token)) return NextResponse.json({ error: "invitation_not_found" }, { status: 404 });
  return forwardInvitation(req, `/${encodeURIComponent(token)}`, { method: "GET" });
}
