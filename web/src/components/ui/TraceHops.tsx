import { cx } from "@/lib/utils";
import { EntityValue } from "./EntityValue";

export interface TraceHop {
  depth: 1 | 2;
  to: string;
  toDisplay?: string;
  amount: string;
  token?: string;
  label?: string;
}

export interface TraceHopsProps {
  wallet: string;
  walletDisplay?: string;
  chain?: string;
  hops: TraceHop[];
}

export function TraceHops({ wallet, walletDisplay, chain, hops }: TraceHopsProps) {
  return (
    <div className="uk-trace">
      <div className="uk-hop">
        <span className="uk-hop-n">Source</span>
        <EntityValue type="wallet" value={wallet} display={walletDisplay} bank={chain} />
        <span />
      </div>
      {hops.map((hp, k) => (
        <div key={k} className={cx("uk-hop", hp.depth === 2 && "uk-hop-child", hp.label && "uk-hop-ex")}>
          <span className="uk-hop-n">Hop {hp.depth}</span>
          <span className="flex min-w-0 flex-wrap items-center gap-2">
            <EntityValue type="wallet" value={hp.to} display={hp.toDisplay} copyable={false} />
            {hp.label ? <span className="uk-badge uk-badge-signal">Exchange · {hp.label}</span> : null}
          </span>
          <span className="uk-hop-amt">
            {hp.amount} {hp.token || "USDT"}
          </span>
        </div>
      ))}
    </div>
  );
}
