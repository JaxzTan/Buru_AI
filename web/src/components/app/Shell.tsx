"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { Button } from "@/components/ui";
import { ToastProvider } from "./Toast";

type Theme = "light" | "dark";

export interface NavItem {
  label: string;
  href: string;
  count?: number;
}

const THEME_EVENT = "uk-theme";

function subscribeTheme(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(THEME_EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(THEME_EVENT, cb);
  };
}

/** Theme persisted per surface in localStorage; server render uses the surface default. */
function useTheme(storageKey: string, def: Theme): [Theme, () => void] {
  const read = (): Theme => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved === "light" || saved === "dark") return saved;
    } catch {}
    return def;
  };
  const theme = useSyncExternalStore(subscribeTheme, read, () => def);
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);
  function toggle() {
    try {
      localStorage.setItem(storageKey, theme === "dark" ? "light" : "dark");
    } catch {}
    window.dispatchEvent(new Event(THEME_EVENT));
  }
  return [theme, toggle];
}

export interface ShellProps {
  items: NavItem[];
  defaultTheme: Theme;
  themeKey: string;
  who: string;
  tag?: string;
  children: ReactNode;
}

export function Shell({ items, defaultTheme, themeKey, who, tag, children }: ShellProps) {
  const pathname = usePathname();
  const [theme, toggle] = useTheme(themeKey, defaultTheme);
  return (
    <ToastProvider>
      <div className="shell" data-theme={theme}>
        <aside className="side">
          <div className="uk-wordmark">
            <i />
            unknown
            {tag ? <span className="uk-badge uk-badge-neutral">{tag}</span> : null}
          </div>
          <nav className="uk-nav" aria-label="Main">
            {items.map((it) => {
              const on = pathname === it.href || pathname.startsWith(it.href + "/");
              return (
                <Link key={it.href} href={it.href} className={on ? "on" : ""} aria-current={on ? "page" : undefined}>
                  {it.label}
                  {it.count != null ? <span className="n">{it.count}</span> : null}
                </Link>
              );
            })}
          </nav>
          <div className="side-ft">
            <span>{who}</span>
            <Button size="sm" variant="secondary" onClick={toggle}>
              {theme === "dark" ? "Light theme" : "Dark theme"}
            </Button>
          </div>
        </aside>
        <main className="main">{children}</main>
      </div>
    </ToastProvider>
  );
}
