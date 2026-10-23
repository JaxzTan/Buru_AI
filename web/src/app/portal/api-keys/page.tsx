"use client";

import { useState } from "react";
import { Field, Modal, Top } from "@/components/app/primitives";
import { useToast } from "@/components/app/Toast";
import { ApiKeyRow, Button } from "@/components/ui";

interface Key {
  id: number;
  name: string;
  prefix: string;
  created: string;
  status: "active" | "revoked";
  secret?: string;
}

const QUICKSTART = `curl https://api.unknown.my/v1/lookup \\
  -H "Authorization: Bearer $UNKNOWN_KEY" \\
  -d '{"type":"bank_account","value":"1234567890","bank":"MBB"}'

# → {"match":true,"confidence":"high","scam_types":["job","investment"],"sightings":7}`;

function hex(n: number) {
  let s = "";
  for (let i = 0; i < n; i++) s += "0123456789abcdef"[Math.floor(Math.random() * 16)];
  return s;
}

export default function ApiKeysPage() {
  const toast = useToast();
  const [keys, setKeys] = useState<Key[]>([
    { id: 1, name: "Production — payments", prefix: "uk_live_8f2a", created: "2 Oct 2026", status: "active" },
    { id: 2, name: "Fraud analyst scripts", prefix: "uk_live_41d0", created: "9 Oct 2026", status: "active" },
    { id: 3, name: "Staging", prefix: "uk_test_19bc", created: "14 Sep 2026", status: "revoked" },
  ]);
  const [modal, setModal] = useState<{ kind: "new" } | { kind: "revoke"; key: Key } | null>(null);
  const [name, setName] = useState("");
  const closeModal = () => setModal(null);

  function create() {
    const pre = "uk_live_" + hex(4);
    // The secret is shown once, on the newest key only.
    setKeys([
      { id: Date.now(), name: name || "Untitled key", prefix: pre, created: "22 Oct 2026", status: "active", secret: pre + hex(28) },
      ...keys.map((x) => ({ ...x, secret: undefined })),
    ]);
    setModal(null);
    setName("");
  }
  function revoke(id: number) {
    setKeys(keys.map((x) => (x.id === id ? { ...x, status: "revoked" as const, secret: undefined } : x)));
    setModal(null);
    toast("Key revoked");
  }

  return (
    <>
      <Top
        title="API keys"
        sub="Keys are shown once and stored hashed. Rate limit: 100 requests/s per key."
        actions={
          <Button variant="primary" onClick={() => setModal({ kind: "new" })}>
            Create key
          </Button>
        }
      />
      <div className="col gap-2">
        {keys.map((x) => (
          <ApiKeyRow
            key={x.id}
            name={x.name}
            prefix={x.prefix}
            created={x.created}
            status={x.status}
            secret={x.secret}
            onRevoke={() => setModal({ kind: "revoke", key: x })}
          />
        ))}
      </div>
      <div className="uk-card">
        <div className="uk-card-hd">
          <h3>Quick start</h3>
        </div>
        <pre className="uk-card-bd uk-mono m-0 overflow-auto bg-surface-sunken text-xs leading-[18px]">{QUICKSTART}</pre>
      </div>
      {modal?.kind === "new" ? (
        <Modal
          title="Create API key"
          onClose={closeModal}
          footer={
            <>
              <Button variant="ghost" onClick={closeModal}>
                Cancel
              </Button>
              <Button variant="primary" onClick={create}>
                Create
              </Button>
            </>
          }
        >
          <Field label="Name">
            <input
              className="uk-input font-sans"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Production — DuitNow transfers"
              autoFocus
            />
          </Field>
        </Modal>
      ) : null}
      {modal?.kind === "revoke" ? (
        <Modal
          title="Revoke key?"
          onClose={closeModal}
          footer={
            <>
              <Button variant="ghost" onClick={closeModal}>
                Cancel
              </Button>
              <Button variant="danger" onClick={() => revoke(modal.key.id)}>
                Revoke key
              </Button>
            </>
          }
        >
          <p className="m-0">
            Requests using <code className="inl">{modal.key.prefix}…</code> will fail immediately. This can’t be undone.
          </p>
        </Modal>
      ) : null}
    </>
  );
}
