import fs from 'node:fs';
import path from 'node:path';
import type { Finding } from '../types.js';
import { localLinkTarget, MARKDOWN_LINK_RE } from './markdown-links.js';

const FILE_NAME = 'llms.txt';
const H1_RE = /^#\s+\S/;
const H2_RE = /^##\s+\S/;
const HEADING_RE = /^#{1,6}\s+/;
const LIST_ITEM_RE = /^(?:[-*]|\d+\.)\s+/;

export function checkLlmsTxtContent(content: string, rootDir: string): Finding[] {
  const findings: Finding[] = [];
  const normalized = content.startsWith('\uFEFF') ? content.slice(1) : content;
  const lines = normalized.split(/\r?\n/);

  let h1Index = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]?.trim() ?? '';
    if (line.length > 0) {
      if (H1_RE.test(line)) {
        h1Index = i;
      }
      break;
    }
  }

  if (h1Index === -1) {
    findings.push({
      rule: 'llms/h1-required',
      severity: 'error',
      file: FILE_NAME,
      line: 1,
      message: 'First non-empty line must be a Markdown "# H1" title.',
    });
  } else {
    let hasBlockquote = false;
    for (let i = h1Index + 1; i < lines.length; i++) {
      const line = lines[i]?.trim() ?? '';
      if (line.length === 0) {
        continue;
      }
      hasBlockquote = line.startsWith('>');
      break;
    }
    if (!hasBlockquote) {
      findings.push({
        rule: 'llms/blockquote-summary',
        severity: 'warn',
        file: FILE_NAME,
        line: h1Index + 1,
        message: 'Expected a "> blockquote" summary directly after the H1 title.',
      });
    }
  }

  let inH2Section = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const trimmed = line.trim();

    if (H2_RE.test(trimmed)) {
      inH2Section = true;
      continue;
    }
    if (HEADING_RE.test(trimmed)) {
      inH2Section = false;
      continue;
    }

    if (inH2Section && LIST_ITEM_RE.test(trimmed)) {
      MARKDOWN_LINK_RE.lastIndex = 0;
      if (!MARKDOWN_LINK_RE.test(trimmed)) {
        findings.push({
          rule: 'llms/h2-link-format',
          severity: 'error',
          file: FILE_NAME,
          line: i + 1,
          message: 'List items in ## H2 sections must contain a Markdown link "[title](url)".',
        });
      }
    }

    MARKDOWN_LINK_RE.lastIndex = 0;
    for (const match of line.matchAll(MARKDOWN_LINK_RE)) {
      const rawUrl = match[2]?.trim() ?? '';
      const localTarget = localLinkTarget(rawUrl);
      if (!localTarget) {
        continue;
      }
      const resolved = path.resolve(rootDir, localTarget);
      if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
        findings.push({
          rule: 'llms/broken-local-link',
          severity: 'error',
          file: FILE_NAME,
          line: i + 1,
          message: `Local link "${rawUrl}" does not resolve to an existing file.`,
        });
      }
    }
  }

  return findings;
}

export function lintLlmsTxt(rootDir: string): { checked: boolean; findings: Finding[] } {
  const filePath = path.join(rootDir, FILE_NAME);
  if (!fs.existsSync(filePath)) {
    return { checked: false, findings: [] };
  }

  const content = fs.readFileSync(filePath, 'utf8');
  return {
    checked: true,
    findings: checkLlmsTxtContent(content, rootDir),
  };
}
