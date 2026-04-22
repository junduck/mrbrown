import { parse, format } from "date-fns";

const MARKET_OPEN_HOUR = 9;
const MARKET_OPEN_MIN = 30;

export function asMarketOpen(
  date: string,
  fmt: string,
  hour = MARKET_OPEN_HOUR,
  min = MARKET_OPEN_MIN,
  refDate?: Date,
): Date {
  const parsed = parse(date, fmt, refDate ?? /* c8 ignore */ new Date());
  parsed.setHours(hour, min, 0, 0);
  return parsed;
}

export function asDateString(date: Date, fmt: string): string {
  return format(date, fmt);
}
