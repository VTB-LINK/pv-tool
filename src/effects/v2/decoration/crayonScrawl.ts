// VTB-LIVE Fork - Copyright (c) 2026 VTB-LIVE
// Licensed under AGPL-3.0.
// Effects V2 — Crayon Scrawl
// Scatters a handful of hand-drawn crayon doodle motifs across the frame with a
// wobbly waxy stroke texture and a discrete stop-motion "boil" that re-seeds the
// wobble at a fixed real-time interval so the lines twitch frame by frame. Closed
// motifs get a chunky filled crayon body under the outline; the palette can be
// expanded into a set of muted crayon hues, and each doodle can optionally snap
// between a few held poses for a stop-motion feel.

import * as PIXI from 'pixi.js';
import { BaseEffectV2 } from '../BaseEffect';
import type { EffectMeta } from '../schema';
import type { UpdateContext } from '../../../types/engine';
import { resolveColor } from '../../../types/engine';

// ── Own PRNG: integer bit-mixing (no GLSL sin-fract hashing) ──

/** Mix two 32-bit integers into one unsigned 32-bit value. */
function hash32(a: number, b: number): number {
  let h = (a ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ ((b + 0x85ebca6b) | 0), 0xcc9e2d51) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0x1b873593) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return h >>> 0;
}

/** mulberry32 — a small, fast deterministic PRNG returning floats in [0, 1). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Color helpers (own HSL tint/shade/hue-nudge math for the expanded palette) ──

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Parse a #rgb / #rrggbb string into 0-255 channels; null for anything else. */
function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return [h, s, l];
}

function hslToHex(h: number, s: number, l: number): string {
  h = ((h % 360) + 360) % 360;
  s = clamp01(s); l = clamp01(l);
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  const to = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

/**
 * Derive ~6-8 muted crayon hues from the enabled palette roles. Each role yields
 * a de-saturated body colour plus a chalky tint, a deeper shade and a warm
 * hue-nudge; the set is de-duplicated and capped so the doodles read as a box of
 * waxy crayons rather than three flat brand colours. Colours that don't parse as
 * hex are passed through unchanged.
 */
function expandPalette(roles: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (c: string) => { const k = c.toLowerCase(); if (!seen.has(k)) { seen.add(k); out.push(c); } };
  for (const c of roles) {
    const rgb = hexToRgb(c);
    if (!rgb) { push(c); continue; }
    const [h, s, l] = rgbToHsl(rgb[0], rgb[1], rgb[2]);
    const ms = Math.min(1, s * 0.72);                                 // muted body
    push(hslToHex(h, ms, clamp01(Math.max(0.36, Math.min(0.70, l)))));
    push(hslToHex(h, ms * 0.65, Math.min(0.86, l + 0.19)));           // chalky tint
    push(hslToHex(h, Math.min(1, ms + 0.06), Math.max(0.26, l - 0.16))); // deeper shade
    push(hslToHex(h + 20, ms * 0.8, clamp01(Math.max(0.36, Math.min(0.74, l + 0.04))))); // warm nudge
  }
  if (out.length <= 8) return out;
  // Thin evenly to ~8 so no single role dominates.
  const picked: string[] = [];
  for (let i = 0; i < 8; i++) picked.push(out[Math.round((i * (out.length - 1)) / 7)]);
  return Array.from(new Set(picked));
}

// ── Motif geometry (unit coords, radius ≈ 1, centered at origin) ──

type Pt = { x: number; y: number };
type SubPath = { pts: Pt[]; closed: boolean };

const MOTIF_COUNT = 13;
/** Wobble spatial frequency, expressed as base waves per unit radius. */
const WOBBLES_PER_RADIUS = 2.2;

/** Scale a point cloud so its farthest point sits at radius 1. */
function scaleToUnit(pts: Pt[]): Pt[] {
  let maxR = 0;
  for (const p of pts) { const r = Math.hypot(p.x, p.y); if (r > maxR) maxR = r; }
  if (maxR < 1e-6) return pts;
  const k = 1 / maxR;
  return pts.map(p => ({ x: p.x * k, y: p.y * k }));
}

/** A loose outward spiral scribble. */
function motifSpiral(): SubPath[] {
  const turns = 2.7, n = 48;
  const pts: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const r = 0.12 + 0.88 * t;
    const a = t * turns * Math.PI * 2;
    pts.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
  }
  return [{ pts, closed: false }];
}

