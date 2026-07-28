---
name: release-readiness
description: Perform a production and beta release audit for CHROMAWAVE mobile and web. Use before TestFlight, internal beta or public deployment.
---

Audit the release candidate against every area below. Verify against the actual
repository and a real build — not against documentation or intent.

## Audit

- **Build configuration** — Expo/EAS profiles, app identifiers, versions and build
  numbers, Next.js build settings, source maps.
- **Environment variables** — every required variable is declared and validated at
  startup; no client-exposed variable holds a secret; staging and production are
  separated.
- **Secrets** — no service-role key, provider client secret or API token in the
  client bundle, the repository or committed env files.
- **Typecheck, lint, tests, format** — run them and report actual output. A skipped
  or failing check is a finding, not a footnote.
- **Crash reporting** — wired for both platforms, symbol/source-map upload working,
  a test event confirmed.
- **Analytics privacy** — typed event map only; no raw photo content, personal
  notes or precise location in event payloads.
- **Permission messages** — camera, photo library and location strings present,
  accurate, and shown only when the permission is actually needed.
- **Authentication lifecycle** — sign-in, token refresh, expired session, sign-out,
  account deletion, and Spotify disconnected/expired states all behave.
- **Subscription entitlements** — Free, Pro and Premium limits enforced through the
  centralized entitlement rules; paywall reachable; restore purchases works; no mock
  entitlement provider left active in a production build.
- **Offline behavior** — cached Memories viewable, drafts stored locally, pending
  uploads retryable, failed pairings retryable, drafts visually distinct from
  synced Memories.
- **Accessibility** — contrast, Dynamic Type, screen reader labels, focus order,
  touch targets, Reduce Motion, non-color state indicators.
- **Performance** — cold start, timeline scroll, palette extraction time, animation
  frame rate, memory under sustained browsing.
- **Store metadata requirements** — icons, splash, screenshots, descriptions, age
  rating, privacy nutrition labels matching what the app actually collects.
- **Database migrations** — applied cleanly to a fresh and an existing database,
  RLS still enforced after the migration.
- **Rollback path** — how to revert the release and the migration, and what breaks
  if a client on the old build talks to the new backend.

## Report

Return three separate sections:

1. **Blockers** — must be fixed before shipping.
2. **High-risk warnings** — ship only with an explicit accepted risk.
3. **Non-blocking improvements.**

## Never

- Do not approve a release while any critical flow remains mocked, including the
  music provider, the entitlement provider or checkout.
- Do not report a check as passing without having run it.
