// VTB-LIVE Fork - Copyright (c) 2026 VTB-LIVE
// Licensed under AGPL-3.0.
// Effects V2 — Chalk Figure
// A static, hand-drawn crime-scene chalk body outline: a spread-eagle lying
// silhouette drawn as many short, broken, retraced stroke fragments with a
// faint dusty halo, using frozen seeded per-vertex jitter (no animation).

import * as PIXI from 'pixi.js';
import { BaseEffectV2 } from '../BaseEffect';
import type { EffectMeta } from '../schema';
import type { UpdateContext } from '../../../types/engine';
import { resolveColor } from '../../../types/engine';

// ── Geometry helpers ──

type Pt = { x: number; y: number };

/** Outline points around a circle (closed loop, origin at center). */
function circleLoop(cx: number, cy: number, r: number, n: number): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
  }
  return pts;
}

/**
 * Outline points around a capsule (a thick rounded segment from A to B):
 * two parallel sides connected by semicircular end caps. Returns a closed loop.
 */
function capsuleLoop(
  ax: number, ay: number, bx: number, by: number,
  r: number, nSide: number, nCap: number,
): Pt[] {
  const phi = Math.atan2(by - ay, bx - ax);
  const px = Math.cos(phi + Math.PI / 2);
  const py = Math.sin(phi + Math.PI / 2);
  const pts: Pt[] = [];

  // Side 1: A(+perp) → B(+perp)
  for (let i = 0; i <= nSide; i++) {
    const t = i / nSide;
    pts.push({ x: ax + (bx - ax) * t + px * r, y: ay + (by - ay) * t + py * r });
  }
  // Cap at B: sweep the outward half from +perp to −perp
  for (let i = 1; i < nCap; i++) {
    const a = (phi + Math.PI / 2) - Math.PI * (i / nCap);
    pts.push({ x: bx + Math.cos(a) * r, y: by + Math.sin(a) * r });
  }
  // Side 2: B(−perp) → A(−perp)
  for (let i = 0; i <= nSide; i++) {
    const t = i / nSide;
    pts.push({ x: bx + (ax - bx) * t - px * r, y: by + (ay - by) * t - py * r });
  }
  // Cap at A: sweep the outward half back to +perp
  for (let i = 1; i < nCap; i++) {
    const a = (phi - Math.PI / 2) - Math.PI * (i / nCap);
    pts.push({ x: ax + Math.cos(a) * r, y: ay + Math.sin(a) * r });
  }
  return pts;
}

/**
 * Break a closed loop into many short, overlapping/gapped fragments so the
 * silhouette reads as retraced chalk marks rather than one clean contour.
 * Structure is deterministic (independent of the jitter PRNG).
 */
function fragmentLoop(loop: Pt[]): Pt[][] {
  const n = loop.length;
  const frags: Pt[][] = [];
  let i = 0;
  let step = 0;
  while (i < n) {
    const fragLen = 5 + (step % 4); // 5..8 vertices per fragment
    const frag: Pt[] = [];
    for (let k = 0; k < fragLen; k++) frag.push(loop[(i + k) % n]);
    frags.push(frag);
    const mode = step % 3;
    const adv =
      mode === 0 ? fragLen - 2 : // overlap → retraced marks
      mode === 1 ? fragLen - 1 : // adjacent
                   fragLen + 1;  // skip → gap
    i += Math.max(1, adv);
    step++;
  }
  return frags;
}

/**
 * Spread-eagle lying body authored in a local frame (~660×400, landscape ~1.6:1,
 * origin near torso center): rounded head, torso, two arms and two legs fanning
 * toward the corners. Each part is one closed outline loop.
 */
function buildBodyLoops(): Pt[][] {
  return [
    circleLoop(0, -128, 50, 48),                    // head
    capsuleLoop(0, -78, 0, 78, 52, 10, 10),         // torso (neck → hip)
    capsuleLoop(-28, -58, -298, -138, 20, 12, 8),   // left arm
    capsuleLoop(28, -58, 298, -138, 20, 12, 8),     // right arm
    capsuleLoop(-24, 70, -228, 212, 26, 12, 8),     // left leg
    capsuleLoop(24, 70, 228, 212, 26, 12, 8),       // right leg
  ];
}

