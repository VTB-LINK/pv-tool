// VTB-LIVE Fork - Copyright (c) 2026 VTB-LIVE
// Licensed under AGPL-3.0.

import { fixupPluginRules } from '@eslint/compat';
import header from 'eslint-plugin-header';
import tseslint from 'typescript-eslint';

// eslint-plugin-header needs this call to initialize its internal state
header.rules.header.meta.schema = false;

export default [
  // Ignore build output, dependencies, and auto-generated files
  { ignores: ['dist/**', 'node_modules/**', 'src/vite-env.d.ts'] },

  // TypeScript files
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tseslint.parser,
    },
    plugins: {
      header: fixupPluginRules(header),
    },
    rules: {
      // Enforce that every .ts file starts with a recognized VTB-LIVE header.
      // Matches BOTH formats:
      //   NEW files:      "// VTB-LIVE Fork - Copyright (c) ..."
      //   MODIFIED files: "// Modified by VTB-LIVE on ..."
      'header/header': [
        'warn',
        'line',
        [
          { pattern: '(VTB-LIVE Fork - Copyright \\(c\\) \\d{4} VTB-LIVE|Modified by VTB-LIVE on \\d{4}-\\d{2}-\\d{2})' },
          { pattern: '(Licensed under AGPL-3\\.0\\.|Copyright \\(c\\) \\d{4} VTB-LIVE \\(Modifications\\))' },
        ],
      ],
    },
  },
];
