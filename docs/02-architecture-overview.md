# Architecture overview

## Shape

```text
apps/mobile              Expo Router composition and native infrastructure
packages/domain          Pure schemas, color science, mood and entitlement rules
packages/design-tokens   Platform-neutral visual and motion tokens
packages/analytics       Typed privacy-safe event contract
```

`Memory` is the central aggregate. Presentation depends on use cases and provider
interfaces; infrastructure implements those interfaces. Domain packages never
import React, Expo, Supabase, Spotify, RevenueCat, or AsyncStorage.

## First-slice boundaries

- `PaletteExtractor`: native image normalization plus pure perceptual clustering.
- `MemoryRepository`: AsyncStorage implementation with Zod validation.
- `MemoryAssetStore`: copies confirmed photos to application documents storage.
- `MusicProvider`: deterministic local mock; Spotify adapter is a later module.
- `Analytics`: no-op/dev adapter over a typed event map.
- `EntitlementProvider`: typed mock, with rules centralized in the domain.

TanStack Query will own remote state when cloud synchronization begins. It is not
installed merely to wrap local device state.

## ADR-001: local-first vertical slice

Status: accepted. Local-first removes account and credential dependencies while
exercising the real aggregate, repository, image processing, and navigation seams.

## ADR-002: no web app in cycle one

Status: accepted. The Blueprint prioritizes the mobile loop. Shared packages keep a
Next.js public surface possible without creating an empty web shell.
