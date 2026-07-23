// VTB-LIVE Fork - Copyright (c) 2026 VTB-LIVE
// Licensed under AGPL-3.0.
// Effects V2 — Chalk Figure
// A static, hand-drawn crime-scene chalk body outline: an asymmetric sprawled
// silhouette with bent limbs and interior gesture strokes, drawn as many short,
// broken, retraced stroke fragments with a faint dusty halo, using frozen seeded
// per-vertex jitter (no animation).

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
 * A bent limb: two connected capsule segments (upper + lower) meeting at a
 * mid-joint (elbow/knee). The lower segment turns by `bend` relative to the
 * upper one, and is slightly thinner, so the limb reads as jointed rather than
 * as one straight bar. Returns two closed loops.
 */
function bentLimb(
  rootX: number, rootY: number,
  baseAngle: number, len1: number, len2: number, bend: number,
  r1: number, r2: number,
): Pt[][] {
  const ex = rootX + Math.cos(baseAngle) * len1;
  const ey = rootY + Math.sin(baseAngle) * len1;
  const a2 = baseAngle + bend;
  const tx = ex + Math.cos(a2) * len2;
  const ty = ey + Math.sin(a2) * len2;
  return [
    capsuleLoop(rootX, rootY, ex, ey, r1, 16, 10),
    capsuleLoop(ex, ey, tx, ty, r2, 16, 10),
  ];
}

