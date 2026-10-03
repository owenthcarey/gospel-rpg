import { expect, it, vi } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { AssetLibrary } from '../../src/scene/assets';
import { Actor } from '../../src/scene/actors/actor';
import type { StationaryFeet } from '../../src/scene/actors/stationary-feet';

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
interface HelperInspection extends Pick<
  StationaryFeet,
  'continuation' | 'apply' | 'restoreSampledPose'
> {
  ground?: unknown;
  displayed?: unknown;
  sampled?: unknown;
  source?: unknown;
  clearances?: unknown;
  model?: unknown;
  nodes: unknown[];
  rest: unknown[];
  continuations: Set<() => void>;
  sceneObserver?: unknown;
  restoreRootDispose?: unknown;
}
interface NpcInspection {
  ground?: unknown;
  released?: unknown;
  root?: unknown;
  visual?: unknown;
  sceneObserver?: unknown;
  restoreRootDispose?: unknown;
  sandals: unknown[];
  matrices: Map<unknown, unknown>;
}
const observations: unknown[] = [];
it.each([
  ['actor', false],
  ['root', false],
  ['scene', false],
  ['actor', true],
  ['root', true],
  ['scene', true],
] as const)(
  'releases retained support before direct %s disposal with combined NPC helper=%s',
  async (target, combined) => {
    const engine = new NullEngine();
    engine.getCaps().maxVertexUniformVectors = 1024;
    const scene = new Scene(engine);
    const library = new AssetLibrary(scene);
    let actor: Actor | undefined;
    try {
      await library.load(['traveler'], () => {});
      const model = library.instantiate('traveler', 'disposal-proof');
      const originalDispose = model.root.dispose;
      const originalDescriptor = Object.getOwnPropertyDescriptor(model.root, 'dispose');
      const ground = vi.fn(() => 0);
      actor = new Actor(model, true, {
        stationaryFeet: true,
        locomotionClearance: combined ? { ground } : undefined,
      });
      actor.sample('Carry', 0.3);
      actor.supportFeet({ stationary: false, dt: 0.3, ground });
      actor.sample('Carry', 0, true);
      actor.supportFeet({ stationary: true, dt: 0, frozen: true, ground });
      expect(actor.hasFootSupport).toBe(true);
      const owned = actor as unknown as {
        stationaryFeet: HelperInspection;
        locomotionClearance?: NpcInspection;
      };
      const helper = owned.stationaryFeet;
      const npc = owned.locomotionClearance;
      expect(Boolean(npc)).toBe(combined);
      const actorScope = actor.footSupportContinuation()!;
      const helperScope = helper.continuation()!;
      expect(actorScope).toBeDefined();
      expect(helperScope).toBeDefined();
      const reads = vi.spyOn(actor, 'hasFootSupport', 'get');
      const compose = vi.spyOn(helper, 'apply');
      const restore = vi.spyOn(helper, 'restoreSampledPose');
      const meshes = actor.root.getChildMeshes();
      let observed = 0;
      for (const mesh of meshes)
        mesh.onDisposeObservable.add(() => {
          observed++;
          const actorResult = actorScope.step(0.1);
          const helperResult = helperScope.step(0.1);
          expect(actorResult).toBe(false);
          expect(helperResult).toBe(false);
          expect(ground).not.toHaveBeenCalled();
          expect(compose).not.toHaveBeenCalled();
          expect(restore).not.toHaveBeenCalled();
          // The helper's release notification has already removed the outer Actor owner.
          expect(reads).not.toHaveBeenCalled();
          expect(helper.ground).toBeUndefined();
          expect(helper.clearances).toBeUndefined();
          expect(helper.model).toBeUndefined();
          expect(helper.displayed).toBeUndefined();
          if (npc) {
            expect(npc.ground).toBeUndefined();
            expect(npc.released).toBeUndefined();
            expect(npc.root).toBeUndefined();
            expect(npc.visual).toBeUndefined();
          }
          observations.push({
            target,
            combined,
            mesh: mesh.name,
            actorResult,
            helperResult,
            rootDisposed: model.root.isDisposed(),
            sceneDisposed: scene.isDisposed,
            floorQueries: ground.mock.calls.length,
            compatibilityReads: reads.mock.calls.length,
          });
        });
      ground.mockClear();
      if (target === 'actor') actor.dispose();
      else if (target === 'root') actor.root.dispose();
      else scene.dispose();
      expect(observed).toBe(meshes.length);
      expect(actorScope.step(0.1)).toBe(false);
      expect(helperScope.step(0.1)).toBe(false);
      expect(ground).not.toHaveBeenCalled();
      expect(compose).not.toHaveBeenCalled();
      expect(restore).not.toHaveBeenCalled();
      expect(reads).not.toHaveBeenCalled();
      expect(helper.ground).toBeUndefined();
      expect(helper.displayed).toBeUndefined();
      expect(helper.sampled).toBeUndefined();
      expect(helper.source).toBeUndefined();
      expect(helper.clearances).toBeUndefined();
      expect(helper.model).toBeUndefined();
      expect(helper.nodes).toEqual([]);
      expect(helper.rest).toEqual([]);
      expect(helper.continuations.size).toBe(0);
      expect(helper.sceneObserver).toBeUndefined();
      expect(helper.restoreRootDispose).toBeUndefined();
      if (npc) {
        expect(owned.locomotionClearance).toBeUndefined();
        expect(npc.sceneObserver).toBeUndefined();
        expect(npc.restoreRootDispose).toBeUndefined();
        expect(npc.sandals).toEqual([]);
        expect(npc.matrices.size).toBe(0);
      }
      // Nested early-disposal wrappers return ownership to the original method/descriptor.
      expect(model.root.dispose).toBe(originalDispose);
      expect(Object.getOwnPropertyDescriptor(model.root, 'dispose')).toEqual(originalDescriptor);
      expect(helper.continuation()).toBeUndefined();
      expect(actor.footSupportContinuation()).toBeUndefined();
      expect(actor.hasFootSupport).toBe(false);
      actorScope.release();
      helperScope.release();
    } finally {
      actor?.dispose();
      library.dispose();
      scene.dispose();
      engine.dispose();
      if (process.env.FOOT_DISPOSAL_REPORT)
        writeFileSync(process.env.FOOT_DISPOSAL_REPORT, JSON.stringify(observations, null, 2));
    }
  },
);
