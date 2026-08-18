import {
  describeElement,
  duplicateElement as duplicateElementIn,
  elementAt,
  findLayer,
  formatOf,
  planSlicesFor,
  removeElement,
  setElementFrame,
  applyStoryPatch,
  compose,
  toRecipe,
  type StoryTemplate,
  livingPaletteConfig,
  livingPalettePresets,
  mapElement,
  setElementHidden,
  setElementLocked,
  reorderElement,
  snapDraggedFrame,
  type Rect,
  type CompositionProposal,
  type SnapGuide,
  type StoryProject,
} from '@cw/domain';
import { space, type Skin } from '@cw/tokens';
import * as Crypto from 'expo-crypto';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { AccessibilityInfo, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle } from 'react-native-reanimated';
import { analytics, hapticsService, recipeRepository } from '@/infrastructure/dependencies';
import { usePreferences, useSkin } from '@/providers';
import { reconcileSelection, useStoryEditorStore } from '@/store/storyEditorStore';
import { selectCanRedo, selectCanUndo, selectProject, useStoryStore } from '@/store/storyStore';
import { Button, Chip, InlineError, NavBar, Screen, Text, useStyles } from '@/ui';
import { StoryCanvas, StoryOverview } from './canvas/StoryCanvas';
import { useElementGesture } from './canvas/useElementGesture';
import { useStoryImages } from './canvas/useStoryImages';
import { addPaletteStrip, addTextElement } from './editorActions';
import { LayerPanel } from './LayerPanel';
import { usePalettePhase } from './canvas/usePalettePhase';
import { applyTemplate } from './applyTemplate';
import { ComposePanel } from './ComposePanel';
import { TemplatePicker } from './TemplatePicker';
import { useMemories } from '@/hooks/useMemories';

/**
 * The editor.
 *
 * **Layout, and why it is this shape.** A compact bar at the top, the largest
 * possible canvas in the middle, a filmstrip and a contextual dock at the
 * bottom. Nothing floats over the canvas: Swiss has no glass, no depth and no
 * radii, so a translucent inspector panel is not expressible in it at all — and
 * designing Swiss-first happens to produce the uncluttered editor the brief
 * asks for rather than the glassy one a canvas app reaches for by default.
 *
 * **What re-renders, and what does not.** Selecting, adding and deleting go
 * through React. Dragging does not: it runs on shared values through
 * `useElementGesture` and reaches the document once, on release. So the Skia
 * picture is re-recorded per *edit*, not per frame.
 */
