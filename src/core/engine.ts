// PV Tool — Copyright (c) 2026 DanteAlighieri13210914
// Licensed under AGPL-3.0. For commercial use, see COMMERCIAL.md

import * as PIXI from 'pixi.js';
import type { TemplateConfig, UpdateContext, ColorPalette, LayerType, MotionTargetInfo } from './types';
import { createEffect, BaseEffect } from '../effects';
import { extractDominantColors } from './colorExtractor';
import { MediaOutlineRenderer } from './mediaOutline';
import { GlitchFilter } from './glitchFilter';
import { BeatProvider } from './beatProvider';
import { MotionDetector } from './motionDetector';

const EFFECT_LAYERS: LayerType[] = ['background', 'decoration', 'text', 'overlay'];

export class PVEngine {
  private app: PIXI.Application;
  private layers = new Map<LayerType, PIXI.Container>();
  private effectsRoot!: PIXI.Container;
  private activeEffects: BaseEffect[] = [];
  private palette: ColorPalette = {
    background: '#ffffff',
    primary: '#000000',
    secondary: '#666666',
    accent: '#ff0000',
    text: '#000000',
  };
  private currentTemplate: TemplateConfig | null = null;
  private userText = '';
  private startTime = 0;

  private _animationSpeed = 2;
  private _motionIntensity = 1;
  private textSegments: string[] = ['春を告げる'];
  private _segmentDuration = 3;
  private _effectOpacity = 1;
  private _hueShift = 0;
  private hueFilter: PIXI.ColorMatrixFilter;
  private glitchFilter: GlitchFilter;
  private bgFill!: PIXI.Graphics;

  private _shake = 0;
  private _zoom = 0;
  private _tilt = 0;
  private _glitch = 0;

  private mediaElement: HTMLVideoElement | HTMLImageElement | null = null;
  private outlineRenderer: MediaOutlineRenderer | null = null;
  private _outlineEnabled = false;
  private extractingColors = false;

  private motionDetector: MotionDetector | null = null;
  private _motionDetectionEnabled = false;
  private motionTargets: MotionTargetInfo[] = [];

  private invertFilter: PIXI.ColorMatrixFilter | null = null;
  private _invertMediaEnabled = false;

  readonly beat = new BeatProvider();
  private _beatReactivity = 0.5;

  private _nativeDPR = 1;
  private _currentResolution = 1;
  private _resizeParent: HTMLElement | null = null;

  constructor() {
    this.app = new PIXI.Application();
    this.hueFilter = new PIXI.ColorMatrixFilter();
    this.glitchFilter = new GlitchFilter();
  }

  async init(parent: HTMLElement) {
    this._nativeDPR = Math.min(window.devicePixelRatio || 1, 3);
    this._currentResolution = this._nativeDPR;
    this._resizeParent = parent;

    await this.app.init({
      resizeTo: parent,
      backgroundColor: 0x000000,
      antialias: true,
      resolution: this._nativeDPR,
      autoDensity: true,
    });
    parent.appendChild(this.app.canvas);

    // Media layer at the very bottom
    const mediaLayer = new PIXI.Container();
    this.layers.set('media', mediaLayer);
    this.app.stage.addChild(mediaLayer);

    // All effect layers inside one container, on top of media
    this.effectsRoot = new PIXI.Container();
    this.app.stage.addChild(this.effectsRoot);

    // Solid background fill as the first child — ensures full coverage over media
    this.bgFill = new PIXI.Graphics();
    this.effectsRoot.addChild(this.bgFill);

    for (const layerType of EFFECT_LAYERS) {
      const container = new PIXI.Container();
      this.layers.set(layerType, container);
      this.effectsRoot.addChild(container);
    }

    this.startTime = performance.now();

    this.app.stage.filters = [this.hueFilter, this.glitchFilter];

    this.app.ticker.add((ticker) => {
      const time = (performance.now() - this.startTime) / 1000;
      this.update(time, ticker.deltaTime / 60);
    });
  }

