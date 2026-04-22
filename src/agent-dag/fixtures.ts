import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export interface SampleBar {
  ts_code: string;
  trade_date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  vol: number;
  amount: number;
}

const fixturePath = join(
  dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "sample-bars.json",
);

let _cache: SampleBar[] | undefined;

export function loadSampleBars(): SampleBar[] {
  if (!_cache) {
    _cache = JSON.parse(readFileSync(fixturePath, "utf-8")) as SampleBar[];
  }
  return _cache;
}
