import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { examineText } from '../../src/content/examine';
import { activeInteractables, allInteractables } from '../../src/content/region';
import { explorationAssets } from '../../src/content/inventories';
import { AssetLibrary } from '../../src/scene/assets';
import { Actor } from '../../src/scene/actors/actor';
import { GalileeActivity } from '../../src/scene/actors/galilee';
import { LifeActivity } from '../../src/scene/actors/life';
import { importSave, makeSave } from '../../src/persistence/schema';
import { roadStart } from '../helpers/road';
import { galileeAction, connectSpring } from '../helpers/galilee';

vi.mock('@babylonjs/core/Loading/sceneLoader', async (original) => {
  const actual = await original<typeof import('@babylonjs/core/Loading/sceneLoader')>();
  return {
    ...actual,
    LoadAssetContainerAsync: (
      source: string,
      scene: Scene,
      options?: import('@babylonjs/core/Loading/sceneLoader').LoadAssetContainerOptions,
    ) =>
      actual.LoadAssetContainerAsync(
        new Uint8Array(readFileSync('public/assets/models/' + source.split('/').at(-1))),
        scene,
        { ...options, pluginExtension: '.glb' },
      ),
  };
});

function earnedStages() {
  const initial = roadStart();
  let inspected = initial;
  for (const id of ['spring-start', 'spring-note-source', 'spring-note-basins'])
    inspected = galileeAction(inspected, id);
  const held = galileeAction(inspected, 'spring-borrow');
  const returned = galileeAction(held, 'spring-return');
  const reborrowed = galileeAction(returned, 'spring-borrow');
  const inletClear = galileeAction(reborrowed, 'spring-clear-inlet');
  const bothClear = galileeAction(inletClear, 'spring-clear-silt');
  const prepared = galileeAction(bothClear, 'spring-return');
  const complete = galileeAction(connectSpring(prepared), 'spring-finish-patience');
  return {
    initial,
    inspected,
    held,
    returned,
    reborrowed,
    inletClear,
    bothClear,
    prepared,
    complete,
  };
}

let engine: NullEngine | undefined;
afterEach(() => engine?.dispose());

describe('scoop Examine follows the earned physical location', () => {
  for (const [stage, earned] of Object.entries(earnedStages())) {
    it(`observes ${stage} without changing any saved progress or other descriptions`, () => {
      const state = importSave(JSON.stringify(makeSave(earned))).state;
      const before = structuredClone(state);
      const rack = activeInteractables(state).find((place) => place.id === 'spring-tools')!;
      const text = examineText(rack, state);
      if (state.campaign.carrying === 'channel-scoop') {
        expect(text).toBe(
          'The scoop rack: The low rack is empty. The wooden scoop is in your hands.',
        );
        expect(text).not.toContain('lies on');
      } else {
        expect(text).toBe('The scoop rack: A wooden scoop lies on a low rack beside the channel.');
        expect(text).toBe(examineText(rack));
        expect(text).not.toContain('empty');
      }
      expect(text).not.toContain('hanging');
      if (stage === 'complete') expect(state.galilee.spring.stage).toBe('complete');
      for (const other of allInteractables.filter((place) => place.id !== 'spring-tools'))
        expect(examineText(other, state)).toBe(examineText(other));
      expect(state).toEqual(before);
    });
  }

  it('agrees with the actual shipped rack, stored scoop and held scoop through every earned stage', async () => {
    engine = new NullEngine();
    engine.getCaps().maxVertexUniformVectors = 1024;
    const scene = new Scene(engine);
    const library = new AssetLibrary(scene);
    await library.load(explorationAssets('galilean-road'), () => {});
    const player = new Actor(library.instantiate('traveler', 'scoop-observer'));
    const galilee = new GalileeActivity(library, scene, 'galilean-road');
    const life = new LifeActivity(library, player, 'galilean-road');
    for (const [stage, earned] of Object.entries(earnedStages())) {
      const state = importSave(JSON.stringify(makeSave(earned))).state;
      const before = structuredClone(state);
      galilee.update(state);
      life.update(state);
      const rack = scene.getTransformNodeByName('galilee-rack')!;
      const stored = scene.getTransformNodeByName('galilee-scoop')!;
      const held = scene.getTransformNodeByName('held-channel-scoop')!;
      const inHands = state.campaign.carrying === 'channel-scoop';
      expect(rack.isEnabled(), stage + ' rack').toBe(true);
      expect(stored.isEnabled(), stage + ' stored scoop').toBe(!inHands);
      expect(held.isEnabled(), stage + ' held scoop').toBe(inHands);
      for (const model of [rack, stored, held])
        expect(model.getChildMeshes().some((mesh) => mesh.getTotalVertices() > 0)).toBe(true);
      for (const model of [rack, stored])
        expect(
          model
            .getChildMeshes()
            .filter((mesh) => mesh.getTotalVertices() > 0)
            .every((mesh) => mesh.metadata?.interactionId === 'spring-tools' && mesh.isPickable),
        ).toBe(true);
      const place = activeInteractables(state).find((place) => place.id === 'spring-tools')!;
      expect(examineText(place, state).includes('rack is empty')).toBe(inHands);
      expect(state).toEqual(before);
    }
  });
});
