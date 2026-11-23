import { NextRequest, NextResponse } from "next/server";
import { buildAuthHeader, resolveApiUrl, readJsonStrict } from "../../_utils/proxy-helpers";

export const runtime = "nodejs";

/**
 * Puente genérico hacia el backend para los módulos de la Fase 4.
 * Solo reenvía rutas de esta lista (no es un proxy abierto). El backend decide
 * quién puede hacer qué; aquí solo se agrega el token de la sesión si existe.
 */
const UUID = "[0-9a-fA-F-]{36}";
const TOKEN = "[\\w-]{20,100}";
const ALLOWED: Array<{ method: string; re: RegExp }> = [
  { method: "GET", re: new RegExp(`^reputation/me$`) },
  { method: "GET", re: new RegExp(`^reputation/referrers/${UUID}$`) },
  { method: "POST", re: new RegExp(`^referrals/${UUID}/rating$`) },
  { method: "POST", re: new RegExp(`^partner-applications$`) },
  { method: "GET", re: new RegExp(`^partner-applications(/me)?$`) },
  { method: "POST", re: new RegExp(`^partner-applications/${UUID}/(approve|reject)$`) },
  { method: "GET", re: new RegExp(`^companies/${UUID}/rating$`) },
  { method: "POST", re: new RegExp(`^companies/${UUID}/rating$`) },
  { method: "GET", re: new RegExp(`^work-references/mine$`) },
  { method: "POST", re: new RegExp(`^work-references$`) },
  { method: "DELETE", re: new RegExp(`^work-references/${UUID}$`) },
  { method: "GET", re: new RegExp(`^work-references/candidate/${UUID}$`) },
  { method: "GET", re: new RegExp(`^work-references/public/${TOKEN}$`) },
  { method: "POST", re: new RegExp(`^work-references/public/${TOKEN}/(confirm|decline)$`) },
];

async function forward(req: NextRequest, context: any) {
  const { path } = await context.params;
  const joined = (Array.isArray(path) ? path : [path]).join("/");
  if (!ALLOWED.some((a) => a.method === req.method && a.re.test(joined))) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  try {
    const API = resolveApiUrl(req);
    const auth = buildAuthHeader(req);
    const qs = req.nextUrl.search || "";
    const hasBody = req.method === "POST";
    const body = hasBody ? await req.text() : undefined;

    const upstream = await fetch(`${API}/${joined}${qs}`, {
      method: req.method,
      headers: {
        Accept: "application/json",
        ...(hasBody ? { "Content-Type": "application/json" } : {}),
        ...(auth ? { Authorization: auth } : {}),
      },
      body: hasBody ? body || "{}" : undefined,
      cache: "no-store",
    });
    const { data } = await readJsonStrict(upstream).catch(() => ({ data: null as any }));
    if (!upstream.ok) {
      const msg = data?.message || data?.error || `upstream_${upstream.status}`;
      return NextResponse.json({ error: Array.isArray(msg) ? msg.join(", ") : msg }, { status: upstream.status || 502 });
    }
    return NextResponse.json(data ?? {}, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "backend_proxy_error" }, { status: 500 });
  }
}

export const GET = forward;
export const POST = forward;
export const DELETE = forward;