  loadTemplate(template: TemplateConfig) {
    this.clearEffects();
    this.currentTemplate = template;
    this.palette = { ...template.palette };

    this.beat.bpm = template.bpm ?? 120;
    this._outlineEnabled = template.features?.mediaOutline ?? false;
    this._motionDetectionEnabled = template.features?.motionDetection ?? false;
    this._invertMediaEnabled = template.features?.invertMedia ?? false;
    this.syncMotionDetector();
    this.syncInvertFilter();

    if (template.features?.autoExtractColors && this.mediaElement && !this.extractingColors) {
      this.applyExtractedColors();
    }

    this.app.renderer.background.color = new PIXI.Color(this.palette.background).toNumber();
    this.updateBgFill();

    for (const entry of template.effects) {
      const layer = this.layers.get(entry.layer);
      if (!layer) continue;

      const config = { ...entry.config };
      if (this.userText) {
        config._userText = this.textSegments[0] || this.userText;
      }

      const effect = createEffect(entry.type, layer, config, this.palette);
      this.activeEffects.push(effect);
    }

    this.syncOutline();
    this.syncResolution();
  }

  setText(text: string) {
    this.userText = text;
    this.textSegments = text
      .split('/')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    if (this.textSegments.length === 0) {
      this.textSegments = [''];
    }
    if (this.currentTemplate) {
      this.loadTemplate(this.currentTemplate);
    }
  }

  set animationSpeed(val: number) { this._animationSpeed = val; }
  get animationSpeed() { return this._animationSpeed; }

  set motionIntensity(val: number) { this._motionIntensity = val; }
  get motionIntensity() { return this._motionIntensity; }

  set segmentDuration(val: number) { this._segmentDuration = val; }
  get segmentDuration() { return this._segmentDuration; }

  set effectOpacity(val: number) {
    this._effectOpacity = val;
    this.effectsRoot.alpha = val;
  }
  get effectOpacity() { return this._effectOpacity; }

  private updateBgFill() {
    if (!this.bgFill) return;
    this.bgFill.clear();
    this.bgFill.rect(0, 0, this.app.screen.width, this.app.screen.height);
    this.bgFill.fill({ color: this.palette.background });
  }

  set shake(val: number) { this._shake = val; }
  get shake() { return this._shake; }
  set zoom(val: number) { this._zoom = val; }
  get zoom() { return this._zoom; }
  set tilt(val: number) { this._tilt = val; }
  get tilt() { return this._tilt; }
  set glitch(val: number) {
    this._glitch = val;
    this.glitchFilter.intensity = val;
  }
  get glitch() { return this._glitch; }

  set beatReactivity(val: number) { this._beatReactivity = val; }
  get beatReactivity() { return this._beatReactivity; }

  set hueShift(degrees: number) {
    this._hueShift = degrees;
    this.hueFilter.matrix = [1,0,0,0,0, 0,1,0,0,0, 0,0,1,0,0, 0,0,0,1,0];
    this.hueFilter.hue(degrees, false);
  }
  get hueShift() { return this._hueShift; }

