// Modified by VTB-LIVE on 2026-04-01
// Copyright (c) 2026 VTB-LIVE (Modifications)
//
// Original Work:
// PV Tool — Copyright (c) 2026 DanteAlighieri13210914
// Licensed under AGPL-3.0. For commercial use, see COMMERCIAL.md

import App from './App.svelte';
import { mount } from 'svelte';
import { t } from './i18n';

console.log('%cPV Tool FORK %c · VTB-LIVE&VTB-LINK', 'color:#6688cc;font-weight:bold', 'color:#888');
document.title = t('page_title');

const app = mount(App, {
  target: document.getElementById('app')!,
});

export default app;
