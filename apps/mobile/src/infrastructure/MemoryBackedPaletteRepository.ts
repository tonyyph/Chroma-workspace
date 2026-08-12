import {
  chromaticMemorySchema,
  deriveFacets,
  memoryToPalette,
  paletteToMemory,
  type ChromaticMemory,
  type ChromaticMemoryRepository,
  type Palette,
  type PaletteRepository,
} from '@cw/domain';

/**
 * The v1 `Palette` interface, served from v2 memories.
 *
 * `mergePalettes`, `paletteGaps`, `discovery`'s search, `libraryStore` and all
 * ten `tools/*` screens are written against `PaletteRepository`. They are
 * correct, tested, and have nothing to do with music — rewriting them against
 * the new aggregate would be a large change to code that works, purely to
 * satisfy a naming preference.
 *
 * So the aggregate moved and the interface did not. A palette is a *view* of a
 * memory, and this is where the two meet.
 *
 * **Writes patch rather than replace.** A tune performed in a colour tool must
 * change the colours and leave the photograph, the music and the note alone,
 * which a naive `paletteToMemory(palette)` round trip would silently discard.
 */
export class MemoryBackedPaletteRepository implements PaletteRepository {
  constructor(private readonly memories: ChromaticMemoryRepository) {}

  async list(): Promise<readonly Palette[]> {
    return (await this.memories.list()).map(memoryToPalette);
  }

  async get(id: string): Promise<Palette | null> {
    const memory = await this.memories.get(id);
    return memory === null ? null : memoryToPalette(memory);
  }

  async save(palette: Palette): Promise<void> {
    const existing = await this.memories.get(palette.id);

    // A palette the memory store has never seen is a new capture arriving
    // through the old path. Widening it is exactly what the migration does.
    if (existing === null) {
      await this.memories.save(paletteToMemory(palette));
      return;
    }

    await this.memories.save(patch(existing, palette));
  }

  async remove(id: string): Promise<void> {
    await this.memories.remove(id);
  }
}

/**
 * Folds a v1 palette back onto the memory it came from.
 *
 * Everything the `Palette` shape can express is taken from the palette;
 * everything it cannot — image, atmosphere, music, note, visual analysis — is
 * kept from the memory. Facets are re-derived because the colours may have
 * moved, and a stale facet is a filter that quietly lies.
 */
function patch(memory: ChromaticMemory, palette: Palette): ChromaticMemory {
  const widened = paletteToMemory(palette);

  const next: ChromaticMemory = {
    ...memory,
    updatedAt: new Date().toISOString(),
    capturedAt: palette.capturedAt,
    palette: widened.palette,
    // Re-read from the new colours: a retune changes what the moment feels like.
    atmosphere: widened.atmosphere,
    personalContext: {
      ...memory.personalContext,
      title: palette.name,
      tags: palette.tags,
      location: palette.location === null ? null : { name: palette.location },
    },
    collectionIds: palette.setIds,
    isPinned: palette.isPinned,
    facets: deriveFacets({
      colors: widened.palette.colors,
      atmosphere: widened.atmosphere,
      pairing: memory.musicPairing,
      capturedAt: palette.capturedAt,
    }),
  };

  // The photograph only moves if the palette actually carries a different one.
  // A v1 palette whose `photoUri` is null usually means "this view does not
  // model an image", not "delete the image".
  if (palette.photoUri !== null && palette.photoUri !== memory.image.localUri) {
    next.image = { ...memory.image, localUri: palette.photoUri };
  }

  // Validated here rather than trusted: this is the one place two schemas meet,
  // and a patch that produces something invalid should fail at the write, not
  // at the next read.
  return chromaticMemorySchema.parse(next);
}
