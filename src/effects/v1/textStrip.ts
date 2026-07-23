// Modified by VTB-LIVE on 2026-04-11
// Copyright (c) 2026 VTB-LIVE (Modifications)
//
// Original Work:
// PV Tool — Copyright (c) 2026 DanteAlighieri13210914
// Licensed under AGPL-3.0. For commercial use, see COMMERCIAL.md

import * as PIXI from 'pixi.js';
import { BaseEffect } from './base';
import type { UpdateContext } from '../../types/engine';
import { resolveColor } from '../../types/engine';

export class TextStrip extends BaseEffect {
  readonly name = 'textStrip';
  private stripContainer!: PIXI.Container;
  private textContainer!: PIXI.Container;

  private displayedText = '';
  private pendingText = '';
  private textAlpha = 1;
  private fadeState: 'idle' | 'fadeOut' | 'fadeIn' = 'idle';

  protected setup(): void {
    this.stripContainer = new PIXI.Container();
    this.container.addChild(this.stripContainer);

    const stripColor = resolveColor(this.config.stripColor ?? '$secondary', this.palette);
    const width = this.config.stripWidth ?? 80;
    const height = this.config.stripHeight ?? 600;
    const rotation = (this.config.rotation ?? -30) * Math.PI / 180;

    const bg = new PIXI.Graphics();
    bg.rect(-width / 2, -height / 2, width, height);
    bg.fill({ color: stripColor, alpha: this.config.stripAlpha ?? 0.85 });
    this.stripContainer.addChild(bg);

    this.textContainer = new PIXI.Container();
    this.stripContainer.addChild(this.textContainer);
    this.stripContainer.rotation = rotation;

    const text = this.config._userText || this.config.text || '';
    this.buildText(text);
  }

  private buildText(text: string): void {
    this.textContainer.removeChildren().forEach(c => c.destroy());
    this.displayedText = text;

    const textColor = resolveColor(this.config.textColor ?? '$text', this.palette);
    const height = this.config.stripHeight ?? 600;
    const fontSize = this.config.fontSize ?? 60;

    const chars = text.split('');
    const charSpacing = height / (chars.length + 1);

    for (let i = 0; i < chars.length; i++) {
      const style = new PIXI.TextStyle({
        fontFamily: this.config.fontFamily ?? '"Noto Sans JP", "Hiragino Kaku Gothic Pro", sans-serif',
        fontSize,
        fontWeight: 'bold',
        fill: textColor,
      });
      const t = new PIXI.Text({ text: chars[i], style });
      t.anchor.set(0.5);
      t.y = -height / 2 + charSpacing * (i + 1);
      this.textContainer.addChild(t);
    }
  }

  update(ctx: UpdateContext): void {
    const newText = ctx.lyricsActive ? ctx.currentText : (ctx.currentText || this.config.text || '');

    // 暂停/拖动时 deltaTime<=0，基于时间的淡入淡出无法推进；
    // 无论当前是否在淡变途中，都直接结算到目标文本并恢复满不透明度，
    // 避免文本不更新或卡在半透明状态。
    if (ctx.deltaTime <= 0) {
      if (newText !== this.displayedText) this.buildText(newText);
      this.pendingText = newText;
      this.textAlpha = 1;
      this.fadeState = 'idle';
    } else {
      if (newText !== this.displayedText && this.fadeState === 'idle') {
        this.pendingText = newText;
        this.fadeState = 'fadeOut';
      }

      const fadeSpeed = 4 * Math.max(ctx.animationSpeed, 0.5);
      if (this.fadeState === 'fadeOut') {
        this.textAlpha -= ctx.deltaTime * fadeSpeed;
        if (this.textAlpha <= 0) {
          this.textAlpha = 0;
          this.buildText(this.pendingText);
          this.fadeState = 'fadeIn';
        }
      } else if (this.fadeState === 'fadeIn') {
        this.textAlpha += ctx.deltaTime * fadeSpeed;
        if (this.textAlpha >= 1) {
          this.textAlpha = 1;
          this.fadeState = 'idle';
        }
      }
    }
    this.textContainer.alpha = this.textAlpha;

    const px = (this.config.x ?? 0.5) * ctx.screenWidth;
    const py = (this.config.y ?? 0.5) * ctx.screenHeight;
    const drift = ctx.motionIntensity;
    this.stripContainer.x = px + Math.sin(ctx.time * 0.3 * ctx.animationSpeed) * 3 * drift;
    this.stripContainer.y = py;
  }
}