"use client";

import { useState } from "react";
import { Top } from "@/components/app/primitives";
import { PLAYBOOKS, SCAM_LABEL } from "@/lib/mock";
import type { ScamType } from "@/lib/types";

export default function PlaybooksPage() {
  const [sel, setSel] = useState<ScamType>("job");
  const pb = PLAYBOOKS.find((x) => x.id === sel) ?? PLAYBOOKS[0];

  return (
    <>
      <Top title="Playbooks" sub="One stage machine per scam type: rapport → bait → payment request → stall." />
      <div className="pb">
        <div className="pb-list">
          {PLAYBOOKS.map((x) => (
            <button key={x.id} type="button" className={x.id === sel ? "on" : ""} onClick={() => setSel(x.id)}>
              {SCAM_LABEL[x.id]}
              <span className="uk-mono uk-muted text-xs">{x.reach[2]}%</span>
            </button>
          ))}
        </div>
        <div className="col">
          <div className="uk-card">
            <div className="uk-card-hd">
              <h3>Stage reach — {SCAM_LABEL[sel]}</h3>
              <span className="uk-muted text-xs">% of conversations reaching each stage, last 30 days</span>
            </div>
            <div className="uk-card-bd funnel">
              {pb.stages.map((st, i) => (
                <div key={i} className="funnel-row">
                  <span className="uk-over">{st[0]}</span>
                  <div className="track">
                    <i style={{ width: pb.reach[i] + "%" }} />
                  </div>
                  <span className="pct">{pb.reach[i]}%</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            {pb.stages.map(([name, goal, line], i) => (
              <div key={i} className="stage-card">
                <div className="hd">
                  <b>{i + 1}</b>
                  <strong>{name}</strong>
                </div>
                <div className="bd">
                  <div>
                    <span className="uk-over">Persona goal</span>
                    <p>{goal}</p>
                  </div>
                  <div>
                    <span className="uk-over">Example line</span>
                    <q className="say">{line}</q>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
