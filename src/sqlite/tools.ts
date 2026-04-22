import { tool, type ToolSet } from "ai";
import { z } from "zod";
import type Database from "better-sqlite3";
import { toMarkdownTable, emptyResult } from "./format.js";
import { t } from "../prompts/provider.js";

export function createSqliteTools(
  db: Database.Database,
  maxRows = 500,
): ToolSet {
  return {
    list_tables: tool({
      description: t("tools.sql.list_tables"),
      inputSchema: z.object({}),
      execute: async () => {
        const tables = db
          .prepare(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
          )
          .all() as { name: string }[];

        if (tables.length === 0) return "Database has no tables.";

        const rows = tables.map((t) => {
          const r = db
            .prepare(`SELECT COUNT(*) as cnt FROM "${t.name}"`)
            .get() as {
            cnt: number;
          };
          return [t.name, r.cnt] as [string, number];
        });

        return toMarkdownTable({ columns: ["table", "rows"], rows }, maxRows);
      },
    }),

    describe_table: tool({
      description: t("tools.sql.describe_table"),
      inputSchema: z.object({
        table: z.string().describe("Table name to describe"),
      }),
      execute: async ({ table }) => {
        const exists = db
          .prepare(
            "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
          )
          .get(table);
        if (!exists) return `Table '${table}' not found.`;

        const cols = db.pragma(`table_info("${table}")`) as {
          name: string;
          type: string;
          notnull: number;
          dflt_value: unknown;
          pk: number;
        }[];

        return toMarkdownTable({
          columns: ["column", "type", "notnull", "default", "pk"],
          rows: cols.map((c) => [
            c.name,
            c.type,
            c.notnull ? "YES" : "NO",
            String(c.dflt_value ?? ""),
            c.pk ? "YES" : "NO",
          ]),
        });
      },
    }),

    query_sql: tool({
      description: t("tools.sql.query_sql"),
      inputSchema: z.object({
        sql: z.string().describe("SQL query to execute"),
      }),
      execute: async ({ sql }) => {
        const stmt = db.prepare(sql);
        const rows = stmt.all() as Record<string, unknown>[];
        if (rows.length === 0) return emptyResult();

        const columns = Object.keys(rows[0]!);
        const data = rows.map((r) => columns.map((c) => r[c] ?? null));
        return toMarkdownTable({ columns, rows: data }, maxRows);
      },
    }),
  };
}
