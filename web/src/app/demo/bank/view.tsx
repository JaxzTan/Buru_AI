"use client";
import { useRef, useState, type ReactNode } from "react";
import { Badge, Head, Spin } from "@/components/ui";
import { BANKS, digits, plural } from "@/lib/format";
import { cancelTransfer, clearLookup, fillBank, runLookup, setBankDraft, useStore } from "@/lib/store";
import type { Confidence } from "@/lib/types";

export function BankView() {
  const { data, ui } = useStore();
  const [err, setErr] = useState(false);
  const acctRef = useRef<HTMLInputElement>(null);
  const d = data.bank;
  const L = data.lastLookup;
  const e = L?.entityId ? data.entities.find((x) => x.id === L.entityId) : undefined;
  const captured = data.entities.filter((x) => x.type === "bank_account" && !x.sample).at(-1);

  const edit = () => {
    clearLookup();
    acctRef.current?.focus();
  };

  let result: ReactNode = null;
  if (ui.checking) {
    result = (
      <div className="result" style={{ borderColor: "var(--line)", background: "var(--paper)" }}>
        <div className="rh">
          <Spin />
          <b>Checking recipient with Sockabus…</b>
        </div>
      </div>
    );
  } else if (L?.result === "held" && e) {
    result = (
      <div className="result held" data-testid="result-held" role="alert">
        <div className="rh">
          <span className="ic">!</span>
          <div>
            <h2>Transfer held</h2>
            <p>
              This account is linked to a <b>{e.scam}</b> scam. Your RM {L.amt} has not left your account.
            </p>
          </div>
        </div>
        <div className="reasons">
          <div>
            <span className="caps muted">Confidence</span>
            <b>{confLabel(L.res.confidence)}</b>
          </div>
          <div>
            <span className="caps muted">Scam type</span>
            <b style={{ textTransform: "capitalize" }}>{e.scam}</b>
          </div>
          <div>
            <span className="caps muted">Seen</span>
            <b>{plural(e.sightings, "time")}</b>
          </div>
          <div>
            <span className="caps muted">First seen</span>
            <b>{e.first}</b>
          </div>
          <div>
            <span className="caps muted">Checked in</span>
            <b className="mono">{L.ms} ms</b>
          </div>
        </div>
        <div className="row-gap">
          <button className="btn btn-secondary" onClick={edit}>
            Edit recipient
          </button>
          <button className="btn btn-danger" onClick={cancelTransfer}>
            Cancel transfer
          </button>
        </div>
      </div>
    );
  } else if (L) {
    result = (
      <div className="result sent" data-testid="result-sent" role="status">
        <div className="rh">
          <span className="ic">✓</span>
          <div>
            <h2>Transfer sent</h2>
            <p>
              No scam record for this recipient. Checked in <span className="mono">{L.ms} ms</span>, so the customer felt no delay.
            </p>
          </div>
        </div>
        <div className="row-gap">
          <button className="btn btn-secondary" onClick={edit}>
            New transfer
          </button>
        </div>
      </div>
    );
  }

  const steps: [string, string][] = !L
    ? [
        ["DemoBank asks Sockabus", "POST /v1/lookup with bank + account number"],
        ["Sockabus checks verified intelligence", "Only human-verified accounts return high confidence"],
        ["DemoBank decides", "Hold or send — in well under a second"],
      ]
    : L.result === "held"
      ? [
          ["DemoBank asked Sockabus", `POST /v1/lookup · bank account · ${L.bank}`],
          L.res.confidence === "high"
            ? ["Sockabus found a verified record", "Captured from a scammer chat, confirmed by an operator"]
            : ["Sockabus found a record", "Captured from a scammer chat, not yet confirmed by an operator"],
          ["DemoBank held the transfer", `Answer in ${L.ms} ms, inside the payment window`],
        ]
      : [
          ["DemoBank asked Sockabus", `POST /v1/lookup · bank account · ${L.bank}`],
          ["No record in Sockabus intelligence", "Never seen in a scammer conversation"],
          ["DemoBank sent the money", `Answer in ${L.ms} ms, no friction for good customers`],
        ];

  return (
    <>
      <Head title="Bank simulator" sub="A pretend bank. Its fraud check calls the real Sockabus lookup before money leaves." right={<Badge word="Demo only · not a real bank" tone="neutral" />} />
      <div className="bankgrid">
        <section className="card bank" aria-label="DemoBank transfer">
          <div className="bank-h">
            <span className="sq">DB</span>
            <b>DemoBank · Online transfer</b>
            <small className="mono">Savings ••• 4410</small>
          </div>
          <form
            noValidate
            onSubmit={(ev) => {
              ev.preventDefault();
              if (digits(d.acct).length < 10) {
                setErr(true);
                acctRef.current?.focus();
                return;
              }
              setErr(false);
              runLookup();
            }}
          >
            <div className="field">
              <label htmlFor="bank-select">Recipient bank</label>
              <select
                className="input"
                id="bank-select"
                value={d.bank}
                onChange={(ev) => {
                  setBankDraft({ bank: ev.target.value });
                  clearLookup();
                }}
                data-testid="bank-select"
              >
                {Object.entries(BANKS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v} ({k})
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="account-input">Account number</label>
              <input
                ref={acctRef}
                className="input mono"
                id="account-input"
                inputMode="numeric"
                autoComplete="off"
                placeholder="e.g. 5621 0384 11"
                value={d.acct}
                onChange={(ev) => setBankDraft({ acct: ev.target.value })}
                data-testid="account-input"
                required
              />
            </div>
            <div className="quick">
              <span>Quick fill:</span>
              {captured && (
                <button type="button" onClick={() => fillBank(captured.bank, captured.value)}>
                  Account captured from chat
                </button>
              )}
              <button type="button" onClick={() => fillBank("CIMB", "800122334455")}>
                Known loan-scam account
              </button>
              <button type="button" onClick={() => fillBank("MBB", "114022018837")}>
                Clean account
              </button>
            </div>
            <div className="field">
              <label htmlFor="amount-input">Amount (RM)</label>
              <input
                className="input mono"
                id="amount-input"
                inputMode="decimal"
                value={d.amt}
                onChange={(ev) => setBankDraft({ amt: ev.target.value })}
                onBlur={(ev) => {
                  const v = parseFloat(ev.target.value.replace(/[^\d.]/g, ""));
                  setBankDraft({ amt: isNaN(v) ? "0.00" : v.toFixed(2) });
                }}
                data-testid="amount-input"
              />
            </div>
            <button className="btn btn-primary" disabled={ui.checking} data-testid="transfer-btn">
              Transfer RM {d.amt || "0.00"}
            </button>
            <p className="muted" style={{ margin: 0, fontSize: 15, color: err ? "var(--red)" : undefined }} role={err ? "alert" : undefined}>
              {err ? "Enter the full account number (at least 10 digits)." : "Before sending, DemoBank asks Sockabus: is this recipient linked to a scam?"}
            </p>
          </form>
          {result}
        </section>
        <aside className="bts" aria-label="Behind the scenes">
          <span className="caps">Behind the scenes</span>
          <h2>{L ? "What just happened, in 3 steps" : "What happens when you press Transfer"}</h2>
          <ol>
            {steps.map(([a, b], i) => (
              <li key={a} className={L ? "" : "off"}>
                <b className="n">{i + 1}</b>
                <span>
                  <b>{a}</b>
                  <small>{b}</small>
                </span>
              </li>
            ))}
          </ol>
          <pre aria-label="Lookup response">{L ? <Json value={L.res} /> : "// press Transfer to see the response"}</pre>
          <p className="fine">The lookup token stays on our server. The browser never calls /v1/lookup directly.</p>
        </aside>
      </div>
    </>
  );
}

// Held banner shows the confidence the API returned. Only a human sets high.
function confLabel(c?: Confidence) {
  if (c === "high") return "High · human-verified";
  if (c === "medium") return "Medium · not yet verified";
  return "Low · not yet verified";
}

// Pretty JSON with the deciding fields picked out in mustard.
function Json({ value }: { value: unknown }) {
  const text = JSON.stringify(value, null, 2);
  const parts = text.split(/("match": true|"confidence": "high")/);
  return (
    <>
      {parts.map((p, i) =>
        i % 2 ? (
          <span key={i} className="k">
            {p}
          </span>
        ) : (
          p
        ),
      )}
    </>
  );
}
