#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { formatHuman, formatJson } from './format.js';
import { lintAgentsMd } from './rules/agents-md.js';
import { lintLlmsTxt } from './rules/llms-txt.js';
import type { Finding, LintResult } from './types.js';

const DEFAULT_MAX_TOKENS = 2000;

function readPackageVersion(): string {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const pkgPath = path.resolve(currentDir, '..', 'package.json');
  const raw = fs.readFileSync(pkgPath, 'utf8');
  const parsed = JSON.parse(raw) as { version?: string };
  return parsed.version ?? '0.0.0';
}

function printUsage(): void {
  console.log(`Usage: agents-md-lint [path] [options]

Options:
  --json             Output machine-readable JSON
  --strict           Exit with status 1 if there are any lint warnings
  --max-tokens <n>   Token bloat threshold for AGENTS.md (default: ${DEFAULT_MAX_TOKENS})
  -h, --help         Show this help message
  -v, --version      Show package version`);
}

function main(): number {
  let parsed: ReturnType<typeof parseArgs>;
  try {
    parsed = parseArgs({
      args: process.argv.slice(2),
      allowPositionals: true,
      options: {
        json: { type: 'boolean', default: false },
        strict: { type: 'boolean', default: false },
        'max-tokens': { type: 'string' },
        help: { type: 'boolean', short: 'h', default: false },
        version: { type: 'boolean', short: 'v', default: false },
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Error: ${message}`);
    return 2;
  }

  if (parsed.values.help) {
    printUsage();
    return 0;
  }

  if (parsed.values.version) {
    console.log(readPackageVersion());
    return 0;
  }

  if (parsed.positionals.length > 1) {
    console.error('Error: Expected at most one target path.');
    return 2;
  }

  let maxTokens = DEFAULT_MAX_TOKENS;
  const maxTokensArg = parsed.values['max-tokens'];
  if (typeof maxTokensArg === 'string') {
    const num = Number(maxTokensArg);
    if (!Number.isInteger(num) || num <= 0) {
      console.error(`Error: Invalid --max-tokens value "${maxTokensArg}". Expected a positive integer.`);
      return 2;
    }
    maxTokens = num;
  }

  const targetArg = parsed.positionals[0] ?? '.';
  const targetDir = path.resolve(targetArg);

  if (!fs.existsSync(targetDir) || !fs.statSync(targetDir).isDirectory()) {
    console.error(`Error: Target path "${targetArg}" is not an existing directory.`);
    return 2;
  }

  const agentsResult = lintAgentsMd(targetDir, { maxTokens });
  const llmsResult = lintLlmsTxt(targetDir);

  const findings: Finding[] = [...agentsResult.findings, ...llmsResult.findings];
  const filesChecked: string[] = [];
  if (agentsResult.checked) {
    filesChecked.push('AGENTS.md');
  }
  if (llmsResult.checked) {
    filesChecked.push('llms.txt');
  }

  const errors = findings.filter((f) => f.severity === 'error').length;
  const warnings = findings.filter((f) => f.severity === 'warn').length;
  const result: LintResult = {
    findings,
    summary: { errors, warnings, filesChecked },
  };

  console.log(parsed.values.json ? formatJson(result) : formatHuman(result));
  return errors > 0 || (parsed.values.strict && warnings > 0) ? 1 : 0;
}

process.exitCode = main();
