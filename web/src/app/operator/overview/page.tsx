"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { HBars, BarChart } from "@/components/app/charts";
import { Empty, Top } from "@/components/app/primitives";
import { Button, ConversationThread, EntityTable, StatTile, StatusBadge } from "@/components/ui";
import { WEEKS } from "@/lib/mock";
import type { AccountStatus } from "@/lib/types";
import { personaName, useOps } from "../store";

export default function OverviewPage() {
  const router = useRouter();
  const { entities, convos, personas, accounts, decide, toggle } = useOps();
  const pending = entities.filter((r) => r.status === "unverified");
  const c = convos[0];
  const health: AccountStatus[] = ["active", "cooldown", "banned"];

  return (
    <>
      <Top
        over="Thu 22 Oct 2026"
        title="Overview"
        actions={
          <>
            <Button variant="secondary" onClick={() => router.push("/operator/honeypot-accounts")}>
              Bind account
            </Button>
            <Button variant="primary" onClick={() => router.push("/operator/personas")}>
              New persona
            </Button>
          </>
        }
      />
      <div className="stats">
        <StatTile label="Live conversations" value="23" detail="of 1,000 capacity" progress={2.3} />
        <StatTile label="Reached payment stage" value="43%" detail="target 40%" progress={43} />
        <StatTile label="Entities this month" value="1,284" delta="+18%" detail="vs Sep" />
        <StatTile
          label="Accounts banned (7d)"
          value={String(accounts.filter((a) => a.status === "banned").length)}
          detail={"pool of " + accounts.length}
        />
      </div>
      <div className="col">
        <div className="sec">
          <h2>Verification queue</h2>
          <Link href="/operator/verification" className="uk-badge uk-badge-signal no-underline">
            {pending.length} pending
          </Link>
        </div>
        {pending.length ? (
          <EntityTable rows={pending.slice(0, 4)} onVerify={decide("verified")} onReject={decide("rejected")} />
        ) : (
          <Empty>Queue clear.</Empty>
        )}
      </div>
      <div className="split">
        <div className="col">
          <div className="sec">
            <h2>Needs attention</h2>
            <Link href="/operator/live-chats" className="uk-muted text-xs">
              All live chats
            </Link>
          </div>
          <ConversationThread
            title={c.scammer + " → " + personaName(personas, c.persona)}
            status={c.status}
            stage={c.stage}
            messages={c.msgs.slice(-4)}
            onTakeover={() => toggle(c.id)}
          />
        </div>
        <div className="col">
          <div className="sec">
            <h2>Weekly entities extracted</h2>
          </div>
          <div className="uk-card uk-card-bd">
            <BarChart data={WEEKS} label="Entities extracted per week" unit="entities" />
          </div>
          <div className="sec">
            <h2>Account health</h2>
          </div>
          <div className="uk-card uk-card-bd">
            <HBars
              rows={health.map((s) => ({
                k: s,
                label: <StatusBadge status={s} />,
                v: accounts.filter((a) => a.status === s).length,
              }))}
            />
          </div>
        </div>
      </div>
    </>
  );
}
