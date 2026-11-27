import fs from 'node:fs';
import path from 'node:path';
import type { Finding, LintOptions } from '../types.js';
import { localLinkTarget, MARKDOWN_LINK_RE } from './markdown-links.js';

const FILE_NAME = 'AGENTS.md';
const VERIFICATION_KEYWORD_RE =
  /\b(test|tests|lint|check|build|typecheck|verify|pytest|jest|vitest|eslint|tsc|cargo\s+test|go\s+test|npm\s+run)\b/i;
const CLI_VERIFICATION_RE =
  /\b(?:(?:npm|pnpm|yarn|bun)\s+(?:run|test|ci)\b|npx\b|pytest\b|jest\b|vitest\b|eslint\b|tsc\b|cargo\s+test\b|go\s+test\b|make\s+(?:test|check|lint|build|verify|ci)\b)/i;
const INLINE_CODE_RE = /`([^`\n]+)`/g;
const BARE_EXTENSION_RE = /^\.[a-z0-9]{1,6}$/i;
const VERSION_LIKE_RE = /^v?\d+\.\d+(?:\.\d+)?$/i;
const DISALLOWED_PATH_CHARS_RE = /[\s*?<>|"'\[\]{}()$=,:;@]/;
const KNOWN_FILE_EXTENSIONS = new Set([
  'ts',
  'tsx',
  'js',
  'jsx',
  'mjs',
  'cjs',
  'json',
  'md',
  'txt',
  'yml',
  'yaml',
  'toml',
  'py',
  'rs',
  'go',
  'sh',
  'css',
  'html',
  'sql',
  'env',
  'lock',
  'xml',
  'csv',
  'svg',
]);

function hasKnownExtension(segment: string): boolean {
  const dotIdx = segment.lastIndexOf('.');
  if (dotIdx <= 0 || dotIdx === segment.length - 1) {
    return false;
  }
  const ext = segment.slice(dotIdx + 1).toLowerCase();
  return KNOWN_FILE_EXTENSIONS.has(ext);
}

function collectCodeRegions(content: string): string {
  const parts: string[] = [];
  const lines = content.split(/\r?\n/);
  let inFencedBlock = false;
  const outsideFence: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('```') || trimmed.startsWith('~~~')) {
      inFencedBlock = !inFencedBlock;
      continue;
    }
    if (inFencedBlock) {
      parts.push(line);
    } else {
      outsideFence.push(line);
    }
  }

  for (const match of outsideFence.join('\n').matchAll(INLINE_CODE_RE)) {
    parts.push(match[1] ?? '');
  }
  return parts.join('\n');
}

function hasVerificationGate(content: string): boolean {
  if (CLI_VERIFICATION_RE.test(content)) {
    return true;
  }
  return VERIFICATION_KEYWORD_RE.test(collectCodeRegions(content));
}

function looksLikeRepoPath(raw: string): boolean {
  const token = raw.trim();
  if (!token || token.startsWith('-') || token.startsWith('/') || token.startsWith('~')) {
    return false;
  }
  if (DISALLOWED_PATH_CHARS_RE.test(token)) {
    return false;
  }
  if (BARE_EXTENSION_RE.test(token) || VERSION_LIKE_RE.test(token)) {
    return false;
  }
  if (token.includes('/')) {
    if (token.startsWith('.') || token.endsWith('/')) {
      return true;
    }
    const slashCount = token.split('/').length - 1;
    if (slashCount >= 2) {
      return true;
    }
    const lastSegment = token.slice(token.lastIndexOf('/') + 1);
    return hasKnownExtension(lastSegment);
  }
  return /^[A-Za-z0-9_.-]+$/.test(token) && hasKnownExtension(token);
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

    const candidates: string[] = [];
    for (const match of line.matchAll(INLINE_CODE_RE)) {
      const candidate = match[1]?.trim() ?? '';
      if (looksLikeRepoPath(candidate)) {
        candidates.push(candidate);
      }
    }
    const markdown = line.replace(INLINE_CODE_RE, ' ');
    for (const match of markdown.matchAll(MARKDOWN_LINK_RE)) {
      const candidate = localLinkTarget(match[2] ?? '');
      if (candidate && !candidate.startsWith('/') && !candidate.startsWith('~/')) {
        candidates.push(candidate);
      }
    }
    for (const candidate of candidates) {
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

  if (!hasVerificationGate(content)) {
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
