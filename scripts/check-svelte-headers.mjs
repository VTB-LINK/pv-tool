// VTB-LIVE Fork - Copyright (c) 2026 VTB-LIVE
// Licensed under AGPL-3.0.

// Checks that all .svelte files in src/ have a valid VTB-LIVE copyright header.
// Intended to run alongside `eslint src/` via `npm run lint`.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const SRC_DIR = 'src';
const FORK_RE = /^<!--\s*VTB-LIVE Fork\s*-\s*Copyright\s*\(c\)\s*\d{4}\s*VTB-LIVE\s*-->/;
const MOD_RE = /^<!--\s*Modified by VTB-LIVE on\s*\d{4}-\d{2}-\d{2}\s*-->/;

function walk(dir) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      results.push(...walk(full));
    } else if (entry.endsWith('.svelte')) {
      results.push(full);
    }
  }
  return results;
}

const files = walk(SRC_DIR);
const failures = [];

for (const file of files) {
  const firstLine = readFileSync(file, 'utf8').split('\n')[0];
  if (!FORK_RE.test(firstLine) && !MOD_RE.test(firstLine)) {
    failures.push(relative('.', file).replace(/\\/g, '/'));
  }
}

if (failures.length > 0) {
  console.error(`\n  svelte-header-check: ${failures.length} file(s) missing VTB-LIVE header:\n`);
  for (const f of failures) {
    console.error(`    ✗ ${f}`);
  }
  console.error();
  process.exit(1);
} else {
  console.log(`  svelte-header-check: ${files.length} .svelte file(s) OK`);
}
