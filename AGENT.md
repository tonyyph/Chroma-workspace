# Chroma Wave — Codex Working Agreement

## Product

Chroma Wave is a synesthetic memory platform combining photography,
color palettes, music discovery and emotional journaling.

A Memory is the central domain aggregate.

## Working method

- Inspect existing code before modifying it.
- Complete one vertical slice before expanding broadly.
- Do not present placeholder implementations as complete.
- Run relevant checks before reporting success.
- Keep the repository buildable after every task.
- Do not silently alter unrelated behavior.

## Architecture

- Strict TypeScript; do not use `any`.
- Keep domain code independent from React, Expo, Supabase and Spotify.
- Do not call Supabase or music providers directly from screens.
- Keep server state in TanStack Query rather than duplicating it in Zustand.
- Validate external input with Zod.
- Use provider abstractions for music, analytics, subscriptions and storage.
- Represent database changes through migrations.
- Never expose service-role credentials to clients.

## UI and motion

- Use semantic design tokens; do not scatter raw styling values.
- Preserve Chroma Wave's distinctive visual identity.
- Do not replace intentional layouts with generic bordered-card dashboards.
- Motion must have purpose, reduced-motion behavior and performance awareness.
- User-derived palette colors must pass contrast and readability safeguards.
- Implement loading, empty, error, offline and permission-denied states.

## Validation

After relevant changes, run the available equivalents of:

- pnpm typecheck
- pnpm lint
- pnpm test
- pnpm format:check

For mobile changes, also validate Expo configuration and launch the target app.
For web UI changes, inspect the running application with Playwright.
