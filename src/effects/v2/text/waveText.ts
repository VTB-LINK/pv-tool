// VTB-LIVE Fork - Copyright (c) 2026 VTB-LIVE
// Licensed under AGPL-3.0.
// Effects V2 — Wave Text
// Characters appear with staggered spring-in animation and alternating vertical offset

import * as PIXI from 'pixi.js';
import { BaseEffectV2 } from '../BaseEffect';
import type { EffectMeta } from '../schema';
import type { UpdateContext } from '../../../types/engine';
import { resolveColor } from '../../../types/engine';

// ── i18n ──
const i18n = {
  name:          { zh: '波浪文字',   en: 'Wave Text',       ja: 'ウェーブテキスト' },
  category:      { zh: '文字',       en: 'Text',            ja: 'テキスト' },
  color:         { zh: '颜色',       en: 'Color',           ja: '色' },
  fontSize:      { zh: '字号',       en: 'Font Size',       ja: 'フォントサイズ' },
  font:          { zh: '字体',       en: 'Font',            ja: 'フォント' },
  fontWeight:    { zh: '字重',       en: 'Font Weight',     ja: 'フォントウェイト' },
  spread:        { zh: '分散比例',   en: 'Spread',          ja: '分散率' },
  vertOffset:    { zh: '交错偏移',   en: 'Stagger',         ja: 'ずらし量' },
  blendMode:     { zh: '混合模式',   en: 'Blend Mode',      ja: 'ブレンドモード' },
  enterSpeed:    { zh: '入场速度',   en: 'Enter Speed',     ja: '登場速度' },
  charDelay:     { zh: '字符延迟',   en: 'Char Delay',      ja: '文字遅延' },
  posY:          { zh: 'Y 位置',     en: 'Y Position',      ja: 'Y 位置' },
};

export class WaveTextV2 extends BaseEffectV2 {
  static readonly meta: EffectMeta = {
    type: 'waveTextV2',
    name: i18n.name,
    category: i18n.category,
    layer: 'text',
    version: 2,
    fields: [
      { key: 'color',        label: i18n.color,      type: { kind: 'color', default: '#ffffff', paletteRef: true } },
      { key: 'fontSize',     label: i18n.fontSize,   type: { kind: 'number', min: 16, max: 200, step: 2, default: 48 } },
      { key: 'fontFamily',   label: i18n.font,       type: { kind: 'string', default: '"Noto Sans JP", sans-serif' } },
      { key: 'fontWeight',   label: i18n.fontWeight,  type: { kind: 'string', default: '900', options: ['400', '600', '700', '800', '900'] } },
      { key: 'spreadFrac',   label: i18n.spread,     type: { kind: 'number', min: 0.1, max: 1, step: 0.05, default: 0.45 } },
      { key: 'staggerY',     label: i18n.vertOffset,  type: { kind: 'number', min: 0, max: 80, step: 1, default: 14 } },
      { key: 'blendMode',    label: i18n.blendMode,   type: { kind: 'string', default: 'difference', options: ['normal', 'difference', 'screen', 'multiply', 'overlay'] } },
      { key: 'enterSpeed',   label: i18n.enterSpeed,  type: { kind: 'number', min: 0.5, max: 8, step: 0.5, default: 2.5 }, group: '动画' },
      { key: 'charDelay',    label: i18n.charDelay,   type: { kind: 'number', min: 0.02, max: 0.5, step: 0.01, default: 0.1 }, group: '动画' },
      { key: 'y',            label: i18n.posY,        type: { kind: 'number', min: 0, max: 1, step: 0.01, default: 0.5 }, group: '布局' },
    ],
  };

  private glyphs: PIXI.Text[] = [];
  private restY: number[] = [];
  private wrapper!: PIXI.Container;
  private lastText = '';
  private entryTime = -100;

  protected setup(): void {
    this.wrapper = new PIXI.Container();
    this.wrapper.blendMode = (this.config.blendMode ?? 'difference') as PIXI.BLEND_MODES;
    this.container.addChild(this.wrapper);
  }

