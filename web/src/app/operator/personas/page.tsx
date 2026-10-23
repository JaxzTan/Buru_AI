"use client";

import { useState } from "react";
import { Field, Modal, Top } from "@/components/app/primitives";
import { useToast } from "@/components/app/Toast";
import { Button, PersonaCard, ScamTypeTag } from "@/components/ui";
import { SCAM_LABEL, SCAM_TYPES } from "@/lib/mock";
import type { Persona, ScamType } from "@/lib/types";
import { useOps } from "../store";

const LANGUAGES = ["BM", "English", "Mandarin", "Cantonese", "Hokkien", "Manglish"];
type Draft = Omit<Persona, "id">;

function PersonaForm({ onClose, onSave }: { onClose: () => void; onSave: (f: Draft) => void }) {
  const [f, set] = useState<Draft>({ name: "", age: 55, backstory: "", wealth: "", languages: ["English", "Manglish"], playbooks: ["job"] });
  const up = <K extends keyof Draft>(k: K, v: Draft[K]) => set({ ...f, [k]: v });
  const tog = <T extends string>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : list.concat(v));
  const ok = f.name.trim() && f.backstory.trim() && f.languages.length;

  return (
    <Modal
      title="New persona"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!ok} onClick={() => onSave(f)}>
            Create persona
          </Button>
        </>
      }
    >
      <div className="row2">
        <Field label="Name">
          <input className="uk-input font-sans" value={f.name} onChange={(e) => up("name", e.target.value)} placeholder="Auntie Lin" />
        </Field>
        <Field label="Age">
          <input className="uk-input" type="number" min={18} max={90} value={f.age} onChange={(e) => up("age", +e.target.value)} />
        </Field>
      </div>
      <Field label="Backstory">
        <textarea
          className="uk-input"
          rows={3}
          value={f.backstory}
          onChange={(e) => up("backstory", e.target.value)}
          placeholder="Where they live, work, family, habits — kept consistent across every chat."
        />
      </Field>
      <Field label="Wealth signals">
        <input
          className="uk-input font-sans"
          value={f.wealth}
          onChange={(e) => up("wealth", e.target.value)}
          placeholder="e.g. FD savings, recently sold property"
        />
      </Field>
      <Field label="Language mix">
        <div className="bar">
          {LANGUAGES.map((l) => (
            <label key={l} className="chk">
              <input type="checkbox" checked={f.languages.includes(l)} onChange={() => up("languages", tog(f.languages, l))} />
              {l}
            </label>
          ))}
        </div>
      </Field>
      <Field label="Playbooks">
        <div className="bar">
          {SCAM_TYPES.filter((k) => k !== "other").map((k: ScamType) => (
            <label key={k} className="chk">
              <input type="checkbox" checked={f.playbooks.includes(k)} onChange={() => up("playbooks", tog(f.playbooks, k))} />
              {SCAM_LABEL[k]}
            </label>
          ))}
        </div>
      </Field>
    </Modal>
  );
}

export default function PersonasPage() {
  const { personas, accounts, addPersona } = useOps();
  const toast = useToast();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Top
        title="Personas"
        sub="AI victims with consistent backstories. Each one can run on several honeypot accounts."
        actions={
          <Button variant="primary" onClick={() => setOpen(true)}>
            New persona
          </Button>
        }
      />
      <div className="grid3">
        {personas.map((x) => {
          const acc = accounts.filter((a) => a.persona === x.id);
          return (
            <div key={x.id} className="col gap-2">
              <PersonaCard
                name={x.name}
                age={x.age}
                backstory={x.backstory}
                languages={x.languages}
                conversations={acc.reduce((s, a) => s + a.chats, 0)}
                accounts={acc.map((a) => ({ channel: a.channel, handle: a.handle, status: a.status }))}
              />
              <div className="bar text-xs">
                <span className="uk-muted">Playbooks</span>
                {x.playbooks.map((k) => (
                  <ScamTypeTag key={k} type={k} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {open ? (
        <PersonaForm
          onClose={() => setOpen(false)}
          onSave={(f) => {
            addPersona(f);
            setOpen(false);
            toast(f.name + " created — bind an account to start");
          }}
        />
      ) : null}
    </>
  );
}
