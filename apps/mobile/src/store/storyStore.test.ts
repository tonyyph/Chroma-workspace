import {
  addAsset,
  addElement,
  setTitle,
  storyElementSchema,
  type StoryAsset,
  type StoryElement,
  type StoryProject,
} from '@cw/domain';
import { selectCanRedo, selectCanUndo, selectProject, useStoryStore } from './storyStore';

const mockSave = jest.fn<Promise<void>, [StoryProject]>();
const mockGet = jest.fn<Promise<StoryProject | null>, [string]>();

jest.mock('@/infrastructure/dependencies', () => ({
  storyRepository: {
    save: (project: StoryProject) => mockSave(project),
    get: (id: string) => mockGet(id),
  },
}));

const ID = '11111111-1111-4111-8111-111111111111';
const NOW = '2026-08-17T09:00:00.000Z';

const asset: StoryAsset = {
  id: 'a',
  uri: 'file:///story-assets/a.jpg',
  width: 3000,
  height: 4000,
  previewUri: null,
  createdAt: NOW,
};

const photo = (id: string): StoryElement =>
  storyElementSchema.parse({
    kind: 'photo',
    id,
    frame: { x: 0, y: 0, width: 400, height: 400 },
    rotation: 0,
    opacity: 1,
    locked: false,
    hidden: false,
    assetId: 'a',
    sourceWidth: 3000,
    sourceHeight: 4000,
    crop: { x: 0, y: 0, width: 1, height: 1 },
  });

const create = () =>
  useStoryStore.getState().create({ id: ID, format: 'portrait', slideCount: 3, now: NOW });

beforeEach(() => {
  jest.useFakeTimers();
  mockSave.mockReset().mockResolvedValue(undefined);
  mockGet.mockReset().mockResolvedValue(null);
  useStoryStore.getState().close();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('creating a story', () => {
  it('writes immediately rather than waiting for autosave', async () => {
    await create();

    // A project that exists only in memory is one a crash erases without trace,
    // and one the drafts list cannot show.
    expect(mockSave).toHaveBeenCalledTimes(1);
    expect(useStoryStore.getState().saveState).toBe('saved');
    expect(selectProject(useStoryStore.getState())?.id).toBe(ID);
  });

  it('starts with nothing to undo', async () => {
    await create();
    expect(selectCanUndo(useStoryStore.getState())).toBe(false);
    expect(selectCanRedo(useStoryStore.getState())).toBe(false);
  });
});

describe('autosave', () => {
  it('does not write on every edit, only after the user stops', async () => {
    await create();
    mockSave.mockClear();

    const { apply } = useStoryStore.getState();
    apply((project) => addAsset(project, asset, NOW));
    apply((project) => addElement(project, photo('p1'), NOW));
    apply((project) => addElement(project, photo('p2'), NOW));

    expect(mockSave).not.toHaveBeenCalled();
    expect(useStoryStore.getState().saveState).toBe('dirty');

    await jest.advanceTimersByTimeAsync(1000);

    expect(mockSave).toHaveBeenCalledTimes(1);
    expect(useStoryStore.getState().saveState).toBe('saved');
  });

  it('saves the newest document, not the one that scheduled the write', async () => {
    await create();
    mockSave.mockClear();

    const { apply } = useStoryStore.getState();
    apply((project) => setTitle(project, 'First', NOW));
    await jest.advanceTimersByTimeAsync(400);
    apply((project) => setTitle(project, 'Second', NOW));
    await jest.advanceTimersByTimeAsync(1000);

    expect(mockSave).toHaveBeenCalledTimes(1);
    expect(mockSave.mock.calls[0]?.[0].title).toBe('Second');
  });

  it('reports a failed write instead of claiming the work is safe', async () => {
    await create();
    mockSave.mockClear().mockRejectedValue(new Error('disk full'));

    useStoryStore.getState().apply((project) => setTitle(project, 'Blue Hour', NOW));
    await jest.advanceTimersByTimeAsync(1000);

    expect(useStoryStore.getState().saveState).toBe('failed');
  });

  it('stays dirty when an edit lands while the write is in flight', async () => {
    await create();

    // Captured through an object so TypeScript does not narrow the binding to
    // `never` on the assignment inside the executor.
    const gate: { release: (() => void) | undefined } = { release: undefined };
    mockSave.mockClear().mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          gate.release = resolve;
        }),
    );

    useStoryStore.getState().apply((project) => setTitle(project, 'First', NOW));
    await jest.advanceTimersByTimeAsync(1000);
    expect(useStoryStore.getState().saveState).toBe('saving');

    // An edit arrives before the write resolves.
    useStoryStore.getState().apply((project) => setTitle(project, 'Second', NOW));
    gate.release?.();
    await jest.advanceTimersByTimeAsync(0);

    // The badge must not say "saved" over work that is not on disk.
    expect(useStoryStore.getState().saveState).not.toBe('saved');
  });

  it('flush writes at once and cancels the pending autosave', async () => {
    await create();
    mockSave.mockClear();

    useStoryStore.getState().apply((project) => setTitle(project, 'Blue Hour', NOW));
    await useStoryStore.getState().flush();

    expect(mockSave).toHaveBeenCalledTimes(1);

    // The cancelled timer must not fire a second write afterwards.
    await jest.advanceTimersByTimeAsync(2000);
    expect(mockSave).toHaveBeenCalledTimes(1);
  });

  it('does not write when an operation was refused', async () => {
    await create();
    mockSave.mockClear();

    // `addElement` with a duplicate id returns the same project.
    useStoryStore.getState().apply((project) => addAsset(project, asset, NOW));
    await jest.advanceTimersByTimeAsync(1000);
    mockSave.mockClear();

    useStoryStore.getState().apply((project) => addAsset(project, asset, NOW));
    await jest.advanceTimersByTimeAsync(1000);

    expect(mockSave).not.toHaveBeenCalled();
    expect(useStoryStore.getState().saveState).toBe('saved');
  });
});

