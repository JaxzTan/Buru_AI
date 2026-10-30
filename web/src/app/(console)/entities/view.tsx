"use client";
import Link from "next/link";
import { useState } from "react";
import { Badge, Chip, Head } from "@/components/ui";
import { digits, showVal, typeLabel } from "@/lib/format";
import { useQuery } from "@/lib/hooks";
import { useStore } from "@/lib/store";

const TYPES: [string, string][] = [
  ["all", "All types"],
  ["bank_account", "Bank account"],
  ["wallet", "Wallet"],
  ["phone", "Phone"],
  ["url", "URL"],
  ["handle", "Handle"],
];
const STATUSES: [string, string][] = [
  ["all", "All statuses"],
  ["unverified", "Unverified"],
  ["verified", "Verified"],
  ["rejected", "Rejected"],
];

export function EntitiesView() {
  const { data } = useStore();
  const q = useQuery();
  const type = q.get("type", "all");
  const status = q.get("status", "all");
  // Local copy so typing stays smooth; the URL follows it.
  const [search, setSearch] = useState(q.get("q"));
  const s = search.trim().toLowerCase();
  const sd = digits(s);

  const list = data.entities.filter(
    (e) =>
      (type === "all" || e.type === type) &&
      (status === "all" || e.status === status) &&
      (!s || `${e.value} ${e.scam} ${e.bank}`.toLowerCase().includes(s) || (sd.length > 2 && digits(e.value).includes(sd))),
  );
  const live = data.entities.filter((e) => !e.sample).length;

  return (
    <>
      <Head title="Entities" sub="Every scam account, wallet, number and link we have captured. Each one traces back to its chat." />
      <div className="row-gap" style={{ gap: 10 }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <input
            className="input"
            type="search"
            placeholder="Search account, wallet, phone, URL…"
            value={search}
            onChange={(ev) => {
              setSearch(ev.target.value);
              q.set({ q: ev.target.value });
            }}
            aria-label="Search entities"
          />
        </div>
        <select className="input" style={{ width: "auto" }} value={type} onChange={(ev) => q.set({ type: ev.target.value })} data-testid="entity-filter-type" aria-label="Type">
          {TYPES.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <select className="input" style={{ width: "auto" }} value={status} onChange={(ev) => q.set({ status: ev.target.value })} data-testid="entity-filter-status" aria-label="Status">
          {STATUSES.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </div>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Type</th>
              <th>Value</th>
              <th>Scam type</th>
              <th>Confidence</th>
              <th>Status</th>
              <th>Sightings</th>
              <th>First seen</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {list.length ? (
              list.map((e) => (
                <tr key={e.id} className={e.status === "verified" && !e.sample ? "hl-green" : ""} data-testid="entity-row">
                  <td className="caps muted">{typeLabel(e)}</td>
                  <td>
                    <div className="row-gap">
                      <span className="mono">{showVal(e)}</span>
                      <Badge word={e.sample ? "sample" : "live"} />
                    </div>
                  </td>
                  <td>
                    <Chip>{e.scam}</Chip>
                  </td>
                  <td>
                    <Badge word={e.conf} />
                  </td>
                  <td data-testid="entity-status">
                    <Badge word={e.status} />
                  </td>
                  <td className="mono">
                    <b>{e.sightings}</b>
                  </td>
                  <td className="muted">{e.first}</td>
                  <td className="right">
                    {e.convoId ? (
                      <Link className="btn btn-quiet btn-sm" href={`/conversations/${e.convoId}`}>
                        View chat →
                      </Link>
                    ) : (
                      <span className="muted" style={{ fontSize: 15 }}>
                        {e.sample ? "Seed data" : "No chat linked"}
                      </span>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8}>
                  <div className="empty">
                    <b>No entities match</b>
                    <span>Try another type or status.</span>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        setSearch("");
                        q.set({ type: null, status: null, q: null });
                      }}
                    >
                      Clear filters
                    </button>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="foot-note">
        {list.length} shown · {live} live from chats, {data.entities.length - live} labelled <b>sample</b> (seed data, never real people). Trend chart and CSV
        export come after v1.0.
      </p>
    </>
  );
}
