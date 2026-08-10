# 08 · Privacy and backend decision

## The question, answered directly

The previous position was **no backend, no account, no telemetry**
(`archive/25 §1`), stated as a position rather than a gap. It is incompatible
with two of the three things the restored vision wants.

| Capability                       | Needs a secret? | Verdict                          |
| -------------------------------- | --------------- | -------------------------------- |
| Colour extraction, ΔE00, roles   | No              | Stays fully on device            |
| Atmosphere reading, MusicIntent  | No              | Stays fully on device            |
| iTunes Search: search + previews | **No**          | Direct from device               |
| Deezer search + previews         | **No**          | Direct from device               |
| Apple Music API                  | **Yes** (.p8)   | Needs a token endpoint           |
| LLM image analysis / explanation | **Yes**         | Needs a proxy                    |

**So: "no backend" survives for the entire free, default product.** The core
loop — capture → palette → atmosphere → intent → search → preview → save — runs
with no server, no account, and no secret in the bundle. That is the shipping
configuration.

A backend is required only for the two optional upgrades. It must therefore be
*optional at runtime*, not a hard dependency, and its absence must be a
first-class configuration rather than a broken app.

## The minimal secure boundary

Two routes. Stateless. No database, no user records, no logs of content.

```
POST /v1/analyse
  in : { image: base64 (≤1024px, q0.7, EXIF-stripped), locale }
  out: VisualAnalysis          — validated against the same Zod schema
  does: forwards to the vision model with a pinned system prompt,
        validates the structured output, returns it, retains nothing.

GET  /v1/apple-music-token
  out: { token: string, expiresAt: string }
  does: signs a short-lived ES256 JWT from the MusicKit .p8 held in the
        platform secret store. Never returns the key.
```

Deployment: a single edge function (Cloudflare Workers / Vercel / Supabase Edge —
all equivalent here). Requirements:

- Secrets in the platform's secret store; **never** in the repo, never in
  `app.json`, never in an `EXPO_PUBLIC_*` variable — those are compiled into the
  bundle in plaintext.
- Anonymous, per-install rate limiting via a device-generated opaque id. That id
  is random, stored in MMKV, never derived from IDFV/IDFA, and is not an account.
- No request logging of image bytes, captions, or prompts. Counts and latencies
  only.
- Explicit retention statement: **zero**. Images are held in memory for the
  duration of the request.
- CORS closed; only the app's bundle identifier permitted where the platform
  supports attestation.

**Not** an account system. No sign-in, no email, no profile, no sync.

## What leaves the device, exactly

| Data                    | Leaves?               | To whom            | Why                     |
| ----------------------- | --------------------- | ------------------ | ----------------------- |
| Original photograph     | **Never**             | —                  | —                       |
| 1024px JPEG copy        | Only with consent, on | Our edge → model   | Caption and scene       |
| EXIF                    | **Never** — stripped  | —                  | —                       |
| GPS / precise location  | **Never**             | —                  | Not sent even if stored |
| Palette hex values      | No                    | —                  | Intent is computed local|
| Search terms (genre, mood words) | Yes         | Music provider     | Finding tracks          |
| Device locale / market  | Yes                   | Music provider     | Regional catalogue      |
| User note / title       | **Never**             | —                  | —                       |
| Selected track ids      | **Never**             | —                  | Feedback stays local    |
| Analytics               | Nothing               | —                  | Transport is a no-op    |

The search terms are the only unavoidable disclosure in the default
configuration, and they are genre and mood words — "ambient instrumental calm" —
not the user's content.

## Consent

Image analysis is **off by default** and asked for once, in context, at the
moment it would first run:

> **Read the scene as well as the colour?**
> A 1024-pixel copy of this photo is sent to our analysis service and deleted
> immediately. It is never stored, never linked to you, and location is never
> sent. Colours and music work without this.
> **[ Not now ]  [ Turn on ]**

Stored as `preferences.imageAnalysisConsent: 'granted' | 'denied' | 'unasked'`.
Revocable in You → Privacy, alongside a plain-language statement of what has been
sent. Declining is a complete product, not a degraded one — which is what makes
the consent honest.

Location is **never** attached to a memory without a separate, explicit action
("Add place"), and even then it is stored as a coarse place name string
(`personalContext.location`), not coordinates, and never transmitted.

## Deletion and retention

- Deleting a memory removes the record, its photo, and its thumbnail. The
  existing orphan-free deletion in `StoredPaletteRepository.remove` extends to
  both assets.
- You → Privacy offers **Delete all local data** — memories, collections,
  photos, caches, preferences — with confirmation.
- Remote retention is zero by design: there is nothing to delete server-side
  because nothing is stored. This is stated in-app rather than only in a policy.
- Caches (`analysis:`, `intent:`, `search:`) are cleared by the same action and
  are bounded independently.

## App Store requirements

- `PrivacyInfo.xcprivacy` exists (`ios/CHROMAWAVE/PrivacyInfo.xcprivacy`) and
  must be updated to declare the network use and the "no data collected"
  position accurately.
- `NSPhotoLibraryUsageDescription` / `NSCameraUsageDescription`: already present;
  copy must be rewritten to mention the colour-and-music purpose.
- No background audio mode. `UIBackgroundModes: audio` is **not** declared —
  30-second previews in an active session do not need it, and declaring an unused
  capability invites review questions (`11`).

## Analytics

The typed 27-event contract in `packages/analytics` is kept and extended for
pairing events. The transport stays `DevelopmentAnalytics` / `NoopAnalytics`.
**Nothing is sent.** If that ever changes it is a deliberate, documented decision
with a consent gate, and the event shapes already exclude URIs, image bytes,
notes, and location by construction.
