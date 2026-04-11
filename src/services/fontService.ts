// Modified by VTB-LIVE on 2026-04-11
// Copyright (c) 2026 VTB-LIVE (Modifications)
//
// Original Work:
// PV Tool — Copyright (c) 2026 DanteAlighieri13210914
// Licensed under AGPL-3.0. For commercial use, see COMMERCIAL.md

export interface FontInfo {
  /** CSS font-family value (English/internal name) */
  family: string;
  /** Localized display name if available, otherwise same as family */
  displayName: string;
  /** Whether this is a CJK font (sorted first) */
  cjk: boolean;
}

/** CJK Unicode range test */
const CJK_RE = /[\u2E80-\u9FFF\uF900-\uFAFF\u3040-\u309F\u30A0-\u30FF\uAC00-\uD7AF]/;

/** Determine preferred Windows langIDs based on navigator.language */
function getPreferredLangIDs(): number[] {
  const lang = navigator.language.toLowerCase();
  if (lang.startsWith('zh-tw') || lang.startsWith('zh-hk') || lang.startsWith('zh-hant'))
    return [0x0404, 0x0C04, 0x0804];
  if (lang.startsWith('zh'))
    return [0x0804, 0x0404, 0x0C04];
  if (lang.startsWith('ja'))
    return [0x0411];
  if (lang.startsWith('ko'))
    return [0x0412];
  // Non-CJK locale: try zh-CN, zh-TW, ja, ko
  return [0x0804, 0x0404, 0x0411, 0x0412];
}

/**
 * Parse the OpenType/TrueType `name` table from a FontData blob.
 * Only reads a 1KB header to locate the name table offset, then reads
 * just the name table (up to 8KB). This avoids loading multi-MB CJK fonts.
 * Returns a localized family name (nameID=1) for the user's locale, or null.
 */
async function readLocalizedName(blob: Blob): Promise<string | null> {
  // 1) Read a small header to locate the name table
  const headerBuf = await blob.slice(0, 1024).arrayBuffer();
  const hv = new DataView(headerBuf);
  if (headerBuf.byteLength < 12) return null;

  // Detect TrueType Collection (ttcf)
  let off0 = 0;
  if (hv.getUint32(0) === 0x74746366) off0 = hv.getUint32(12);

  const numTables = hv.getUint16(off0 + 4);
  let nameOff = 0, nameLen = 0;
  for (let i = 0; i < numTables; i++) {
    const base = off0 + 12 + i * 16;
    if (base + 16 > headerBuf.byteLength) break;
    if (hv.getUint32(base) === 0x6E616D65) { // 'name'
      nameOff = hv.getUint32(base + 8);
      nameLen = hv.getUint32(base + 12);
      break;
    }
  }
  if (!nameOff) return null;

  // 2) Read just the name table (capped at 8KB)
  const nameBuf = await blob.slice(nameOff, nameOff + Math.min(nameLen, 8192)).arrayBuffer();
  const nv = new DataView(nameBuf);
  const count = nv.getUint16(2);
  const strBase = nv.getUint16(4);

  const targetLangs = getPreferredLangIDs();

  // Walk name records, looking for nameID 1 (Family) on platform 3 (Windows)
  for (const targetLang of targetLangs) {
    for (let i = 0; i < count; i++) {
      const rec = 6 + i * 12;
      if (rec + 12 > nameBuf.byteLength) break;
      const pid = nv.getUint16(rec);
      const lid = nv.getUint16(rec + 4);
      const nid = nv.getUint16(rec + 6);
      const len = nv.getUint16(rec + 8);
      const soff = nv.getUint16(rec + 10);
      if (pid !== 3 || nid !== 1 || lid !== targetLang) continue;
      if (strBase + soff + len > nameBuf.byteLength) continue;
      // Decode UTF-16BE
      const bytes = new Uint8Array(nameBuf, strBase + soff, len);
      let name = '';
      for (let j = 0; j < len; j += 2) {
        name += String.fromCharCode((bytes[j] << 8) | bytes[j + 1]);
      }
      if (name) return name;
    }
  }
  return null;
}

/** Cache: family → localized name (populated by getLocalFontInfos) */
const _localizedNameCache = new Map<string, string>();

