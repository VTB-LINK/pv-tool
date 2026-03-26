// VTB-LIVE Fork - Copyright (c) 2026 VTB-LIVE
// Licensed under AGPL-3.0.
// Effects V2 — Base class with schema, hot-update, and lifecycle

import * as PIXI from 'pixi.js';
import type { ColorPalette, UpdateContext } from '../../types/engine';
import type { EffectMeta } from './schema';

export abstract class BaseEffectV2 {
  /** Static metadata — subclasses MUST define this */
  static readonly meta: EffectMeta;

  /** Mark as heavy for engine frame-skipping */
  readonly heavy: boolean = false;

  protected container!: PIXI.Container;
  protected config: Record<string, any> = {};
  protected palette!: ColorPalette;
  private _ownContainer!: PIXI.Container;

  // ── Lifecycle ──

  init(parentLayer: PIXI.Container, config: Record<string, any>, palette: ColorPalette): void {
    this._ownContainer = new PIXI.Container();
    parentLayer.addChild(this._ownContainer);
    this.container = this._ownContainer;
    this.config = config;
    this.palette = palette;
    this.setup();
  }

  /** Create PIXI display objects */
  protected abstract setup(): void;

  /** Per-frame update */
  abstract update(ctx: UpdateContext): void;

  /** Cleanup */
  destroy(): void {
    try {
      this._ownContainer.removeChildren().forEach(c => {
        try { c.destroy({ children: true }); } catch { /* already gone */ }
      });
      this._ownContainer.destroy();
    } catch { /* container already destroyed */ }
  }

  // ── V2: Hot-update support ──

  /**
   * Hot-update a single config parameter without destroy + recreate.
   * Subclasses can override `onConfigChange` for incremental updates.
   */
  updateConfig(key: string, value: any): void {
    this.config[key] = value;
    this.onConfigChange(key, value);
  }

  /** Override to handle incremental config changes (e.g. change tint instead of rebuilding) */
  protected onConfigChange(_key: string, _value: any): void {}

  /** Hot-update palette */
  updatePalette(palette: ColorPalette): void {
    this.palette = palette;
    this.onPaletteChange(palette);
  }

  /** Override to handle palette changes incrementally */
  protected onPaletteChange(_palette: ColorPalette): void {}
}
