// VTB-LIVE Fork - Copyright (c) 2026 VTB-LIVE
// Licensed under AGPL-3.0.
// Effects V2 — Shard Text
// The current lyric line is rasterized glyph-by-glyph, split into sub-glyph
// fragments (individual strokes / radicals) via alpha connected-component
// labelling, and each fragment shatters into a deterministic scattered pose
// before reassembling into its home stroke, then gently floats and (optionally)
// pushes outward on the beat. The reassembled fragments still read as the line.

import * as PIXI from 'pixi.js';
import { BaseEffectV2 } from '../BaseEffect';
import type { EffectMeta } from '../schema';
import type { UpdateContext } from '../../../types/engine';
import { resolveColor } from '../../../types/engine';

// ── Deterministic hashing / PRNG (integer bit-mixing, no sin-fract) ──

/** FNV-1a 32-bit string hash → unsigned 32-bit integer seed. */
function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * mulberry32-style PRNG factory: from a 32-bit seed returns a generator that
 * emits successive floats in [0, 1). Pure integer mixing — deterministic and
 * independent of any GLSL-style trig hash.
 */
function makeRng(seed: number): () => number {
  let s = (seed ^ 0x9e3779b9) >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Small math helpers ──

const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
/** Cubic ease-out: fast start, gentle settle. */
const easeOut = (x: number): number => 1 - (1 - x) ** 3;
/** Hermite smoothstep on an already-clamped [0,1] input. */
const smooth = (x: number): number => x * x * (3 - 2 * x);

// ── Tokenizer: CJK char-by-char, Latin split on whitespace into words ──
// Each token is rasterized then flood-filled into components, so Latin words
// naturally shatter into per-letter strokes and CJK chars into radicals.

const CJK_RE = /[\p{sc=Han}\p{sc=Hiragana}\p{sc=Katakana}]/u;
const RUN_RE = /[\p{sc=Han}\p{sc=Hiragana}\p{sc=Katakana}]+|[^\p{sc=Han}\p{sc=Hiragana}\p{sc=Katakana}]+/gu;

function tokenize(text: string): string[] {
  const runs = text.match(RUN_RE);
  if (!runs) return [];
  const out: string[] = [];
  for (const run of runs) {
    if (CJK_RE.test(run)) {
      for (const ch of run) if (ch.trim()) out.push(ch);
    } else {
      for (const w of run.split(/\s+/)) if (w) out.push(w);
    }
  }
  return out;
}

// ── Connected-component labelling (own flood-fill, 8-connectivity) ──

interface Component {
  label: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  area: number; // foreground pixel count
}

/**
 * Textbook BFS flood-fill over alpha-above-threshold pixels of an RGBA buffer.
 * Returns a per-pixel label map and one Component (bbox + area) per blob.
 * Background and unreachable pixels keep label -2 / -1; foreground blobs are
 * labelled 0,1,2… — the index into the returned components array.
 */
function labelComponents(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  threshold: number,
): { labels: Int32Array; comps: Component[] } {
  const n = w * h;
  const labels = new Int32Array(n).fill(-1);
  const comps: Component[] = [];
  // Reused explicit queue (indices into the pixel grid) — no recursion, so a
  // pathologically large blob cannot blow the call stack.
  const queue = new Int32Array(n);

  for (let start = 0; start < n; start++) {
    if (labels[start] !== -1) continue;
    if (data[start * 4 + 3] < threshold) {
      labels[start] = -2; // background
      continue;
    }
    const label = comps.length;
    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    labels[start] = label;
    let minX = w;
    let minY = h;
    let maxX = 0;
    let maxY = 0;
    let area = 0;

    while (head < tail) {
      const p = queue[head++];
      const x = p % w;
      const y = (p / w) | 0;
      area++;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;

      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          if (nx < 0 || nx >= w) continue;
          const np = ny * w + nx;
          if (labels[np] === -1 && data[np * 4 + 3] >= threshold) {
            labels[np] = label;
            queue[tail++] = np;
          }
        }
      }
    }
    comps.push({ label, minX, minY, maxX, maxY, area });
  }
  return { labels, comps };
}

