# 07 · Music provider feasibility

Researched 2026-08-10. **Every row marked "needs legal confirmation" must be
checked against the provider's own current terms before a public release.** This
document is engineering due diligence, not legal advice, and provider terms
change without notice — Spotify's did, and it invalidated the design most people
would reach for.

## The headline finding

**Spotify cannot do what this product needs.** Effective 2024-11-27, Spotify
removed access to 30-second `preview_url` values for applications registered
after that date, along with the Recommendations and audio-features endpoints for
new apps. A Spotify app registered today returns `preview_url: null`. Full
playback requires the native Spotify SDK **and** a Premium subscription on the
listener's account.

Any design that assumes "we'll just use Spotify previews" is dead on arrival in
2026. This is the single most important fact in this document.

## Feasibility matrix

| | **iTunes Search** | **Apple Music API** | **Deezer** | **Spotify** |
|---|---|---|---|---|
| Track search | ✅ keyless | ✅ | ✅ keyless | ✅ |
| Preview clips | ✅ `previewUrl` | ✅ `previews[].url` | ✅ `preview` | ❌ new apps |
| Preview length | ~30s | ~30s | 30s | — |
| Auth required | **None** | ES256 JWT, server-signed | **None** | OAuth |
| Paid sub for preview | No | No | No | — |
| Full playback | No — deep link out | Subscriber + MusicKit native | No | Premium + native SDK |
| Custom highlight segment | ❌ | ❌ | ❌ | ❌ |
| Regional (incl. 🇻🇳) | ✅ `country=` | ✅ storefronts | ✅ (Deezer operates in VN) | — |
| Attribution required | ✅ store badge, proximate | ✅ "Music previews via Apple Music" | ⚠️ needs legal confirmation | — |
| Artwork use | Store-promotion context | Per Apple Music guidelines | ⚠️ needs legal confirmation | — |
| Deep link | `trackViewUrl` | `url` | `link` | — |
| Expo/native impact | **None** — plain `fetch` | None for previews; native module for subscriber playback | **None** | Native SDK |
| App Store review risk | Low if badge shown | Low | Medium — third-party catalogue | — |
| Caching audio | ❌ prohibited | ❌ prohibited | ❌ prohibited | — |
| Preview URL stability | Fairly stable, not guaranteed | Re-resolve per session | Fairly stable | — |
| Rate limit | ~20 req/min | Per developer token | Undocumented, modest | — |

## Constraint that shapes the product: no custom highlights

**None of these providers permits choosing your own chorus or highlight
segment.** You get the provider's ~30-second clip, from the provider's chosen
offset, or nothing. Extracting, trimming, caching or re-hosting audio is
prohibited by all four.

So "play a highlight" means, in strict order:

1. The provider's own preview clip, streamed from the provider's URL.
2. Otherwise, provider-authorised playback through the official SDK — out of
   scope for this phase (native module, subscriber requirement).
3. Otherwise, a clear **"Preview unavailable"** state plus "Open in Apple Music".

We do not fake step 3, and we do not describe the clip as anything other than a
preview. UI copy says "0:30 preview", never "highlight" or "the chorus".

## Decision

### Default adapter: **iTunes Search API** (`itunes`)

Chosen because it is the only option that makes a **genuinely playable vertical
slice** with nothing to provision — no key, no account, no backend, no native
module, no prebuild. `fetch` and `expo-audio`, both already present.

```
GET https://itunes.apple.com/search
      ?media=music&entity=song&limit=25
      &country=VN&term=ambient+instrumental+calm
→ results[]: trackId, trackName, artistName, collectionName,
             artworkUrl100, previewUrl, primaryGenreName,
             releaseDate, trackViewUrl, trackTimeMillis
```

**The binding condition.** Apple's terms permit these previews and artwork *to
promote store content* and require sound samples to sit **proximate to a store
badge**. Chromawave complies by construction:

- every recommendation card carries a **"Listen on Apple Music"** store link, in
  the card, adjacent to the play control — not buried in an overflow;
- the memory detail's track block carries the same link;
- artwork is only ever shown attached to that link;
- attribution text "Preview via Apple Music" is rendered by the adapter, from
  `MusicTrackReference.attribution`, so a screen cannot forget it.

This is a real constraint that shapes the UI, and it is a **legal precondition,
not a nicety**. `14` includes a check that no recommendation card renders without
its store link. Before public release, this usage must be confirmed against
Apple's then-current Services Performance Partners terms — flagged in `13`.

### Upgrade path: **Apple Music API** (`appleMusic`)

The properly licensed route for an iOS-first product. Catalog previews are
DRM-free and playable with standard audio APIs, and attribution is a documented
string rather than an inference.

Blocked on one thing only: the developer token is an **ES256 JWT signed with a
MusicKit private key (.p8), valid ≤180 days**. That key must never be in the
bundle, and a 180-day token in the bundle is a long-lived credential in a file
anyone can unzip. So this adapter requires the token endpoint described in `08`.

Subscriber full-playback is explicitly **out of scope**: it needs a native
MusicKit module (community-maintained, not first-party for Expo), a prebuild, and
a subscription check. Previews satisfy the product.

### Secondary: **Deezer** (`deezer`)

Keyless, 30-second previews, real presence in Vietnam. Useful as a fallback when
iTunes returns nothing for a market. Held behind a flag until its terms are
confirmed for in-app preview playback — the metadata is openly published, the
audio clips are not unambiguously licensed for third-party app playback.

### Not implemented: **Spotify**

Cannot supply previews to a new app. Would be reduced to metadata and a deep
link, which the chosen providers already do while also playing audio. If Spotify
restores preview access, the adapter is one file behind the existing interface.

## The provider abstraction

`packages/domain/src/music.ts` — domain-side, provider-agnostic:

```ts
export interface MusicProvider {
  readonly id: MusicProviderId;
  readonly attribution: string;
  search(queries: readonly MusicSearchQuery[], signal: AbortSignal):
    Promise<readonly MusicTrackReference[]>;
  getTrack(providerTrackId: string, signal: AbortSignal):
    Promise<MusicTrackReference | null>;
  /** Resolved at playback time. Never persisted. */
  getPreview(track: MusicTrackReference, signal: AbortSignal):
    Promise<MusicPreview | null>;
  openExternal(track: MusicTrackReference): Promise<void>;
}
```

Adapters live in `apps/mobile/src/infrastructure/music/`. Rules:

- No provider type crosses into `domain/` or `features/` — enforced by a test
  scanning for provider field names.
- Every adapter sets `attribution`; screens render it from the model.
- `getPreview` returns `null` rather than throwing when unavailable — an absent
  preview is a normal state.
- `MusicProviderId` includes `'none'`, whose adapter honestly reports pairing as
  unavailable. That is what ships if no provider is configured — never fixtures.

## Compliance rules encoded in the app

1. Audio is **streamed**, never downloaded, cached to disk, or re-hosted.
2. Preview URLs are **never persisted** in a memory (`05`), and a test enforces it.
3. Every card and every track block shows provider attribution and a store link.
4. Artwork is displayed only alongside its store link, at provider-supplied URLs
   — never copied into app storage.
5. No claim of a custom highlight, chorus detection, or full playback.
6. Search is debounced and result-cached (15 min) to stay well inside rate limits.
7. `market` comes from device locale so a Vietnamese user gets the VN storefront.
