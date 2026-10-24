export interface StatTileProps {
  label: string;
  value: string;
  delta?: string;
  detail?: string;
  progress?: number;
}

export function StatTile({ label, value, delta, detail, progress }: StatTileProps) {
  return (
    <div className="uk-stat">
      <span className="uk-over">{label}</span>
      <span className="uk-stat-v">{value}</span>
      {detail || delta ? (
        <span className="uk-stat-d">
          {delta ? <span className={delta.startsWith("-") ? "down" : "up"}>{delta + " "}</span> : null}
          {detail}
        </span>
      ) : null}
      {progress != null ? (
        <div className="uk-stat-bar" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
          <i style={{ width: Math.min(100, progress) + "%" }} />
        </div>
      ) : null}
    </div>
  );
}
