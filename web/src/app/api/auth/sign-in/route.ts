// POST from the /sign-in form (plain HTML form, works without JavaScript). 303 back to the page asked
// for, or to /sign-in with an error code. Credentials are checked here, on the server.
// Redirects are relative paths, never built from req.url (that is the server's bind address).
import { authConfigured, checkLogin, cookieOptions, isHttps, makeSession, redirectTo, safeNext, SESSION_COOKIE } from "@/lib/auth";

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const user = String(form?.get("user") ?? "");
  const pass = String(form?.get("password") ?? "");
  const next = safeNext(String(form?.get("next") ?? ""));
  const back = (error: string) => {
    const q = new URLSearchParams({ error });
    if (next !== "/") q.set("next", next);
    return redirectTo(`/sign-in?${q}`, 303);
  };
  if (!authConfigured()) return back("setup");
  if (!checkLogin(user, pass)) return back("wrong");
  const res = redirectTo(next, 303);
  res.cookies.set(SESSION_COOKIE, makeSession(user.trim()), cookieOptions(isHttps(req)));
  return res;
}
