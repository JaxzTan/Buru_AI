"use client";

import { useState } from "react";
import { Field, Top } from "@/components/app/primitives";
import { useToast } from "@/components/app/Toast";
import { Button, StatusBadge } from "@/components/ui";
import { MY_BANK } from "@/lib/mock";

type Rule = "mine" | "wallets" | "urls";

const PAYLOAD = `{
  "event": "entity.verified",
  "entity": {
    "type": "bank_account",
    "value": "562103841192",
    "bank": "MBB",
    "scam_types": ["job"],
    "confidence": "high",
    "first_seen": "2026-09-02T10:14:00Z"
  },
  "delivered_at": "2026-10-22T08:42:11Z"
}

X-Unknown-Signature: sha256=…`;

export default function WebhooksPage() {
  const toast = useToast();
  const [url, setUrl] = useState("https://fraud.example-bank.my/hooks/unknown");
  const [rules, setRules] = useState<Record<Rule, boolean>>({ mine: true, wallets: false, urls: false });
  const [log, setLog] = useState([
    { at: "22 Oct 08:42", ev: "entity.verified", ent: "5621 0384 1192", code: 200, ms: 182 },
    { at: "21 Oct 16:03", ev: "entity.verified", ent: "8007 1233 4561", code: 200, ms: 205 },
    { at: "20 Oct 11:21", ev: "entity.verified", ent: "1140 2201 8837", code: 500, ms: 3012 },
    { at: "20 Oct 11:22", ev: "entity.verified", ent: "1140 2201 8837", code: 200, ms: 190 },
  ]);
  const tog = (k: Rule) => setRules({ ...rules, [k]: !rules[k] });
  const RULES: [Rule, string][] = [
    ["mine", `Mule accounts at my bank (${MY_BANK})`],
    ["wallets", "Any new scam wallet (TRON, ETH)"],
    ["urls", "Scam URLs impersonating banks"],
  ];

  return (
    <>
      <Top title="Webhooks" sub="Get a signed POST within 5 minutes when a new entity matches your watch rules." />
      <div className="split">
        <div className="uk-card">
          <div className="uk-card-hd">
            <h3>Endpoint</h3>
            <StatusBadge status="active" />
          </div>
          <div className="uk-card-bd col">
            <Field label="URL">
              <input className="uk-input" value={url} onChange={(e) => setUrl(e.target.value)} />
            </Field>
            <Field label="Signing secret">
              <div className="bar">
                <code className="inl">whsec_••••••••••••3f9a</code>
                <Button size="sm" variant="ghost" onClick={() => toast("Secret rotated — update your verifier")}>
                  Rotate
                </Button>
              </div>
            </Field>
            <Field label="Watch rules">
              <div className="col gap-2 p-0">
                {RULES.map(([k, label]) => (
                  <label key={k} className="chk">
                    <input type="checkbox" checked={rules[k]} onChange={() => tog(k)} />
                    {label}
                  </label>
                ))}
              </div>
            </Field>
            <div className="bar">
              <Button variant="primary" onClick={() => toast("Webhook settings saved")}>
                Save
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setLog([{ at: "now", ev: "test.ping", ent: "—", code: 200, ms: 164 }, ...log]);
                  toast("Test event delivered");
                }}
              >
                Send test event
              </Button>
            </div>
          </div>
        </div>
        <div className="uk-card">
          <div className="uk-card-hd">
            <h3>Payload</h3>
          </div>
          <pre className="uk-card-bd uk-mono m-0 overflow-auto bg-surface-sunken text-xs leading-[18px]">{PAYLOAD}</pre>
        </div>
      </div>
      <div className="col">
        <div className="sec">
          <h2>Delivery log</h2>
        </div>
        <div className="uk-table-wrap">
          <table className="uk-table">
            <thead>
              <tr>
                {["Time", "Event", "Entity", "Response", "Duration"].map((c) => (
                  <th key={c}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {log.map((l, i) => (
                <tr key={i}>
                  <td className="uk-mono uk-muted text-xs">{l.at}</td>
                  <td className="uk-mono">{l.ev}</td>
                  <td className="uk-mono">{l.ent}</td>
                  <td>
                    <StatusBadge status={l.code === 200 ? "active" : "banned"} label={l.code === 200 ? "200 OK" : l.code + " · retried"} />
                  </td>
                  <td className="uk-mono">{l.ms} ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
