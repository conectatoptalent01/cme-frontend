import { NextRequest, NextResponse } from "next/server";
import { buildAuthHeader, resolveApiUrl, readJsonStrict } from "../_utils/proxy-helpers";

/** Reenvía la llamada al backend (/invitations/...) con o sin sesión. */
export async function forwardInvitation(
  req: NextRequest,
  path: string,
  init: { method: "GET" | "POST"; body?: unknown; requireAuth?: boolean },
) {
  try {
    const auth = buildAuthHeader(req);
    if (init.requireAuth && !auth) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
    const API = resolveApiUrl(req);
    const upstream = await fetch(`${API}/invitations${path}`, {
      method: init.method,
      headers: {
        Accept: "application/json",
        ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(auth ? { Authorization: auth } : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
    });
    const { data } = await readJsonStrict(upstream).catch(() => ({ data: null as any }));
    if (!upstream.ok) {
      const msg = data?.message || data?.error || `invitations_upstream_${upstream.status}`;
      return NextResponse.json({ error: msg }, { status: upstream.status || 502 });
    }
    return NextResponse.json(data ?? {}, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "invitations_proxy_error" }, { status: 500 });
  }
}

export const tokenOk = (t: string | undefined) => !!t && /^[\w-]{20,100}$/.test(t);
