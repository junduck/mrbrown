import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const promptCache = new Map<string, string>();
const stringsCache = new Map<string, Record<string, string>>();
const templatesDir = join(dirname(fileURLToPath(import.meta.url)));

const defaultLang = process.env["MRBROWN_LANG"] ?? undefined;

function loadPrompt(name: string, lang?: string): string {
  const loadKey = lang ? `${name}:${lang}` : name;
  let cached = promptCache.get(loadKey);
  if (cached) return cached;

  const candidates: string[] = [];
  if (lang) {
    candidates.push(`${name}.${lang}.txt`, `${name}.${lang}.json`);
  }
  candidates.push(`${name}.txt`, `${name}.json`);

  let raw: string | undefined;
  for (const c of candidates) {
    try {
      raw = readFileSync(join(templatesDir, c), "utf-8");
      break;
    } catch {
      // try next candidate
    }
  }
  if (raw === undefined) throw new Error(`Prompt not found: ${name}`);

  // legacy .json: { "content": "..." } — extract content
  if (raw.startsWith("{")) {
    raw = (JSON.parse(raw) as { content: string })["content"];
  }

  promptCache.set(loadKey, raw);
  return raw;
}

function interpolate(content: string, vars?: Record<string, string>): string {
  if (!vars) return content;
  for (const [key, value] of Object.entries(vars)) {
    content = content.replaceAll(`{{${key}}}`, value);
  }
  return content;
}

function loadStrings(lang?: string): Record<string, string> {
  const loadKey = lang ?? "__default__";
  let strings = stringsCache.get(loadKey);
  if (strings) return strings;

  let raw: string;
  if (lang) {
    const localPath = join(templatesDir, `strings.${lang}.json`);
    try {
      raw = readFileSync(localPath, "utf-8");
    } catch {
      raw = readFileSync(join(templatesDir, "strings.json"), "utf-8");
    }
  } else {
    raw = readFileSync(join(templatesDir, "strings.json"), "utf-8");
  }

  strings = JSON.parse(raw) as Record<string, string>;
  stringsCache.set(loadKey, strings);
  return strings;
}

export function getPrompt(
  name: string,
  vars?: Record<string, string>,
  lang?: string,
): string {
  const locale = lang ?? defaultLang;
  const content = loadPrompt(name, locale);

  if (!vars) return content;

  const rendered = interpolate(content, vars);
  const renderKey = `${locale ?? ""}:${name}:${JSON.stringify(vars)}`;
  promptCache.set(renderKey, rendered);
  return rendered;
}

export function t(
  key: string,
  vars?: Record<string, string>,
  lang?: string,
): string {
  const locale = lang ?? defaultLang;
  const strings = loadStrings(locale);
  const raw = strings[key] ?? key;
  return interpolate(raw, vars);
}
