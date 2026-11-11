import { NextRequest, NextResponse } from 'next/server';

function buildAuthHeader(req: NextRequest): string | undefined {
    const fromHeader = req.headers.get('authorization');
    if (fromHeader && fromHeader.trim() !== '') return fromHeader;
    const cookieHeader = req.headers.get('cookie') ?? '';
    const m = cookieHeader.match(/(?:^|;\s*)access_token=([^;]+)/i);
    if (m?.[1]) return `Bearer ${decodeURIComponent(m[1])}`;
    return undefined;
}

function resolveApiUrl(req: NextRequest) {
    const base =
        process.env.NEXT_PUBLIC_API_URL ||
        process.env.API_URL ||
        'cme-monolith.vercel.app/api';
    if (/^https?:\/\//i.test(base)) return base.replace(/\/$/, '');
    return new URL(base, req.nextUrl.origin).toString().replace(/\/$/, '');
}

async function readUpstream(res: Response) {
    const text = await res.text().catch(() => '');
    let data: any = null;
    try { data = text ? JSON.parse(text) : null; } catch { }
    return { ok: res.ok, status: res.status, data, text, url: res.url };
}

export async function PATCH(req: NextRequest, context: any) {
    try {
        const { id } = await context.params;
        if (!id) return NextResponse.json({ error: 'missing_id' }, { status: 400 });

        const API = resolveApiUrl(req);
        const authorization = buildAuthHeader(req);
        const cookie = req.headers.get('cookie') ?? '';
        const body = await req.json().catch(() => ({}));

        const upstream = await fetch(`${API}/payments/${encodeURIComponent(id)}`, {
            method: 'PATCH',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                ...(authorization ? { Authorization: authorization } : {}),
                ...(cookie ? { cookie } : {}),
            },
            body: JSON.stringify(body),
            credentials: 'include',
            cache: 'no-store',
        });

        const parsed = await readUpstream(upstream);
        if (!parsed.ok) {
            const msg = (parsed.data && (parsed.data.error || parsed.data.message)) || `payments_patch_upstream_${parsed.status}`;
            return NextResponse.json({ error: msg, raw: typeof parsed.data === 'object' ? parsed.data : parsed.text?.slice(0, 800) }, { status: parsed.status || 502 });
        }
        return NextResponse.json(parsed.data ?? { ok: true }, { status: 200 });
    } catch (e: any) {
        return NextResponse.json({ error: e?.message || 'payments_id_proxy_error' }, { status: 500 });
    }
}

/** Consulta el estado de un pago (lo usa la pantalla de cobro mientras espera la confirmación del webhook). */
export async function GET(req: NextRequest, context: any) {
    try {
        const { id } = await context.params;
        if (!id) return NextResponse.json({ error: 'missing_id' }, { status: 400 });

        const API = resolveApiUrl(req);
        const authorization = buildAuthHeader(req);
        const upstream = await fetch(`${API}/payments/${encodeURIComponent(id)}`, {
            method: 'GET',
            headers: {
                Accept: 'application/json',
                ...(authorization ? { Authorization: authorization } : {}),
            },
            cache: 'no-store',
        });

        const parsed = await readUpstream(upstream);
        if (!parsed.ok) {
            const msg = (parsed.data && (parsed.data.error || parsed.data.message)) || `payments_get_upstream_${parsed.status}`;
            return NextResponse.json({ error: msg }, { status: parsed.status || 502 });
        }
        return NextResponse.json(parsed.data ?? {}, { status: 200 });
    } catch (e: any) {
        return NextResponse.json({ error: e?.message || 'payments_id_proxy_error' }, { status: 500 });
    }
}