  async addMedia(file: File, mode: 'fit' | 'free' = 'fit'): Promise<void> {
    const url = URL.createObjectURL(file);
    const mediaLayer = this.layers.get('media')!;
    this.destroyOutline();
    mediaLayer.removeChildren().forEach(c => c.destroy());

    const isVideo = file.type.startsWith('video/');

    if (isVideo) {
      const video = document.createElement('video');
      video.src = url;
      video.loop = true;
      video.muted = true;
      video.playsInline = true;

      await video.play();
      this.mediaElement = video;

      const texture = PIXI.Texture.from(video);
      const sprite = new PIXI.Sprite(texture);

      if (mode === 'fit') {
        const scale = Math.max(
          this.app.screen.width / video.videoWidth,
          this.app.screen.height / video.videoHeight
        );
        sprite.scale.set(scale);
      } else {
        const scale = Math.min(
          this.app.screen.width * 0.6 / video.videoWidth,
          this.app.screen.height * 0.6 / video.videoHeight
        );
        sprite.scale.set(scale);
      }

      sprite.anchor.set(0.5);
      sprite.x = this.app.screen.width / 2;
      sprite.y = this.app.screen.height / 2;
      mediaLayer.addChild(sprite);
    } else {
      const img = new Image();
      img.src = url;
      await new Promise<void>((resolve) => { img.onload = () => resolve(); });
      this.mediaElement = img;

      const texture = PIXI.Texture.from(img);
      const sprite = new PIXI.Sprite(texture);

      if (mode === 'fit') {
        const scale = Math.max(
          this.app.screen.width / sprite.texture.width,
          this.app.screen.height / sprite.texture.height
        );
        sprite.scale.set(scale);
      } else {
        const scale = Math.min(
          this.app.screen.width * 0.6 / sprite.texture.width,
          this.app.screen.height * 0.6 / sprite.texture.height
        );
        sprite.scale.set(scale);
      }

      sprite.anchor.set(0.5);
      sprite.x = this.app.screen.width / 2;
      sprite.y = this.app.screen.height / 2;
      mediaLayer.addChild(sprite);
    }

    if (this.currentTemplate?.features?.autoExtractColors) {
      this.extractingColors = true;
      this.applyExtractedColors();
      this.loadTemplate(this.currentTemplate);
      this.extractingColors = false;
    }

    this.syncOutline();
    this.syncMotionDetector();
  }

  private applyExtractedColors(): void {
    if (!this.mediaElement) return;
    const colors = extractDominantColors(this.mediaElement);
    this.palette = {
      background: colors.primary,
      primary: colors.primary,
      secondary: colors.secondary,
      accent: colors.complement,
      text: '#ffffff',
    };
  }

  private syncOutline(): void {
    if (!this._outlineEnabled || !this.mediaElement) {
      this.destroyOutline();
      return;
    }

    const mediaLayer = this.layers.get('media')!;
    const mediaSprite = mediaLayer.children[0] as PIXI.Sprite | undefined;
    if (!mediaSprite) return;

    if (this.outlineRenderer) return;

    const srcW = this.mediaElement instanceof HTMLVideoElement
      ? this.mediaElement.videoWidth
      : this.mediaElement.naturalWidth;
    const srcH = this.mediaElement instanceof HTMLVideoElement
      ? this.mediaElement.videoHeight
      : this.mediaElement.naturalHeight;

    this.outlineRenderer = new MediaOutlineRenderer(srcW, srcH);
    const os = this.outlineRenderer.sprite;
    os.anchor.set(0.5);
    os.x = mediaSprite.x;
    os.y = mediaSprite.y;
    os.width = mediaSprite.width;
    os.height = mediaSprite.height;
    mediaLayer.addChild(os);
  }

  private destroyOutline(): void {
    if (this.outlineRenderer) {
      this.outlineRenderer.destroy();
      this.outlineRenderer = null;
    }
  }