/** A five-point spiky star / burst. */
function motifStar(): SubPath[] {
  const spikes = 5, n = spikes * 2;
  const pts: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 === 0 ? 1 : 0.42;
    pts.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
  }
  return [{ pts, closed: true }];
}

/** A horizontal zigzag streak. */
function motifZigzag(): SubPath[] {
  const teeth = 5, n = teeth * 2;
  const pts: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const x = -1 + (2 * i) / n;
    const y = i % 2 === 0 ? -0.5 : 0.5;
    pts.push({ x, y });
  }
  return [{ pts, closed: false }];
}

/** A rough ring that slightly overshoots its start (hand-drawn look, stroke-only). */
function motifRing(): SubPath[] {
  const n = 42, turns = 1.08;
  const pts: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * turns * Math.PI * 2 - Math.PI / 2;
    pts.push({ x: Math.cos(a), y: Math.sin(a) });
  }
  return [{ pts, closed: false }];
}

/** A little plus / cross (two independent strokes). */
function motifCross(): SubPath[] {
  return [
    { pts: [{ x: -1, y: 0 }, { x: 1, y: 0 }], closed: false },
    { pts: [{ x: 0, y: -1 }, { x: 0, y: 1 }], closed: false },
  ];
}

/** A sun: a small filled disc surrounded by radial spokes. */
function motifSun(): SubPath[] {
  const subs: SubPath[] = [];
  const disc: Pt[] = [];
  const dn = 28, dr = 0.42;
  for (let i = 0; i < dn; i++) { const a = (i / dn) * Math.PI * 2; disc.push({ x: Math.cos(a) * dr, y: Math.sin(a) * dr }); }
  subs.push({ pts: disc, closed: true });
  const spokes = 8;
  for (let i = 0; i < spokes; i++) {
    const a = (i / spokes) * Math.PI * 2;
    subs.push({ pts: [{ x: Math.cos(a) * 0.58, y: Math.sin(a) * 0.58 }, { x: Math.cos(a), y: Math.sin(a) }], closed: false });
  }
  return subs;
}

/** A heart: two lobes tapering to a point at the bottom (own parametric curve). */
function motifHeart(): SubPath[] {
  const n = 60, pts: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    const x = 16 * Math.pow(Math.sin(t), 3);
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    pts.push({ x, y: -y }); // flip so the point faces down in screen coords
  }
  return [{ pts: scaleToUnit(pts), closed: true }];
}

/** A six-fold snowflake: arms with small side-branches, stroke-only. */
function motifSnowflake(): SubPath[] {
  const subs: SubPath[] = [];
  const arms = 6;
  for (let i = 0; i < arms; i++) {
    const a = (i / arms) * Math.PI * 2;
    const ca = Math.cos(a), sa = Math.sin(a);
    subs.push({ pts: [{ x: 0, y: 0 }, { x: ca, y: sa }], closed: false });
    for (const [r, len] of [[0.55, 0.3], [0.78, 0.22]] as [number, number][]) {
      const bx = ca * r, by = sa * r;
      for (const sgn of [-1, 1]) {
        const b = a + sgn * 0.62;
        subs.push({ pts: [{ x: bx, y: by }, { x: bx + Math.cos(b) * len, y: by + Math.sin(b) * len }], closed: false });
      }
    }
  }
  return subs;
}

