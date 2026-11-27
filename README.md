# agents-md-lint

Zero-dependency CLI linter that validates `AGENTS.md` and `llms.txt` files in any repository so AI coding agents get accurate, non-bloated context without stale file paths or broken links.

## Quickstart

```bash
npx agents-md-lint
```

Lint a specific directory or output machine-readable JSON:

```bash
npx agents-md-lint ./path/to/repo --json
npx agents-md-lint --max-tokens 1500
```

## CLI Options

- `[path]`: Target directory (defaults to `.`)
- `--json`: Output machine-readable JSON findings and summary
- `--max-tokens <n>`: Override token bloat threshold for `AGENTS.md` (default: `2000`, estimated as `Math.ceil(chars / 4)`)
- `--help`, `-h`: Print usage information
- `--version`, `-v`: Print package version

## Exit Codes

- `0`: All checks passed (warnings allowed)
- `1`: One or more `error` findings detected
- `2`: Runtime or CLI usage error (e.g., invalid directory or flag)

## Rules (v0.1.0)

### `AGENTS.md` (checked if present; `warn` if missing)

- `agents/non-empty` (`error`): File must not be empty or whitespace-only.
- `agents/token-budget` (`warn`): Estimated token count (`Math.ceil(chars / 4)`) exceeds `--max-tokens`.
- `agents/broken-path` (`error`): Backticked relative repo paths must exist on disk (ignores URLs, CLI flags, and shell commands).
- `agents/verification-gate` (`warn`): Should mention at least one verification/test/lint/build command.

### `llms.txt` (checked if present; silent if absent)

Follows the `llmstxt.org` v2 specification:

- `llms/h1-required` (`error`): First non-empty line (after optional BOM) must be a Markdown `# H1` title.
- `llms/blockquote-summary` (`warn`): Should include a `> blockquote` summary directly after the H1.
- `llms/h2-link-format` (`error`): List items inside `## H2` sections must contain a valid Markdown link `[title](url)`.
- `llms/broken-local-link` (`error`): Relative file links must resolve to an existing file on disk.

## Development

```bash
npm install
npm run check
```
