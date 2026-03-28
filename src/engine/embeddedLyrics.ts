// VTB-LIVE Fork - Copyright (c) 2026 VTB-LIVE
// Licensed under AGPL-3.0.

/**
 * Extract embedded lyrics from audio files.
 * Supports: ID3v2 USLT frames (MP3), Vorbis comment LYRICS fields (FLAC/OGG).
 */

export async function extractEmbeddedLyrics(file: File): Promise<string | null> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);

  // Try ID3v2 (MP3)
  const id3Lyrics = parseID3v2USLT(bytes);
  if (id3Lyrics) return id3Lyrics;

  // Try FLAC Vorbis comment
  const flacLyrics = parseFLACVorbisLyrics(bytes);
  if (flacLyrics) return flacLyrics;

  // Try OGG Vorbis comment
  const oggLyrics = parseOGGVorbisLyrics(bytes);
  if (oggLyrics) return oggLyrics;

  return null;
}

// ── ID3v2 USLT (Unsynchronized Lyrics) ──

function parseID3v2USLT(data: Uint8Array): string | null {
  if (data.length < 10) return null;
  // ID3v2 header: "ID3"
  if (data[0] !== 0x49 || data[1] !== 0x44 || data[2] !== 0x33) return null;

  const major = data[3]; // 2, 3, or 4
  const flags = data[5];
  let tagSize = decodeSyncsafe(data, 6);

  if (major < 2 || major > 4) return null;

  let offset = 10;

  // Extended header (v2.3/v2.4)
  if (major >= 3 && (flags & 0x40)) {
    if (offset + 4 > data.length) return null;
    const extSize = major === 4
      ? decodeSyncsafe(data, offset)
      : readUint32BE(data, offset);
    offset += (major === 4 ? extSize : extSize + 4);
  }

  const end = Math.min(10 + tagSize, data.length);
  const frameIdLen = major === 2 ? 3 : 4;
  const frameHeaderLen = major === 2 ? 6 : 10;
  const usltId = major === 2 ? 'ULT' : 'USLT';

  while (offset + frameHeaderLen <= end) {
    const frameId = readAscii(data, offset, frameIdLen);
    if (frameId[0] === '\0') break; // padding

    let frameSize: number;
    if (major === 2) {
      frameSize = (data[offset + 3] << 16) | (data[offset + 4] << 8) | data[offset + 5];
    } else if (major === 4) {
      frameSize = decodeSyncsafe(data, offset + 4);
    } else {
      frameSize = readUint32BE(data, offset + 4);
    }

    if (frameSize <= 0 || offset + frameHeaderLen + frameSize > end) break;

    if (frameId === usltId) {
      const body = data.subarray(offset + frameHeaderLen, offset + frameHeaderLen + frameSize);
      const text = decodeUSLTBody(body);
      if (text && text.trim().length > 0) return text.trim();
    }

    offset += frameHeaderLen + frameSize;
  }

  return null;
}

function decodeUSLTBody(body: Uint8Array): string | null {
  if (body.length < 5) return null;
  const encoding = body[0];
  // bytes 1-3: language code (skip)
  let pos = 4;

  // Skip content descriptor (null-terminated)
  if (encoding === 0 || encoding === 3) {
    // ISO-8859-1 or UTF-8: single-byte null terminator
    while (pos < body.length && body[pos] !== 0) pos++;
    pos++; // skip null
  } else {
    // UTF-16 (LE/BE): double-byte null terminator
    while (pos + 1 < body.length && !(body[pos] === 0 && body[pos + 1] === 0)) pos += 2;
    pos += 2; // skip null pair
  }

  if (pos >= body.length) return null;
  const textBytes = body.subarray(pos);
  return decodeID3Text(encoding, textBytes);
}

function decodeID3Text(encoding: number, data: Uint8Array): string {
  switch (encoding) {
    case 0: // ISO-8859-1
      return Array.from(data).map(b => String.fromCharCode(b)).join('');
    case 1: { // UTF-16 with BOM
      const bom = (data[0] << 8) | data[1];
      const le = bom === 0xFFFE;
      const start = (bom === 0xFEFF || bom === 0xFFFE) ? 2 : 0;
      return decodeUTF16(data.subarray(start), le);
    }
    case 2: // UTF-16BE without BOM
      return decodeUTF16(data, false);
    case 3: // UTF-8
      return new TextDecoder('utf-8').decode(data);
    default:
      return new TextDecoder('utf-8').decode(data);
  }
}

