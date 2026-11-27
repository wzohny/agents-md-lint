import fs from 'node:fs';
import path from 'node:path';
import type { Finding, LintOptions } from '../types.js';

const FILE_NAME = 'AGENTS.md';
const VERIFICATION_GATE_RE =
  /\b(test|tests|lint|check|build|typecheck|verify|pytest|jest|vitest|eslint|tsc|cargo\s+test|go\s+test|npm\s+run)\b/i;
const INLINE_CODE_RE = /`([^`\n]+)`/g;
const BARE_EXTENSION_RE = /^\.[a-z0-9]{1,6}$/i;
const VERSION_LIKE_RE = /^v?\d+\.\d+(?:\.\d+)?$/i;
const DOMAIN_TLD_RE = /\.(?:org|com|io|dev|net|ai|co)$/i;
const DISALLOWED_PATH_CHARS_RE = /[\s*?<>|"'\[\]{}()$=,:;@]/;

function looksLikeRepoPath(raw: string): boolean {
  const token = raw.trim();
  if (!token || token.startsWith('-') || token.startsWith('/')) {
    return false;
  }
  if (DISALLOWED_PATH_CHARS_RE.test(token)) {
    return false;
  }
  if (BARE_EXTENSION_RE.test(token) || VERSION_LIKE_RE.test(token) || DOMAIN_TLD_RE.test(token)) {
    return false;
  }
  if (token.includes('/')) {
    return true;
  }
  return /^[A-Za-z0-9_.-]+\.[A-Za-z0-9]{1,6}$/.test(token);
}

export function checkAgentsMdContent(
  content: string,
  rootDir: string,
  options: LintOptions,
): Finding[] {
  const findings: Finding[] = [];

  if (content.trim().length === 0) {
    findings.push({
      rule: 'agents/non-empty',
      severity: 'error',
      file: FILE_NAME,
      line: 1,
      message: 'AGENTS.md must not be empty or whitespace-only.',
    });
    return findings;
  }

  const estimatedTokens = Math.ceil(content.length / 4);
  if (estimatedTokens > options.maxTokens) {
    findings.push({
      rule: 'agents/token-budget',
      severity: 'warn',
      file: FILE_NAME,
      message: `Estimated ${estimatedTokens} tokens exceeds budget of ${options.maxTokens} tokens.`,
    });
  }

  const lines = content.split(/\r?\n/);
  let inFencedBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const trimmed = line.trim();
    if (trimmed.startsWith('```') || trimmed.startsWith('~~~')) {
      inFencedBlock = !inFencedBlock;
      continue;
    }
    if (inFencedBlock) {
      continue;
    }

    INLINE_CODE_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = INLINE_CODE_RE.exec(line)) !== null) {
      const candidate = match[1]?.trim() ?? '';
      if (!looksLikeRepoPath(candidate)) {
        continue;
      }
      const resolved = path.resolve(rootDir, candidate);
      if (!fs.existsSync(resolved)) {
        findings.push({
          rule: 'agents/broken-path',
          severity: 'error',
          file: FILE_NAME,
          line: i + 1,
          message: `Referenced path "${candidate}" does not exist on disk.`,
        });
      }
    }
  }

  if (!VERIFICATION_GATE_RE.test(content)) {
    findings.push({
      rule: 'agents/verification-gate',
      severity: 'warn',
      file: FILE_NAME,
      message: 'No verification/test/lint/build command mentioned.',
    });
  }

  return findings;
}

export function lintAgentsMd(
  rootDir: string,
  options: LintOptions,
): { checked: boolean; findings: Finding[] } {
  const filePath = path.join(rootDir, FILE_NAME);
  if (!fs.existsSync(filePath)) {
    return {
      checked: false,
      findings: [
        {
          rule: 'agents/missing',
          severity: 'warn',
          file: FILE_NAME,
          message: 'AGENTS.md not found in target directory.',
        },
      ],
    };
  }

  const content = fs.readFileSync(filePath, 'utf8');
  return {
    checked: true,
    findings: checkAgentsMdContent(content, rootDir, options),
  };
}
