import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import type { LintResult } from '../src/types.js';

const cli = fileURLToPath(new URL('../src/cli.js', import.meta.url));

test('--recursive lints nested AGENTS.md files without scanning ignored directories', (t) => {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), 'agents-md-recursive-'));
  t.after(() => fs.rmSync(target, { recursive: true, force: true }));
  fs.writeFileSync(path.join(target, 'AGENTS.md'), '# Run npm test\n');

  for (const relative of ['packages/api', 'packages/ui', '.git', 'node_modules/pkg', 'dist']) {
    const directory = path.join(target, relative);
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, 'AGENTS.md'), '');
  }
  fs.writeFileSync(path.join(target, 'packages', 'api', 'local.ts'), '');
  fs.writeFileSync(path.join(target, 'packages', 'api', 'AGENTS.md'), '# Run npm test\nSee [local](./local.ts).\n');

  const run = (...options: string[]) =>
    spawnSync(process.execPath, [cli, target, '--json', ...options], { encoding: 'utf8' });

  const regular = run();
  assert.equal(regular.status, 0);
  const regularResult: LintResult = JSON.parse(regular.stdout);
  assert.deepEqual(regularResult.summary.filesChecked, ['AGENTS.md']);

  const recursive = run('--recursive');
  assert.equal(recursive.status, 1, recursive.stderr);
  const result: LintResult = JSON.parse(recursive.stdout);
  assert.deepEqual(result.summary.filesChecked, ['AGENTS.md', 'packages/api/AGENTS.md', 'packages/ui/AGENTS.md']);
  assert.deepEqual(result.findings.map((finding) => finding.file), ['packages/ui/AGENTS.md']);
});
