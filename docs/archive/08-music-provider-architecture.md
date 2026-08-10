# Music provider architecture

The domain-facing `MusicProvider` accepts a `RecommendationInput` and returns
provider-neutral `MusicTrack` records plus concise explanations.

Cycle one ships `MockMusicProvider`, whose deterministic catalogue exercises empty
preview URLs and multiple mood results. It is a development provider, not a fake
Spotify integration.

A future Spotify adapter will live in mobile/server infrastructure, map every
response, refresh authorization outside screen components, tolerate missing
preview URLs, and keep secret-dependent playlist creation in a server function.
Apple Music and generated soundscapes can implement the same boundary.