// ── Per-piece (per-component) state ──

interface Piece {
  sprite: PIXI.Sprite;
  texture: PIXI.Texture; // owned per-component texture (destroyed on teardown)
  homeX: number;
  homeY: number;
  scatX: number;   // scattered start position
  scatY: number;
  scatRot: number; // scattered start rotation (rad)
  scatScale: number; // scattered start scale (< 1, grows to 1)
  dirX: number;    // outward unit direction (for beat push)
  dirY: number;
  delay: number;   // stagger before this piece resolves (s)
  phaseX: number;  // float phases
  phaseY: number;
  floatMul: number;
}

// Rasterization / CCL tuning (authored constants, not matched to any source).
const ALPHA_THRESHOLD = 90;   // foreground cut on the glyph's alpha channel
const MAX_COMPONENTS = 260;   // hard cap on emitted fragments per line
const MAX_CANVAS_DIM = 4096;  // clamp offscreen glyph canvas size

// ── i18n ──
const i18n = {
  name:      { zh: '碎片文字',   en: 'Shard Text',       ja: 'シャード文字' },
  category:  { zh: '文字',       en: 'Text',             ja: 'テキスト' },
  color:     { zh: '颜色',       en: 'Color',            ja: '色' },
  maxSize:   { zh: '最大字号',   en: 'Max Font Size',    ja: '最大フォントサイズ' },
  font:      { zh: '字体',       en: 'Font',             ja: 'フォント' },
  weight:    { zh: '字重',       en: 'Font Weight',      ja: 'フォントウェイト' },
  fitWidth:  { zh: '宽度占比',   en: 'Fit Width',        ja: '幅の割合' },
  fitHeight: { zh: '最大高度占比', en: 'Max Height',       ja: '最大高さ割合' },
  posY:      { zh: 'Y 位置',     en: 'Y Position',       ja: 'Y 位置' },
  assemble:  { zh: '组装动画',   en: 'Assemble',         ja: '組み立て' },
  assembDur: { zh: '组装时长',   en: 'Assemble Duration', ja: '組み立て時間' },
  radius:    { zh: '散射半径',   en: 'Scatter Radius',   ja: '散乱半径' },
  spin:      { zh: '最大旋转',   en: 'Max Rotation',     ja: '最大回転' },
  stagger:   { zh: '错峰延迟',   en: 'Stagger Delay',    ja: 'ずらし遅延' },
  floatOn:   { zh: '漂浮',       en: 'Float',            ja: 'フロート' },
  floatAmt:  { zh: '漂浮幅度',   en: 'Float Amount',     ja: 'フロート幅' },
  floatSpd:  { zh: '漂浮速度',   en: 'Float Speed',      ja: 'フロート速度' },
  beatOn:    { zh: '节拍推动',   en: 'Beat Push',        ja: 'ビートプッシュ' },
  beatAmt:   { zh: '推动幅度',   en: 'Push Amount',      ja: 'プッシュ量' },
};

const GRP_LAYOUT = '布局';
const GRP_ANIM = '动画';

