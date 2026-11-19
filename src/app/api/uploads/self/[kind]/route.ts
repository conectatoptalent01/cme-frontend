import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function resolveApiUrl(req: NextRequest) {
  const base =
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.API_URL ||
    "https://cme-monolith-7hth.onrender.com/api";

  if (/^https?:\/\//i.test(base)) {
    return base.replace(/\/$/, "");
  }

  return new URL(base, req.nextUrl.origin)
    .toString()
    .replace(/\/$/, "");
}

function decodeJwtPayload<T = any>(jwt: string): T | null {
  try {
    const [, b64] = jwt.split(".");
    if (!b64) return null;

    const pad = "=".repeat((4 - (b64.length % 4)) % 4);

    const base64 = (b64 + pad)
      .replace(/-/g, "+")
      .replace(/_/g, "/");

    return JSON.parse(
      Buffer.from(base64, "base64").toString("utf8")
    );
  } catch {
    return null;
  }
}

function pickBestJwt(req: NextRequest) {
  const access = req.cookies.get("access_token")?.value ?? null;
  const session = req.cookies.get("session_access")?.value ?? null;

  const accessPayload = access
    ? decodeJwtPayload<any>(access)
    : null;

  const sessionPayload = session
    ? decodeJwtPayload<any>(session)
    : null;

  if (accessPayload?.sub || accessPayload?.user_id) {
    return {
      jwt: access,
      payload: accessPayload,
      source: "access_token",
    };
  }

  if (sessionPayload?.sub || sessionPayload?.user_id) {
    return {
      jwt: session,
      payload: sessionPayload,
      source: "session_access",
    };
  }

  return {
    jwt: null as string | null,
    payload: null as any,
    source: null as string | null,
  };
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ kind: string }> }
) {
  try {
    const { kind } = await params;

    console.log("UPLOAD ROUTE HIT");
    console.log("KIND:", kind);

    if (!["avatar", "cover"].includes(kind)) {
      return NextResponse.json(
        {
          error: "route_not_supported",
        },
        { status: 404 }
      );
    }

    const { jwt, payload } = pickBestJwt(req);

    if (!jwt) {
      return NextResponse.json(
        {
          error: "unauthenticated_missing_token",
        },
        { status: 401 }
      );
    }

    const userId =
      payload?.sub ??
      payload?.user_id ??
      null;

    if (!userId) {
      return NextResponse.json(
        {
          error: "cannot_extract_user_id_from_token",
        },
        { status: 401 }
      );
    }

    const form = await req.formData();

    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          error: "missing_file_field",
        },
        { status: 400 }
      );
    }

    const fd = new FormData();

    fd.append("file", file, file.name);

    const API = resolveApiUrl(req);

    console.log(
      "UPSTREAM:",
      `${API}/uploads/self/${kind}`
    );

    const upstream = await fetch(
      `${API}/uploads/self/${kind}`,
      {
        method: "POST",
        headers: {
          // El backend identifica al usuario por el token verificado (ya no por x-user-id).
          Authorization: `Bearer ${jwt}`,
        },
        body: fd,
        cache: "no-store",
      }
    );

    const text = await upstream.text();

    try {
      const json = text
        ? JSON.parse(text)
        : null;

      return new NextResponse(
        JSON.stringify(json ?? {}),
        {
          status: upstream.status,
          headers: {
            "content-type":
              "application/json",
          },
        }
      );
    } catch {
      return NextResponse.json(
        {
          error: "upstream_not_json",
          sample: text.slice(0, 180),
        },
        { status: 502 }
      );
    }
  } catch (e: any) {
    console.error(e);

    return NextResponse.json(
      {
        error: e?.message || "internal_error",
      },
      { status: 500 }
    );
  }
}