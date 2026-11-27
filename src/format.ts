import type { LintResult } from './types.js';

export function formatJson(result: LintResult): string {
  return JSON.stringify(result, null, 2);
}

export function formatHuman(result: LintResult): string {
  const lines: string[] = [];

  for (const finding of result.findings) {
    const location = finding.line !== undefined ? `${finding.file}:${finding.line}` : finding.file;
    const level = finding.severity.toUpperCase().padEnd(5);
    lines.push(`${location}  ${level}  [${finding.rule}] ${finding.message}`);
  }

  if (lines.length > 0) {
    lines.push('');
  }

  const { errors, warnings, filesChecked } = result.summary;
  const fileLabel = filesChecked.length === 1 ? 'file' : 'files';
  lines.push(
    `Checked ${filesChecked.length} ${fileLabel}: ${errors} error(s), ${warnings} warning(s).`,
  );

  return lines.join('\n');
}
