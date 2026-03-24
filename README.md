# 关于本项目（VTB-LIVE Fork 版本）的声明

鉴于上游项目已于 2026年3月24日 更改为非开源的专有协议（Non-Commercial License），为了保护开源社区的利益，并确保广大创作者能继续免费、自由地使用该工具，本仓库将作为一个独立的开源分支长期维护。

本仓库所有的代码均基于上游最后一次合法的 AGPL-3.0 提交，并严格遵守 AGPL-3.0 协议。我们将继续开放 PR，并定期修复 Bug。我们感谢原作者与各贡献者前期的巨大贡献，也欢迎所有开源开发者加入本分支的维护。

---

# PV Tool — Kinetic Typography & Post-Processing for Music Videos

A browser-based visual effects engine for creating PV (Promotional Video) style kinetic typography and post-processing overlays, built with [PixiJS](https://pixijs.com/) and TypeScript.

Designed for the Japanese PV / music video community and anyone creating lyric videos, motion graphics, or real-time visual performances.

## What It Does

PV Tool takes text (lyrics, titles, poetry) and renders them with layered visual effects in real-time — no video editing software required. Think of it as a programmable, template-driven motion graphics compositor that runs entirely in the browser.

**Core capabilities:**

- **16 preset templates** — curated visual styles ranging from clean typography to cyberpunk HUDs, each combining multiple effects into a cohesive look
- **54 configurable effects** — geometry, text layouts, overlays, textures, organic shapes, composition guides, and more
- **Custom mode** — mix and match any effects from the catalog to build your own style
- **Media input** — load images or videos as background layers with automatic color extraction
- **Audio-reactive** — BPM-synced beat reactivity drives animations and camera effects
- **Motion detection** — real-time browser-based object tracking for interactive HUD overlays
- **Post-processing** — shake, zoom, tilt, glitch, hue shift, chromatic aberration
- **HiDPI support** — renders at native device pixel ratio with automatic downscaling when many effects are active

## Templates

| Template | Style |
|---|---|
| 蓝色冲击 | Bold blue geometric impact |
| 斩击 | Kinetic split with diagonal energy |
| 蓝色构成 | Deconstructed blueprint with physics formulas |
| 城市、文字、雨 | Urban rain with flowing text |
| 夜色 | Soft nocturnal atmosphere |
| 波普 | Pop art halftone and bold colors |
| 青墨 | Ink wash minimalism |
| 电脑 | Digital / cyber aesthetic |
| 战场 | High-intensity battle theme |
| 几何 | Pure geometric composition |
| 全息 | Holographic glow rings |
| 赛博监控 | Cyberpunk HUD with motion tracking |
| 情绪电影 | Cinematic emotion overlay |
| 剪影极简 | Silhouette clean minimalism |
| 歇斯底里之夜 | Radial rectangles with glowing text cards |
| 戒尺 | Ruler guides with breathing blocks |

## Effects Library

Effects are organized by layer and category:

- **Background** — texture fills, gradients, triangle grids, checkerboards, color blocks
- **Decoration** — geometric shapes (circles, diamonds, lines, crosses), flowing lines, burst rays, perspective grids, composition guides (golden spiral, rule of thirds, phi grid), organic blobs, ocean waves, clouds
- **Text** — hero text, scattered text, text strips, text cards, outline text, layered text, glow cards, vertical sub-text, formula overlays, falling text rain
- **Overlay** — vignette, color mask, chromatic aberration, glitch bars, scanlines, film grain, dot screen (halftone), HUD elements
- **Motion** — real-time motion detection brackets with target tracking

## Getting Started

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build
```

Open the browser and use the controls:

1. **Select a template** from the dropdown, or choose "Custom" to build your own
2. **Enter text** — use `/` to separate segments (e.g. `/夜を越えて/踊れ踊れ`)
3. **Load media** — drag in an image or video as background
4. **Load audio** — add music for beat-reactive animations
5. **Adjust parameters** — animation speed, motion intensity, segment timing, post-FX

## Tech Stack

- **[PixiJS 8](https://pixijs.com/)** — WebGL/WebGPU 2D rendering
- **TypeScript** — full type safety
- **Vite** — development and build tooling
- **Canvas 2D** — motion detection, texture generation, media analysis

## License

This fork is licensed under the [GNU Affero General Public License v3.0](LICENSE) (AGPL-3.0).

Free for personal use, community projects, and open-source work under AGPL-3.0.
For commercial licensing (use in proprietary/closed-source products), please contact the original author — see [COMMERCIAL.md](COMMERCIAL.md).

## Credits

Original Work: **PV Tool** — Copyright (c) 2026 DanteAlighieri13210914
Fork Maintainer: **VTB-LIVE** — Modifications and new features since 2026-03-24

See [NOTICE](NOTICE) for full attribution details.
