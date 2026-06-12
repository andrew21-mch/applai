# Contributing to ApplAI

Thanks for your interest in contributing!

## Getting started

1. Fork the repo and clone your fork
2. Follow [README.md](README.md) quick start (install, `.env`, Supabase, Ollama)
3. Create a branch: `git checkout -b fix/my-change` or `feat/my-feature`
4. Make changes and verify builds pass:
   ```bash
   npm run build
   cd dashboard && npm run build
   ```
5. Open a pull request against `main`

## What to work on

Good first contributions:

- ATS site support in `src/utils/formFill.ts`
- Job board sources in `src/config/sources.ts`
- Dashboard UX improvements
- Documentation and troubleshooting entries
- Tests for `src/utils/matchScore.ts` and `src/utils/jsonParse.ts`

## Code guidelines

- Match existing TypeScript style and file layout
- Keep changes focused — one feature or fix per PR
- Do not commit `.env`, secrets, or personal resume data
- Prompts in `prompts/` should stay generic (no hardcoded personal info)

## Reporting bugs

Use the [bug report template](.github/ISSUE_TEMPLATE/bug_report.md) and include:

- Steps to reproduce
- Expected vs actual behavior
- API logs or dashboard error message
- Ollama model name if LLM-related

## Feature requests

Open an issue with the [feature request template](.github/ISSUE_TEMPLATE/feature_request.md). Explain the use case — especially for new job boards or apply flows.

## License

By contributing, you agree your contributions are licensed under the [MIT License](LICENSE).
