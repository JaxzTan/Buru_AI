"use client";

import type { ReactNode } from "react";
import { Shell } from "@/components/app/Shell";
import { PLAYBOOKS } from "@/lib/mock";
import { useOps } from "./store";

export function OpsShell({ children }: { children: ReactNode }) {
  const { convos, entities, personas, accounts } = useOps();
  return (
    <Shell
      tag="ops"
      defaultTheme="dark"
      themeKey="uk-theme-operator"
      who="Signed in as operator · TOTP"
      items={[
        { label: "Overview", href: "/operator/overview" },
        { label: "Live chats", href: "/operator/live-chats", count: convos.filter((c) => c.status !== "closed").length },
        { label: "Verification", href: "/operator/verification", count: entities.filter((e) => e.status === "unverified").length },
        { label: "Personas", href: "/operator/personas", count: personas.length },
        { label: "Honeypot accounts", href: "/operator/honeypot-accounts", count: accounts.length },
        { label: "Playbooks", href: "/operator/playbooks", count: PLAYBOOKS.length },
        { label: "Entities", href: "/operator/entities" },
      ]}
    >
      {children}
    </Shell>
  );
}