  /** Lay out individual character sprites across the screen width */
  private layoutChars(text: string, sw: number, sh: number): void {
    // Tear down previous glyphs
    this.wrapper.removeChildren().forEach(c => {
      try { c.destroy(); } catch {}
    });
    this.glyphs = [];
    this.restY = [];
    this.lastText = text;

    const letters = [...text];
    if (letters.length === 0) return;

    const fillColor = resolveColor(this.config.color ?? '#ffffff', this.palette);
    const size = this.config.fontSize ?? 48;
    const family = this.config.fontFamily ?? '"Noto Sans JP", sans-serif';
    const weight = (this.config.fontWeight ?? '900') as PIXI.TextStyleFontWeight;
    const stagger = this.config.staggerY ?? 14;
    const fraction = this.config.spreadFrac ?? 0.45;

    const totalWidth = sw * fraction;
    const gap = letters.length > 1 ? totalWidth / (letters.length - 1) : 0;
    const originX = sw / 2 - totalWidth / 2;
    const centerY = sh * (this.config.y ?? 0.5);

    for (let idx = 0; idx < letters.length; idx++) {
      const glyph = new PIXI.Text({
        text: letters[idx],
        style: { fontFamily: family, fontSize: size, fontWeight: weight, fill: fillColor },
      });
      glyph.anchor.set(0.5);
      glyph.x = originX + idx * gap;

      // Alternating vertical offset
      const targetY = centerY + (idx % 2 === 0 ? -stagger : stagger);
      this.restY.push(targetY);

      // Start state: offset below, invisible, tiny
      glyph.y = targetY + 45;
      glyph.alpha = 0;
      glyph.scale.set(0.15);

      this.wrapper.addChild(glyph);
      this.glyphs.push(glyph);
    }
  }

  update(ctx: UpdateContext): void {
    // Rebuild when text changes
    if (ctx.currentText !== this.lastText) {
      this.entryTime = ctx.time;
      this.layoutChars(ctx.currentText, ctx.screenWidth, ctx.screenHeight);
    }

    const since = ctx.time - this.entryTime;
    const speed = this.config.enterSpeed ?? 2.5;
    const perCharDelay = this.config.charDelay ?? 0.1;

    for (let i = 0; i < this.glyphs.length; i++) {
      const charTime = Math.max(0, since - i * perCharDelay);

      // Opacity: cubic ease-in
      const fadeT = Math.min(1, charTime * speed * 2);
      const opacity = fadeT * fadeT * (3 - 2 * fadeT);   // smoothstep

      // Scale: dampened cosine spring → settles at 1.05
      const scaleT = Math.min(1, charTime * speed);
      const dampened = 1 - Math.exp(-4.5 * scaleT) * Math.cos(scaleT * Math.PI * 2.5);
      const finalScale = dampened * 1.05;

      // Y slide: ease-out cubic
      const slideT = Math.min(1, charTime * speed * 1.1);
      const eased = 1 - (1 - slideT) ** 3;

      // Entry rotation: alternating tilt that decays
      const rotDecay = Math.exp(-charTime * speed * 2.2);
      const tiltDir = i % 2 === 0 ? 1 : -1;

      this.glyphs[i].alpha = opacity;
      this.glyphs[i].scale.set(finalScale);
      this.glyphs[i].y = this.restY[i] + 45 * (1 - eased);
      this.glyphs[i].rotation = rotDecay * 0.45 * tiltDir;
    }
  }

  // ── Hot-update support ──
  protected onConfigChange(key: string, value: any): void {
    if (key === 'color') {
      const c = resolveColor(value, this.palette);
      for (const g of this.glyphs) (g.style as PIXI.TextStyle).fill = c;
    } else if (key === 'fontSize') {
      for (const g of this.glyphs) (g.style as PIXI.TextStyle).fontSize = value;
    } else if (key === 'blendMode') {
      this.wrapper.blendMode = value as PIXI.BLEND_MODES;
    }
  }

  protected onPaletteChange(): void {
    if (this.config.color?.startsWith?.('$')) {
      const c = resolveColor(this.config.color, this.palette);
      for (const g of this.glyphs) (g.style as PIXI.TextStyle).fill = c;
    }
  }
}
