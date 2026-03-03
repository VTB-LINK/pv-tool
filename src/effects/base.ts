// PV Tool — Copyright (c) 2026 DanteAlighieri13210914
// Licensed under AGPL-3.0. For commercial use, see COMMERCIAL.md

import * as PIXI from 'pixi.js';
import type { ColorPalette, UpdateContext } from '../core/types';

export abstract class BaseEffect {
  abstract readonly name: string;
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
    this._ownContainer.removeChildren().forEach(c => c.destroy());
    this._ownContainer.destroy();
  }
}