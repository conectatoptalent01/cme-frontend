import { NextRequest, NextResponse } from "next/server";
import { buildAuthHeader, resolveApiUrl, readJsonStrict } from "../../_utils/proxy-helpers";

export const runtime = "nodejs";

/**
 * Canjear un código de referido en una vacante.
 *
 * Antes esta ruta descargaba la lista de referidos de la vacante para buscar el código
 * (exponiendo los referidos de otros). Ahora el backend lo valida y asigna en un solo paso:
 * POST /referrals/claim { code, jobOfferId } → solo si el código es de esa vacante y está libre.
 */
export async function POST(req: NextRequest) {
  try {
    const { jobOfferId, code } = (await req.json().catch(() => ({}))) as {
      jobOfferId?: string;
      code?: string;
    };
    if (!jobOfferId || !code) {
      return NextResponse.json({ error: "jobOfferId_and_code_required" }, { status: 400 });
    }

    const auth = buildAuthHeader(req);
    if (!auth) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const API = resolveApiUrl(req);
    const upstream = await fetch(`${API}/referrals/claim`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: auth },
      body: JSON.stringify({ code: String(code).trim().toUpperCase(), jobOfferId }),
      cache: "no-store",
    });
    const { data } = await readJsonStrict(upstream).catch(() => ({ data: null as any }));

    if (upstream.status === 404) {
      return NextResponse.json({ error: "referral_not_found_for_offer" }, { status: 404 });
    }
    if (!upstream.ok) {
      const msg = data?.message || data?.error || `claim_upstream_${upstream.status}`;
      return NextResponse.json({ error: msg }, { status: upstream.status || 502 });
    }
    return NextResponse.json({ ok: true, referral: data }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "consume_proxy_error" }, { status: 500 });
  }
}
