import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { checkAgentsMdContent, lintAgentsMd } from '../src/rules/agents-md.js';

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'agents-md-lint-test-'));
}

describe('AGENTS.md rules', () => {
  it('warns when AGENTS.md is missing', () => {
    const dir = makeTempDir();
    try {
      const result = lintAgentsMd(dir, { maxTokens: 2000 });
      assert.equal(result.checked, false);
      assert.equal(result.findings.length, 1);
      assert.equal(result.findings[0]?.rule, 'agents/missing');
      assert.equal(result.findings[0]?.severity, 'warn');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('errors on empty or whitespace-only AGENTS.md', () => {
    const dir = makeTempDir();
    try {
      const findings = checkAgentsMdContent('   \n\t\n', dir, { maxTokens: 2000 });
      assert.equal(findings.length, 1);
      assert.equal(findings[0]?.rule, 'agents/non-empty');
      assert.equal(findings[0]?.severity, 'error');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('warns when estimated tokens exceed maxTokens', () => {
    const dir = makeTempDir();
    try {
      const content = `${'a'.repeat(401)}\nRun \`npm test\`.`;
      const findings = checkAgentsMdContent(content, dir, { maxTokens: 100 });
      assert.ok(findings.some((f) => f.rule === 'agents/token-budget' && f.severity === 'warn'));
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('flags broken relative paths and ignores URLs, flags, commands, and fenced blocks', () => {
    const dir = makeTempDir();
    try {
      fs.mkdirSync(path.join(dir, 'src'));
      fs.writeFileSync(path.join(dir, 'src', 'index.ts'), 'export {};\n');

      const content = [
        '# AGENTS.md',
        'Valid: `src/index.ts`.',
        'Broken: `src/missing.ts` and `docs/nope.md`.',
        'Ignore flags `--json`, `-h`, URLs `https://example.com/a/b`, node builtins `node:fs`,',
        'scoped packages `@types/node`, extensions `.js`, versions `v0.1.0`, and commands `npm run check`.',
        '```ts',
        'const ignored = `src/fenced-does-not-exist.ts`;',
        '```',
        'Run `npm test` to verify.',
      ].join('\n');

      const findings = checkAgentsMdContent(content, dir, { maxTokens: 2000 });
      const broken = findings.filter((f) => f.rule === 'agents/broken-path');
      assert.equal(broken.length, 2);
      assert.equal(broken[0]?.line, 3);
      assert.match(broken[0]?.message ?? '', /src\/missing\.ts/);
      assert.match(broken[1]?.message ?? '', /docs\/nope\.md/);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('ignores home paths, dotted config keys, and owner/repo slugs while flagging real paths', () => {
    const dir = makeTempDir();
    try {
      const content = [
        '# AGENTS.md',
        'Ignore home `~/.config/yosr`, config key `engines.yosr`, and slug `getyosr/yosr-seed`.',
        'Flag `src/missing.ts`, `.github/workflows/`, and `seed.template.json`.',
        'Run `npm test` to verify.',
      ].join('\n');

      const findings = checkAgentsMdContent(content, dir, { maxTokens: 2000 });
      const broken = findings.filter((f) => f.rule === 'agents/broken-path');
      assert.equal(broken.length, 3);
      assert.match(broken[0]?.message ?? '', /src\/missing\.ts/);
      assert.match(broken[1]?.message ?? '', /\.github\/workflows\//);
      assert.match(broken[2]?.message ?? '', /seed\.template\.json/);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('checks relative Markdown links outside code and skips URLs and anchors', () => {
    const dir = makeTempDir();
    try {
      fs.mkdirSync(path.join(dir, 'docs'));
      fs.writeFileSync(path.join(dir, 'docs', 'guide.md'), '# Guide');

      const content = [
        '# AGENTS.md',
        'See [guide](docs/guide.md?view=1#setup), [directory](docs/), and [missing](docs/missing.md).',
        'See [web](https://example.com/guide), [email](mailto:docs@example.com), and [jump](#setup).',
        'Syntax example: `[guide](docs/placeholder.md)`.',
        '~~~md',
        '[fenced example](docs/placeholder.md)',
        '~~~',
        'Run `npm test`.',
      ].join('\n');

      const broken = checkAgentsMdContent(content, dir, { maxTokens: 2000 })
        .filter((finding) => finding.rule === 'agents/broken-path');
      assert.equal(broken.length, 1);
      assert.equal(broken[0]?.line, 2);
      assert.match(broken[0]?.message ?? '', /docs\/missing\.md/);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('warns when no verification gate is mentioned', () => {
    const dir = makeTempDir();
    try {
      const findings = checkAgentsMdContent('# AGENTS.md\nJust some notes.', dir, { maxTokens: 2000 });
      assert.ok(findings.some((f) => f.rule === 'agents/verification-gate' && f.severity === 'warn'));
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('passes on examples/valid-repo', () => {
    const validDir = path.resolve('examples/valid-repo');
    const result = lintAgentsMd(validDir, { maxTokens: 2000 });
    assert.equal(result.checked, true);
    assert.equal(result.findings.length, 0);
  });

  it('fails on examples/broken-repo', () => {
    const brokenDir = path.resolve('examples/broken-repo');
    const result = lintAgentsMd(brokenDir, { maxTokens: 2000 });
    assert.equal(result.checked, true);
    assert.ok(result.findings.some((f) => f.rule === 'agents/broken-path' && f.severity === 'error'));
    assert.ok(result.findings.some((f) => f.rule === 'agents/verification-gate' && f.severity === 'warn'));
  });
});
