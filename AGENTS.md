# AGENTS.md

## Project Overview
`agents-md-lint` is a zero-dependency TypeScript CLI that lints `AGENTS.md` and `llms.txt` files. Read `SPEC.md` before making changes.

## Architecture Boundaries
- `src/cli.ts`: Argument parsing (`node:util` `parseArgs`), orchestration, exit codes. No rule logic here.
- `src/rules/agents-md.ts`: Pure linting functions for `AGENTS.md`.
- `src/rules/llms-txt.ts`: Pure linting functions for `llms.txt`.
- `src/format.ts`: Human and JSON output formatting.
- `src/types.ts`: Shared TypeScript interfaces only.

## Code Style & Rules
- TypeScript `strict: true`, ESM (`"type": "module"`), explicit `.js` extensions on relative imports.
- **Zero runtime dependencies.** Do not add packages to `dependencies` in `package.json`.
- Keep functions small, flat, and readable by a human in one pass. No clever one-liners or premature abstractions.
- Never use `any`.

## Local Verification Gate
Run this single command before finishing any task or opening a PR:
```bash
npm run check
```

This runs: `typecheck` (`tsc --noEmit`) → `build` (`tsc`) → `test` (`node --test`) → self-lint (`node dist/cli.js .`).
All steps must exit `0`.

## Commit Hygiene

Keep commits focused and logical (e.g., `feat: add llms.txt spec rules`, `test: add broken-repo fixture`).
