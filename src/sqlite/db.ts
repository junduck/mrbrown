import Database from "better-sqlite3";

export function openSqliteReadonly(path: string): Database.Database {
  return new Database(path, { readonly: true });
}