export function StoryEditorScreen({
  storyId,
  onPreview,
  onClose,
}: {
  storyId: string;
  onPreview: () => void;
  onClose: () => void;
}) {
  const styles = useStyles(makeStyles);
  const router = useRouter();
  const skin = useSkin();
  const { t } = usePreferences();
  const { width } = useWindowDimensions();

  const project = useStoryStore(selectProject);
  const loadState = useStoryStore((state) => state.loadState);
  const saveState = useStoryStore((state) => state.saveState);
  const canUndo = useStoryStore(selectCanUndo);
  const canRedo = useStoryStore(selectCanRedo);

  const selectedId = useStoryEditorStore((state) => state.selectedId);
  const activeSlide = useStoryEditorStore((state) => state.activeSlide);
  const overview = useStoryEditorStore((state) => state.overview);

  const { images } = useStoryImages(project);
  const [missing, setMissing] = useState<readonly string[]>([]);

  useEffect(() => {
    void useStoryStore.getState().load(storyId);
    analytics.track('studio_opened', { source: 'library' });
    return () => {
      void useStoryStore.getState().flush();
      useStoryEditorStore.getState().reset();
    };
  }, [storyId]);

  useEffect(() => {
    if (project !== null) reconcileSelection(project.layers.map((layer) => layer.id));
  }, [project]);

  const canvasWidth = width - space.gutter * 2;
  const selected = project === null || selectedId === null ? null : findLayer(project, selectedId);

  const plans = useMemo(() => (project === null ? [] : planSlicesFor(project)), [project]);
  const unitsPerPoint = plans[0] === undefined ? 1 : plans[0].width / canvasWidth;

  const commitFrame = useCallback(
    (frame: { x: number; y: number; width: number; height: number }) => {
      if (selectedId === null) return;
      useStoryStore
        .getState()
        .apply((current) => setElementFrame(current, selectedId, frame, new Date().toISOString()));
    },
    [selectedId],
  );

  const announceStart = useCallback(() => {
    void hapticsService.selection();
  }, []);

  const [guides, setGuides] = useState<readonly SnapGuide[]>([]);
  const [showLayers, setShowLayers] = useState(false);

  /**
   * The clock for animated palettes.
   *
   * Driven by the *selected* strip's config so a preview costs one re-record
   * loop rather than one per animated element. A story with several breathing
   * palettes previews the one being worked on, which is the one the author is
   * looking at.
   */
  const animatedConfig =
    selected !== null && selected.kind === 'paletteStrip' ? selected.animation : null;
  const { phase, reduceMotion } = usePalettePhase(animatedConfig);

  /**
   * Aligns a released frame, and records what it aligned to.
   *
   * Runs on the JS thread, once per gesture, because it reads the document. The
   * guides it returns are drawn until the next gesture — long enough to explain
   * what just happened, and gone before they become decoration.
   */
  const snap = useCallback(
    (frame: Rect): Rect => {
      const current = useStoryStore.getState().history?.present;
      if (current === null || current === undefined || selectedId === null) return frame;

      const result = snapDraggedFrame({
        frame,
        movingId: selectedId,
        layers: current.layers,
        format: formatOf(current.format),
        slideIndex: activeSlide,
        slideCount: current.slideCount,
      });

      setGuides(result.guides);
      return result.frame;
    },
    [activeSlide, selectedId],
  );

  const { gesture: dragGesture, values } = useElementGesture({
    frame: selected?.frame ?? null,
    locked: selected?.locked ?? false,
    unitsPerPoint,
    onCommit: commitFrame,
    onStart: announceStart,
    snap,
  });

  /**
   * Selecting by tapping the canvas.
   *
   * The scene is one recorded Skia picture, so there are no per-element React
   * views to receive a press — hit-testing is the app's job. The tap point is in
   * screen points relative to the canvas; `unitsPerPoint` converts it, and the
   * active slide's origin puts it back into logical canvas coordinates, which is
   * the space every element's frame lives in.
   *
   * A tap on empty space deselects. That has to be reachable: without it, once
   * something is selected every drag moves it, including drags meant for the
   * canvas.
   */
  const selectAt = useCallback(
    (screenX: number, screenY: number) => {
      const current = useStoryStore.getState().history?.present;
      if (current === undefined) return;

      const slide = planSlicesFor(current)[activeSlide];
      if (slide === undefined) return;

      const hit = elementAt(current.layers, {
        x: slide.bounds.x + screenX * unitsPerPoint,
        y: screenY * unitsPerPoint,
      });

      // A new selection makes the previous drag's guides meaningless.
      setGuides([]);
      useStoryEditorStore.getState().select(hit?.id ?? null);
      AccessibilityInfo.announceForAccessibility(
        hit === null
          ? t('story.a11y.deselected')
          : t('story.a11y.selected', { name: describeElement(hit) }),
      );
      void hapticsService.selection();
    },
    [activeSlide, t, unitsPerPoint],
  );

  const tapGesture = useMemo(
    () =>
      Gesture.Tap().onEnd((event) => {
        'worklet';
        runOnJS(selectAt)(event.x, event.y);
      }),
    [selectAt],
  );

  // The tap runs alongside the drag rather than racing it: a drag that never
  // moved is a tap, and `Gesture.Exclusive` would swallow one of the two.
  const gesture = useMemo(
    () => Gesture.Simultaneous(tapGesture, dragGesture),
    [tapGesture, dragGesture],
  );

  const dragStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: values.translateX.value / unitsPerPoint },
      { translateY: values.translateY.value / unitsPerPoint },
      { scale: values.scale.value },
    ],
  }));

  const act = useCallback((change: (project: StoryProject) => StoryProject) => {
    useStoryStore.getState().apply(change);
  }, []);

  /**
   * Adds an element and reports it.
   *
   * The tracking lives here rather than at each chip so `element_added` cannot
   * become a defined-but-unfired event — which is the same defect as a control
   * with no action, one dashboard column removed.
   */
  const add = useCallback(
    (kind: 'text' | 'paletteStrip', change: (project: StoryProject) => StoryProject) => {
      act(change);
      analytics.track('element_added', { kind });
    },
    [act],
  );

  const { memories } = useMemories();
  const [proposal, setProposal] = useState<CompositionProposal | null>(null);
  const [recipeSaved, setRecipeSaved] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [templateKept, setTemplateKept] = useState<number | null>(null);
  const [rejectedCount, setRejectedCount] = useState(0);

  /**
   * Asks the local composer for a proposal.
   *
   * Reads only the memories this story was built from — a composer that reached
   * into the whole library would be suggesting things about photographs the
   * author did not put in this story.
   */
  const suggest = useCallback(() => {
    const current = useStoryStore.getState().history?.present;
    if (current === undefined || current === null) return;

    const sources = memories.filter((memory) => current.sourceMemoryIds.includes(memory.id));
    setProposal(
      compose({
        memories: sources,
        order: 'chronological',
        intensity: 'flow',
        slideElementIds: current.layers.map((layer) => layer.id),
      }),
    );
    setRejectedCount(0);
  }, [memories]);

  /**
   * Applies the proposal through the validator, not directly.
   *
   * The local composer's output goes through exactly the same `applyStoryPatch`
   * a provider's would — one validator, one accept path, no privileged
   * shortcut for the app's own suggestion.
   */
  const applyProposal = useCallback(() => {
    if (proposal === null) return;
    let refused = 0;

    act((current) => {
      const result = applyStoryPatch(current, proposal.patch, skin.ui.bg.base);
      refused = result.rejected.length;
      return result.project;
    });

    setRejectedCount(refused);
    setProposal(null);
  }, [act, proposal, skin.ui.bg.base]);

  /**
   * Saves the arrangement as a remix recipe, on this device.
   *
   * `toRecipe` strips every asset, every word and every source memory — the
   * recipe has nowhere to put them. Nothing is published: there is no backend
   * and no account (decision D5), so this is a shelf on the phone.
   */
  const saveRecipe = useCallback(() => {
    const current = useStoryStore.getState().history?.present;
    if (current === undefined || current === null) return;

    void recipeRepository
      .save(toRecipe(current, { recipeId: Crypto.randomUUID(), now: new Date().toISOString() }))
      .then(() => setRecipeSaved(true))
      .catch(() => setRecipeSaved(false));
  }, []);

  /**
   * Applies a layout, keeping everything the author made.
   *
   * Through `apply` like any other edit, so it is one undoable step — which is
   * what makes trying a template cheap enough to actually try.
   */
  const useTemplate = useCallback(
    (template: StoryTemplate) => {
      let kept = 0;
      act((current) => {
        const result = applyTemplate(current, template, {
          groundHex: skin.ui.bg.base,
          now: new Date().toISOString(),
          nextId: () => Crypto.randomUUID(),
        });
        kept = result.unplaced;
        return result.project;
      });

      setTemplateKept(kept);
      setShowTemplates(false);
      analytics.track('template_applied', {
        family: template.family,
        free: template.free,
        slideCount: project?.slideCount ?? 0,
      });
    },
    [act, project?.slideCount, skin.ui.bg.base],
  );

  const undo = useCallback(() => {
    useStoryStore.getState().undo();
    AccessibilityInfo.announceForAccessibility(t('story.a11y.undone'));
  }, [t]);

  const redo = useCallback(() => {
    useStoryStore.getState().redo();
    AccessibilityInfo.announceForAccessibility(t('story.a11y.redone'));
  }, [t]);

  if (loadState === 'loading' || loadState === 'idle') {
    return (
      <Screen>
        <NavBar onLeading={onClose} title={t('story.editor.title')} />
        <View style={styles.body}>
          <Text variant="body">{t('story.save.saving')}</Text>
        </View>
      </Screen>
    );
  }

  if (project === null) {
    return (
      <Screen>
        <NavBar onLeading={onClose} title={t('story.editor.title')} />
        <View style={styles.body}>
          <InlineError
            detail={t(loadState === 'missing' ? 'story.error.missing' : 'story.error.load')}
            title={t('story.editor.title')}
          />
        </View>
      </Screen>
    );
  }

  const now = () => new Date().toISOString();

  return (
    <Screen>
      <NavBar
        onLeading={onClose}
        onTrailing={onPreview}
        title={t('story.editor.title')}
        trailing={t('story.editor.preview')}
      />

      <View style={styles.statusRow}>
        <Text tone="secondary" variant="meta">
          {t(`story.save.${saveState}`)}
        </Text>
        <Text tone="secondary" variant="meta">
          {t('story.editor.slide', { index: activeSlide + 1, count: project.slideCount })}
        </Text>
      </View>

      <View
        accessibilityLabel={t('story.a11y.canvas', {
          index: activeSlide + 1,
          count: project.slideCount,
        })}
        style={styles.canvasWrap}
      >
        {overview ? (
          <StoryOverview
            background={skin.ui.bg.base}
            images={images}
            project={project}
            width={canvasWidth}
          />
        ) : (
          <GestureDetector gesture={gesture}>
            <Animated.View style={dragStyle}>
              <StoryCanvas
                background={skin.ui.bg.base}
                guideColor={skin.ui.action.primary}
                guides={guides}
                images={images}
                onReport={(report) => setMissing(report.missingAssets)}
                phase={phase}
                project={project}
                reduceMotion={reduceMotion}
                selectedId={selectedId}
                slideIndex={activeSlide}
                width={canvasWidth}
              />
            </Animated.View>
          </GestureDetector>
        )}
      </View>

      {missing.length === 0 ? null : (
        <View style={styles.notice}>
          <Text tone="danger" variant="meta">
            {t('story.editor.missingAsset')}
          </Text>
        </View>
      )}

      <ScrollView
        contentContainerStyle={styles.filmstrip}
        horizontal
        keyboardShouldPersistTaps="handled"
        showsHorizontalScrollIndicator={false}
      >
        {plans.map((plan) => (
          <Chip
            key={plan.index}
            label={String(plan.index + 1)}
            onPress={() => useStoryEditorStore.getState().setActiveSlide(plan.index)}
            tone={plan.index === activeSlide ? 'selected' : 'default'}
          />
        ))}
        <Chip
          label={overview ? t('story.editor.single') : t('story.editor.overview')}
          onPress={() => useStoryEditorStore.getState().toggleOverview()}
          tone="info"
        />
      </ScrollView>

      <ScrollView
        contentContainerStyle={styles.dock}
        horizontal
        keyboardShouldPersistTaps="handled"
        showsHorizontalScrollIndicator={false}
      >
        <Chip
          label={t('story.editor.addText')}
          onPress={() =>
            add('text', (current) =>
              addTextElement(current, Crypto.randomUUID(), activeSlide, now(), skin.ui.bg.base),
            )
          }
          tone="add"
        />
        <Chip
          label={t('story.editor.addPalette')}
          onPress={() =>
            add('paletteStrip', (current) =>
              addPaletteStrip(current, Crypto.randomUUID(), activeSlide, now(), [
                skin.ui.bg.base,
                skin.ui.text.primary,
              ]),
            )
          }
          tone="add"
        />
        <Chip label={t('story.compose.run')} onPress={suggest} tone="add" />
        <Chip label={t('story.remix.save')} onPress={saveRecipe} />
        <Chip
          label={t('story.template.title')}
          onPress={() => setShowTemplates((open) => !open)}
          tone={showTemplates ? 'selected' : 'default'}
        />
        <Chip
          label={t('story.layer.panel')}
          onPress={() => setShowLayers((open) => !open)}
          tone={showLayers ? 'selected' : 'default'}
        />
        {canUndo ? <Chip label={t('story.editor.undo')} onPress={undo} /> : null}
        {canRedo ? <Chip label={t('story.editor.redo')} onPress={redo} /> : null}
      </ScrollView>

      {showTemplates ? (
        <TemplatePicker
          onApply={useTemplate}
          onLocked={() => router.push({ pathname: '/paywall', params: { trigger: 'template' } })}
          project={project}
        />
      ) : null}

      {templateKept === null || templateKept === 0 ? null : (
        <View style={styles.notice}>
          <Text tone="secondary" variant="meta">
            {t('story.template.kept', { count: templateKept })}
          </Text>
        </View>
      )}

      {recipeSaved ? (
        <View style={styles.notice}>
          <Text tone="secondary" variant="meta">
            {t('story.remix.saved')}
          </Text>
          {/* Said where the action is, not in a settings screen. */}
          <Text tone="secondary" variant="meta">
            {t('story.remix.carries')}
          </Text>
        </View>
      ) : null}

      <ComposePanel
        onApply={applyProposal}
        onDiscard={() => setProposal(null)}
        proposal={proposal}
        rejectedCount={rejectedCount}
      />

      {showLayers ? (
        <LayerPanel
          layers={project.layers}
          onMove={(id, toIndex) => act((current) => reorderElement(current, id, toIndex, now()))}
          onSelect={(id) => {
            setGuides([]);
            useStoryEditorStore.getState().select(id);
          }}
          onToggleHidden={(id, hidden) =>
            act((current) => setElementHidden(current, id, hidden, now()))
          }
          onToggleLocked={(id, locked) =>
            act((current) => setElementLocked(current, id, locked, now()))
          }
          selectedId={selectedId}
        />
      ) : null}

      {selected?.kind !== 'paletteStrip' ? null : (
        <ScrollView
          contentContainerStyle={styles.dock}
          horizontal
          keyboardShouldPersistTaps="handled"
          showsHorizontalScrollIndicator={false}
        >
          {/* "Still" is a first-class choice, not the absence of one — which is
              why it is a chip beside the presets rather than a toggle elsewhere. */}
          <Chip
            label={t('story.living.still')}
            onPress={() =>
              act((current) =>
                mapElement(
                  current,
                  selected.id,
                  (element) =>
                    element.kind === 'paletteStrip' ? { ...element, animation: null } : element,
                  now(),
                ),
              )
            }
            tone={selected.animation === null ? 'selected' : 'default'}
          />
          {livingPalettePresets.map((preset) => (
            <Chip
              key={preset}
              label={t(`story.living.${preset}`)}
              onPress={() =>
                act((current) =>
                  mapElement(
                    current,
                    selected.id,
                    (element) =>
                      element.kind === 'paletteStrip'
                        ? { ...element, animation: livingPaletteConfig(preset) }
                        : element,
                    now(),
                  ),
                )
              }
              tone={selected.animation?.preset === preset ? 'selected' : 'default'}
            />
          ))}
        </ScrollView>
      )}

      {reduceMotion && animatedConfig !== null ? (
        <View style={styles.notice}>
          <Text tone="secondary" variant="meta">
            {t('story.living.reduced')}
          </Text>
        </View>
      ) : null}

      {selected === null ? null : (
        <View style={styles.selectionBar}>
          <Text tone="secondary" variant="meta">
            {describeElement(selected)}
          </Text>
          <View style={styles.selectionActions}>
            <Chip
              label={selected.locked ? t('story.editor.unlock') : t('story.editor.lock')}
              onPress={() =>
                act((current) => setElementLocked(current, selected.id, !selected.locked, now()))
              }
            />
            <Chip
              label={t('story.editor.duplicate')}
              onPress={() =>
                act((current) =>
                  duplicateElementIn(current, selected.id, Crypto.randomUUID(), 40, now()),
                )
              }
            />
            <Chip
              label={t('story.editor.delete')}
              onPress={() => {
                act((current) => removeElement(current, selected.id, now()));
                useStoryEditorStore.getState().select(null);
                AccessibilityInfo.announceForAccessibility(t('story.a11y.deselected'));
              }}
              tone="danger"
            />
          </View>
        </View>
      )}

      {project.layers.length === 0 ? (
        <View style={styles.body}>
          <Text tone="secondary" variant="body">
            {t('story.editor.empty')}
          </Text>
        </View>
      ) : null}

      <View style={styles.footer}>
        <Button label={t('story.editor.preview')} onPress={onPreview} />
      </View>
    </Screen>
  );
}

const makeStyles = (skin: Skin) =>
  StyleSheet.create({
    body: {
      gap: space.sm,
      paddingHorizontal: space.gutter,
      paddingVertical: space.md,
    },
    statusRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: space.gutter,
      paddingVertical: space.xs,
    },
    canvasWrap: {
      alignItems: 'center',
      paddingHorizontal: space.gutter,
    },
    notice: {
      paddingHorizontal: space.gutter,
      paddingTop: space.xs,
    },
    filmstrip: {
      gap: space.xs,
      paddingHorizontal: space.gutter,
      paddingVertical: space.sm,
    },
    dock: {
      gap: space.xs,
      paddingHorizontal: space.gutter,
      borderTopWidth: skin.chrome.rules ? StyleSheet.hairlineWidth : 0,
      borderTopColor: skin.ui.border.hairline,
      paddingVertical: space.sm,
    },
    selectionBar: {
      gap: space.xs,
      paddingHorizontal: space.gutter,
      paddingBottom: space.sm,
    },
    selectionActions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: space.xs,
    },
    footer: {
      paddingHorizontal: space.gutter,
      paddingBottom: space.md,
    },
  });
