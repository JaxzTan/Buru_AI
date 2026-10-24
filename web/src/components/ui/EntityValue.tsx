"use client";

import { useState } from "react";
import type { EntityType } from "@/lib/types";

const ETYPE: Record<EntityType, string> = {
  bank_account: "BANK",
  wallet: "WALLET",
  phone: "PHONE",
  url: "URL",
  handle: "HANDLE",
};

export interface EntityValueProps {
  type: EntityType;
  value: string;
  display?: string;
  bank?: string;
  copyable?: boolean;
}

/** Every account, wallet, phone, URL and key renders through this, in mono. */
export function EntityValue({ type, value, display, bank, copyable = true }: EntityValueProps) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard?.writeText(value).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }
  return (
    <span className="uk-ev" title={value}>
      <span className="uk-ev-type">
        {(ETYPE[type] ?? type) + (bank ? " · " + bank : "")}
      </span>
      <span className="uk-ev-val">{display || value}</span>
      {copyable ? (
        <button type="button" className="uk-ev-copy" onClick={copy} aria-label="Copy value">
          {copied ? "copied" : "copy"}
        </button>
      ) : null}
    </span>
  );
}