/** A cloud: three overlapping bumps over a flat base (puffy filled outline). */
function motifCloud(): SubPath[] {
  const bumps = [
    { cx: -0.55, cy: 0.05, r: 0.42 },
    { cx: -0.02, cy: -0.15, r: 0.55 },
    { cx: 0.52, cy: 0.05, r: 0.45 },
  ];
  const base = 0.5;
  const pts: Pt[] = [];
  for (const b of bumps) {
    const n = 16;
    for (let i = 0; i <= n; i++) {
      const th = Math.PI + (i / n) * Math.PI; // upper arc: left → top → right
      pts.push({ x: b.cx + Math.cos(th) * b.r, y: b.cy + Math.sin(th) * b.r });
    }
  }
  const last = bumps[bumps.length - 1];
  pts.push({ x: last.cx + last.r, y: base });
  pts.push({ x: bumps[0].cx - bumps[0].r, y: base });
  return [{ pts: scaleToUnit(pts), closed: true }];
}

/** A raindrop: rounded bottom tapering to a top point (own teardrop curve). */
function motifRaindrop(): SubPath[] {
  const n = 48, pts: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    const w = Math.sin(t) * Math.pow(Math.sin(t / 2), 3);
    const y = -Math.cos(t); // t=0 → apex up, t=π → rounded bottom
    pts.push({ x: w * 0.95, y });
  }
  return [{ pts: scaleToUnit(pts), closed: true }];
}

/** A crescent moon: an outer arc closed by an offset inner arc (own geometry). */
function motifCrescent(): SubPath[] {
  const cx = 0.42, ir = 0.82;
  const xi = (1 - ir * ir + cx * cx) / (2 * cx);       // outer/inner intersection x
  const yi = Math.sqrt(Math.max(0, 1 - xi * xi));
  const outTop = Math.atan2(yi, xi);
  const outBot = -outTop;
  const pts: Pt[] = [];
  const n1 = 40, a0 = outTop, a1 = Math.PI * 2 + outBot; // long way through π
  for (let i = 0; i <= n1; i++) {
    const a = a0 + (a1 - a0) * (i / n1);
    pts.push({ x: Math.cos(a), y: Math.sin(a) });
  }
  const it = Math.atan2(yi, xi - cx);
  const ib = Math.atan2(-yi, xi - cx);
  const b0 = Math.PI * 2 + ib, b1 = it;               // inner arc back through its left side
  const n2 = 32;
  for (let i = 0; i <= n2; i++) {
    const a = b0 + (b1 - b0) * (i / n2);
    pts.push({ x: cx + Math.cos(a) * ir, y: Math.sin(a) * ir });
  }
  return [{ pts, closed: true }];
}

/** A flower: a ring of six petals around a filled centre. */
function motifFlower(): SubPath[] {
  const subs: SubPath[] = [];
  const petals = 6, pr = 0.5, ra = 0.34, rb = 0.2, n = 20;
  for (let i = 0; i < petals; i++) {
    const a = (i / petals) * Math.PI * 2 - Math.PI / 2;
    const cx = Math.cos(a) * pr, cy = Math.sin(a) * pr;
    const ca = Math.cos(a), sa = Math.sin(a);
    const pts: Pt[] = [];
    for (let k = 0; k < n; k++) {
      const th = (k / n) * Math.PI * 2;
      const ex = Math.cos(th) * ra, ey = Math.sin(th) * rb; // major axis along the radial
      pts.push({ x: cx + ex * ca - ey * sa, y: cy + ex * sa + ey * ca });
    }
    subs.push({ pts, closed: true });
  }
  const c: Pt[] = [];
  const cn = 16, cr = 0.22;
  for (let i = 0; i < cn; i++) { const th = (i / cn) * Math.PI * 2; c.push({ x: Math.cos(th) * cr, y: Math.sin(th) * cr }); }
  subs.push({ pts: c, closed: true });
  return subs;
}

/** A music note: a filled notehead with a stem and flag (stem/flag stroke-only). */
function motifMusicNote(): SubPath[] {
  const subs: SubPath[] = [];
  const hx = -0.3, hy = 0.55, ra = 0.36, rb = 0.27, tilt = -0.35;
  const ct = Math.cos(tilt), st = Math.sin(tilt);
  const head: Pt[] = [];
  const n = 22;
  for (let i = 0; i < n; i++) {
    const th = (i / n) * Math.PI * 2;
    const ex = Math.cos(th) * ra, ey = Math.sin(th) * rb;
    head.push({ x: hx + ex * ct - ey * st, y: hy + ex * st + ey * ct });
  }
  subs.push({ pts: head, closed: true });
  subs.push({ pts: [{ x: 0.04, y: 0.5 }, { x: 0.04, y: -0.9 }], closed: false });          // stem
  subs.push({ pts: [{ x: 0.04, y: -0.9 }, { x: 0.5, y: -0.58 }], closed: false });         // flag
  return subs;
}

