# SPEC: agents-md-lint (v0.1.0)

## Purpose
A zero-dependency CLI linter that validates `AGENTS.md` and `llms.txt` files in any repository so AI coding agents get accurate, non-bloated context without stale file paths or broken links.

## Stack & Constraints
- **Runtime:** Node.js >= 20 (ESM)
- **Language:** TypeScript (strict mode)
- **Runtime Dependencies:** **0** (use Node built-ins only: `node:fs`, `node:path`, `node:util`)
- **Test Runner:** `node:test` + `node:assert/strict` (zero test framework bloat)
- **Core Code Ceiling:** <= 600 lines across `src/`

## CLI Interface
```bash
npx @wzohny/agents-md-lint [path] [options]
```

* `[path]`: Target directory (defaults to `.`)
* `--json`: Output machine-readable JSON array of findings + summary
* `--strict`: Fail on warnings without changing finding severities
* `--recursive`: Also check nested `AGENTS.md` files, skipping symlinked directories and common dependency or output directories
* `--max-tokens <n>`: Override token bloat threshold for `AGENTS.md` (default: `2000`, estimated as `Math.ceil(chars / 4)`)
* `--help` / `-h`: Print concise usage
* `--version` / `-v`: Print package version

## Exit Codes

* `0`: All checks passed (warnings allowed by default)
* `1`: One or more `error` findings, or any `warn` findings with `--strict`
* `2`: Runtime or CLI usage error (e.g., invalid directory)

## Lint Rules (v0.1.0)

### A. `AGENTS.md` Rules (checked if `AGENTS.md` exists; `warn` if missing)

1. **`agents/non-empty`** (`error`): File must not be empty or whitespace-only.
2. **`agents/token-budget`** (`warn`): Estimated token count (`chars / 4`) exceeds `--max-tokens` (default 2000).
3. **`agents/broken-path`** (`error`): Relative file and directory paths in backticks or Markdown links must exist on disk. Ignore external URLs, same-document anchors, CLI flags, and shell commands.
4. **`agents/verification-gate`** (`warn`): File should mention at least one verification/test/lint command (e.g., `test`, `lint`, `check`, `build`, `pytest`, `cargo test`).

### B. `llms.txt` Rules (checked if `llms.txt` exists; silent if absent)

Follows the `llmstxt.org` v2 specification:

1. **`llms/h1-required`** (`error`): First non-empty line (after optional BOM) must be a Markdown `# H1` title.
2. **`llms/blockquote-summary`** (`warn`): Should include a `> blockquote` summary directly after the H1.
3. **`llms/h2-link-format`** (`error`): List items inside `## H2` sections must contain a valid Markdown link `[title](url)` (optional `: notes` allowed).
4. **`llms/broken-local-link`** (`error`): Relative file links (non-`http://`, non-`https://`, non-`mailto:`) must resolve to an existing file on disk.

## Exact File Tree

```text
agents-md-lint/
├── AGENTS.md
├── SPEC.md
├── llms.txt
├── README.md
├── LICENSE
├── package.json
├── tsconfig.json
├── src/
│   ├── cli.ts              # CLI entrypoint, arg parsing, exit codes
│   ├── types.ts            # Shared types (Finding, LintResult, Severity)
│   ├── rules/
│   │   ├── agents-md.ts    # Rules for AGENTS.md (paths, tokens, gates)
│   │   ├── llms-txt.ts     # Rules for llms.txt (v2 spec compliance, links)
│   │   └── markdown-links.ts # shared Markdown link parsing
│   └── format.ts           # Human terminal output + --json formatter
├── test/
│   ├── agents-md.test.ts   # Node built-in test runner (node:test)
│   └── llms-txt.test.ts
└── examples/
    ├── valid-repo/         # CI-tested passing fixture (AGENTS.md + llms.txt)
    └── broken-repo/        # CI-tested failing fixture

```

## Non-Goals (Out of Scope for v0.1.0)

* No network HTTP requests (no live URL pinging—keep it 100% offline and deterministic).
* No auto-fix (`--fix`).
* No config file (`.agentslintrc`). CLI flags only.
