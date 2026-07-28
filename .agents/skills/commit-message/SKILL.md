---
name: commit-message
description: Generate one high-quality Conventional Commit message from the current staged or unstaged Git changes. Use when asked for a commit message.
---

Inspect `git status` and the relevant diff. Prefer the staged diff
(`git diff --cached`); fall back to the unstaged diff when nothing is staged.

Generate:

- One Conventional Commit subject — `type(scope): summary`, imperative mood,
  lowercase summary, no trailing period, ideally under 72 characters.
  Types: `feat`, `fix`, `refactor`, `perf`, `docs`, `test`, `build`, `ci`, `chore`.
  Scope should match the workspace or package the change lives in
  (for example `mobile`, `web`, `domain`, `ui`, `design-tokens`, `db`).
- An optional concise body only when the diff is not self-explanatory — what changed
  and why, wrapped at ~72 columns.
- A `BREAKING CHANGE:` footer only when the diff actually breaks a contract.

Output the message alone.

## Never

- No markdown explanation, code fences or commentary around the message.
- No fabricated issue, ticket or PR number.
- No claim beyond what the actual diff contains.
- Do not modify files, stage changes, or create a commit.
