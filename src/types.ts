export type Severity = 'error' | 'warn';

export interface Finding {
  rule: string;
  severity: Severity;
  file: string;
  line?: number;
  message: string;
}

export interface LintSummary {
  errors: number;
  warnings: number;
  filesChecked: string[];
}

export interface LintResult {
  findings: Finding[];
  summary: LintSummary;
}

export interface LintOptions {
  maxTokens: number;
}
