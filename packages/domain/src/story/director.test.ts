import { describe, expect, it } from 'vitest';

import { readAtmosphere } from '../atmosphere';
import { deriveFacets, emptyPersonalContext, type ChromaticMemory } from '../memory';
import { unpairedPairing } from '../music';
import { makeColor } from '../palette';
import { compose, focalMemory, prevailingMood } from './director';
import { acceptStoryPatch } from './patch';

const uuid = (n: number) => `${n}1111111-1111-4111-8111-111111111111`;

const memory = (input: {
  n: number;
  hex: string;
  day: number;
  title?: string | null;
}): ChromaticMemory => {
  const colors = [makeColor(input.hex, 0.65, 'dominant'), makeColor('#101010', 0.35, 'support')];
  const atmosphere = readAtmosphere(colors, 2.4);
  const capturedAt = `2026-08-${String(input.day).padStart(2, '0')}T09:00:00.000Z`;

  return {
    schemaVersion: 2,
    id: uuid(input.n),
    createdAt: capturedAt,
    updatedAt: capturedAt,
    capturedAt,
    image: {
      localUri: 'file:///a.jpg',
      width: 4032,
      height: 3024,
      source: 'photo-library',
      thumbnailUri: null,
      grade: null,
    },
    palette: { colors, deltaE: 2.4, confidence: 0.9, space: 'srgb', tuned: false, source: 'photo' },
    atmosphere,
    visualAnalysis: null,
    musicPairing: unpairedPairing,
    personalContext: { ...emptyPersonalContext, title: input.title ?? null },
    facets: deriveFacets({ colors, atmosphere, pairing: unpairedPairing, capturedAt }),
    collectionIds: [],
    isPinned: false,
  } as ChromaticMemory;
};

const three = [
  memory({ n: 1, hex: '#7C5CFF', day: 1 }),
  memory({ n: 2, hex: '#22D3EE', day: 2 }),
  memory({ n: 3, hex: '#E8320C', day: 3, title: 'Blue hour' }),
];

const composeThree = (order: 'chronological' | 'building' | 'colour-flow' = 'chronological') =>
  compose({ memories: three, order, intensity: 'flow', slideElementIds: ['a', 'b', 'c'] });

describe('the composer produces a valid patch', () => {
  it('returns something the validator accepts', () => {
    // Local and remote proposals go through one validator, so the composer's own
    // output has to survive it too.
    expect(acceptStoryPatch(composeThree().patch)).not.toBeNull();
  });

  it('is deterministic', () => {
    expect(composeThree()).toEqual(composeThree());
  });

  it('handles no memories without failing', () => {
    const proposal = compose({
      memories: [],
      order: 'chronological',
      intensity: 'calm',
      slideElementIds: [],
    });
    expect(acceptStoryPatch(proposal.patch)).not.toBeNull();
    expect(proposal.patch.theme).toBeNull();
  });
});

describe('it explains itself in structured terms', () => {
  it('names the ordering it used', () => {
    expect(composeThree('building').reasons.map((reason) => reason.kind)).toContain(
      'ordered-by-energy',
    );
    expect(composeThree('colour-flow').reasons.map((reason) => reason.kind)).toContain(
      'ordered-by-colour',
    );
    expect(composeThree('chronological').reasons.map((reason) => reason.kind)).toContain(
      'ordered-by-time',
    );
  });

  it('names the memory it chose to lead on', () => {
    const focal = composeThree().reasons.find((reason) => reason.kind === 'focal-chosen');
    expect(focal?.subjectId).toBe(focalMemory(three)?.id);
  });

  it('says when motion came from mood', () => {
    expect(composeThree().reasons.map((reason) => reason.kind)).toContain('motion-from-mood');
  });
});

describe('it does not write captions', () => {
  it('takes a title only from a memory the author already named', () => {
    // Titled so that whichever memory wins emphasis, the focal one has words of
    // its own. Asserting a literal here would pin the test to the emphasis
    // maths rather than to the rule being tested.
    const titled = three.map((entry, index) => ({
      ...entry,
      personalContext: { ...entry.personalContext, title: `Memory ${index}` },
    }));
    const proposal = compose({
      memories: titled,
      order: 'chronological',
      intensity: 'flow',
      slideElementIds: ['a', 'b', 'c'],
    });

    // The focal memory's own words, never a sentence this app composed about
    // someone's photograph.
    expect(proposal.patch.theme).toBe(focalMemory(titled)?.personalContext.title);
    expect(proposal.reasons.map((reason) => reason.kind)).toContain('title-from-memory');
  });

  it('proposes no title when nobody wrote one', () => {
    const untitled = [memory({ n: 4, hex: '#7C5CFF', day: 4 })];
    const proposal = compose({
      memories: untitled,
      order: 'chronological',
      intensity: 'flow',
      slideElementIds: ['a'],
    });

    expect(proposal.patch.theme).toBeNull();
    expect(proposal.reasons.map((reason) => reason.kind)).not.toContain('title-from-memory');
  });

  it('never proposes text content of its own', () => {
    // There is deliberately no field for it: a caption is not something this
    // patch can carry.
    expect(Object.keys(composeThree().patch)).not.toContain('captions');
  });
});

describe('prevailing mood', () => {
  it('reports the mood most memories share', () => {
    const mood = prevailingMood(three);
    expect(mood).not.toBeNull();
    expect(three.some((entry) => entry.facets.mood === mood)).toBe(true);
  });

  it('reports nothing for no memories', () => {
    expect(prevailingMood([])).toBeNull();
  });

  it('is stable rather than depending on iteration luck', () => {
    const shuffled = [three[2]!, three[0]!, three[1]!];
    expect(prevailingMood(three)).toBe(prevailingMood(shuffled));
  });
});

describe('focal memory', () => {
  it('picks one when there are memories', () => {
    expect(focalMemory(three)).not.toBeNull();
  });

  it('returns null for none', () => {
    expect(focalMemory([])).toBeNull();
  });

  it('is deterministic', () => {
    expect(focalMemory(three)?.id).toBe(focalMemory([...three].reverse())?.id);
  });
});

describe('the proposal does not reorder what was already ordered', () => {
  it('leaves slideOrder null', () => {
    // Composing from memories already applied the order; re-proposing it would
    // let a second pass silently disagree with the first.
    expect(composeThree('building').patch.slideOrder).toBeNull();
  });
});
