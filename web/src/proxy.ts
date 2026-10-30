// Sign-in gate (Next 16 renamed middleware.ts to proxy.ts). Runs before every page and /api/* route.
// Pages without a valid session go to /sign-in; /api/* answers 401 JSON (the browser code then opens /sign-in).
import { NextResponse, type NextRequest } from "next/server";
import { authOff, publicOrigin, readSession, SESSION_COOKIE } from "@/lib/auth";

const PUBLIC = new Set(["/sign-in", "/api/auth/sign-in"]);

export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (authOff() || PUBLIC.has(pathname)) return NextResponse.next();
  if (readSession(req.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();
  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Sign in to use the console API.", sign_in: "/sign-in" }, { status: 401 });
  // Next parses a proxy redirect's Location, so it must be absolute: build it from the host the browser
  // used (X-Forwarded-Host / Host), never from req.url, which is the bind address (http://0.0.0.0:3000).
  const path = pathname === "/" ? "/sign-in" : `/sign-in?next=${encodeURIComponent(pathname + search)}`;
  const origin = publicOrigin(req);
  if (!origin) return new NextResponse("Bad Host header", { status: 400 });
  return NextResponse.redirect(origin + path, 307);
}

// Everything except build assets and the public images the sign-in page itself needs.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.png|logo.png|.*\\.woff2$).*)"],
};