/**
 * Get the localized display name for a font family.
 * Uses the name table cache built by getLocalFontInfos().
 * If the cache doesn't have it, returns the family as-is.
 */
export function getLocalizedFontName(family: string): string {
  return _localizedNameCache.get(family) ?? family;
}

let _cachedFonts: string[] | null = null;
let _cachedFontInfos: FontInfo[] | null = null;

/** Whether the Local Font Access API is available in this browser. */
export function isLocalFontApiSupported(): boolean {
  return 'queryLocalFonts' in window;
}

/**
 * Query local fonts via the Local Font Access API.
 * Results are cached after the first successful call.
 * Returns an empty array if the API is unavailable or permission is denied.
 */
export async function getLocalFonts(forceRefresh = false): Promise<string[]> {
  if (_cachedFonts && !forceRefresh) return _cachedFonts;
  const infos = await getLocalFontInfos(forceRefresh);
  _cachedFonts = infos.map(f => f.family);
  return _cachedFonts;
}

/**
 * Query local fonts with detailed info (display name, CJK flag).
 * Parses each font's OpenType name table to read the localized family name.
 * CJK fonts are sorted first, then alphabetically.
 */
export async function getLocalFontInfos(forceRefresh = false): Promise<FontInfo[]> {
  if (_cachedFontInfos && !forceRefresh) return _cachedFontInfos;
  if (!isLocalFontApiSupported()) return [];

  try {
    // @ts-ignore — Local Font Access API not yet in TS lib
    const fonts: { family: string; blob(): Promise<Blob> }[] = await window.queryLocalFonts();
    // De-duplicate by family, keep one FontData per family for blob() access
    const familyMap = new Map<string, { family: string; blob(): Promise<Blob> }>();
    for (const f of fonts) {
      if (!familyMap.has(f.family)) familyMap.set(f.family, f);
    }

    const entries = [...familyMap.values()];

    // Parse ALL fonts in parallel — only reads 1KB + 8KB per font, no timeout needed
    const infos = await Promise.all(entries.map(async (fontData): Promise<FontInfo> => {
      let displayName = fontData.family;
      let cjk = false;
      try {
        const blob = await fontData.blob();
        const localized = await readLocalizedName(blob);
        if (localized && localized !== fontData.family) {
          displayName = `${localized}（${fontData.family}）`;
          cjk = true;
        } else {
          cjk = CJK_RE.test(fontData.family);
        }
      } catch {
        cjk = CJK_RE.test(fontData.family);
      }
      _localizedNameCache.set(fontData.family, displayName);
      return { family: fontData.family, displayName, cjk };
    }));

    // Sort with zh locale — CJK display names naturally sort first
    infos.sort((a, b) => a.displayName.localeCompare(b.displayName, 'zh'));
    _cachedFontInfos = infos;
    _cachedFonts = infos.map(f => f.family);
    return infos;
  } catch {
    return [];
  }
}

/**
 * Extract the primary (first) font name from a CSS font-family string.
 * Handles both quoted and unquoted names.
 *
 * @example parsePrimaryFont('"Noto Sans JP", sans-serif') → 'Noto Sans JP'
 */
export function parsePrimaryFont(css: string): string {
  const trimmed = css.trim();
  if (!trimmed) return '';
  // Split on comma, take the first entry
  const first = trimmed.split(',')[0].trim();
  // Strip surrounding quotes
  if ((first.startsWith('"') && first.endsWith('"')) ||
      (first.startsWith("'") && first.endsWith("'"))) {
    return first.slice(1, -1);
  }
  return first;
}

/**
 * Check whether the primary font of a CSS font-family value is available.
 * Uses `document.fonts.check()` — note this may return false positives for
 * system fonts that haven't been used yet in some browsers.
 */
export function checkFontAvailable(cssFontFamily: string): boolean {
  const primary = parsePrimaryFont(cssFontFamily);
  if (!primary) return false;
  // Generic families are always "available"
  const generics = ['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui'];
  if (generics.includes(primary.toLowerCase())) return true;
  try {
    return document.fonts.check(`16px "${primary}"`);
  } catch {
    return false;
  }
}
