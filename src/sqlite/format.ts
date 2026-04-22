export interface Tabular {
  columns: string[];
  rows: unknown[][];
}

export function toMarkdownTable(data: Tabular, maxRows = 500): string {
  const { columns, rows } = data;
  if (columns.length === 0) return "No columns.";

  const escape = (v: unknown): string => {
    if (v === null || v === undefined) return "NULL";
    const s = String(v);
    return s.includes("|") ? s.replaceAll("|", "\\|") : s;
  };

  const header = `| ${columns.join(" | ")} |`;
  const sep = `| ${columns.map(() => "---").join(" | ")} |`;
  const limited = rows.slice(0, maxRows);
  const body = limited
    .map((r) => `| ${r.map(escape).join(" | ")} |`)
    .join("\n");
  const truncated =
    rows.length > maxRows ? `\n... (${rows.length - maxRows} more rows)` : "";

  return `${header}\n${sep}\n${body}${truncated}`;
}

export function emptyResult(): string {
  return "No rows returned.";
}
