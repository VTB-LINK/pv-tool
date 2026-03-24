// Modified by VTB-LIVE on 2026-03-24
// Copyright (c) 2026 VTB-LIVE (Modifications)
//
// Original Work:
// PV Tool — Copyright (c) 2026 DanteAlighieri13210914
// Licensed under AGPL-3.0. For commercial use, see COMMERCIAL.md

import App from './App.svelte';
import { mount } from 'svelte';

console.log('%cPV Tool%c v2.0 · solaris:0914', 'color:#6688cc;font-weight:bold', 'color:#888');

const app = mount(App, {
  target: document.getElementById('app')!,
});

export default app;
