import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import type { LintResult } from '../src/types.js';

const cli = fileURLToPath(new URL('../src/cli.js', import.meta.url));

test('--strict changes a warning-only exit status and preserves JSON severity', (t) => {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), 'agents-md-strict-'));
  t.after(() => fs.rmSync(target, { recursive: true, force: true }));
  fs.writeFileSync(path.join(target, 'AGENTS.md'), '# Agent instructions\n');

  const run = (...options: string[]) =>
    spawnSync(process.execPath, [cli, target, '--json', ...options], { encoding: 'utf8' });

  const regular = run();
  assert.equal(regular.status, 0);
  const strict = run('--strict');
  assert.equal(strict.status, 1, strict.stderr);
  assert.deepEqual(JSON.parse(strict.stdout), JSON.parse(regular.stdout));
  const result: LintResult = JSON.parse(strict.stdout);
  assert.equal(result.summary.warnings, 1);
  assert.equal(result.findings[0]?.severity, 'warn');

  fs.writeFileSync(path.join(target, 'AGENTS.md'), '# Run npm test\n');
  assert.equal(run('--strict').status, 0);
});