describe('undo and redo through the store', () => {
  it('walks back and forward across edits', async () => {
    await create();
    const { apply } = useStoryStore.getState();
    apply((project) => addAsset(project, asset, NOW));
    apply((project) => addElement(project, photo('p1'), NOW));

    expect(selectProject(useStoryStore.getState())?.layers).toHaveLength(1);

    useStoryStore.getState().undo();
    expect(selectProject(useStoryStore.getState())?.layers).toHaveLength(0);

    useStoryStore.getState().redo();
    expect(selectProject(useStoryStore.getState())?.layers).toHaveLength(1);
  });

  it('persists the undone state, because undo is an edit like any other', async () => {
    await create();
    useStoryStore.getState().apply((project) => setTitle(project, 'Blue Hour', NOW));
    await jest.advanceTimersByTimeAsync(1000);
    mockSave.mockClear();

    useStoryStore.getState().undo();
    await jest.advanceTimersByTimeAsync(1000);

    expect(mockSave).toHaveBeenCalledTimes(1);
    expect(mockSave.mock.calls[0]?.[0].title).toBeNull();
  });

  it('does nothing at either end', async () => {
    await create();
    useStoryStore.getState().undo();
    useStoryStore.getState().redo();
    expect(selectProject(useStoryStore.getState())?.id).toBe(ID);
  });

  it('coalesces a run of same-key edits into one step', async () => {
    await create();
    for (let n = 0; n < 20; n += 1) {
      useStoryStore
        .getState()
        .apply((project) => setTitle(project, `Title ${n}`, NOW), { coalesceKey: 'title' });
    }
    expect(selectProject(useStoryStore.getState())?.title).toBe('Title 19');

    useStoryStore.getState().undo();
    expect(selectProject(useStoryStore.getState())?.title).toBeNull();
  });
});

describe('loading and recovery', () => {
  it('recovers a draft written by a previous session', async () => {
    const stored = { ...(await create()), title: 'Recovered' };
    useStoryStore.getState().close();
    mockGet.mockResolvedValue(stored);

    await useStoryStore.getState().load(ID);

    expect(useStoryStore.getState().loadState).toBe('ready');
    expect(selectProject(useStoryStore.getState())?.title).toBe('Recovered');
    expect(useStoryStore.getState().saveState).toBe('saved');
  });

  it('does not restore an undo stack across a restart', async () => {
    const stored = await create();
    useStoryStore.getState().close();
    mockGet.mockResolvedValue(stored);

    await useStoryStore.getState().load(ID);

    // Undoing into a state from a session the user no longer remembers is worse
    // than having nothing to undo.
    expect(selectCanUndo(useStoryStore.getState())).toBe(false);
    expect(selectCanRedo(useStoryStore.getState())).toBe(false);
  });

  it('reports a story that is not there rather than showing an empty editor', async () => {
    mockGet.mockResolvedValue(null);
    await useStoryStore.getState().load(ID);

    expect(useStoryStore.getState().loadState).toBe('missing');
    expect(selectProject(useStoryStore.getState())).toBeNull();
  });

  it('reports a failed read without throwing into the screen', async () => {
    mockGet.mockRejectedValue(new Error('storage gone'));
    await useStoryStore.getState().load(ID);

    expect(useStoryStore.getState().loadState).toBe('failed');
    expect(useStoryStore.getState().problem).toBe('story.error.load');
  });

  it('cancels a pending autosave when a different story is opened', async () => {
    await create();
    mockSave.mockClear();
    useStoryStore.getState().apply((project) => setTitle(project, 'Unsaved', NOW));

    mockGet.mockResolvedValue(null);
    await useStoryStore.getState().load('other');
    await jest.advanceTimersByTimeAsync(2000);

    // The pending write belonged to a story that is no longer open; firing it
    // would resurrect it over whatever is loaded now.
    expect(mockSave).not.toHaveBeenCalled();
  });

  it('ignores edits when no story is open', () => {
    useStoryStore.getState().apply((project) => setTitle(project, 'Nothing', NOW));
    expect(selectProject(useStoryStore.getState())).toBeNull();
  });
});
