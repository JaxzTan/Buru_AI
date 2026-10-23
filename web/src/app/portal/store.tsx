"use client";

// Customer portal state. Mock-backed; replace with GET /v1/usage.
import { createContext, useContext, useState, type ReactNode } from "react";
import { DAYS } from "@/lib/mock";

const Ctx = createContext<{ lookups: number; bump: () => void } | null>(null);

export function usePortal() {
  const s = useContext(Ctx);
  if (!s) throw new Error("usePortal must be used inside <PortalProvider>");
  return s;
}

export function PortalProvider({ children }: { children: ReactNode }) {
  const [lookups, setLookups] = useState(() => DAYS.reduce((s, d) => s + d.v, 0));
  return <Ctx.Provider value={{ lookups, bump: () => setLookups((x) => x + 1) }}>{children}</Ctx.Provider>;
}