export class ShardTextV2 extends BaseEffectV2 {
  static readonly meta: EffectMeta = {
    type: 'shardTextV2',
    name: i18n.name,
    category: i18n.category,
    layer: 'text',
    version: 2,
    fields: [
      // Layout
      { key: 'shardColor',    label: i18n.color,     type: { kind: 'color', default: '#ffffff', paletteRef: true }, group: GRP_LAYOUT },
      { key: 'maxFontSize',   label: i18n.maxSize,   type: { kind: 'number', min: 16, max: 240, step: 2, default: 84 }, group: GRP_LAYOUT },
      { key: 'fontFamily',    label: i18n.font,      type: { kind: 'string', default: '"Noto Serif JP", "Yu Mincho", serif' }, group: GRP_LAYOUT },
      { key: 'shardWeight',   label: i18n.weight,    type: { kind: 'string', default: '900', options: ['400', '600', '700', '800', '900'] }, group: GRP_LAYOUT },
      { key: 'fitWidthFrac',  label: i18n.fitWidth,  type: { kind: 'number', min: 0.2, max: 1, step: 0.02, default: 0.84 }, group: GRP_LAYOUT },
      { key: 'fitHeightFrac', label: i18n.fitHeight, type: { kind: 'number', min: 0.05, max: 0.8, step: 0.01, default: 0.26 }, group: GRP_LAYOUT },
      { key: 'posYFrac',      label: i18n.posY,      type: { kind: 'number', min: 0, max: 1, step: 0.01, default: 0.5 }, group: GRP_LAYOUT },
      // Assemble
      { key: 'enableAssemble',   label: i18n.assemble,  type: { kind: 'boolean', default: true }, group: GRP_ANIM },
      { key: 'assembleDuration', label: i18n.assembDur, type: { kind: 'number', min: 0.2, max: 4, step: 0.05, default: 1.15 }, group: GRP_ANIM },
      { key: 'scatterRadiusFrac', label: i18n.radius,   type: { kind: 'number', min: 0, max: 1, step: 0.02, default: 0.42 }, group: GRP_ANIM },
      { key: 'maxSpin',          label: i18n.spin,      type: { kind: 'number', min: 0, max: 3.14159, step: 0.05, default: 1.8 }, group: GRP_ANIM },
      { key: 'staggerDelay',     label: i18n.stagger,   type: { kind: 'number', min: 0, max: 2, step: 0.02, default: 0.55 }, group: GRP_ANIM, advanced: true },
      // Float / breathe
      { key: 'enableFloat', label: i18n.floatOn,  type: { kind: 'boolean', default: true }, group: GRP_ANIM },
      { key: 'floatAmount', label: i18n.floatAmt, type: { kind: 'number', min: 0, max: 48, step: 1, default: 5 }, group: GRP_ANIM },
      { key: 'floatSpeed',  label: i18n.floatSpd, type: { kind: 'number', min: 0.1, max: 5, step: 0.1, default: 1.3 }, group: GRP_ANIM, advanced: true },
      // Beat — opt-in (off by default): when enabled, pieces push outward on each
      // beat. Kept off by default so calm templates do not twitch on every BPM beat.
      { key: 'enableBeat', label: i18n.beatOn,  type: { kind: 'boolean', default: false }, group: GRP_ANIM },
      { key: 'beatPush',   label: i18n.beatAmt, type: { kind: 'number', min: 0, max: 160, step: 2, default: 44 }, group: GRP_ANIM, advanced: true },
    ],
  };

  private wrapper!: PIXI.Container;
  private pieces: Piece[] = [];
  private lastText = '\0'; // sentinel: never equals a real line, forces first layout
  private lastW = -1;
  private lastH = -1;
  private warnedCap = false;

  protected setup(): void {
    this.wrapper = new PIXI.Container();
    this.container.addChild(this.wrapper);
  }

  /** Destroy all current piece sprites and their owned textures. */
  private teardown(): void {
    this.wrapper.removeChildren();
    for (const p of this.pieces) {
      try { p.sprite.destroy(); } catch { /* already gone */ }
      try { p.texture.destroy(true); } catch { /* already gone */ }
    }
    this.pieces = [];
  }

  /** Free all per-fragment textures on effect removal (song switch / rebuild). */
  destroy(): void {
    this.teardown();
    super.destroy();
  }

