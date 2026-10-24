"use client";

import { useState } from "react";
import { Field, Modal, Select, Tabs, Top } from "@/components/app/primitives";
import { useToast } from "@/components/app/Toast";
import { Button, StatTile, StatusBadge } from "@/components/ui";
import type { AccountStatus, Channel } from "@/lib/types";
import { personaName, useOps } from "../store";

type Filter = "all" | AccountStatus;

export default function HoneypotAccountsPage() {
  const { accounts, personas, setAcc, removeAcc, addAcc } = useOps();
  const toast = useToast();
  const [tab, setTab] = useState<Filter>("all");
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<{ channel: Channel; handle: string; persona: string }>({ channel: "TG", handle: "", persona: personas[0].id });

  const rows = accounts.filter((a) => tab === "all" || a.status === tab);
  const cnt = (s: Filter) => accounts.filter((a) => s === "all" || a.status === s).length;
  const close = () => setOpen(false);

  return (
    <>
      <Top
        title="Honeypot accounts"
        sub="Telegram and WhatsApp accounts the personas speak through. Banned accounts rotate out automatically."
        actions={
          <Button variant="primary" onClick={() => setOpen(true)}>
            Bind account
          </Button>
        }
      />
      <div className="stats">
        <StatTile label="Active" value={String(cnt("active"))} detail="receiving messages" />
        <StatTile label="Cooldown" value={String(cnt("cooldown"))} detail="resting 24–72 h" />
        <StatTile
          label="Banned (30d)"
          value={String(cnt("banned"))}
          detail={"ban rate " + Math.round((cnt("banned") / Math.max(1, cnt("all"))) * 100) + "%"}
        />
        <StatTile label="Avg account age" value="21 d" detail="before ban or rotation" />
      </div>
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={(["all", "active", "cooldown", "banned"] as Filter[]).map((s) => ({
          id: s,
          label: s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1),
          count: cnt(s),
        }))}
      />
      <div className="uk-table-wrap">
        <table className="uk-table">
          <thead>
            <tr>
              {["Account", "Persona", "Status", "Live chats", "Last message", "Age", ""].map((c, i) => (
                <th key={i}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id}>
                <td>
                  <span className="bar">
                    <span className="uk-badge uk-badge-neutral">{a.channel}</span>
                    <span className="uk-mono">{a.handle}</span>
                  </span>
                </td>
                <td>{personaName(personas, a.persona)}</td>
                <td>
                  <StatusBadge status={a.status} />
                </td>
                <td className="uk-mono">{a.chats}</td>
                <td className="uk-muted text-xs">{a.last}</td>
                <td className="uk-mono uk-muted text-xs">{a.age}</td>
                <td>
                  <div className="uk-actions">
                    {a.status === "active" ? (
                      <Button size="sm" variant="ghost" onClick={() => setAcc(a.id, "cooldown")}>
                        Cool down
                      </Button>
                    ) : null}
                    {a.status === "cooldown" ? (
                      <Button size="sm" variant="secondary" onClick={() => setAcc(a.id, "active")}>
                        Reactivate
                      </Button>
                    ) : null}
                    {a.status === "banned" ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          removeAcc(a.id);
                          toast("Removed from pool");
                        }}
                      >
                        Remove
                      </Button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {open ? (
        <Modal
          title="Bind honeypot account"
          onClose={close}
          footer={
            <>
              <Button variant="ghost" onClick={close}>
                Cancel
              </Button>
              <Button
                variant="primary"
                disabled={!f.handle.trim()}
                onClick={() => {
                  addAcc(f);
                  setOpen(false);
                  toast("Account bound — routing within 5 s");
                }}
              >
                Bind
              </Button>
            </>
          }
        >
          <div className="row2">
            <Field label="Channel">
              <Select
                label="Channel"
                value={f.channel}
                onChange={(v) => setF({ ...f, channel: v })}
                options={[
                  ["TG", "Telegram"],
                  ["WA", "WhatsApp"],
                ]}
              />
            </Field>
            <Field label="Persona">
              <Select
                label="Persona"
                value={f.persona}
                onChange={(v) => setF({ ...f, persona: v })}
                options={personas.map((x) => [x.id, x.name] as [string, string])}
              />
            </Field>
          </div>
          <Field label={f.channel === "TG" ? "Username or phone" : "Phone number"}>
            <input
              className="uk-input"
              value={f.handle}
              onChange={(e) => setF({ ...f, handle: e.target.value })}
              placeholder={f.channel === "TG" ? "@lin_auntie" : "+60 12-345 6789"}
            />
          </Field>
          <p className="uk-muted m-0 text-xs">
            You’ll scan a login code on the next step. Session secrets are stored in the secret manager, never in the database.
          </p>
        </Modal>
      ) : null}
    </>
  );
}
