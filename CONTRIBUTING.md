# Contributing — Student Worker Scheduling System (Backend)

## First-time setup

After cloning, run the hook installer once:

```sh
sh scripts/setup-hooks.sh
```

This points git to `.githooks/` so the enforcement hooks are active. Without this step, the hooks do nothing.

---

## Branch rules

| Branch | Purpose | Who pushes directly |
|--------|---------|-------------------|
| `main` | Production-stable releases | **Nobody — PRs only** |
| `dev` | Integration branch for the active sprint | **Nobody — PRs only** |
| `feat/*` | New features | You |
| `fix/*` | Bug fixes | You |
| `chore/*` | Tooling, deps, config, cleanup | You |
| `test/*` | Test-only changes | You |

**Never push directly to `dev` or `main`.** The `pre-push` hook will block it locally. On GitHub, both branches should have branch protection rules enabled (see below).

---

## Workflow

```
1. Branch off dev
   git checkout dev && git pull origin dev
   git checkout -b feat/your-feature-name

2. Make commits on your branch
   Keep commits focused. One logical change per commit.

3. Push your branch
   git push origin feat/your-feature-name

4. Open a Pull Request → dev
   - Fill out the PR template
   - Link to any related issue or ticket
   - Add at least one reviewer

5. Address review feedback on the same branch

6. Squash and merge when approved
   Delete the branch after merge.
```

---

## Commit message format

Follow conventional commits:

```
<type>: <short description>

[optional body]
```

Types: `feat`, `fix`, `chore`, `refactor`, `test`, `docs`

Examples:
```
feat: add idempotent class schedule sync service
fix: prevent manual availability from overriding class blocks
chore: update sequelize to patch critical vuln
```

**No AI attribution lines.** The `commit-msg` hook will reject any commit containing `Co-Authored-By` AI bylines, `Generated with`, or similar. This applies to all AI tools — Claude, ChatGPT, Copilot, Codex, Gemini, etc.

---

## Pull request checklist

Before requesting review, confirm:

- [ ] Branch is up to date with `dev` (rebase or merge)
- [ ] `npm test` passes locally
- [ ] No new critical/high vulnerabilities introduced (`npm audit`)
- [ ] New endpoints have corresponding tests
- [ ] `.env` changes are reflected in `.env.example` (never commit real secrets)
- [ ] No AI attribution lines in any commit on the branch

---

## GitHub branch protection (repo settings)

Both `main` and `dev` must have these rules enabled in GitHub Settings → Branches:

- Require a pull request before merging
- Require at least 1 approving review
- Dismiss stale reviews when new commits are pushed
- Require status checks to pass before merging (when CI is set up)
- Block direct pushes

---

## What never goes in this repo

- Real credentials, API keys, or passwords (use `.env`, never commit it)
- AI tool attribution lines in commits
- Direct commits to `dev` or `main`
- Commented-out code blocks longer than 5 lines
- Console.log statements in production code paths