  /**
   * Rasterize a single token to an offscreen canvas at the given font, run
   * connected-component labelling over its alpha, and return one masked
   * sub-glyph texture per surviving component together with the component
   * centre (in the token's own canvas coordinates) and the token advance width.
   */
  private rasterizeToken(
    token: string,
    fontStr: string,
    ascent: number,
    descent: number,
    minArea: number,
  ): { advance: number; parts: { texture: PIXI.Texture; cx: number; cy: number }[] } {
    const measure = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
    measure.font = fontStr;
    measure.textBaseline = 'alphabetic';
    measure.textAlign = 'left';
    const advance = Math.max(1, measure.measureText(token).width);

    const pad = Math.ceil(ascent * 0.3) + 4;
    const w = Math.min(MAX_CANVAS_DIM, Math.ceil(advance) + pad * 2);
    const h = Math.min(MAX_CANVAS_DIM, Math.ceil(ascent + descent) + pad * 2);
    const baseY = pad + ascent;

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.font = fontStr;
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    // White ink so each sprite can be tinted to the palette colour later.
    ctx.fillStyle = '#ffffff';
    ctx.fillText(token, pad, baseY);

    const img = ctx.getImageData(0, 0, w, h);
    const { labels, comps } = labelComponents(img.data, w, h, ALPHA_THRESHOLD);

    const parts: { texture: PIXI.Texture; cx: number; cy: number }[] = [];
    for (const c of comps) {
      if (c.area < minArea) continue;
      const cw = c.maxX - c.minX + 1;
      const ch = c.maxY - c.minY + 1;
      const cnv = document.createElement('canvas');
      cnv.width = cw;
      cnv.height = ch;
      const cctx = cnv.getContext('2d')!;
      const out = cctx.createImageData(cw, ch);
      const od = out.data;
      // Copy only pixels that belong to this component; neighbouring strokes
      // that merely intersect the bounding box are excluded, so overlapping
      // bboxes never double-draw.
      for (let y = c.minY; y <= c.maxY; y++) {
        for (let x = c.minX; x <= c.maxX; x++) {
          const sidx = y * w + x;
          if (labels[sidx] !== c.label) continue;
          const didx = ((y - c.minY) * cw + (x - c.minX)) * 4;
          od[didx] = 255;
          od[didx + 1] = 255;
          od[didx + 2] = 255;
          od[didx + 3] = img.data[sidx * 4 + 3];
        }
      }
      cctx.putImageData(out, 0, 0);
      parts.push({
        texture: PIXI.Texture.from(cnv),
        cx: (c.minX + c.maxX + 1) / 2 - pad, // centre relative to token left origin
        cy: (c.minY + c.maxY + 1) / 2 - baseY, // centre relative to baseline
      });
    }
    return { advance, parts };
  }

