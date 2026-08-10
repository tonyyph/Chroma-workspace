# Design system

Chroma Wave uses an editorial "quiet luxury" system: an obsidian canvas, warm bone
text, restrained champagne accents, generous negative space, and user photography
treated as artwork rather than card decoration.

Playfair Display carries display, title, and editorial italic moments. Source Serif
4 carries body, label, and caption text. Both are bundled locally and loaded before
the splash screen is dismissed; the UI does not depend on network font delivery.

## Token layers

- Primitives: fixed neutral and chromatic values.
- Semantics: canvas, surface, text, border, focus, success, warning, danger.
- Component values: spacing, radius, shadow, icon, touch target, typography.
- Dynamic palette: safe accent generation and foreground selection.

Extracted colors are allowed in palette strips, art fields, and small accents. They
are not used directly for body text. Large dynamic surfaces are clamped and always
paired with a contrast-tested foreground. Selection also uses labels, icons, and
shape rather than color alone.

The component language avoids generic bordered-card dashboards. Editorial rules,
numbered section headings, full-bleed photography, slim metric tracks, text-led
navigation, and deliberate asymmetric chromatic forms carry hierarchy. Radius is
reserved for imagery, primary actions, and tactile filters rather than applied to
every surface.

The shared component set includes `Screen`, `AppText`, `Button`, `PaletteStrip`,
`MemoryCard`, `ChromaticArtwork`, `EditorialSection`, `FavoriteButton`,
`FilterChip`, `SearchField`, and reusable state views.

## Exhibition direction

The second visual cycle moves from a sequence of similarly weighted cards to an
exhibition composition:

- one dominant editorial statement per viewport;
- artwork fields that can carry asymmetry and overlap;
- raised information trays with a restrained border and long, soft shadow;
- numbered sections and quiet rules instead of repeated containers;
- a fixed floating dock whose center Capture action breaks the frame.

Elevation has three named levels: `raised` for controls and trays, `hero` for
artwork and atmosphere panels, and `dock` for the navigation shell. Elevation is
reserved for hierarchy, never applied to every section.

The dock always presents five stable destinations: Today, Archive, Capture,
Atelier, and Settings. Capture is the central circular interruption; the other
destinations use geometric glyphs and text so the navigation remains recognizable
without depending on color.

## Curated atmospheres

The six complete semantic atmospheres are Obsidian Atelier, Porcelain Ink,
Rosewood Salon, Midnight Lapis, Forest Patina, and Aubergine Gold. Each atmosphere
redefines canvas, raised surfaces, text hierarchy, border, focus, status, and
navigation colors as one system. Dynamic colors extracted from a Memory remain
inside artwork, palette rails, and small accents, so a photograph cannot reduce
body-copy contrast.
