import { describe, expect, it } from 'vitest';

import { storyElementSchema } from './elements';
import { migrateRecord, readStoredProjects } from './migration';
import { createStoryProject, STORY_SCHEMA_VERSION, type StoryAsset } from './project';

const ID = (n: number): string => `${n}1111111-1111-4111-8111-111111111111`;
const NOW = '2026-08-17T09:00:00.000Z';

const asset: StoryAsset = {
  id: 'a',
  uri: 'file:///story-assets/a.jpg',
  width: 3000,
  height: 4000,
  previewUri: null,
  createdAt: NOW,
};

const project = (n: number): unknown => ({
  ...createStoryProject({ id: ID(n), format: 'portrait', slideCount: 3, now: NOW }),
  assets: [asset],
  layers: [
    storyElementSchema.parse({
      kind: 'photo',
      id: 'p',
      frame: { x: 0, y: 0, width: 400, height: 400 },
      rotation: 0,
      opacity: 1,
      locked: false,
      hidden: false,
      assetId: 'a',
      sourceWidth: 3000,
      sourceHeight: 4000,
      crop: { x: 0, y: 0, width: 1, height: 1 },
    }),
  ],
});

describe('migrateRecord', () => {
  it('passes a current record through untouched', () => {
    const record = project(1);
    expect(migrateRecord(record)).toBe(record);
  });

  it('is idempotent', () => {
    const record = project(1);
    expect(migrateRecord(migrateRecord(record))).toBe(record);
  });

  it('refuses a record from a newer build rather than guessing at its shape', () => {
    expect(migrateRecord({ schemaVersion: STORY_SCHEMA_VERSION + 1, id: ID(1) })).toBeNull();
  });

  it('refuses anything without a readable version', () => {
    expect(migrateRecord({ id: ID(1) })).toBeNull();
    expect(migrateRecord({ schemaVersion: 'one' })).toBeNull();
    expect(migrateRecord(null)).toBeNull();
    expect(migrateRecord('a string')).toBeNull();
  });
});

describe('readStoredProjects', () => {
  it('reads a collection of valid projects', () => {
    const result = readStoredProjects([project(1), project(2)]);
    expect(result.projects).toHaveLength(2);
    expect(result.problems).toEqual([]);
  });

  it('treats an unwritten key as no projects, not as an error', () => {
    expect(readStoredProjects(null)).toEqual({ projects: [], problems: [] });
    expect(readStoredProjects(undefined)).toEqual({ projects: [], problems: [] });
  });

  it('reports a non-array without throwing', () => {
    const result = readStoredProjects({ not: 'an array' });
    expect(result.projects).toEqual([]);
    expect(result.problems).toHaveLength(1);
  });

  it('keeps the good records when one is corrupt — the whole point of this module', () => {
    const corrupt = { ...(project(2) as object), canvas: { width: 1, height: 1 } };
    const result = readStoredProjects([project(1), corrupt, project(3)]);

    expect(result.projects.map((entry) => entry.id)).toEqual([ID(1), ID(3)]);
    expect(result.problems).toHaveLength(1);
    expect(result.problems[0]?.index).toBe(1);
    expect(result.problems[0]?.id).toBe(ID(2));
  });

  it('survives a collection in which every record is corrupt', () => {
    const result = readStoredProjects([{ schemaVersion: 1 }, 'nonsense', 42, null]);
    expect(result.projects).toEqual([]);
    expect(result.problems).toHaveLength(4);
  });

  it('keeps the raw record so a quarantined project can be inspected or recovered', () => {
    const corrupt = { schemaVersion: 1, id: ID(9), unexpected: 'field' };
    const result = readStoredProjects([corrupt]);
    expect(result.problems[0]?.raw).toBe(corrupt);
  });

  it('summarises why a record failed, rather than reporting a bare failure', () => {
    const corrupt = { ...(project(2) as object), slideCount: 99 };
    const result = readStoredProjects([corrupt]);
    expect(result.problems[0]?.issues.length).toBeGreaterThan(0);
  });

  it('quarantines a record from a newer build instead of dropping it silently', () => {
    const future = { ...(project(1) as object), schemaVersion: 99 };
    const result = readStoredProjects([future]);
    expect(result.projects).toEqual([]);
    expect(result.problems[0]?.issues).toContain('99');
  });

  it('reports the index of each problem, so a repair can find it in storage', () => {
    const result = readStoredProjects([project(1), 'bad', project(2), 'worse']);
    expect(result.problems.map((problem) => problem.index)).toEqual([1, 3]);
  });
});
