// VTB-LIVE Fork - Copyright (c) 2026 VTB-LIVE
// Licensed under AGPL-3.0.
// Effects V2 — Crayon Scrawl
// Scatters a handful of hand-drawn crayon doodle motifs across the frame with a
// wobbly waxy stroke texture and a discrete stop-motion "boil" that re-seeds the
// wobble at a fixed real-time interval so the lines twitch frame by frame.

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

// ── Motif geometry (unit coords, radius ≈ 1, centered at origin) ──

type Pt = { x: number; y: number };
type SubPath = { pts: Pt[]; closed: boolean };

const MOTIF_COUNT = 5;
/** Wobble spatial frequency, expressed as base waves per unit radius. */
const WOBBLES_PER_RADIUS = 2.2;

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

/** A rough ring that slightly overshoots its start (hand-drawn look). */
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

function buildMotif(id: number): SubPath[] {
  switch (id) {
    case 0: return motifSpiral();
    case 1: return motifStar();
    case 2: return motifZigzag();
    case 3: return motifRing();
    default: return motifCross();
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

interface Doodle {
  container: PIXI.Container;
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
}

// ── i18n (field labels; name/category inlined in meta) ──
const i18n = {
  shapeCount:   { zh: '涂鸦数量',     en: 'Doodle Count',    ja: '落書き数' },
  seed:         { zh: '随机种子',     en: 'Seed',            ja: 'シード' },
  sizeMin:      { zh: '最小尺寸',     en: 'Size Min',        ja: '最小サイズ' },
  sizeMax:      { zh: '最大尺寸',     en: 'Size Max',        ja: '最大サイズ' },
  roleMode:     { zh: '取色方案',     en: 'Palette Roles',   ja: 'カラー配分' },
  colorPrimary: { zh: '主色',         en: 'Primary Color',   ja: 'プライマリ色' },
  colorSecondary:{ zh: '副色',        en: 'Secondary Color', ja: 'セカンダリ色' },
  colorAccent:  { zh: '强调色',       en: 'Accent Color',    ja: 'アクセント色' },
  strokeWidth:  { zh: '笔触宽度',     en: 'Stroke Width',    ja: '線幅' },
  wobble:       { zh: '抖动幅度',     en: 'Wobble',          ja: 'ゆらぎ量' },
  opacity:      { zh: '整体不透明度', en: 'Opacity',         ja: '不透明度' },
  halo:         { zh: '蜡质双描边',   en: 'Waxy Halo',       ja: 'ワックス縁' },
  haloOpacity:  { zh: '双描边不透明度', en: 'Halo Opacity',   ja: '縁の不透明度' },
  boilInterval: { zh: '定格间隔(秒)',  en: 'Boil Interval',  ja: 'ボイル間隔(秒)' },
  spin:         { zh: '缓慢自转',     en: 'Slow Spin',       ja: 'ゆっくり回転' },
  pulse:        { zh: '缓慢脉动',     en: 'Slow Pulse',      ja: 'ゆっくり脈動' },
};

const GRP_LAYOUT = '分布';
const GRP_COLOR = '颜色';
const GRP_STROKE = '笔触';
const GRP_MOTION = '动画';

export class CrayonScrawlV2 extends BaseEffectV2 {
  static readonly meta: EffectMeta = {
    type: 'crayonScrawl',
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
      { key: 'colorPrimary',   label: i18n.colorPrimary,   type: { kind: 'color', default: '$primary', paletteRef: true }, group: GRP_COLOR },
      { key: 'colorSecondary', label: i18n.colorSecondary, type: { kind: 'color', default: '$secondary', paletteRef: true }, group: GRP_COLOR },
      { key: 'colorAccent',    label: i18n.colorAccent,    type: { kind: 'color', default: '$accent', paletteRef: true }, group: GRP_COLOR },
      // Stroke look
      { key: 'strokeWidth', label: i18n.strokeWidth, type: { kind: 'number', min: 1, max: 20, step: 0.5, default: 4 }, group: GRP_STROKE },
      { key: 'wobble',      label: i18n.wobble,      type: { kind: 'number', min: 0, max: 0.25, step: 0.005, default: 0.06 }, group: GRP_STROKE },
      { key: 'opacity',     label: i18n.opacity,     type: { kind: 'number', min: 0, max: 1, step: 0.01, default: 0.9 }, group: GRP_STROKE },
      { key: 'halo',        label: i18n.halo,        type: { kind: 'boolean', default: true }, group: GRP_STROKE },
      { key: 'haloOpacity', label: i18n.haloOpacity, type: { kind: 'number', min: 0, max: 1, step: 0.05, default: 0.35 }, group: GRP_STROKE, advanced: true },
      // Motion
      { key: 'boilInterval', label: i18n.boilInterval, type: { kind: 'number', min: 0.02, max: 1, step: 0.01, default: 0.12 }, group: GRP_MOTION },
      { key: 'spin',         label: i18n.spin,         type: { kind: 'number', min: 0, max: 1, step: 0.01, default: 0.05 }, group: GRP_MOTION, advanced: true },
      { key: 'pulse',        label: i18n.pulse,        type: { kind: 'number', min: 0, max: 0.3, step: 0.01, default: 0.04 }, group: GRP_MOTION, advanced: true },
    ],
  };

  private root!: PIXI.Container;
  private doodles: Doodle[] = [];
  private built = false;
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

  private teardown(): void {
    for (const d of this.doodles) {
      try { d.container.destroy({ children: true }); } catch { /* already gone */ }
    }
    this.doodles = [];
  }

  /**
   * Deterministically place the doodles for a given screen size. Layout (position,
   * size, rotation, color, motif, spin/pulse) is a pure function of `seed`, so a
   * rebuild after a config/palette change reproduces the same arrangement.
   */
  private build(sw: number, sh: number): void {
    this.teardown();

    const minDim = Math.min(sw, sh);
    const count = Math.max(1, Math.floor(this.config.shapeCount ?? 7));
    const gseed = (Math.floor(this.config.seed ?? 1234) >>> 0);
    let lo = this.config.sizeMin ?? 0.07;
    let hi = this.config.sizeMax ?? 0.17;
    if (lo > hi) { const t = lo; lo = hi; hi = t; }
    const roles = this.resolveRoles();
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
      const color = roles[Math.floor(rng() * roles.length)];
      const spinRate = spinMax * (rng() * 2 - 1);
      const pulseAmp = pulseMax * rng();
      const pulsePhase = rng() * Math.PI * 2;
      const pulseRate = 0.4 + rng() * 0.8;

      const container = new PIXI.Container();
      container.position.set(x, y);
      container.rotation = baseRot;
      const gHalo = new PIXI.Graphics();
      const gMain = new PIXI.Graphics();
      container.addChild(gHalo);
      container.addChild(gMain);
      this.root.addChild(container);

      this.doodles.push({
        container, gHalo, gMain, radius, baseRot,
        spinRate, pulseAmp, pulsePhase, pulseRate, color, motif, seed,
      });
    }

    this.root.alpha = this.config.opacity ?? 0.9;
    this.currentFrame = -1; // force a wobble redraw on the next update
    this.built = true;
  }

  /** Re-trace every doodle for the given boil frame, re-seeding the wobble. */
  private redraw(frame: number): void {
    const wobble = this.config.wobble ?? 0.06;
    const strokeWidth = this.config.strokeWidth ?? 4;
    const halo = this.config.halo ?? true;
    const haloOpacity = this.config.haloOpacity ?? 0.35;

    for (const d of this.doodles) {
      const paths = buildMotif(d.motif);
      const amp = wobble * d.radius;
      const step = Math.max(2, d.radius * 0.09);

      d.gMain.clear();
      d.gHalo.clear();

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

    // Advance the boil clock in real seconds only while playing (paused → dt ≤ 0).
    if (ctx.deltaTime > 0) this.boilClock += ctx.deltaTime;

    const interval = Math.max(0.001, this.config.boilInterval ?? 0.12);
    const frame = Math.floor(this.boilClock / interval);
    if (frame !== this.currentFrame) {
      this.currentFrame = frame;
      this.redraw(frame);
    }

    // Continuous (but boil-clock-driven, so also frozen while paused) slow spin
    // and pulse per shape. When spin/pulse are 0 these are identity transforms.
    for (const d of this.doodles) {
      d.container.rotation = d.baseRot + d.spinRate * this.boilClock;
      const s = 1 + d.pulseAmp * Math.sin(this.boilClock * d.pulseRate + d.pulsePhase);
      d.container.scale.set(s);
    }
  }

  // ── Hot-update support ──

  protected onConfigChange(key: string, value: any): void {
    if (key === 'opacity') {
      this.root.alpha = value;
      return;
    }
    // Everything else affects deterministic geometry/color → rebuild next update.
    this.built = false;
  }

  protected onPaletteChange(): void {
    const refs = [this.config.colorPrimary, this.config.colorSecondary, this.config.colorAccent];
    if (refs.some(c => typeof c === 'string' && c.startsWith('$'))) this.built = false;
  }
}
