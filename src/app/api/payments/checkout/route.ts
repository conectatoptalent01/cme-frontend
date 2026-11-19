import { NextRequest, NextResponse } from "next/server";
import { buildAuthHeader, resolveApiUrl, readJsonStrict } from "../../_utils/proxy-helpers";

export const runtime = "nodejs";

/**
 * Inicia el cobro de una contratación.
 * Solo se envía el referido: el backend calcula el fee con la tabla de tarifas
 * y crea el pago en la pasarela. El navegador nunca decide el monto.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const referralId = String(body?.referralId ?? "").trim();
    if (!referralId) {
      return NextResponse.json({ error: "referralId_required" }, { status: 400 });
    }

    const auth = buildAuthHeader(req);
    if (!auth) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const API = resolveApiUrl(req);
    const upstream = await fetch(`${API}/payments/referral/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: auth },
      body: JSON.stringify({ referralId }),
      cache: "no-store",
    });

    const { data } = await readJsonStrict(upstream).catch(() => ({ data: null }));
    if (!upstream.ok) {
      const msg = data?.message || data?.error || `checkout_upstream_${upstream.status}`;
      return NextResponse.json({ error: msg }, { status: upstream.status || 502 });
    }
    return NextResponse.json(data, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "checkout_proxy_error" }, { status: 500 });
  }
}
