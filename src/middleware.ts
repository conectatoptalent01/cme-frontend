import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

function readAccessToken(req: NextRequest): string | null {
  const raw =
    req.cookies.get("access_token")?.value ??
    req.cookies.get("token")?.value ??
    req.cookies.get("auth")?.value ??
    null;

  if (!raw) return null;
  const v = String(raw).trim();
  if (!v || v === "null" || v === "undefined") return null;
  return v;
}

export function middleware(req: NextRequest) {
  const { nextUrl } = req;
  const { pathname, search } = nextUrl;

  const token = readAccessToken(req);

  if (token) {
    const res = NextResponse.next();
    res.headers.set("x-mw", "hit");
    return res;
  }

  const loginUrl = new URL("/login", req.url);
  loginUrl.searchParams.set("next", pathname + (search || ""));
  return NextResponse.redirect(loginUrl);
}


export const config = {
  matcher: [
    "/admin",
    "/admin/:path*",

    "/applications",
    "/applications/:path*",

    "/dashboard",
    "/dashboard/:path*",

    "/notifications",
    "/notifications/:path*",

    "/profile",
    "/profile/:path*",

    "/profiles/me",
    "/profiles/me/:path*",

    "/referrals",
    "/referrals/:path*",

    "/settings",
    "/settings/:path*",

    "/company",
    "/company/:path*",
    "/createCompany",
    "/createCompany/:path*",
    "/updateCompany",
    "/updateCompany/:path*",

    "/finance",
    "/finance/:path*",
  ],
};
