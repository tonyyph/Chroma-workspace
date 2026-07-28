# Pairing engine

The first explainable pipeline:

1. Normalize image and extract OKLab clusters.
2. Derive lightness, chroma, temperature, and contrast.
3. Classify a palette mood with pure, tested rules.
4. Map mood to target valence, energy, acousticness, and tempo bands.
5. Ask a provider for candidates.
6. Rank by feature distance and deterministic diversity.
7. Return a one-sentence explanation.

No large language model is required. User preference, listening history, and time
signals will be added as explicit weighted inputs, never hidden screen logic.
