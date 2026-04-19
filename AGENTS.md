# AGENTS.md — AI Agent Instructions

This file instructs AI coding agents (Claude Code, Cursor, Copilot, Codex, Aider,
Windsurf, Gemini, Cline, Devin, v0, and any future tool) on how to behave when
contributing to this repository. Human contributors should also read this.

This is the **backend** repo of the Student Worker Scheduling System. The
corresponding frontend lives at `elvismjema/StudentWrkSchedulingSystem-frontend`.

---

## Absolute rules

### 1. Never add AI attribution to commits

Do **not** add any of the following to commit messages, PR descriptions, or
anywhere in commit metadata:

- `Co-Authored-By: Claude <...>`
- `Co-Authored-By: ChatGPT <...>`
- `Co-Authored-By: Copilot <...>`
- `Co-Authored-By: Cursor <...>`
- `Co-Authored-By:` lines referencing any AI tool, model, or AI provider email
- `Generated with Claude / ChatGPT / Copilot / Cursor / ...`
- `🤖 Generated with ...` or emoji-tagged AI bylines
- `AI-Assisted:`, `AI Generated:`, `Assisted-By: <any AI tool>` prefixes
- Any equivalent phrasing that credits an AI model as author, co-author,
  or contributor

Commits must reflect the **human author only**. The human running the tool
takes full authorship and responsibility for the change.

A `commit-msg` git hook in `.githooks/` enforces this locally and will reject
any commit that contains these lines. Do not attempt to work around the hook.

### 2. Never push directly to `dev` or `main`

All changes land via pull requests. Branch off `dev`, push to your feature
branch, open a PR. A `pre-push` hook blocks direct pushes to protected branches
locally; GitHub branch protection enforces it remotely.

### 3. Never commit secrets

`.env` files are gitignored. Never commit real credentials, API keys, OAuth
secrets, refresh tokens, or database passwords. If you add a new environment
variable, update `.env.example` (if one exists) and document it in
`CONTRIBUTING.md`.

---

## First-time setup for this repo

After cloning, run:

```sh
sh scripts/setup-hooks.sh
```

This activates the enforcement hooks in `.githooks/`. Without this step the
hooks do nothing.

---

## Workflow expectations

- Branch naming: `feat/<short-description>`, `fix/<short-description>`,
  `chore/<short-description>`, `refactor/<short-description>`,
  `docs/<short-description>`, `test/<short-description>`
- Base branch: `dev`
- Commit style: conventional commits — `type(scope): short description`
- One logical change per commit
- Keep PRs focused — avoid bundling unrelated changes

See `CONTRIBUTING.md` for the full workflow.

---

## Code style and project conventions

- This is a Node.js + Express + Sequelize (MySQL) backend, ES modules.
  Follow existing patterns before introducing new ones.
- Database changes: write a Sequelize migration in `migrations/`. Do NOT rely
  on the `addMissingColumns` drift patcher in `server.js` for new schema —
  it is a safety net, not a source of truth.
- Logging: use the Winston logger at `app/config/logger.js`. Do not leave
  `console.log` statements in committed code.
- Routes / controllers / models follow the existing `*.routes.js` /
  `*.controller.js` / `*.model.js` naming. Match the style of neighboring
  files when adding new ones.
- Tests: Jest + Supertest. New endpoints should have integration tests under
  `__tests__/`.
- When editing a file, read neighboring code first to match existing style,
  naming conventions, and patterns.

---

## Acknowledgment

By contributing to this repository — as a human or as an AI agent — you agree
to these rules. Violations will be rejected at the hook level, in CI, and in
code review.
