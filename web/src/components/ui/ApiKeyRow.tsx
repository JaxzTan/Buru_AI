import { Button } from "./Button";
import { StatusBadge } from "./StatusBadge";

export interface ApiKeyRowProps {
  name: string;
  prefix: string;
  created: string;
  status?: "active" | "revoked";
  secret?: string;
  onRevoke?: () => void;
}

export function ApiKeyRow({ name, prefix, created, status = "active", secret, onRevoke }: ApiKeyRowProps) {
  return (
    <div className="uk-key">
      <div>
        <div className="font-semibold">{name}</div>
        <span className="uk-mono uk-muted text-xs">{prefix}••••••••</span>
      </div>
      <span className="uk-muted text-xs">Created {created}</span>
      <StatusBadge status={status} />
      {status === "revoked" ? (
        <span />
      ) : (
        <Button size="sm" variant="ghost" className="text-scam" onClick={onRevoke}>
          Revoke
        </Button>
      )}
      {secret ? (
        <div className="uk-key-reveal">
          <strong>Copy now — shown once.</strong>
          <code>{secret}</code>
        </div>
      ) : null}
    </div>
  );
}
