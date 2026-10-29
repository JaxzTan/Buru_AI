"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, type ReactNode } from "react";
import { DEV_CHAT, useAgo } from "@/lib/hooks";
import { Loading } from "@/components/ui";
import { demoSteps, dismissToast, flushDecisions, liveConvos, queueOf, refresh, resetDemo, startSync, useStore } from "@/lib/store";

const OPERATE = [
  { href: "/personas", label: "Personas", id: "personas" },
  { href: "/conversations", label: "Conversations", id: "conversations" },
  { href: "/verify", label: "Verify queue", id: "verify" },
  { href: "/entities", label: "Entities", id: "entities" },
  { href: "/status", label: "Status", id: "status" },
];
const DEMO = [
  { href: "/demo/bank", label: "Bank simulator", id: "bank" },
  ...(DEV_CHAT ? [{ href: "/demo/chat", label: "Web chat", id: "webchat" }] : []),
];

export function Shell({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="app">
        <Rail />
        <div className="work">
          {DEV_CHAT && <DemoPath />}
          <main id="main" tabIndex={-1}>
            <Gate>{children}</Gate>
          </main>
        </div>
      </div>
      <Toasts />
      <Suspense fallback={null}>
        <FlushOnNavigate />
      </Suspense>
    </>
  );
}

// API mode: poll the Go API, and show loading / error until the first answer arrives.
function Gate({ children }: { children: ReactNode }) {
  const { loaded, loadError } = useStore().ui;
  useEffect(startSync, []);
  if (!loaded && !loadError) return <Loading />;
  if (!loaded)
    return (
      <div className="banner err" role="alert" data-testid="api-error">
        <div className="txt">
          <h3>Can&apos;t load data from Sockabus</h3>
          <p>{loadError}</p>
        </div>
        <div className="acts">
          <button className="btn btn-primary" onClick={() => void refresh()}>
            Try again
          </button>
        </div>
      </div>
    );
  return (
    <>
      {loadError && (
        <div className="banner err" role="alert" data-testid="api-error">
          <div className="txt">
            <h3>Connection lost — showing the last data received</h3>
            <p>{loadError} Retrying every 3 s.</p>
          </div>
        </div>
      )}
      {children}
    </>
  );
}

// Leaving a page sends any Verify/Reject still inside its Undo window (spec §4.5).
function FlushOnNavigate() {
  const path = usePathname();
  useEffect(() => flushDecisions(), [path]);
  return null;
}

type NavItem = (typeof OPERATE)[number];

// usePathname is runtime data, so the active highlight streams in behind Suspense.
function NavLinks({ items, counts }: { items: NavItem[]; counts: Record<string, number> }) {
  return <Links items={items} counts={counts} path={usePathname()} />;
}

function Links({ items, counts, path }: { items: NavItem[]; counts: Record<string, number>; path?: string }) {
  return (
    <nav className="nav">
      {items.map((n) => (
        <Link key={n.id} href={n.href} data-testid={`nav-${n.id}`} aria-current={path?.startsWith(n.href) ? "page" : undefined}>
          <span>{n.label}</span>
          {counts[n.id] ? <span className="count">{counts[n.id]}</span> : null}
        </Link>
      ))}
    </nav>
  );
}

function Nav({ items, counts }: { items: NavItem[]; counts: Record<string, number> }) {
  return (
    <Suspense fallback={<Links items={items} counts={counts} />}>
      <NavLinks items={items} counts={counts} />
    </Suspense>
  );
}

function Rail() {
  const { data } = useStore();
  const ago = useAgo();
  const counts: Record<string, number> = { conversations: liveConvos(data).length, verify: queueOf(data).length };
  const ok = data.telegram;
  return (
    <aside className="rail" aria-label="Sockabus navigation">
      <div className="brand">
        <Image src="/logo.png" alt="Sockabus mascot" width={52} height={34} priority />
        <div>
          <b>Sockabus</b>
          <i />
        </div>
      </div>
      <div className="group caps">Operate</div>
      <Nav items={OPERATE} counts={counts} />
      <div className="group caps">Demo</div>
      <Nav items={DEMO} counts={counts} />
      <div className="spacer" />
      <div className="sys" data-testid="sidebar-status">
        <div className="row">
          <span className="dot" style={{ color: ok ? "var(--green)" : "var(--red)" }} />
          {ok ? "All systems normal" : "Telegram disconnected"}
        </div>
        <small>{ok ? `Telegram connected · last message ${ago}` : "Alert sent to team · use Web chat"}</small>
      </div>
      <div className="who">Signed in as operator</div>
      {DEV_CHAT && (
        <div>
          <button className="reset" type="button" onClick={resetDemo} data-testid="reset-demo">
            Reset demo data
          </button>
        </div>
      )}
    </aside>
  );
}

function DemoPath() {
  const { data } = useStore();
  const steps = demoSteps(data);
  const i = steps.findIndex((s) => !s.done);
  return (
    <div className="path" aria-label="Demo path">
      <span className="caps muted">Demo path</span>
      <ol>
        {steps.map((s, k) => (
          <li key={s.label} className={s.done ? "done" : k === i ? "now" : ""}>
            <b>{s.done ? "✓" : k + 1}</b>
            {s.label}
          </li>
        ))}
      </ol>
      <div className="next">
        {i === -1 ? (
          <span className="badge t-success">Demo path complete</span>
        ) : (
          <>
            <span className="muted">Next:</span>{" "}
            <Link className="btn btn-primary btn-sm" href={steps[i].href} data-testid="demo-next">
              {steps[i].label} →
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

function Toasts() {
  const { toasts } = useStore().ui;
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className="toast" data-testid="verify-toast" role={t.error ? "alert" : undefined}>
          {t.error ? <span className="err">!</span> : <span className="ok">✓</span>}
          <span>{t.msg}</span>
          {t.href ? (
            <Link href={t.href} onClick={() => dismissToast(t.id)} style={{ color: "var(--mustard)", fontWeight: 700, textDecoration: "none" }}>
              {t.label}
            </Link>
          ) : t.run ? (
            <button
              type="button"
              data-testid={t.testId}
              onClick={() => {
                t.run?.();
                dismissToast(t.id);
              }}
            >
              {t.label}
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}
