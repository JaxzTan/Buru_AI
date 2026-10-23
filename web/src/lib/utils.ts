export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

export function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

/** "19 Oct 2026" */
export function fmtDate(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** "08:41" (24h) */
export function nowHHMM() {
  const d = new Date();
  return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
}

export function downloadCsv(rows: Record<string, unknown>[], name: string): boolean {
  const cols = Object.keys(rows[0] || {});
  const body = [cols.join(",")]
    .concat(rows.map((r) => cols.map((c) => '"' + String(r[c]).replace(/"/g, '""') + '"').join(",")))
    .join("\n");
  try {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([body], { type: "text/csv" }));
    a.download = name;
    a.click();
    return true;
  } catch {
    return false;
  }
}