function buildMotif(id: number): SubPath[] {
  switch (id) {
    case 0: return motifSpiral();
    case 1: return motifStar();
    case 2: return motifZigzag();
    case 3: return motifRing();
    case 4: return motifCross();
    case 5: return motifSun();
    case 6: return motifHeart();
    case 7: return motifSnowflake();
    case 8: return motifCloud();
    case 9: return motifRaindrop();
    case 10: return motifCrescent();
    case 11: return motifFlower();
    default: return motifMusicNote();
  }
}

// ── Stroke helpers ──

/** Resample a polyline at ~`step` px spacing, tracking cumulative arc length. */
function resample(path: Pt[], step: number): { p: Pt; L: number }[] {
  const out: { p: Pt; L: number }[] = [];
  if (path.length === 0) return out;
  out.push({ p: path[0], L: 0 });
  let L = 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i];
    const dx = b.x - a.x, dy = b.y - a.y;
    const segLen = Math.hypot(dx, dy);
    if (segLen < 1e-6) continue;
    const nSeg = Math.max(1, Math.ceil(segLen / step));
    for (let k = 1; k <= nSeg; k++) {
      const t = k / nSeg;
      out.push({ p: { x: a.x + dx * t, y: a.y + dy * t }, L: L + segLen * t });
    }
    L += segLen;
  }
  return out;
}

/**
 * Trace one sub-path into `g` as a wobbly polyline: sample the ideal (scaled)
 * path densely, then push each sample along its normal by a sum of two low-freq
 * sines (plus a faint tangential ripple and a per-stroke jump). Phases and the
 * whole-stroke jump come from `rng`, which the caller re-seeds per boil frame so
 * the line twitches. Closed shapes append their first point so the seam wobbles.
 */