/** Densify an open control polyline into evenly interpolated vertices. */
function densify(ctrl: Pt[], perSeg: number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < ctrl.length - 1; i++) {
    const a = ctrl[i], b = ctrl[i + 1];
    const last = i === ctrl.length - 2;
    for (let k = 0; k <= (last ? perSeg : perSeg - 1); k++) {
      const t = k / perSeg;
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  return out;
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
    const fragLen = 3 + (step % 3); // 3..5 vertices per fragment (dense retrace)
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
 * Break an OPEN path (interior gesture stroke) into short fragments without
 * wrapping the ends together. Same overlap/gap cadence as fragmentLoop.
 */
function fragmentPath(path: Pt[]): Pt[][] {
  const n = path.length;
  const frags: Pt[][] = [];
  let i = 0;
  let step = 0;
  while (i < n - 1) {
    const fragLen = 3 + (step % 3);
    const frag: Pt[] = [];
    for (let k = 0; k < fragLen && i + k < n; k++) frag.push(path[i + k]);
    if (frag.length >= 2) frags.push(frag);
    const mode = step % 3;
    const adv =
      mode === 0 ? fragLen - 2 :
      mode === 1 ? fragLen - 1 :
                   fragLen + 1;
    i += Math.max(1, adv);
    step++;
  }
  return frags;
}

const DEG = Math.PI / 180;

/**
 * Sprawled body authored in a local frame (~660×400, landscape, origin near
 * torso center). Geometry is seed-perturbed and deliberately ASYMMETRIC: head
 * and torso sit slightly off the vertical axis, and each arm/leg gets its own
 * length, radius, splay angle and mid-joint bend drawn from `rnd` — so no two
 * limbs are exact mirrors. `rnd` returns values in [-1, 1). `asym` scales the
 * perturbation amplitude; `interior` toggles the gesture strokes.
 *
 * Returns closed outline `loops` (drawn closed) and open interior `strokes`.
 */
function buildBody(
  rnd: () => number,
  asym: number,
  interior: boolean,
): { loops: Pt[][]; strokes: Pt[][] } {
  const v = (c: number, sp: number): number => c + rnd() * sp * asym;

  const loops: Pt[][] = [];

  // Head + torso, each nudged off the centerline in its own direction.
  const headX = v(0, 12);
  const torsoTop = v(0, 8);
  const torsoBot = v(0, 10);
  loops.push(circleLoop(headX, v(-128, 6), v(50, 4), 64));            // head
  loops.push(capsuleLoop(torsoTop, -80, torsoBot, 80, v(52, 4), 18, 12)); // torso

  // Shoulder / hip anchors (slightly uneven left vs. right).
  const lsx = v(-30, 5), lsy = v(-60, 5);
  const rsx = v(30, 5), rsy = v(-60, 5);
  const lhx = v(-24, 5), lhy = v(74, 5);
  const rhx = v(24, 5), rhy = v(74, 5);

  // Arms fan to the upper corners; independent draws break the mirror.
  for (const seg of bentLimb(
    lsx, lsy, v(214, 15) * DEG, v(148, 24), v(150, 28), v(0.20, 0.22),
    v(20, 3), v(15, 2.5),
  )) loops.push(seg); // left arm (up-left)
  for (const seg of bentLimb(
    rsx, rsy, v(326, 15) * DEG, v(154, 24), v(146, 28), v(-0.16, 0.22),
    v(20, 3), v(15, 2.5),
  )) loops.push(seg); // right arm (up-right)

  // Legs fan to the lower corners.
  for (const seg of bentLimb(
    lhx, lhy, v(134, 13) * DEG, v(118, 22), v(132, 26), v(-0.14, 0.20),
    v(27, 3.5), v(20, 3),
  )) loops.push(seg); // left leg (down-left)
  for (const seg of bentLimb(
    rhx, rhy, v(46, 13) * DEG, v(124, 22), v(126, 26), v(0.17, 0.20),
    v(27, 3.5), v(20, 3),
  )) loops.push(seg); // right leg (down-right)

  const strokes: Pt[][] = [];
  if (interior) {
    // Spine down the torso with a slight lateral wander.
    strokes.push(densify([
      { x: torsoTop, y: -66 },
      { x: v(0, 6), y: -22 },
      { x: v(0, 6), y: 30 },
      { x: torsoBot, y: 66 },
    ], 6));
    // Collar line arcing across the chest between the shoulders.
    strokes.push(densify([
      { x: lsx + 8, y: lsy + 6 },
      { x: v(0, 4), y: -52 },
      { x: rsx - 8, y: rsy + 6 },
    ], 6));
    // Short chest hatch reaching toward the left arm.
    strokes.push(densify([
      { x: v(-10, 4), y: v(-30, 4) },
      { x: v(-72, 6), y: v(-50, 6) },
    ], 6));
    // Short waist hatch reaching toward the right leg.
    strokes.push(densify([
      { x: v(8, 4), y: v(40, 4) },
      { x: v(62, 6), y: v(72, 6) },
    ], 6));
  }

  return { loops, strokes };
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
  interiorStrokes: { zh: '内部笔触',   en: 'Interior Strokes', ja: '内部ストローク' },
  roughnessFactor: { zh: '粗糙度',     en: 'Roughness',       ja: 'ラフネス' },
  limbAsymmetry:   { zh: '肢体不对称', en: 'Limb Asymmetry',  ja: '手足の非対称' },
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
    type: 'chalkFigureV2',
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
      { key: 'figureOpacity',  label: i18n.figureOpacity,  type: { kind: 'number', min: 0, max: 1, step: 0.01, default: 0.85 }, group: GRP_CHALK },
      { key: 'roughnessSeed',  label: i18n.roughnessSeed,  type: { kind: 'integer', min: 0, max: 999999, default: 1 }, group: GRP_CHALK },
      { key: 'interiorStrokes', label: i18n.interiorStrokes, type: { kind: 'boolean', default: true }, group: GRP_CHALK },
      // Advanced texture tuning
      { key: 'roughnessFactor', label: i18n.roughnessFactor, type: { kind: 'number', min: 0, max: 1, step: 0.01, default: 0.42 }, group: GRP_ADV, advanced: true },
      { key: 'limbAsymmetry',   label: i18n.limbAsymmetry,   type: { kind: 'number', min: 0, max: 2, step: 0.05, default: 1 }, group: GRP_ADV, advanced: true },
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
  private lastW = 0;
  private lastH = 0;

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
   * unless a config/palette change marks a rebuild. Geometry is screen-independent;
   * only the container position depends on the screen size.
   */
  private build(sw: number, sh: number): void {
    const scale = Math.max(0.05, Number(this.config.figureScale) || 1.5);
    const lineWidth = this.config.chalkLineWidth ?? 5;
    const roughness = this.config.roughnessFactor ?? 0.42;
    const asym = Math.max(0, Number(this.config.limbAsymmetry ?? 1));
    const interior = this.config.interiorStrokes ?? true;
    const haloSpread = this.config.haloSpread ?? 2.35;
    const haloWidthFactor = this.config.haloWidthFactor ?? 0.4;
    const haloOpacity = this.config.haloOpacity ?? 0.3;
    const color = resolveColor(this.config.chalkColor ?? '#ffffff', this.palette);

    // Effective thickness and jitter amplitudes (all in scaled/local units).
    const T = lineWidth * scale;
    const J = lineWidth * scale * roughness;
    const Jhalo = J * haloSpread;

    const seed = (Math.floor(this.config.roughnessSeed ?? 1) >>> 0);

    // Geometry PRNG — mulberry32, seeded on a distinct mixing constant so limb
    // asymmetry is deterministic yet does not consume the jitter noise stream.
    let gs = (seed ^ 0x85ebca6b) >>> 0;
    const grand = (): number => {
      gs = (gs + 0x6d2b79f5) | 0;
      let t = Math.imul(gs ^ (gs >>> 15), 1 | gs);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296 * 2 - 1; // [-1, 1)
    };

    // Jitter PRNG — mulberry32, the per-vertex scatter stream (unchanged look).
    let s = (seed ^ 0x9e3779b9) >>> 0;
    const noise = (a: number): number => {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      const u = ((t ^ (t >>> 14)) >>> 0) / 4294967296; // u in [0,1)
      return (u - 0.5) * 2 * a;                        // uniform in [−a, +a]
    };

    // Assemble the broken-fragment silhouette: closed outline loops + open
    // interior gesture strokes, each split into short retraced marks.
    const { loops, strokes } = buildBody(grand, asym, interior);
    const loopFrags: Pt[][] = [];
    for (const loop of loops) for (const f of fragmentLoop(loop)) loopFrags.push(f);
    const strokeFrags: Pt[][] = [];
    for (const path of strokes) for (const f of fragmentPath(path)) strokeFrags.push(f);

    // One jittered pass: closed outline fragments are linked end-to-start;
    // open interior fragments are left as-is.
    const drawFrags = (g: PIXI.Graphics, amp: number): void => {
      for (const frag of loopFrags) {
        const p0 = frag[0];
        g.moveTo(p0.x * scale + noise(amp), p0.y * scale + noise(amp));
        for (let k = 1; k < frag.length; k++) {
          const p = frag[k];
          g.lineTo(p.x * scale + noise(amp), p.y * scale + noise(amp));
        }
        g.closePath();
      }
      for (const frag of strokeFrags) {
        const p0 = frag[0];
        g.moveTo(p0.x * scale + noise(amp), p0.y * scale + noise(amp));
        for (let k = 1; k < frag.length; k++) {
          const p = frag[k];
          g.lineTo(p.x * scale + noise(amp), p.y * scale + noise(amp));
        }
      }
    };

    // Pass 1 — main chalk line: full thickness, opaque, per-vertex jitter ±J.
    this.gMain.clear();
    drawFrags(this.gMain, J);
    this.gMain.stroke({ width: T, color, alpha: 1, cap: 'round', join: 'round' });

    // Pass 2 — dust halo: thinner, fainter echo with a wider scatter ±(J·spread).
    this.gHalo.clear();
    drawFrags(this.gHalo, Jhalo);
    this.gHalo.stroke({ width: T * haloWidthFactor, color, alpha: haloOpacity, cap: 'round', join: 'round' });

    // Place / rotate / fade the whole figure as one unit.
    this.figure.position.set((this.config.centerX ?? 0.5) * sw, (this.config.centerY ?? 0.5) * sh);
    this.figure.rotation = this.config.orientation ?? 0;
    const op = Number(this.config.figureOpacity);
    this.figure.alpha = Number.isFinite(op) ? Math.min(1, Math.max(0, op)) : 0.85;

    this.lastW = sw;
    this.lastH = sh;
    this.built = true;
  }

  update(ctx: UpdateContext): void {
    // Lazy build once a valid, nonzero screen size is known. The geometry is
    // frozen at build; only placement tracks later resizes.
    if (!this.built) {
      if (ctx.screenWidth > 0 && ctx.screenHeight > 0) {
        this.build(ctx.screenWidth, ctx.screenHeight);
      }
      return;
    }

    // Resize-safe placement: geometry is screen-independent, but the fractional
    // center maps to pixels, so re-apply position when the screen size changes.
    if (
      ctx.screenWidth > 0 && ctx.screenHeight > 0 &&
      (ctx.screenWidth !== this.lastW || ctx.screenHeight !== this.lastH)
    ) {
      this.lastW = ctx.screenWidth;
      this.lastH = ctx.screenHeight;
      this.figure.position.set(
        (this.config.centerX ?? 0.5) * ctx.screenWidth,
        (this.config.centerY ?? 0.5) * ctx.screenHeight,
      );
    }

    // The figure is static by default. The optional breathing below is gated behind
    // `beatBreath` (default off) and only modulates alpha.
    if (this.config.beatBreath) {
      const base = this.config.figureOpacity ?? 0.85;
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