// ── i18n (field labels; name/category are inlined in meta) ──
const i18n = {
  centerX:         { zh: '水平位置',   en: 'Center X',        ja: '水平位置' },
  centerY:         { zh: '垂直位置',   en: 'Center Y',        ja: '垂直位置' },
  orientation:     { zh: '旋转角度',   en: 'Orientation',     ja: '回転角度' },
  figureScale:     { zh: '整体缩放',   en: 'Figure Scale',    ja: '全体スケール' },
  chalkLineWidth:  { zh: '粉笔线宽',   en: 'Chalk Width',     ja: 'チョーク線幅' },
  figureOpacity:   { zh: '整体不透明度', en: 'Figure Opacity',  ja: '全体不透明度' },
  chalkColor:      { zh: '粉笔颜色',   en: 'Chalk Color',     ja: 'チョーク色' },
  roughnessSeed:   { zh: '随机种子',   en: 'Roughness Seed',  ja: 'ラフネスシード' },
  roughnessFactor: { zh: '粗糙度',     en: 'Roughness',       ja: 'ラフネス' },
  haloSpread:      { zh: '粉尘扩散',   en: 'Halo Spread',     ja: 'ハロー拡散' },
  haloWidthFactor: { zh: '粉尘线宽比', en: 'Halo Width',      ja: 'ハロー線幅比' },
  haloOpacity:     { zh: '粉尘不透明度', en: 'Halo Opacity',    ja: 'ハロー不透明度' },
  beatBreath:      { zh: '节拍呼吸',   en: 'Beat Breathing',  ja: 'ビート呼吸' },
  beatBreathAmount:{ zh: '呼吸强度',   en: 'Breath Amount',   ja: '呼吸強度' },
};

const GRP_LAYOUT = '布局';
const GRP_CHALK = '粉笔';
const GRP_ADV = '高级';

export class ChalkFigureV2 extends BaseEffectV2 {
  static readonly meta: EffectMeta = {
    type: 'chalkFigure',
    name: { zh: '粉笔人形', en: 'Chalk Figure', ja: 'チョーク人形' },
    category: { zh: '特殊形状', en: 'Special Shapes', ja: '特殊形状' },
    layer: 'decoration',
    version: 2,
    fields: [
      // Placement
      { key: 'centerX',        label: i18n.centerX,        type: { kind: 'number', min: 0, max: 1, step: 0.01, default: 0.5 }, group: GRP_LAYOUT },
      { key: 'centerY',        label: i18n.centerY,        type: { kind: 'number', min: 0, max: 1, step: 0.01, default: 0.5 }, group: GRP_LAYOUT },
      { key: 'orientation',    label: i18n.orientation,    type: { kind: 'number', min: -3.14159, max: 3.14159, step: 0.01, default: 0 }, group: GRP_LAYOUT },
      { key: 'figureScale',    label: i18n.figureScale,    type: { kind: 'number', min: 0.5, max: 4, step: 0.05, default: 1.5 }, group: GRP_LAYOUT },
      // Chalk look
      { key: 'chalkColor',     label: i18n.chalkColor,     type: { kind: 'color', default: '#ffffff', paletteRef: true }, group: GRP_CHALK },
      { key: 'chalkLineWidth', label: i18n.chalkLineWidth, type: { kind: 'number', min: 1, max: 12, step: 0.5, default: 5 }, group: GRP_CHALK },
      { key: 'figureOpacity',  label: i18n.figureOpacity,  type: { kind: 'number', min: 0, max: 1, step: 0.01, default: 0.88 }, group: GRP_CHALK },
      { key: 'roughnessSeed',  label: i18n.roughnessSeed,  type: { kind: 'integer', min: 0, max: 999999, default: 1 }, group: GRP_CHALK },
      // Advanced texture tuning
      { key: 'roughnessFactor', label: i18n.roughnessFactor, type: { kind: 'number', min: 0, max: 1, step: 0.01, default: 0.42 }, group: GRP_ADV, advanced: true },
      { key: 'haloSpread',      label: i18n.haloSpread,      type: { kind: 'number', min: 1, max: 4, step: 0.1, default: 2.35 }, group: GRP_ADV, advanced: true },
      { key: 'haloWidthFactor', label: i18n.haloWidthFactor, type: { kind: 'number', min: 0.1, max: 1, step: 0.02, default: 0.4 }, group: GRP_ADV, advanced: true },
      { key: 'haloOpacity',     label: i18n.haloOpacity,     type: { kind: 'number', min: 0, max: 1, step: 0.01, default: 0.3 }, group: GRP_ADV, advanced: true },
      // Optional: subtle beat-reactive breathing (default off)
      { key: 'beatBreath',       label: i18n.beatBreath,       type: { kind: 'boolean', default: false }, group: GRP_ADV, advanced: true },
      { key: 'beatBreathAmount', label: i18n.beatBreathAmount, type: { kind: 'number', min: 0, max: 0.3, step: 0.01, default: 0.08 }, group: GRP_ADV, advanced: true },
    ],
  };

  private figure!: PIXI.Container;
  private gMain!: PIXI.Graphics;
  private gHalo!: PIXI.Graphics;
  private built = false;

