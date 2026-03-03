import type { TemplateConfig } from '../core/types';
import { blueBoldTemplate } from './blueBold';
import { kineticSplitTemplate } from './kineticSplit';
import { bluePlaneTemplate } from './bluePlane';
import { rainCityTemplate } from './rainCity';
import { yorushikaTemplate } from './yorushika';
import { popArtTemplate } from './popArt';
import { blueInkTemplate } from './blueInk';
import { cyberTemplate } from './cyber';
import { battleTemplate } from './battle';
import { geometricTemplate } from './geometric';
import { holoScopeTemplate } from './holoScope';
import { cyberpunkHudTemplate } from './cyberpunkHud';
import { emotionCinemaTemplate } from './emotionCinema';
import { silhouetteCleanTemplate } from './silhouetteClean';
import { hystericNightTemplate } from './hystericNight';
import { rulerTemplate } from './ruler';

export const templates: TemplateConfig[] = [
  blueBoldTemplate,        // 蓝色冲击
  kineticSplitTemplate,    // 斩击
  bluePlaneTemplate,       // 蓝色构成
  rainCityTemplate,        // 城市、文字、雨
  yorushikaTemplate,       // 夜色
  popArtTemplate,          // 波普
  blueInkTemplate,         // 青墨
  cyberTemplate,           // 电脑
  battleTemplate,          // 战场
  geometricTemplate,       // 几何
  holoScopeTemplate,       // 全息
  cyberpunkHudTemplate,    // 赛博监控
  emotionCinemaTemplate,   // 情绪电影
  silhouetteCleanTemplate, // 剪影极简
  hystericNightTemplate,   // 歇斯底里之夜
  rulerTemplate,           // 戒尺
];

export function getTemplate(name: string): TemplateConfig | undefined {
  return templates.find(t => t.name === name);
}
