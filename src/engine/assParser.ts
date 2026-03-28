// VTB-LIVE Fork - Copyright (c) 2026 VTB-LIVE
// Licensed under AGPL-3.0.

export interface AssEntry {
  startMs: number;
  endMs: number;
  text: string;
}

function parseAssTimestamp(ts: string): number {
  // ASS format: H:MM:SS.CC (centiseconds)
  const m = ts.trim().match(/^(\d+):(\d{2}):(\d{2})\.(\d{2})$/);
  if (!m) return 0;
  const hours = parseInt(m[1], 10);
  const minutes = parseInt(m[2], 10);
  const seconds = parseInt(m[3], 10);
  const centiseconds = parseInt(m[4], 10);
  return hours * 3600000 + minutes * 60000 + seconds * 1000 + centiseconds * 10;
}

function stripAssTags(text: string): string {
  // Remove ASS override tags like {\b1}, {\i0}, {\pos(x,y)}, etc.
  return text.replace(/\{[^}]*\}/g, '').replace(/\\[Nn]/g, ' ').trim();
}

export function parseAss(raw: string): AssEntry[] {
  const lines = raw.split(/\r?\n/);
  const entries: AssEntry[] = [];

  let inEvents = false;
  let formatFields: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === '[Events]') {
      inEvents = true;
      continue;
    }

    if (trimmed.startsWith('[') && trimmed !== '[Events]') {
      inEvents = false;
      continue;
    }

    if (!inEvents) continue;

    if (trimmed.startsWith('Format:')) {
      formatFields = trimmed
        .substring('Format:'.length)
        .split(',')
        .map(f => f.trim().toLowerCase());
      continue;
    }

    if (trimmed.startsWith('Dialogue:')) {
      const rest = trimmed.substring('Dialogue:'.length);
      // Split by comma but only up to the number of format fields minus 1
      // (the last field "Text" can contain commas)
      const parts: string[] = [];
      let remaining = rest;
      for (let i = 0; i < formatFields.length - 1; i++) {
        const idx = remaining.indexOf(',');
        if (idx === -1) break;
        parts.push(remaining.substring(0, idx).trim());
        remaining = remaining.substring(idx + 1);
      }
      parts.push(remaining); // Last field (Text) gets everything remaining

      const startIdx = formatFields.indexOf('start');
      const endIdx = formatFields.indexOf('end');
      const textIdx = formatFields.indexOf('text');

      if (startIdx === -1 || endIdx === -1 || textIdx === -1) continue;

      const startMs = parseAssTimestamp(parts[startIdx] ?? '');
      const endMs = parseAssTimestamp(parts[endIdx] ?? '');
      const rawText = parts[textIdx] ?? '';
      const text = stripAssTags(rawText);

      if (text && endMs > startMs) {
        entries.push({ startMs, endMs, text });
      }
    }
  }

  entries.sort((a, b) => a.startMs - b.startMs);
  return entries;
}