function drawWobble(
  g: PIXI.Graphics,
  sub: SubPath,
  radius: number,
  amp: number,
  step: number,
  rng: () => number,
  offX: number,
  offY: number,
): void {
  const src = sub.closed ? [...sub.pts, sub.pts[0]] : sub.pts;
  const scaled = src.map(p => ({ x: p.x * radius, y: p.y * radius }));
  const rs = resample(scaled, step);
  if (rs.length < 2) return;

  const ph1 = rng() * Math.PI * 2;
  const ph2 = rng() * Math.PI * 2;
  const ph3 = rng() * Math.PI * 2;
  const jx = (rng() - 0.5) * amp * 0.8 + offX;
  const jy = (rng() - 0.5) * amp * 0.8 + offY;
  const ampJ = amp * (0.75 + rng() * 0.5);

  const f1 = (Math.PI * 2 * WOBBLES_PER_RADIUS) / radius;
  const f2 = f1 * 2.17;
  const f3 = f1 * 1.43;

  for (let j = 0; j < rs.length; j++) {
    const cur = rs[j].p;
    const prev = rs[Math.max(0, j - 1)].p;
    const next = rs[Math.min(rs.length - 1, j + 1)].p;
    let tx = next.x - prev.x, ty = next.y - prev.y;
    const tl = Math.hypot(tx, ty) || 1;
    tx /= tl; ty /= tl;
    const nx = -ty, ny = tx;
    const L = rs[j].L;
    const wn = ampJ * (0.6 * Math.sin(L * f1 + ph1) + 0.4 * Math.sin(L * f2 + ph2));
    const wt = ampJ * 0.28 * Math.sin(L * f3 + ph3);
    const x = cur.x + nx * wn + tx * wt + jx;
    const y = cur.y + ny * wn + ty * wt + jy;
    if (j === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
}

// ── Per-doodle record ──

interface Pose { rot: number; scale: number; }

interface Doodle {
  container: PIXI.Container;
  gFill: PIXI.Graphics;
  gHalo: PIXI.Graphics;
  gMain: PIXI.Graphics;
  radius: number;
  baseRot: number;
  spinRate: number;   // rad/s
  pulseAmp: number;
  pulsePhase: number;
  pulseRate: number;  // rad/s
  color: string;
  motif: number;
  seed: number;       // stable identity seed → base for per-frame wobble re-seeding
  poses: Pose[];      // held rotation/scale poses for the optional stop-motion snap
}

// ── i18n (field labels; name/category inlined in meta) ──
const i18n = {
  shapeCount:   { zh: '涂鸦数量',     en: 'Doodle Count',    ja: '落書き数' },
  seed:         { zh: '随机种子',     en: 'Seed',            ja: 'シード' },
  sizeMin:      { zh: '最小尺寸',     en: 'Size Min',        ja: '最小サイズ' },
  sizeMax:      { zh: '最大尺寸',     en: 'Size Max',        ja: '最大サイズ' },
  roleMode:     { zh: '取色方案',     en: 'Palette Roles',   ja: 'カラー配分' },
  colorMode:    { zh: '取色模式',     en: 'Color Mode',      ja: 'カラーモード' },
  colorPrimary: { zh: '主色',         en: 'Primary Color',   ja: 'プライマリ色' },
  colorSecondary:{ zh: '副色',        en: 'Secondary Color', ja: 'セカンダリ色' },
  colorAccent:  { zh: '强调色',       en: 'Accent Color',    ja: 'アクセント色' },
  strokeWidth:  { zh: '笔触宽度',     en: 'Stroke Width',    ja: '線幅' },
  wobble:       { zh: '抖动幅度',     en: 'Wobble',          ja: 'ゆらぎ量' },
  fillOpacity:  { zh: '填充不透明度', en: 'Fill Opacity',    ja: '塗り不透明度' },
  opacity:      { zh: '整体不透明度', en: 'Opacity',         ja: '不透明度' },
  halo:         { zh: '蜡质双描边',   en: 'Waxy Halo',       ja: 'ワックス縁' },
  haloOpacity:  { zh: '双描边不透明度', en: 'Halo Opacity',   ja: '縁の不透明度' },
  boilInterval: { zh: '定格间隔(秒)',  en: 'Boil Interval',  ja: 'ボイル間隔(秒)' },
  poseSnap:     { zh: '定格摆姿',     en: 'Pose Snap',       ja: 'ポーズスナップ' },
  spin:         { zh: '缓慢自转',     en: 'Slow Spin',       ja: 'ゆっくり回転' },
  pulse:        { zh: '缓慢脉动',     en: 'Slow Pulse',      ja: 'ゆっくり脈動' },
};

const GRP_LAYOUT = '分布';
const GRP_COLOR = '颜色';
const GRP_STROKE = '笔触';
const GRP_MOTION = '动画';

export class CrayonScrawlV2 extends BaseEffectV2 {
  static readonly meta: EffectMeta = {
    type: 'crayonScrawlV2',
    name: { zh: '蜡笔笔触', en: 'Crayon Scrawl', ja: 'クレヨン筆致' },
    category: { zh: '特殊形状', en: 'Special Shapes', ja: '特殊形状' },
    layer: 'decoration',
    version: 2,
    fields: [
      // Distribution
      { key: 'shapeCount', label: i18n.shapeCount, type: { kind: 'integer', min: 1, max: 30, default: 7 }, group: GRP_LAYOUT },
      { key: 'seed',       label: i18n.seed,       type: { kind: 'integer', min: 0, max: 999999, default: 1234 }, group: GRP_LAYOUT },
      { key: 'sizeMin',    label: i18n.sizeMin,    type: { kind: 'number', min: 0.02, max: 0.5, step: 0.01, default: 0.07 }, group: GRP_LAYOUT },
      { key: 'sizeMax',    label: i18n.sizeMax,    type: { kind: 'number', min: 0.03, max: 0.6, step: 0.01, default: 0.17 }, group: GRP_LAYOUT },
      // Color
      { key: 'roleMode',       label: i18n.roleMode,       type: { kind: 'string', default: 'all', options: ['all', 'primarySecondary', 'primaryAccent', 'primaryOnly'] }, group: GRP_COLOR },
      { key: 'colorMode',      label: i18n.colorMode,      type: { kind: 'string', default: 'expanded', options: ['expanded', 'rolesOnly'] }, group: GRP_COLOR },
      { key: 'colorPrimary',   label: i18n.colorPrimary,   type: { kind: 'color', default: '$primary', paletteRef: true }, group: GRP_COLOR },
      { key: 'colorSecondary', label: i18n.colorSecondary, type: { kind: 'color', default: '$secondary', paletteRef: true }, group: GRP_COLOR },
      { key: 'colorAccent',    label: i18n.colorAccent,    type: { kind: 'color', default: '$accent', paletteRef: true }, group: GRP_COLOR },
      // Stroke look
      { key: 'strokeWidth', label: i18n.strokeWidth, type: { kind: 'number', min: 1, max: 20, step: 0.5, default: 4 }, group: GRP_STROKE },
      { key: 'wobble',      label: i18n.wobble,      type: { kind: 'number', min: 0, max: 0.25, step: 0.005, default: 0.06 }, group: GRP_STROKE },
      { key: 'fillOpacity', label: i18n.fillOpacity, type: { kind: 'number', min: 0, max: 1, step: 0.05, default: 0.8 }, group: GRP_STROKE },
      { key: 'opacity',     label: i18n.opacity,     type: { kind: 'number', min: 0, max: 1, step: 0.01, default: 0.9 }, group: GRP_STROKE },
      { key: 'halo',        label: i18n.halo,        type: { kind: 'boolean', default: true }, group: GRP_STROKE },
      { key: 'haloOpacity', label: i18n.haloOpacity, type: { kind: 'number', min: 0, max: 1, step: 0.05, default: 0.35 }, group: GRP_STROKE, advanced: true },
      // Motion
      { key: 'boilInterval', label: i18n.boilInterval, type: { kind: 'number', min: 0.02, max: 1, step: 0.01, default: 0.12 }, group: GRP_MOTION },
      { key: 'poseSnap',     label: i18n.poseSnap,     type: { kind: 'number', min: 0, max: 1, step: 0.01, default: 0 }, group: GRP_MOTION },
      { key: 'spin',         label: i18n.spin,         type: { kind: 'number', min: 0, max: 1, step: 0.01, default: 0.05 }, group: GRP_MOTION, advanced: true },
      { key: 'pulse',        label: i18n.pulse,        type: { kind: 'number', min: 0, max: 0.3, step: 0.01, default: 0.04 }, group: GRP_MOTION, advanced: true },
    ],
  };

  private root!: PIXI.Container;
  private doodles: Doodle[] = [];
  private built = false;
  private builtW = 0;         // screen size the current layout was built for
  private builtH = 0;
  private boilClock = 0;      // accumulated real seconds; only advances while playing
  private currentFrame = -1;  // last drawn discrete boil frame

  protected setup(): void {
    this.root = new PIXI.Container();
    this.container.addChild(this.root);
  }

  /** Resolve the enabled palette-role colors according to `roleMode`. */
  private resolveRoles(): string[] {
    const P = resolveColor(this.config.colorPrimary ?? '$primary', this.palette);
    const S = resolveColor(this.config.colorSecondary ?? '$secondary', this.palette);
    const A = resolveColor(this.config.colorAccent ?? '$accent', this.palette);
    switch (this.config.roleMode) {
      case 'primaryOnly': return [P];
      case 'primarySecondary': return [P, S];
      case 'primaryAccent': return [P, A];
      default: return [P, S, A];
    }
  }

  /** The colour set doodles draw from: raw roles or the expanded muted-crayon set. */
  private resolvePalette(): string[] {
    const roles = this.resolveRoles();
    if (this.config.colorMode === 'rolesOnly') return roles;
    const expanded = expandPalette(roles);
    return expanded.length > 0 ? expanded : roles;
  }

  private teardown(): void {
    for (const d of this.doodles) {
      try { d.container.destroy({ children: true }); } catch { /* already gone */ }
    }
    this.doodles = [];
  }

  /**
   * Deterministically place the doodles for a given screen size. Layout (position,
   * size, rotation, color, motif, spin/pulse/poses) is a pure function of `seed`,
   * so a rebuild after a config/palette/size change reproduces the same arrangement.
   */
  private build(sw: number, sh: number): void {
    this.teardown();

    const minDim = Math.min(sw, sh);
    const count = Math.max(1, Math.floor(this.config.shapeCount ?? 7));
    const gseed = (Math.floor(this.config.seed ?? 1234) >>> 0);
    let lo = this.config.sizeMin ?? 0.07;
    let hi = this.config.sizeMax ?? 0.17;
    if (lo > hi) { const t = lo; lo = hi; hi = t; }
    const colors = this.resolvePalette();
    const spinMax = this.config.spin ?? 0.05;
    const pulseMax = this.config.pulse ?? 0.04;

    for (let i = 0; i < count; i++) {
      const seed = hash32(gseed + 0x1379, i);
      const rng = mulberry32(seed);

      const diaFrac = lo + rng() * (hi - lo);
      const radius = 0.5 * diaFrac * minDim;
      const margin = radius * 1.05;
      const x = margin + rng() * Math.max(1, sw - margin * 2);
      const y = margin + rng() * Math.max(1, sh - margin * 2);
      const baseRot = rng() * Math.PI * 2;
      const motif = Math.floor(rng() * MOTIF_COUNT);
      const color = colors[Math.floor(rng() * colors.length)];
      const spinRate = spinMax * (rng() * 2 - 1);
      const pulseAmp = pulseMax * rng();
      const pulsePhase = rng() * Math.PI * 2;
      const pulseRate = 0.4 + rng() * 0.8;

      // A few held poses (small rotation + scale) for the optional stop-motion snap.
      const poseN = 3 + Math.floor(rng() * 2); // 3 or 4
      const poses: Pose[] = [];
      for (let k = 0; k < poseN; k++) {
        poses.push({ rot: (rng() * 2 - 1) * 0.18, scale: 0.94 + rng() * 0.12 });
      }

      const container = new PIXI.Container();
      container.position.set(x, y);
      container.rotation = baseRot;
      const gFill = new PIXI.Graphics();
      const gHalo = new PIXI.Graphics();
      const gMain = new PIXI.Graphics();
      container.addChild(gFill);
      container.addChild(gHalo);
      container.addChild(gMain);
      this.root.addChild(container);

      this.doodles.push({
        container, gFill, gHalo, gMain, radius, baseRot,
        spinRate, pulseAmp, pulsePhase, pulseRate, color, motif, seed, poses,
      });
    }

    this.root.alpha = this.config.opacity ?? 0.9;
    this.builtW = sw;
    this.builtH = sh;
    this.currentFrame = -1; // force a wobble redraw on the next update
    this.built = true;
  }

  /** Re-trace every doodle for the given boil frame, re-seeding the wobble. */
  private redraw(frame: number): void {
    const wobble = this.config.wobble ?? 0.06;
    const strokeWidth = this.config.strokeWidth ?? 4;
    const halo = this.config.halo ?? true;
    const haloOpacity = this.config.haloOpacity ?? 0.35;
    const fillOpacity = this.config.fillOpacity ?? 0.8;

    for (const d of this.doodles) {
      const paths = buildMotif(d.motif);
      const amp = wobble * d.radius;
      const step = Math.max(2, d.radius * 0.09);

      d.gFill.clear();
      d.gMain.clear();
      d.gHalo.clear();

      // Chunky filled crayon body: trace the closed sub-paths and fill them
      // beneath the outline. Open motifs (zigzag, spiral, spokes, snowflake, stem)
      // have no closed sub-paths and stay stroke-only.
      if (fillOpacity > 0) {
        const closed = paths.filter(p => p.closed);
        if (closed.length > 0) {
          const rngF = mulberry32(hash32(d.seed ^ 0x2f6d1a37, frame * 2 + 7));
          for (const sub of closed) { drawWobble(d.gFill, sub, d.radius, amp, step, rngF, 0, 0); d.gFill.closePath(); }
          d.gFill.fill({ color: d.color, alpha: fillOpacity });
        }
      }

      // Waxy double-stroke: a wider, fainter, slightly offset echo drawn beneath,
      // with its own wobble seed so the two passes don't perfectly coincide.
      if (halo && haloOpacity > 0) {
        const rngH = mulberry32(hash32(d.seed ^ 0x51ed2f01, frame * 2 + 1));
        const off = strokeWidth * 0.55;
        for (const sub of paths) drawWobble(d.gHalo, sub, d.radius, amp, step, rngH, off, off * 0.6);
        d.gHalo.stroke({ width: strokeWidth * 1.55, color: d.color, alpha: haloOpacity, cap: 'round', join: 'round' });
      }

      const rngM = mulberry32(hash32(d.seed ^ 0x1c2a3b4d, frame * 2));
      for (const sub of paths) drawWobble(d.gMain, sub, d.radius, amp, step, rngM, 0, 0);
      d.gMain.stroke({ width: strokeWidth, color: d.color, alpha: 1, cap: 'round', join: 'round' });
    }
  }

  update(ctx: UpdateContext): void {
    // Lazy-init once a valid screen size is known.
    if (!this.built) {
      if (ctx.screenWidth > 0 && ctx.screenHeight > 0) this.build(ctx.screenWidth, ctx.screenHeight);
      else return;
    }

    // Resize-safety: doodle positions/radii are absolute px, so rebuild when the
    // built-for screen size changes.
    if (ctx.screenWidth > 0 && ctx.screenHeight > 0 &&
        (ctx.screenWidth !== this.builtW || ctx.screenHeight !== this.builtH)) {
      this.build(ctx.screenWidth, ctx.screenHeight);
    }

    // Advance the boil clock in real seconds only while playing (paused → dt ≤ 0).
    if (ctx.deltaTime > 0) this.boilClock += ctx.deltaTime;

    const interval = Math.max(0.001, this.config.boilInterval ?? 0.12);
    const frame = Math.floor(this.boilClock / interval);
    if (frame !== this.currentFrame) {
      this.currentFrame = frame;
      this.redraw(frame);
    }

    // Continuous (boil-clock-driven, so frozen while paused) slow spin and pulse,
    // plus an optional discrete pose-snap that jumps between held poses on each
    // boil frame for a stop-motion feel. With spin/pulse/poseSnap at 0 these are
    // identity transforms.
    const poseSnap = this.config.poseSnap ?? 0;
    for (const d of this.doodles) {
      let rot = d.baseRot + d.spinRate * this.boilClock;
      let s = 1 + d.pulseAmp * Math.sin(this.boilClock * d.pulseRate + d.pulsePhase);
      if (poseSnap > 0 && d.poses.length > 0) {
        const idx = hash32(d.seed ^ 0x7a5bc3, this.currentFrame) % d.poses.length;
        const pose = d.poses[idx];
        rot += pose.rot * poseSnap;
        s *= 1 + (pose.scale - 1) * poseSnap;
      }
      d.container.rotation = rot;
      d.container.scale.set(s);
    }
  }

  // ── Hot-update support ──

  protected onConfigChange(key: string, value: any): void {
    if (key === 'opacity') {
      this.root.alpha = value;
      return;
    }
    // poseSnap only affects the per-frame transform, no rebuild needed.
    if (key === 'poseSnap') return;
    // Everything else affects deterministic geometry/color → rebuild next update.
    this.built = false;
  }

  protected onPaletteChange(): void {
    const refs = [this.config.colorPrimary, this.config.colorSecondary, this.config.colorAccent];
    if (refs.some(c => typeof c === 'string' && c.startsWith('$'))) this.built = false;
  }
}