  protected setup(): void {
    this.figure = new PIXI.Container();
    this.gMain = new PIXI.Graphics(); // main chalk line (drawn first, underneath)
    this.gHalo = new PIXI.Graphics(); // dust halo (drawn on top)
    this.figure.addChild(this.gMain);
    this.figure.addChild(this.gHalo);
    this.container.addChild(this.figure);
  }

  /**
   * Build the two stroke passes once, with frozen seeded jitter, and place the
   * container. Idempotent: after a successful build subsequent frames are no-ops
   * unless a config/palette change marks a rebuild.
   */
  private build(sw: number, sh: number): void {
    const scale = this.config.figureScale ?? 1.5;
    const lineWidth = this.config.chalkLineWidth ?? 5;
    const roughness = this.config.roughnessFactor ?? 0.42;
    const haloSpread = this.config.haloSpread ?? 2.35;
    const haloWidthFactor = this.config.haloWidthFactor ?? 0.4;
    const haloOpacity = this.config.haloOpacity ?? 0.3;
    const color = resolveColor(this.config.chalkColor ?? '#ffffff', this.palette);

    // Effective thickness and jitter amplitudes (all in scaled/local units).
    const T = lineWidth * scale;
    const J = lineWidth * scale * roughness;
    const Jhalo = J * haloSpread;

    // Deterministic Park-Miller minimal-standard PRNG, seeded once at build.
    // Seed 0 is degenerate (state stays 0, noise() collapses to ≈ −a), producing a
    // clean diagonally-offset double outline; the field defaults to 1 for genuine
    // per-vertex roughness.
    let state = Math.floor(this.config.roughnessSeed ?? 1) % 2147483647;
    if (state < 0) state += 2147483647;
    const noise = (a: number): number => {
      state = (state * 16807) % 2147483647;
      const u = (state - 1) / 2147483646; // u in [0,1)
      return (u - 0.5) * 2 * a;           // uniform in [−a, +a]
    };

    // Assemble the broken-fragment silhouette.
    const loops = buildBodyLoops();
    const frags: Pt[][] = [];
    for (const loop of loops) for (const f of fragmentLoop(loop)) frags.push(f);

    // Pass 1 — main chalk line: full thickness, opaque, per-vertex jitter ±J.
    this.gMain.clear();
    for (const frag of frags) {
      const p0 = frag[0];
      this.gMain.moveTo(p0.x * scale + noise(J), p0.y * scale + noise(J));
      for (let k = 1; k < frag.length; k++) {
        const p = frag[k];
        this.gMain.lineTo(p.x * scale + noise(J), p.y * scale + noise(J));
      }
      this.gMain.closePath(); // link last vertex back to first
    }
    this.gMain.stroke({ width: T, color, alpha: 1, cap: 'round', join: 'round' });

    // Pass 2 — dust halo: thinner, fainter echo with a wider scatter ±(J·spread).
    this.gHalo.clear();
    for (const frag of frags) {
      const p0 = frag[0];
      this.gHalo.moveTo(p0.x * scale + noise(Jhalo), p0.y * scale + noise(Jhalo));
      for (let k = 1; k < frag.length; k++) {
        const p = frag[k];
        this.gHalo.lineTo(p.x * scale + noise(Jhalo), p.y * scale + noise(Jhalo));
      }
      this.gHalo.closePath();
    }
    this.gHalo.stroke({ width: T * haloWidthFactor, color, alpha: haloOpacity, cap: 'round', join: 'round' });

    // Place / rotate / fade the whole figure as one unit.
    this.figure.position.set((this.config.centerX ?? 0.5) * sw, (this.config.centerY ?? 0.5) * sh);
    this.figure.rotation = this.config.orientation ?? 0;
    this.figure.alpha = this.config.figureOpacity ?? 0.88;

    this.built = true;
  }

  update(ctx: UpdateContext): void {
    // Lazy build once a valid, nonzero screen size is known. The figure captures
    // that first size and does not rebuild on resize.
    if (!this.built) {
      if (ctx.screenWidth > 0 && ctx.screenHeight > 0) {
        this.build(ctx.screenWidth, ctx.screenHeight);
      }
      return;
    }

    // The figure is static by default. The optional breathing below is gated behind
    // `beatBreath` (default off) and only modulates alpha.
    if (this.config.beatBreath) {
      const base = this.config.figureOpacity ?? 0.88;
      const k = this.config.beatBreathAmount ?? 0.08;
      this.figure.alpha = Math.min(1, base * (1 + k * (ctx.beatIntensity ?? 0)));
    }
  }

  // ── Hot-update support ──

  /** Any parameter change rebuilds the frozen figure on the next update. */
  protected onConfigChange(_key: string, _value: any): void {
    this.built = false;
  }

  protected onPaletteChange(): void {
    // Rebuild only if the chalk color references the palette.
    if (typeof this.config.chalkColor === 'string' && this.config.chalkColor.startsWith('$')) {
      this.built = false;
    }
  }
}
