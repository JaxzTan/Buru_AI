# Repository Rules

## 1. Branch Structure

| Branch | Purpose | Who can push | Deploys to |
|---|---|---|---|
| `main` | Final / release. Always deployable, tagged per release. | Nobody directly — PR from `dev` only | Production |
| `dev` | Stable integration branch. All finished work lands here first. | Nobody directly — PR from feature branches | Staging |
| `feature/*` | One branch per person, per piece of work. | The owner of the branch | — |

> **Rule:** `main` and `dev` are protected. No direct commits, no force-push, ever.

## 2. Branch Naming

```
<type>/<short-kebab-description>
```

| Type | Use for |
|---|---|
| `feature/` | New functionality |
| `fix/` | Bug fix on `dev` |
| `hotfix/` | Urgent fix branched from `main` |
| `refactor/` | Code restructuring, no behaviour change |
| `chore/` | Config, deps, CI, tooling |
| `docs/` | Documentation only |

**Examples:**

```
feature/user-authentication
feature/match-history-api
fix/websocket-reconnect-loop
hotfix/payment-null-crash
chore/upgrade-go-1-24
```

**Rules:**

- Lowercase, kebab-case, no spaces or underscores.
- Keep it under ~40 characters.
- If you use an issue tracker, prefix the number: `feature/42-user-authentication`.
- One branch = one concern. Don't stack unrelated work in the same branch.

## 3. Workflow

### Normal work

```
dev ──► feature/xxx ──PR──► dev ──PR──► main
```

1. Always branch off the latest `dev`:

   ```bash
   git checkout dev
   git pull origin dev
   git checkout -b feature/my-thing
   ```

2. Commit as you go (see [§4](#4-commit-message-rules)).
3. Before opening a PR, sync with `dev`:

   ```bash
   git fetch origin
   git rebase origin/dev   # rebase, don't merge, on feature branches
   ```

4. Push and open a PR into `dev`.
5. After merge, delete the remote branch.

### Hotfix (production is broken)

```
main ──► hotfix/xxx ──PR──► main ──► back-merge into dev
```

A hotfix must be merged back into `dev` immediately so the two branches don't drift.

### Release

When `dev` is stable and tested, open a PR `dev → main`, then tag on `main` (`v1.2.0`).

## 4. Commit Message Rules

Every commit message starts with a keyword (type). Format:

```
<type>(<scope>): <subject>

<optional body — what and why, not how>

<optional footer — Closes #12>
```

### Allowed keywords

| Keyword | Meaning |
|---|---|
| `feat` | New feature |
| `fix` | Bug fix |
| `refactor` | Restructure without changing behaviour |
| `perf` | Performance improvement |
| `test` | Adding or fixing tests |
| `docs` | Documentation only |
| `style` | Formatting, whitespace, linting — no logic change |
| `chore` | Build, deps, tooling, CI config |
| `build` | Build system or external dependency changes |
| `ci` | CI/CD pipeline changes |
| `revert` | Reverting a previous commit |

### Subject line rules

- Imperative mood: `add login endpoint`, not `added` / `adds`.
- Lowercase after the colon, no trailing period.
- Max 72 characters.
- Scope is optional but encouraged: the module, package, or area touched.

### Examples

**Good:**

```
feat(auth): add JWT refresh token endpoint
fix(ws): prevent reconnect loop on server restart
refactor(match): extract scoring logic into service layer
chore(deps): bump redis client to v9.5.1
docs(readme): add local setup steps
```

**Bad:**

```
update                      ← no keyword, no information
fixed stuff                 ← past tense, vague
feat: Added New Feature.    ← capitals, past tense, trailing period
WIP                         ← never commit WIP to a shared branch
```

### Breaking changes

Add `!` after the type and explain in the footer:

```
feat(api)!: change match response shape

BREAKING CHANGE: `players` is now an object array instead of an ID array.
```

## 5. Pull Request Rules

- PR title follows the same commit convention: `feat(auth): add JWT refresh flow`.
- Every PR needs at least **1 approval** before merge.
- CI (build + lint + tests) must pass — no merging red builds.
- Keep PRs small. If it's over ~400 changed lines, consider splitting it.
- PR description should cover: **what** changed, **why**, **how to test** it, and any screenshots for UI work.
- Resolve all review comments before merging. Don't merge your own PR without review.

### Merge strategy

| Direction | Strategy | Why |
|---|---|---|
| `feature/*` → `dev` | Squash and merge | Keeps `dev` history clean, one commit per feature |
| `dev` → `main` | Merge commit | Preserves the release history |

## 6. Branch Protection Settings

Configure under **Settings → Branches → Add rule** (or **Rulesets**) for both `main` and `dev`:

- [x] Require a pull request before merging
- [x] Require at least 1 approving review
- [x] Dismiss stale approvals when new commits are pushed
- [x] Require status checks to pass before merging
- [x] Require branches to be up to date before merging
- [x] Require conversation resolution before merging
- [x] Block force pushes
- [x] Restrict deletions
- [x] Require linear history (on `dev`)

## 7. Quick Do / Don't

### ✅ Do

- Pull `dev` before starting anything new
- Commit small and often, with a keyword every time
- Rebase your feature branch onto `dev` before opening a PR
- Delete your branch after it's merged

### ❌ Don't

- Push directly to `main` or `dev`
- Force-push to a shared branch
- Commit secrets, `.env` files, or build artifacts
- Mix unrelated changes in one commit or one PR
- Leave a branch open for weeks — long-lived branches mean painful merges

## 8. Optional: Enforce It Automatically

Add commitlint + husky so bad commit messages get rejected locally:

```bash
npm install --save-dev @commitlint/cli @commitlint/config-conventional husky
npx husky init
echo 'npx --no -- commitlint --edit $1' > .husky/commit-msg
```

`commitlint.config.js`:

```js
module.exports = { extends: ['@commitlint/config-conventional'] };
```

Then add a CI job that runs commitlint on PR titles too, so squash-merge commits stay consistent.