function decodeUTF16(data: Uint8Array, le: boolean): string {
  const codes: number[] = [];
  for (let i = 0; i + 1 < data.length; i += 2) {
    codes.push(le ? (data[i] | (data[i + 1] << 8)) : ((data[i] << 8) | data[i + 1]));
  }
  return String.fromCharCode(...codes);
}

// ── FLAC Vorbis Comment ──

function parseFLACVorbisLyrics(data: Uint8Array): string | null {
  if (data.length < 8) return null;
  // fLaC magic
  if (readAscii(data, 0, 4) !== 'fLaC') return null;

  let offset = 4;
  while (offset + 4 <= data.length) {
    const blockType = data[offset] & 0x7F;
    const isLast = (data[offset] & 0x80) !== 0;
    const blockSize = (data[offset + 1] << 16) | (data[offset + 2] << 8) | data[offset + 3];
    offset += 4;

    if (blockType === 4) { // VORBIS_COMMENT
      const lyrics = parseVorbisCommentBlock(data, offset, offset + blockSize);
      if (lyrics) return lyrics;
    }

    offset += blockSize;
    if (isLast) break;
  }
  return null;
}

// ── OGG Vorbis Comment ──

function parseOGGVorbisLyrics(data: Uint8Array): string | null {
  if (data.length < 4) return null;
  if (readAscii(data, 0, 4) !== 'OggS') return null;

  // Scan for Vorbis comment header (type 3)
  // The comment header packet starts with 0x03 + "vorbis"
  const marker = [0x03, 0x76, 0x6F, 0x72, 0x62, 0x69, 0x73]; // \x03vorbis
  const idx = findBytes(data, marker);
  if (idx < 0) return null;

  const commentStart = idx + 7; // after marker
  if (commentStart >= data.length) return null;

  // Parse as Vorbis comment (vendor string + comment list)
  return parseVorbisCommentBlock(data, commentStart, data.length);
}

function parseVorbisCommentBlock(data: Uint8Array, start: number, end: number): string | null {
  let pos = start;
  if (pos + 4 > end) return null;

  // Vendor string length (little-endian)
  const vendorLen = readUint32LE(data, pos);
  pos += 4 + vendorLen;
  if (pos + 4 > end) return null;

  const commentCount = readUint32LE(data, pos);
  pos += 4;

  for (let i = 0; i < commentCount && pos + 4 <= end; i++) {
    const len = readUint32LE(data, pos);
    pos += 4;
    if (pos + len > end) break;

    const comment = new TextDecoder('utf-8').decode(data.subarray(pos, pos + len));
    pos += len;

    const eq = comment.indexOf('=');
    if (eq < 0) continue;
    const key = comment.substring(0, eq).toUpperCase();
    if (key === 'LYRICS' || key === 'UNSYNCEDLYRICS') {
      const val = comment.substring(eq + 1);
      if (val.trim().length > 0) return val.trim();
    }
  }
  return null;
}

// ── Helpers ──

function decodeSyncsafe(data: Uint8Array, offset: number): number {
  return ((data[offset] & 0x7F) << 21)
       | ((data[offset + 1] & 0x7F) << 14)
       | ((data[offset + 2] & 0x7F) << 7)
       |  (data[offset + 3] & 0x7F);
}

function readUint32BE(data: Uint8Array, offset: number): number {
  return (data[offset] << 24) | (data[offset + 1] << 16) | (data[offset + 2] << 8) | data[offset + 3];
}

function readUint32LE(data: Uint8Array, offset: number): number {
  return data[offset] | (data[offset + 1] << 8) | (data[offset + 2] << 16) | (data[offset + 3] << 24);
}

function readAscii(data: Uint8Array, offset: number, len: number): string {
  let s = '';
  for (let i = 0; i < len && offset + i < data.length; i++) {
    s += String.fromCharCode(data[offset + i]);
  }
  return s;
}

function findBytes(data: Uint8Array, pattern: number[]): number {
  outer:
  for (let i = 0; i <= data.length - pattern.length; i++) {
    for (let j = 0; j < pattern.length; j++) {
      if (data[i + j] !== pattern[j]) continue outer;
    }
    return i;
  }
  return -1;
}
