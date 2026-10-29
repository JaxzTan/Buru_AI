"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useStore } from "./store";

// Web chat, demo path bar, reset and "simulate" controls. On unless set to "false" (spec D2).
export const DEV_CHAT = process.env.NEXT_PUBLIC_DEV_CHAT !== "false";

// View state in the URL (spec §4.2). replace, not push, so Back doesn't step through every filter click.
export function useQuery() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const get = useCallback((k: string, def = "") => sp.get(k) ?? def, [sp]);
  const set = useCallback(
    (patch: Record<string, string | null>, path = pathname) => {
      const p = new URLSearchParams(sp.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === "") p.delete(k);
        else p.set(k, v);
      }
      const q = p.toString();
      router.replace(q ? `${path}?${q}` : path, { scroll: false });
    },
    [sp, router, pathname],
  );
  return { get, set };
}

// "updated 3 s ago" text for live views.
export function useAgo() {
  const { lastSync } = useStore().ui;
  const [now, setNow] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!now || !lastSync) return "just now";
  // Pretend a 3 s poll: never older than 10 s while the page is open.
  const s = Math.max(1, Math.round((now - lastSync) / 1000) % 10);
  return `${s} s ago`;
}

// Keep a chat scrolled to the newest message.
export function useStickToBottom(dep: unknown) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [dep]);
  return ref;
}
