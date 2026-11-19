import { NextRequest, NextResponse } from "next/server";
import { forwardInvitation, tokenOk } from "../../_proxy";

export const runtime = "nodejs";

/** Con sesión: el invitado acepta y queda postulado. */
export async function POST(req: NextRequest, context: any) {
  const { token } = await context.params;
  if (!tokenOk(token)) return NextResponse.json({ error: "invitation_not_found" }, { status: 404 });
  return forwardInvitation(req, `/${encodeURIComponent(token)}/accept`, { method: "POST", requireAuth: true });
}