  /**
   * Rebuild the whole line: tokenize, auto-fit a font size to the width/height
   * budgets, rasterize each token into sub-glyph fragments, lay them out so the
   * assembled fragments read as the line, and derive each fragment's
   * deterministic scattered pose from a per-fragment seed.
   */
  private layout(text: string, sw: number, sh: number): void {
    this.teardown();
    this.lastText = text;
    this.lastW = sw;
    this.lastH = sh;

    const tokens = tokenize(text);
    if (tokens.length === 0) return;

    const color = resolveColor(this.config.shardColor ?? '#ffffff', this.palette);
    const baseSize = this.config.maxFontSize ?? 84;
    const family = this.config.fontFamily ?? '"Noto Serif JP", "Yu Mincho", serif';
    const weight = String(this.config.shardWeight ?? '900');

    // Shared measuring context (reused for the fit pass and metrics).
    const measure = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;

    // Font metrics at base size (fontBoundingBox is text-independent).
    measure.font = `${weight} ${baseSize}px ${family}`;
    const fmBase = measure.measureText('Mgぱ国');
    const ascentBase = fmBase.fontBoundingBoxAscent || fmBase.actualBoundingBoxAscent || baseSize * 0.82;
    const descentBase = fmBase.fontBoundingBoxDescent || fmBase.actualBoundingBoxDescent || baseSize * 0.22;

    // Fit pass — measure advances at base size and shrink (never grow) to the budgets.
    const advBase: number[] = [];
    for (const tok of tokens) advBase.push(Math.max(1, measure.measureText(tok).width));
    const gapBase = baseSize * 0.24;
    let rowW = gapBase * Math.max(0, tokens.length - 1);
    for (const a of advBase) rowW += a;
    const maxH = ascentBase + descentBase;

    const maxRowW = (this.config.fitWidthFrac ?? 0.84) * sw;
    const maxRowH = (this.config.fitHeightFrac ?? 0.26) * sh;
    let fit = 1;
    if (rowW > maxRowW) fit = maxRowW / rowW;
    if (maxH * fit > maxRowH) fit = maxRowH / maxH;
    const finalSize = Math.max(1, baseSize * fit);

    const fontStr = `${weight} ${finalSize}px ${family}`;
    measure.font = fontStr;
    const fm = measure.measureText('Mgぱ国');
    const ascent = fm.fontBoundingBoxAscent || fm.actualBoundingBoxAscent || finalSize * 0.82;
    const descent = fm.fontBoundingBoxDescent || fm.actualBoundingBoxDescent || finalSize * 0.22;
    const minArea = Math.max(10, finalSize * finalSize * 0.0018);

    // Rasterize every token into sub-glyph fragments (skip tokens that vanish).
    type TokRaster = { advance: number; parts: { texture: PIXI.Texture; cx: number; cy: number }[] };
    const rasters: TokRaster[] = [];
    for (const tok of tokens) rasters.push(this.rasterizeToken(tok, fontStr, ascent, descent, minArea));

    // Row geometry from the fitted advances.
    const gap = gapBase * fit;
    let totalSpan = gap * Math.max(0, rasters.length - 1);
    for (const r of rasters) totalSpan += r.advance;
    // Vertically centre the ink block [-ascent, +descent] on the target Y.
    const baselineY = (this.config.posYFrac ?? 0.5) * sh + (ascent - descent) / 2;
    let cursor = sw / 2 - totalSpan / 2;

    // Scatter parameters.
    const radius = (this.config.scatterRadiusFrac ?? 0.42) * Math.min(sw, sh);
    const maxSpin = this.config.maxSpin ?? 1.8;
    const staggerDelay = this.config.staggerDelay ?? 0.55;
    const textSeed = fnv1a(text);

    let emitted = 0;
    let capped = false;

    for (let ti = 0; ti < rasters.length; ti++) {
      const r = rasters[ti];
      const tokenLeft = cursor;
      cursor += r.advance + gap;

      for (const part of r.parts) {
        if (emitted >= MAX_COMPONENTS) {
          // Beyond the cap we still must release textures we already rasterized.
          try { part.texture.destroy(true); } catch { /* ignore */ }
          capped = true;
          continue;
        }

        const homeX = tokenLeft + part.cx;
        const homeY = baselineY + part.cy;

        const sprite = new PIXI.Sprite(part.texture);
        sprite.anchor.set(0.5);
        sprite.tint = color;
        this.wrapper.addChild(sprite);

        // Per-fragment deterministic pose. Mixing the running fragment index into
        // the seed keeps neighbours independent while the line stays reproducible.
        const rng = makeRng(textSeed ^ Math.imul(emitted + 1, 0x27d4eb2f));
        const ang = rng() * Math.PI * 2;
        const dist = radius * (0.3 + 0.7 * rng());
        const dirX = Math.cos(ang);
        const dirY = Math.sin(ang);

        const p: Piece = {
          sprite,
          texture: part.texture,
          homeX,
          homeY,
          scatX: homeX + dirX * dist,
          scatY: homeY + dirY * dist,
          // Wider scatter rotation than the whole-token version.
          scatRot: (rng() * 2 - 1) * maxSpin,
          // Scale only shrinks toward home: start below 1, grow to 1.
          scatScale: 0.3 + rng() * 0.55,
          dirX,
          dirY,
          delay: rng() * staggerDelay,
          phaseX: rng() * Math.PI * 2,
          phaseY: rng() * Math.PI * 2,
          floatMul: 0.7 + rng() * 0.6,
        };

        // Seed the first rendered frame with the scattered/invisible pose so a
        // pre-update frame never flashes the assembled line.
        sprite.position.set(p.scatX, p.scatY);
        sprite.rotation = p.scatRot;
        sprite.scale.set(p.scatScale);
        sprite.alpha = 0;

        this.pieces.push(p);
        emitted++;
      }
    }

    if (capped && !this.warnedCap) {
      this.warnedCap = true;
      console.warn(`[shardTextV2] fragment count exceeded ${MAX_COMPONENTS}; extra fragments skipped.`);
    }
  }

