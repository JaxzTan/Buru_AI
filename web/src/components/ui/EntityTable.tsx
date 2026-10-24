import type { Entity } from "@/lib/types";
import { Button } from "./Button";
import { EntityValue } from "./EntityValue";
import { ScamTypeTag } from "./ScamTypeTag";
import { StatusBadge } from "./StatusBadge";

export interface EntityTableProps {
  rows: Entity[];
  compact?: boolean;
  onVerify?: (id: Entity["id"]) => void;
  onReject?: (id: Entity["id"]) => void;
}

export function EntityTable({ rows, compact, onVerify, onReject }: EntityTableProps) {
  const actions = !!onVerify;
  return (
    <div className="uk-table-wrap">
      <table className="uk-table">
        <thead>
          <tr>
            <th>Entity</th>
            <th>Scam type</th>
            <th>Conf.</th>
            {compact ? null : <th>Sightings</th>}
            {compact ? null : <th>Last seen</th>}
            <th>Status</th>
            {actions ? <th className="text-right" /> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>
                <EntityValue type={r.type} value={r.value} bank={r.bank} display={r.display} />
              </td>
              <td>
                <ScamTypeTag type={r.scam_type} />
              </td>
              <td>
                <span className="uk-conf">{Math.round(r.confidence * 100)}%</span>
              </td>
              {compact ? null : <td className="uk-mono">{r.sightings}</td>}
              {compact ? null : <td className="uk-muted text-xs">{r.last_seen}</td>}
              <td>
                <StatusBadge status={r.status} />
              </td>
              {actions ? (
                <td>
                  {r.status === "unverified" ? (
                    <div className="uk-actions">
                      <Button size="sm" variant="ghost" onClick={() => onReject?.(r.id)}>
                        Reject
                      </Button>
                      <Button size="sm" variant="verify" onClick={() => onVerify?.(r.id)}>
                        Verify
                      </Button>
                    </div>
                  ) : null}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
