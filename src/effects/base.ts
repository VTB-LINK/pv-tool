// Modified by VTB-LIVE on 2026-03-24
// Copyright (c) 2026 VTB-LIVE (Modifications)
//
// Original Work:
// PV Tool — Copyright (c) 2026 DanteAlighieri13210914
// Licensed under AGPL-3.0. For commercial use, see COMMERCIAL.md

import * as PIXI from 'pixi.js';
import type { ColorPalette, UpdateContext } from '../types/engine';

export abstract class BaseEffect {
  abstract readonly name: string;
  /** Mark as true for GPU/CPU-heavy effects — engine will skip frames when many effects are active */
  readonly heavy: boolean = false;
  protected container!: PIXI.Container;
  protected config: Record<string, any> = {};
  protected palette!: ColorPalette;
  private _ownContainer!: PIXI.Container;

  init(parentLayer: PIXI.Container, config: Record<string, any>, palette: ColorPalette): void {
    this._ownContainer = new PIXI.Container();
    parentLayer.addChild(this._ownContainer);
    this.container = this._ownContainer;
    this.config = config;
    this.palette = palette;
    this.setup();
  }

  protected abstract setup(): void;
  abstract update(ctx: UpdateContext): void;

  destroy(): void {
    try {
      this._ownContainer.removeChildren().forEach(c => {
        try { c.destroy({ children: true }); } catch { /* already gone */ }
      });
      this._ownContainer.destroy();
    } catch { /* container already destroyed */ }
  }
}