  update(ctx: UpdateContext): void {
    const text = ctx.currentText ?? '';

    // Interlude / blank line under an active lyric source → render nothing.
    if (ctx.lyricsActive && text.trim() === '') {
      if (this.pieces.length) this.teardown();
      this.lastText = text;
      this.lastW = ctx.screenWidth;
      this.lastH = ctx.screenHeight;
      return;
    }

    // (Re)layout on text or screen-size change (lazy init on first valid frame).
    // Unchanged text at an unchanged size never re-rasterizes.
    if (text !== this.lastText || ctx.screenWidth !== this.lastW || ctx.screenHeight !== this.lastH) {
      if (ctx.screenWidth > 0 && ctx.screenHeight > 0) {
        this.layout(text, ctx.screenWidth, ctx.screenHeight);
      }
    }
    if (this.pieces.length === 0) return;

    // Everything below is derived purely from segmentTime / time / beatIntensity,
    // so a paused or scrubbed frame (deltaTime <= 0) still resolves to a coherent
    // static pose with no NaN and no half-fade.
    const segT = Number.isFinite(ctx.segmentTime) ? Math.max(0, ctx.segmentTime) : 0;
    const dur = Math.max(0.05, this.config.assembleDuration ?? 1.15);
    const useAssemble = this.config.enableAssemble ?? true;
    const useFloat = this.config.enableFloat ?? true;
    const useBeat = this.config.enableBeat ?? false;
    const floatAmt = this.config.floatAmount ?? 5;
    const floatSpd = this.config.floatSpeed ?? 1.3;
    const beatPush = this.config.beatPush ?? 44;
    const beat = Math.max(0, ctx.beatIntensity ?? 0);
    const time = ctx.time ?? 0;

    for (const p of this.pieces) {
      let px = p.homeX;
      let py = p.homeY;
      let rot = 0;
      let scl = 1;
      let alpha = 1;
      let settle = 1; // how "assembled" the piece is (gates float + beat)

      if (useAssemble) {
        const local = clamp01((segT - p.delay) / dur);
        const eased = easeOut(local);
        settle = eased;
        px = lerp(p.scatX, p.homeX, eased);
        py = lerp(p.scatY, p.homeY, eased);
        rot = lerp(p.scatRot, 0, eased);
        scl = lerp(p.scatScale, 1, eased);
        // Opacity fades in over the first ~45% of the piece's resolve.
        alpha = smooth(clamp01(local / 0.45));
      }

      if (useFloat && floatAmt > 0) {
        px += Math.sin(time * floatSpd * p.floatMul + p.phaseX) * floatAmt * settle;
        py += Math.cos(time * floatSpd * p.floatMul * 0.85 + p.phaseY) * floatAmt * settle;
      }

      if (useBeat && beat > 0) {
        px += p.dirX * beatPush * beat * settle;
        py += p.dirY * beatPush * beat * settle;
      }

      p.sprite.position.set(px, py);
      p.sprite.rotation = rot;
      p.sprite.scale.set(scl);
      p.sprite.alpha = alpha;
    }
  }

  // ── Hot-update support ──

  /** Color updates in place via tint; structural/scatter changes rebuild next frame. */
  protected onConfigChange(key: string, value: any): void {
    if (key === 'shardColor') {
      const c = resolveColor(value, this.palette);
      for (const p of this.pieces) p.sprite.tint = c;
      return;
    }
    // Pure animation params are read live in update(); everything else affects
    // layout or the stored scatter pose, so force a relayout via a size mismatch.
    const live = new Set([
      'enableAssemble', 'assembleDuration',
      'enableFloat', 'floatAmount', 'floatSpeed',
      'enableBeat', 'beatPush',
    ]);
    if (!live.has(key)) this.lastW = -1;
  }

  protected onPaletteChange(): void {
    if (typeof this.config.shardColor === 'string' && this.config.shardColor.startsWith('$')) {
      const c = resolveColor(this.config.shardColor, this.palette);
      for (const p of this.pieces) p.sprite.tint = c;
    }
  }
}
