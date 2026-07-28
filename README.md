# CHROMAWAVE

CHROMAWAVE is a mobile-first synesthetic memory platform. A photograph becomes a
perceptual color palette, a mood, and a musical pairing stored as a private Memory.

This repository currently implements the first local-first vertical slice from the
[Product Blueprint](./CHROMAWAVE%20Product%20Blueprint.pdf).

## Requirements

- Node 20.19 or newer (Node 20.20.1 is the verified baseline)
- Corepack
- Xcode for iOS or Android Studio for Android
- Expo Go compatible with SDK 55, or a generated development build

## Setup

```bash
corepack prepare pnpm@10.18.3 --activate
corepack pnpm install
corepack pnpm ios
```

Use `corepack pnpm android` for Android. No credentials are needed for the first slice:
photos are processed locally, metadata is stored with AsyncStorage, confirmed image
files are copied into app documents storage, and music comes from an explicitly
typed mock provider.

## Quality checks

```bash
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm test
corepack pnpm format:check
```

Architecture, privacy, motion, testing, roadmap, and risk decisions are under
[`docs/`](./docs).

## Workspace

```text
apps/mobile
packages/domain
packages/design-tokens
packages/analytics
```

Cloud sync, Spotify, subscription checkout, and publication are not represented as
working integrations. Their provider boundaries are documented for later milestones.
