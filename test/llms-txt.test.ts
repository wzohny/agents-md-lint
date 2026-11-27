import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { checkLlmsTxtContent, lintLlmsTxt } from '../dist/rules/llms-txt.js';
import type { LintResult } from '../dist/types.js';

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'llms-txt-lint-test-'));
}

function runCli(args: string[]): { status: number; stdout: string; stderr: string } {
  try {
    const stdout = execFileSync(process.execPath, [path.resolve('dist/cli.js'), ...args], {
      encoding: 'utf8',
    });
    return { status: 0, stdout, stderr: '' };
  } catch (err) {
    const e = err as { status?: number; stdout?: string; stderr?: string };
    return {
      status: e.status ?? 1,
      stdout: e.stdout ?? '',
      stderr: e.stderr ?? '',
    };
  }
}

describe('llms.txt rules', () => {
  it('is silent when llms.txt is absent', () => {
    const dir = makeTempDir();
    try {
      const result = lintLlmsTxt(dir);
      assert.equal(result.checked, false);
      assert.equal(result.findings.length, 0);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('requires H1 on first non-empty line (allowing optional BOM)', () => {
    const dir = makeTempDir();
    try {
      const validWithBom = '\uFEFF\n# My Project\n\n> Summary here.\n';
      assert.equal(checkLlmsTxtContent(validWithBom, dir).length, 0);

      const missingH1 = 'Not a heading\n# Late H1\n';
      const findings = checkLlmsTxtContent(missingH1, dir);
      assert.ok(findings.some((f) => f.rule === 'llms/h1-required' && f.severity === 'error'));
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('warns when blockquote summary is missing after H1', () => {
    const dir = makeTempDir();
    try {
      const content = '# My Project\n\n## Docs\n';
      const findings = checkLlmsTxtContent(content, dir);
      assert.ok(findings.some((f) => f.rule === 'llms/blockquote-summary' && f.severity === 'warn'));
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('validates H2 list item links and local file resolution', () => {
    const dir = makeTempDir();
    try {
      fs.writeFileSync(path.join(dir, 'README.md'), '# Readme\n');
      const content = [
        '# My Project',
        '',
        '> Concise summary.',
        '',
        '## Docs',
        '- [README](README.md): Main readme.',
        '- [External](https://example.com)',
        '- [Email](mailto:hi@example.com)',
        '- Missing markdown link',
        '- [Broken](docs/missing.md): Does not exist.',
      ].join('\n');

      const findings = checkLlmsTxtContent(content, dir);
      assert.equal(findings.filter((f) => f.rule === 'llms/h2-link-format').length, 1);
      assert.equal(findings.filter((f) => f.rule === 'llms/broken-local-link').length, 1);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('CLI integration', () => {
  it('exits 0 with --json on examples/valid-repo', () => {
    const res = runCli(['examples/valid-repo', '--json']);
    assert.equal(res.status, 0);
    const parsed = JSON.parse(res.stdout) as LintResult;
    assert.equal(parsed.summary.errors, 0);
    assert.equal(parsed.summary.warnings, 0);
    assert.deepEqual(parsed.summary.filesChecked, ['AGENTS.md', 'llms.txt']);
  });

  it('exits 1 on examples/broken-repo', () => {
    const res = runCli(['examples/broken-repo', '--json']);
    assert.equal(res.status, 1);
    const parsed = JSON.parse(res.stdout) as LintResult;
    assert.ok(parsed.summary.errors > 0);
  });

  it('exits 2 on invalid directory or invalid --max-tokens', () => {
    assert.equal(runCli(['does-not-exist-dir']).status, 2);
    assert.equal(runCli(['examples/valid-repo', '--max-tokens', 'abc']).status, 2);
    assert.equal(runCli(['--help']).status, 0);
    assert.equal(runCli(['--version']).status, 0);
  });
});
