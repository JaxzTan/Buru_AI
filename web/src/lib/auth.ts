// Console sign-in (server only: imported by src/proxy.ts and the /api/auth routes, never by the browser).
// One operator login from SOCKABUS_CONSOLE_USER / SOCKABUS_CONSOLE_PASSWORD. The session cookie is
// "<user>.<expiry ms>.<HMAC>", httpOnly, signed with a key derived from the password, so changing the
// password signs everyone out. SOCKABUS_CONSOLE_AUTH=off turns the gate off (local development only).
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

export const SESSION_COOKIE = "sockabus_session";
export const SESSION_MAX_AGE = 12 * 60 * 60; // seconds

const user = () => process.env.SOCKABUS_CONSOLE_USER ?? "";
const password = () => process.env.SOCKABUS_CONSOLE_PASSWORD ?? "";

export const authOff = () => ["off", "false", "0"].includes((process.env.SOCKABUS_CONSOLE_AUTH ?? "").toLowerCase());
export const authConfigured = () => user() !== "" && password() !== "";

const sha = (s: string) => createHash("sha256").update(s).digest();
// Compare hashes so the time taken doesn't depend on where the strings differ.
const same = (a: string, b: string) => timingSafeEqual(sha(a), sha(b));
const sign = (payload: string) => createHmac("sha256", sha("sockabus-console:" + password())).update(payload).digest("base64url");

export function checkLogin(u: string, p: string): boolean {
  if (!authConfigured()) return false;
  // Evaluate both, so a wrong username takes as long as a wrong password.
  const okUser = same(u.trim().toLowerCase(), user().trim().toLowerCase());
  const okPass = same(p, password());
  return okUser && okPass;
}

export function makeSession(u: string): string {
  const payload = `${Buffer.from(u).toString("base64url")}.${Date.now() + SESSION_MAX_AGE * 1000}`;
  return `${payload}.${sign(payload)}`;
}

// The signed-in username, or null when the cookie is missing, forged, expired or for another user.
export function readSession(cookie: string | undefined): string | null {
  if (!cookie || !authConfigured()) return null;
  const parts = cookie.split(".");
  if (parts.length !== 3) return null;
  const [u64, exp, mac] = parts;
  if (!same(mac, sign(`${u64}.${exp}`))) return null;
  if (!(Number(exp) > Date.now())) return null;
  const u = Buffer.from(u64, "base64url").toString();
  return same(u.trim().toLowerCase(), user().trim().toLowerCase()) ? u : null;
}

// Only a same-site path after sign-in, never "//evil.example", "/\\evil.example" or a full URL. Browsers drop
// tabs and newlines inside URLs ("/\t/evil" becomes "//evil"), so any control character, space or
// backslash is refused outright. Anything else falls back to "/".
export function safeNext(n: string | null | undefined): string {
  if (!n || !n.startsWith("/") || n.startsWith("//") || /[\u0000-\u0020\u007f\\]/.test(n)) return "/";
  try {
    const u = new URL(n, "http://sockabus.invalid");
    if (u.origin !== "http://sockabus.invalid") return "/";
    return u.pathname + u.search + u.hash;
  } catch {
    return "/";
  }
}

// Redirect with a relative Location ("/verify", "/sign-in?next=…"). Never built from request.url: in the
// standalone server that is the bind address (http://0.0.0.0:3000), which the browser can't open.
export function redirectTo(path: string, status: 303 | 307 = 307): NextResponse {
  return new NextResponse(null, { status, headers: { Location: path, "Cache-Control": "no-store" } });
}

// The origin the browser used, from X-Forwarded-Host (Caddy) or Host, never request.url's host (the bind
// address). Needed where Next requires an absolute redirect: Location headers returned from proxy.ts
// are parsed with new URL(), so a relative path throws there. Odd-looking hosts are refused.
const HOST = /^[a-z0-9.-]+(:\d{1,5})?$|^\[[0-9a-f:.]+\](:\d{1,5})?$/i;
export function publicOrigin(req: Request): string | null {
  const first = (h: string | null) => h?.split(",")[0]?.trim() ?? "";
  const host = first(req.headers.get("x-forwarded-host")) || first(req.headers.get("host"));
  if (!host || !HOST.test(host)) return null;
  return `${isHttps(req) ? "https" : "http"}://${host}`;
}

// HTTPS as the browser sees it: behind Caddy the app itself only gets plain HTTP.
export function isHttps(req: Request): boolean {
  const fwd = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
  return fwd ? fwd === "https" : new URL(req.url).protocol === "https:";
}

export const cookieOptions = (secure: boolean) => ({ httpOnly: true, sameSite: "lax" as const, secure, path: "/", maxAge: SESSION_MAX_AGE });