  private syncInvertFilter(): void {
    const mediaLayer = this.layers.get('media')!;
    if (this._invertMediaEnabled) {
      if (!this.invertFilter) {
        this.invertFilter = new PIXI.ColorMatrixFilter();
      }
      // Desaturate fully, then negate, then apply warm tint
      // This replicates: grayscale → bitwise_not → warm tint blend
      const m = this.invertFilter;
      m.matrix = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0];
      m.desaturate();
      m.negative(false);
      // Warm tint: slightly boost red, reduce blue
      const tint = new PIXI.ColorMatrixFilter();
      tint.matrix = [
        1.06, 0, 0, 0, 0.08,
        0, 1.02, 0, 0, 0.04,
        0, 0, 0.94, 0, 0,
        0, 0, 0, 1, 0,
      ];
      mediaLayer.filters = [this.invertFilter, tint];
    } else {
      this.invertFilter = null;
      mediaLayer.filters = [];
    }
  }

  /**
   * Scale renderer resolution down when many effects are active.
   * Keeps visuals sharp with few effects, avoids GPU overload with many.
   */
  private syncResolution(): void {
    const n = this.activeEffects.length;
    const dpr = this._nativeDPR;

    let target: number;
    if (n <= 6) {
      target = dpr;
    } else if (n <= 12) {
      target = Math.min(dpr, 2);
    } else if (n <= 18) {
      target = Math.min(dpr, 1.5);
    } else {
      target = 1;
    }

    // Round to avoid sub-pixel jitter
    target = Math.round(target * 4) / 4;

    if (target !== this._currentResolution) {
      this._currentResolution = target;
      this.app.renderer.resolution = target;
      if (this._resizeParent) {
        const w = this._resizeParent.clientWidth;
        const h = this._resizeParent.clientHeight;
        this.app.renderer.resize(w, h);
      }
    }
  }

  private syncMotionDetector(): void {
    if (this._motionDetectionEnabled && this.mediaElement instanceof HTMLVideoElement) {
      if (!this.motionDetector) {
        this.motionDetector = new MotionDetector();
      }
    } else {
      if (this.motionDetector) {
        this.motionDetector.destroy();
        this.motionDetector = null;
      }
      this.motionTargets = [];
    }
  }

  private clearEffects() {
    for (const e of this.activeEffects) {
      e.destroy();
    }
    this.activeEffects = [];
    // Safety: remove any orphaned children left over (shouldn't happen, but belt-and-suspenders)
    for (const [key, layer] of this.layers) {
      if (key !== 'media' && layer.children.length > 0) {
        layer.removeChildren().forEach(c => c.destroy());
      }
    }
  }

  private update(time: number, deltaTime: number) {
    const segIdx = this.textSegments.length > 1
      ? Math.floor(time / this._segmentDuration) % this.textSegments.length
      : 0;

    if (this.motionDetector && this.mediaElement instanceof HTMLVideoElement) {
      this.motionDetector.detect(this.mediaElement);
      const srcW = this.mediaElement.videoWidth || 1;
      const srcH = this.mediaElement.videoHeight || 1;
      this.motionTargets = this.motionDetector.getTargetsForDisplay(
        this.app.screen.width, this.app.screen.height, srcW, srcH,
      );
    }

    const ctx: UpdateContext = {
      time,
      deltaTime,
      screenWidth: this.app.screen.width,
      screenHeight: this.app.screen.height,
      palette: this.palette,
      animationSpeed: this._animationSpeed,
      motionIntensity: this._motionIntensity,
      currentText: this.textSegments[segIdx] || '',
      beatIntensity: this.beat.getIntensity(time) * this._beatReactivity,
      motionTargets: this.motionTargets,
    };

    this.updateBgFill();
    this.applyCameraFX(time);

    if (this.outlineRenderer && this.mediaElement) {
      this.outlineRenderer.update(this.mediaElement as HTMLVideoElement);
    }

    for (const effect of this.activeEffects) {
      effect.update(ctx);
    }
  }

  private applyCameraFX(time: number): void {
    const w = this.app.screen.width;
    const h = this.app.screen.height;
    const cx = w / 2;
    const cy = h / 2;

    this.app.stage.pivot.set(cx, cy);

    let px = cx, py = cy;

    const beatShake = this.beat.getIntensity(time) * this._beatReactivity;
    const totalShake = this._shake + beatShake * 0.15;
    if (totalShake > 0) {
      px += (Math.random() - 0.5) * totalShake * 30;
      py += (Math.random() - 0.5) * totalShake * 20;
    }

    this.app.stage.position.set(px, py);
    this.app.stage.scale.set(1 + this._zoom * 0.5);
    this.app.stage.rotation = this._tilt * 0.3;

    this.glitchFilter.time = time;
  }

  get canvas(): HTMLCanvasElement {
    return this.app.canvas as HTMLCanvasElement;
  }

  destroy() {
    this.clearEffects();
    this.app.destroy(true);
  }
}