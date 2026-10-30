"use client";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Spin } from "@/components/ui";

const ERRORS: Record<string, string> = {
  wrong: "That username and password don't match. Try again.",
  setup: "Sign-in isn't set up on this server. Set SOCKABUS_CONSOLE_USER and SOCKABUS_CONSOLE_PASSWORD.",
};

export function SignInView() {
  const sp = useSearchParams();
  const error = ERRORS[sp.get("error") ?? ""];
  const [busy, setBusy] = useState(false);
  return (
    <div className="signin">
      <aside className="signin-side">
        <div className="brand">
          <Image src="/logo.png" alt="" width={52} height={34} priority />
          <div>
            <b>Sockabus</b>
            <i />
          </div>
        </div>
        <div className="signin-pitch">
          <Image src="/logo.png" alt="Sockabus mascot" width={240} height={158} className="signin-mascot" />
          <h1>The operator console for a scam honeypot.</h1>
          <ul>
            <li>AI personas chat with scammers and capture the accounts they share.</li>
            <li>A human verifies every account before any bank sees it.</li>
            <li>Banks look it up before a transfer leaves.</li>
          </ul>
        </div>
        <small>Sockabus Console · demo build</small>
      </aside>
      <main className="signin-main">
        {/* Plain form POST: credentials are checked on the server, which sets an httpOnly cookie. */}
        <form className="card signin-card" method="post" action="/api/auth/sign-in" onSubmit={() => setBusy(true)}>
          <h2>Sign in</h2>
          <p className="muted">Operators only.</p>
          {error && (
            <div className="banner err" role="alert" data-testid="signin-error">
              <div className="txt">
                <p>{error}</p>
              </div>
            </div>
          )}
          <input type="hidden" name="next" value={sp.get("next") ?? ""} />
          <div className="field">
            <label htmlFor="signin-user">Work email / username</label>
            <input
              className="input"
              id="signin-user"
              name="user"
              autoComplete="username"
              placeholder="you@sockabus.my"
              required
              autoFocus
              data-testid="signin-user"
            />
          </div>
          <div className="field">
            <label htmlFor="signin-password">Password</label>
            <input className="input" id="signin-password" name="password" type="password" autoComplete="current-password" required data-testid="signin-password" />
          </div>
          <button className="btn btn-primary" disabled={busy} data-testid="signin-submit">
            {busy ? <Spin /> : null}
            Sign in →
          </button>
          <p className="muted" style={{ margin: 0, fontSize: 15 }}>
            Forgot your password? Ask an admin.
          </p>
        </form>
      </main>
    </div>
  );
}
